import type { UserRole } from "@/lib/auth-utils";

declare module "next-auth" {
  interface User {
    role: UserRole;
    tenantId: string | null;
    tenantName: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      tenantId: string | null;
      tenantName: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    tenantId: string | null;
    tenantName: string | null;
  }
}
