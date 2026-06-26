import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fileToDataUrl } from "@/lib/upload";

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

  try {
    const photoUrl = await fileToDataUrl(file);

    await prisma.client.update({
      where: { id: clientId },
      data: { photoUrl },
    });

    return NextResponse.json({ success: true, photoUrl });
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

  const { clientId } = await req.json();
  if (!clientId) {
    return NextResponse.json({ error: "clientId obrigatório" }, { status: 400 });
  }

  await prisma.client.updateMany({
    where: { id: clientId, tenantId: session.user.tenantId },
    data: { photoUrl: null },
  });

  return NextResponse.json({ success: true });
}
