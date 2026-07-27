import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storeClientPhoto, deleteClientPhoto } from "@/lib/storage";
import { ALLOWED_CONTENT_TYPES } from "@/lib/storage/constants";

const MAX_PHOTO_BYTES = 500 * 1024;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const formData = await req.formData();
  const file = formData.get("photo") as File | null;
  const clientId = formData.get("clientId") as string | null;

  if (!file || !clientId) {
    return NextResponse.json({ error: "Foto e clientId obrigatórios" }, { status: 400 });
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId },
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
      { error: "Foto muito grande. Máximo 500KB. Migre para object storage para arquivos maiores." },
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

    return NextResponse.json({ success: true, photoUrl: stored.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro no upload" },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const { clientId } = await req.json();
  if (!clientId) {
    return NextResponse.json({ error: "clientId obrigatório" }, { status: 400 });
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId },
    select: { photoUrl: true },
  });

  if (client?.photoUrl) {
    await deleteClientPhoto(tenantId, clientId, client.photoUrl);
  }

  await prisma.client.updateMany({
    where: { id: clientId, tenantId },
    data: { photoUrl: null },
  });

  return NextResponse.json({ success: true });
}
