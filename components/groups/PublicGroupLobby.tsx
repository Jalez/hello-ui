'use client';

import { useMemo, useState } from "react";
import { useCollaboration } from "@/lib/collaboration";
import { Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildAvatarFallbacks } from "./PresenceStack";
import { GroupTab } from "./GroupTab";
import { LobbyChatSection } from "./LobbyChatSection";
import { CollaborationProvider } from "@/lib/collaboration";
import type { UserIdentity } from "@/lib/collaboration/types";

interface PublicGroupLobbyProps {
  gameId: string;
  groupId: string | null;
  gameTitle: string;
  courseName: string | null;
  currentUser: UserIdentity;
  onGroupSelect: (groupId: string | null) => void | Promise<void>;
  onSkipWaiting?: () => void;
  canSkipWaiting?: boolean;
  lmsGroupPicker?: {
    open: boolean;
    loading: boolean;
    groups: Array<{
      id: string;
      memberNames: string[];
      timestamp: string | null;
    }>;
    error: string | null;
    onOpenChange: (open: boolean) => void;
    onSelect: (groupId: string) => void | Promise<void>;
  };
}

export function PublicGroupLobby({
  gameId,
  groupId,
  gameTitle,
  courseName,
  currentUser,
  onGroupSelect,
  onSkipWaiting,
  canSkipWaiting = false,
  lmsGroupPicker,
}: PublicGroupLobbyProps) {
  const lobbyCollaboration = useCollaboration();
  const [chatMode, setChatMode] = useState<"lobby" | "group">("lobby");
  const effectiveCurrentUser = lobbyCollaboration.effectiveIdentity ?? currentUser;

  const connectedUsersLobby = useMemo(() => {
    const presenceByKey = new Map<
      string,
      {
        userId?: string;
        accountUserId?: string;
        userEmail?: string;
        accountUserEmail?: string;
        userName?: string;
        userImage?: string;
        color?: string;
        clientId?: string;
      }
    >();
    const avatarFallbacks = buildAvatarFallbacks([
      {
        userId: effectiveCurrentUser.id,
        accountUserId: effectiveCurrentUser.id,
        userEmail: effectiveCurrentUser.email,
        accountUserEmail: effectiveCurrentUser.email,
        userName: effectiveCurrentUser.name,
        userImage: effectiveCurrentUser.image,
      },
      ...lobbyCollaboration.activeUsers,
    ]);

    for (const entry of [
      {
        userId: effectiveCurrentUser.id,
        accountUserId: effectiveCurrentUser.id,
        userEmail: effectiveCurrentUser.email,
        accountUserEmail: effectiveCurrentUser.email,
        userName: effectiveCurrentUser.name,
        userImage: effectiveCurrentUser.image,
        clientId: "self",
      },
      ...lobbyCollaboration.activeUsers,
    ]) {
      const email = entry.accountUserEmail || entry.userEmail;
      const key = email?.toLowerCase() || entry.userId || entry.clientId;
      if (!key || presenceByKey.has(key)) continue;

      const fallback = (entry.accountUserId ? avatarFallbacks.byUserId.get(entry.accountUserId) : undefined)
        ?? (email ? avatarFallbacks.byEmail.get(email.toLowerCase()) : undefined);

      presenceByKey.set(key, {
        ...entry,
        userName: entry.userName || fallback?.userName || undefined,
        userImage: entry.userImage || fallback?.userImage || undefined,
      });
    }

    return Array.from(presenceByKey.values());
  }, [lobbyCollaboration.activeUsers, effectiveCurrentUser.email, effectiveCurrentUser.id, effectiveCurrentUser.image, effectiveCurrentUser.name]);

  const groupRoomId = groupId ? `group:${groupId}:game:${gameId}` : null;

  return (
    <div className="flex h-full items-center justify-center px-4 py-8 overflow-y-auto">
      <Dialog open={Boolean(lmsGroupPicker?.open)} onOpenChange={(open) => lmsGroupPicker?.onOpenChange(open)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Select LMS Group</DialogTitle>
            <DialogDescription>
              Choose the course group you want to open in this game lobby.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {lmsGroupPicker?.groups.length ? (
              lmsGroupPicker.groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                  onClick={() => lmsGroupPicker.onSelect(group.id)}
                >
                  <p className="font-medium">A+ Group {group.id}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {group.memberNames.length
                      ? group.memberNames.join(", ")
                      : "No member names available"}
                  </p>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No LMS groups were available for this user.
              </p>
            )}
            {lmsGroupPicker?.error ? (
              <p className="text-sm text-destructive">{lmsGroupPicker.error}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => lmsGroupPicker?.onOpenChange(false)}>
              Continue Manually
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="w-full max-w-5xl rounded-xl border bg-card p-5 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Public Group Lobby</p>
          <h1 className="text-2xl font-bold">{gameTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {courseName ? `Course: ${courseName}` : `Game: ${gameId}`}
          </p>
        </div>

        <div className="mt-5 rounded-lg border p-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><strong className="text-foreground">1.</strong> Create an app group or pick an existing one.</p>
            <p><strong className="text-foreground">2.</strong> Ask your teammates to join the same group.</p>
            <p><strong className="text-foreground">3.</strong> Enter the group waiting room and start together.</p>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            This temporary lobby and its chat disappear automatically when everyone leaves.
          </p>
        </div>

        {/*
          A single Tabs tree is always rendered to prevent layout jitter when a group is
          selected or deselected. One CollaborationProvider for the group room wraps both
          tab contents so GroupWaitingRoom and Group Chat share the same connection — no
          double-connect and no reconnect when toggling between Lobby/Group chat.
          The provider handles null roomId gracefully (stays disconnected) until a group
          is selected.
        */}
        <Tabs defaultValue="group" className="mt-6 min-h-[550px]">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="group">Group tab</TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-2">
              Chat tab
              <div className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium transition-colors group-data-[state=active]:bg-primary group-data-[state=active]:text-primary-foreground">
                <Users className="h-3 w-3" />
                <span>{connectedUsersLobby.length}</span>
              </div>
            </TabsTrigger>
          </TabsList>

          <CollaborationProvider roomId={groupRoomId} groupId={groupId || null} user={currentUser}>
            <TabsContent value="group" className="mt-4 min-h-[400px]">
              <GroupTab
                gameId={gameId}
                gameTitle={gameTitle}
                courseName={courseName}
                currentUser={currentUser}
                selectedGroupId={groupId}
                onGroupSelect={onGroupSelect}
                onSkipWaiting={onSkipWaiting}
                canSkipWaiting={canSkipWaiting}
              />
            </TabsContent>

            <TabsContent value="chat" className="mt-4 space-y-4 min-h-[400px]">
              {groupRoomId && (
                <div className="flex items-center gap-2 p-1 rounded-lg bg-muted/50 w-fit">
                  <Button
                    variant={chatMode === "lobby" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setChatMode("lobby")}
                    className="h-8 text-xs px-4 font-normal"
                  >
                    Lobby Chat
                  </Button>
                  <Button
                    variant={chatMode === "group" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setChatMode("group")}
                    className="h-8 text-xs px-4 font-normal"
                  >
                    Group Chat
                  </Button>
                </div>
              )}

              {chatMode === "group" && groupRoomId ? (
                /* Group Chat: uses the inner group CollaborationProvider via useCollaboration() */
                <LobbyChatSection
                  currentUser={currentUser}
                  title="Group Chat"
                  placeholder="Chat with your group..."
                  emptyMessage="No group messages yet."
                />
              ) : (
                /* Lobby Chat: always uses the outer lobby collaboration captured above */
                <LobbyChatSection
                  currentUser={currentUser}
                  title="Lobby Chat"
                  collaboration={lobbyCollaboration}
                  placeholder="Chat with everyone in the lobby..."
                  emptyMessage="No lobby messages yet."
                />
              )}
            </TabsContent>
          </CollaborationProvider>
        </Tabs>
      </div>
    </div>
  );
}
