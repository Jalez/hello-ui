import { PageContainer } from "@/components/scriba/ui/PageContainer";
import { GameHelpContent } from "@/components/Help/GameHelpContent";

export default function GameHelpPage() {
  return (
    <PageContainer className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto py-10 px-4 space-y-6">
        <GameHelpContent />
      </div>
    </PageContainer>
  );
}
