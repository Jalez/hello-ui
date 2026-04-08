import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getServerSession } from "next-auth/next";
import { ArrowLeft } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getGameById, listCollaborators } from "@/app/api/_lib/services/gameService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreatorGameSettingsLayout } from "@/components/creator-settings/CreatorGameSettingsLayout";

interface CreatorGameSettingsRouteLayoutProps {
  children: ReactNode;
  params: Promise<{
    gameId: string;
  }>;
}

export default async function CreatorGameSettingsRouteLayout({
  children,
  params,
}: CreatorGameSettingsRouteLayoutProps) {
  const { gameId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/auth/signin");
  }

  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost || requestHeaders.get("host") || "localhost:3000";
  const protocol = forwardedProto || (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  const actorIdentifiers = [session.userId, session.user.email].filter(Boolean) as string[];
  const game = await getGameById(gameId, actorIdentifiers);

  if (!game) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Game Settings</CardTitle>
            <CardDescription>Game not found.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href={`/creator/${gameId}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Creator
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!game.can_edit) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Game Settings</CardTitle>
            <CardDescription>You do not have permission to edit this game's settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href={`/creator/${gameId}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Creator
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const collaborators = game.can_manage_collaborators ? await listCollaborators(gameId) : [];
  const initialScrollTop = Number(cookieStore.get(`creator-settings-scroll-${gameId}`)?.value ?? "0");

  return (
    <CreatorGameSettingsLayout
      gameId={gameId}
      initialScrollTop={Number.isFinite(initialScrollTop) ? Math.max(0, initialScrollTop) : 0}
      initialData={{
        origin,
        game: {
          id: game.id,
          title: game.title,
          description: game.description,
          isPublic: game.is_public,
          collaborationMode: game.collaboration_mode,
          allowDuplicateUsers: game.allow_duplicate_users,
          thumbnailUrl: game.thumbnail_url,
          hideSidebar: game.hide_sidebar,
          accessWindowEnabled: game.access_window_enabled,
          accessStartsAt: game.access_starts_at ? game.access_starts_at.toISOString() : null,
          accessEndsAt: game.access_ends_at ? game.access_ends_at.toISOString() : null,
          accessWindowTimezone: game.access_window_timezone,
          accessWindows: game.access_windows,
          accessKeyRequired: game.access_key_required,
          accessKey: game.access_key,
          drawboardCaptureMode: game.drawboard_capture_mode,
          manualDrawboardCapture: game.manual_drawboard_capture,
          remoteSyncDebounceMs: game.remote_sync_debounce_ms,
          drawboardReloadDebounceMs: game.drawboard_reload_debounce_ms,
          instancePurgeCadence: game.instance_purge_cadence,
          instancePurgeTimezone: game.instance_purge_timezone,
          instancePurgeHour: game.instance_purge_hour,
          instancePurgeMinute: game.instance_purge_minute,
          instancePurgeWeekday: game.instance_purge_weekday,
          instancePurgeDayOfMonth: game.instance_purge_day_of_month,
          canEdit: Boolean(game.can_edit),
          isOwner: Boolean(game.is_owner),
          canManageCollaborators: Boolean(game.can_manage_collaborators),
          canRemoveCollaborators: Boolean(game.can_remove_collaborators),
        },
        collaborators: collaborators.map((collaborator) => ({
          user_id: collaborator.user_id,
          added_by: collaborator.added_by,
          created_at:
            collaborator.created_at instanceof Date
              ? collaborator.created_at.toISOString()
              : String(collaborator.created_at),
        })),
        canEdit: Boolean(game.can_edit),
        canManageCollaborators: Boolean(game.can_manage_collaborators),
        canRemoveCollaborators: Boolean(game.can_remove_collaborators),
      }}
    >
      {children}
    </CreatorGameSettingsLayout>
  );
}
