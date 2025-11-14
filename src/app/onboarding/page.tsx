import { SessionControls } from "@/components/SessionControls";
import { requireServerAuthSession } from "@/lib/auth/server";

import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  await requireServerAuthSession({ redirectTo: "/" });
  return (
    <>
      <SessionControls />
      <OnboardingWizard />
    </>
  );
}
