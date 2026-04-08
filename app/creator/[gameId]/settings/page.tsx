import { redirect } from "next/navigation";

interface CreatorSettingsIndexPageProps {
  params: Promise<{
    gameId: string;
  }>;
}

export default async function CreatorSettingsIndexPage({ params }: CreatorSettingsIndexPageProps) {
  const { gameId } = await params;
  redirect(`/creator/${gameId}/settings/basics`);
}
