import { SignupPageClient } from "@/components/marketing/signup-form";
import type { PlanBilling } from "@/lib/plan-pricing";

export default async function AssinarPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; billing?: string }>;
}) {
  const params = await searchParams;
  const plan = params.plan === "CLUBE" ? "CLUBE" : "PRO";
  const billing: PlanBilling = params.billing === "yearly" ? "yearly" : "monthly";

  return <SignupPageClient defaultPlan={plan} defaultBilling={billing} />;
}
