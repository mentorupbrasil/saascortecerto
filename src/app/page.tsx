import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function HomeRedirect() {
  const session = await getServerSession(authOptions);
  if (session) {
    if (session.user.role === "SUPER_ADMIN" && !session.user.tenantId) {
      redirect("/admin");
    }
    redirect("/dashboard");
  }
  redirect("/login");
}
