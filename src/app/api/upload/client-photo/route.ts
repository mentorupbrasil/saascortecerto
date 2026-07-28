import { NextRequest, NextResponse } from "next/server";
import { requirePermission, requireTenantUser, AuthError } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { storeClientPhoto, deleteClientPhoto } from "@/lib/storage";
import { ALLOWED_CONTENT_TYPES } from "@/lib/storage/constants";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const MAX_PHOTO_BYTES = 500 * 1024;
const GENERIC_ERROR = "Não foi possível concluir o upload. Tente novamente.";

export async function POST(req: NextRequest) {
  let tenantId: string;
  let userId: string;
  try {
    const user = await requireTenantUser();
    await requirePermission("clients:manage");
    tenantId = user.tenantId;
    userId = user.id;
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === "FORBIDDEN" ? 403 : 401;
      return NextResponse.json({ error: err.message }, { status });
    }
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("photo") as File | null;
  const clientId = formData.get("clientId") as string | null;

  if (!file || !clientId) {
    return NextResponse.json({ error: "Foto e clientId obrigatórios" }, { status: 400 });
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId },
    select: { id: true },
  });

  if (!client) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Formato inválido. Use JPG, PNG ou WebP." },
      { status: 400 }
    );
  }

  if (file.size > MAX_PHOTO_BYTES) {
    return NextResponse.json(
      { error: `Foto muito grande. Máximo ${MAX_PHOTO_BYTES / 1024}KB.` },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeClientPhoto(tenantId, clientId, buffer, file.type);

    await prisma.client.update({
      where: { id: clientId },
      data: { photoUrl: stored.url },
    });

    await writeAuditLog({
      tenantId,
      actorUserId: userId,
      action: "client.photo_uploaded",
      entityType: "Client",
      entityId: clientId,
    });

    return NextResponse.json({ success: true, photoUrl: stored.url });
  } catch (err) {
    logger.error("client_photo_upload_failed", {
      tenantId,
      userId,
      action: "client.photo_uploaded",
      entity: "Client",
      entityId: clientId,
      result: "failure",
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  let tenantId: string;
  let userId: string;
  try {
    const user = await requireTenantUser();
    await requirePermission("clients:manage");
    tenantId = user.tenantId;
    userId = user.id;
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === "FORBIDDEN" ? 403 : 401;
      return NextResponse.json({ error: err.message }, { status });
    }
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const clientId = body?.clientId as string | undefined;
  if (!clientId) {
    return NextResponse.json({ error: "clientId obrigatório" }, { status: 400 });
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId },
    select: { photoUrl: true },
  });

  if (!client) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  try {
    if (client.photoUrl) {
      await deleteClientPhoto(tenantId, clientId, client.photoUrl);
    }

    await prisma.client.updateMany({
      where: { id: clientId, tenantId },
      data: { photoUrl: null },
    });

    await writeAuditLog({
      tenantId,
      actorUserId: userId,
      action: "client.photo_removed",
      entityType: "Client",
      entityId: clientId,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("client_photo_remove_failed", {
      tenantId,
      userId,
      action: "client.photo_removed",
      entity: "Client",
      entityId: clientId,
      result: "failure",
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
}
