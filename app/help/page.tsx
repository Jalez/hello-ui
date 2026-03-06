import { PageContainer } from "@/components/scriba/ui/PageContainer";
import { CreatorHelpContent } from "@/components/Help/CreatorHelpContent";

export default function HelpPage() {
  return (
    <PageContainer className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto py-10 px-4 space-y-6">
        <CreatorHelpContent />
      </div>
    </PageContainer>
  );
}
