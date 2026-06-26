import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LandingPage } from "@/components/marketing/landing-page";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session) {
    if (session.user.role === "SUPER_ADMIN" && !session.user.tenantId) {
      redirect("/admin");
    }
    redirect("/dashboard");
  }

  return <LandingPage />;
}
