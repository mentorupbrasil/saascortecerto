import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const TENANT_APP_PATHS = [
  "/dashboard",
  "/agenda",
  "/clientes",
  "/clube",
  "/whatsapp",
  "/servicos",
  "/equipe",
  "/faturamento",
  "/lista-espera",
  "/relatorios",
  "/financeiro",
  "/caixa",
  "/comandas",
  "/estoque",
  "/comissoes",
];

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    if (token?.role === "SUPER_ADMIN" && !token.tenantId) {
      if (TENANT_APP_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
    }

    if (path.startsWith("/faturamento") && token?.role === "BARBER") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    if (path.startsWith("/faturamento") && token?.role === "RECEPTIONIST") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    if (path.startsWith("/relatorios") && token?.role === "BARBER") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    if (path.startsWith("/relatorios") && token?.role === "RECEPTIONIST") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    if (path.startsWith("/admin") && token?.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    if (
      path.startsWith("/equipe") &&
      !["SUPER_ADMIN", "OWNER", "MANAGER"].includes(token?.role as string)
    ) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Waitlist offer confirmation is a public link sent via WhatsApp — no login required.
      authorized: ({ token, req }) =>
        req.nextUrl.pathname.startsWith("/lista-espera/confirmar") ? true : !!token,
    },
  }
);

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/agenda",
    "/agenda/:path*",
    "/lista-espera",
    "/lista-espera/:path*",
    "/relatorios",
    "/relatorios/:path*",
    "/clientes",
    "/clientes/:path*",
    "/clube",
    "/clube/:path*",
    "/whatsapp",
    "/whatsapp/:path*",
    "/servicos",
    "/servicos/:path*",
    "/equipe",
    "/equipe/:path*",
    "/faturamento",
    "/faturamento/:path*",
    "/financeiro",
    "/financeiro/:path*",
    "/caixa",
    "/caixa/:path*",
    "/comandas",
    "/comandas/:path*",
    "/estoque",
    "/estoque/:path*",
    "/comissoes",
    "/comissoes/:path*",
    "/conta-bloqueada",
    "/admin",
    "/admin/:path*",
  ],
};
