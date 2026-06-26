import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    if (token?.role === "SUPER_ADMIN" && !token.tenantId) {
      if (
        path === "/dashboard" ||
        path.startsWith("/agenda") ||
        path.startsWith("/clientes") ||
        path.startsWith("/clube") ||
        path.startsWith("/whatsapp") ||
        path.startsWith("/servicos") ||
        path.startsWith("/equipe")
      ) {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
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
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/agenda/:path*",
    "/clientes/:path*",
    "/clube/:path*",
    "/whatsapp/:path*",
    "/servicos/:path*",
    "/equipe/:path*",
    "/admin/:path*",
  ],
};
