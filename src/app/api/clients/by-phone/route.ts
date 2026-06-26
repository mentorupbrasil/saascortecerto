import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const phone = req.nextUrl.searchParams.get("phone")?.replace(/\D/g, "");
  if (!phone) {
    return NextResponse.json({ error: "phone obrigatório" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({
    where: {
      tenantId_phone: { tenantId: session.user.tenantId, phone },
    },
    select: { id: true },
  });

  if (!client) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  return NextResponse.json(client);
}
