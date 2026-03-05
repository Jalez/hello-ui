import { AiProviderSettingsSection } from "@/components/default/account/AiProviderSettingsSection";
import { AiPromptSettingsSection } from "@/components/default/account/AiPromptSettingsSection";

export default function AccountGenerationPage() {
  return (
    <section className="space-y-4">
      <AiProviderSettingsSection />
      <AiPromptSettingsSection />
    </section>
  );
}
