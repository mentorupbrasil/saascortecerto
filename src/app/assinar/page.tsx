import { SignupPageClient } from "@/components/marketing/signup-form";

export default async function AssinarPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const params = await searchParams;
  const plan = params.plan === "CLUBE" ? "CLUBE" : "PRO";

  return <SignupPageClient defaultPlan={plan} />;
}
