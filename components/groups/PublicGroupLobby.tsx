'use client';

import { FormEvent, useMemo, useState } from "react";
import { useCollaboration } from "@/lib/collaboration";
import { Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PresenceStack, buildAvatarFallbacks } from "./PresenceStack";
import { GroupTab } from "./GroupTab";
import type { LobbyChatEntry, UserIdentity } from "@/lib/collaboration/types";

interface PublicGroupLobbyProps {
  gameId: string;
  groupId: string | null;
  gameTitle: string;
  courseName: string | null;
  currentUser: UserIdentity;
  onGroupSelect: (groupId: string | null) => void | Promise<void>;
}

export function PublicGroupLobby({
  gameId,
  groupId,
  gameTitle,
  courseName,
  currentUser,
  onGroupSelect,
}: PublicGroupLobbyProps) {
  const collaboration = useCollaboration();
  const [draftMessage, setDraftMessage] = useState("");
  const effectiveCurrentUser = collaboration.effectiveIdentity ?? currentUser;

  const connectedUsers = useMemo(() => {
    const avatarFallbacks = buildAvatarFallbacks([
      {
        userId: effectiveCurrentUser.id,
        accountUserId: effectiveCurrentUser.id,
        userEmail: effectiveCurrentUser.email,
        accountUserEmail: effectiveCurrentUser.email,
        userName: effectiveCurrentUser.name,
        userImage: effectiveCurrentUser.image,
      },
      ...collaboration.activeUsers,
    ]);
    const seen = new Set<string>();
    const combined = [
      {
        userId: effectiveCurrentUser.id,
        accountUserId: effectiveCurrentUser.id,
        userEmail: effectiveCurrentUser.email,
        accountUserEmail: effectiveCurrentUser.email,
        userName: effectiveCurrentUser.name,
        userImage: effectiveCurrentUser.image,
      },
      ...collaboration.activeUsers,
    ];

    return combined.filter((entry) => {
      const key = entry.userId || entry.userEmail;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      const fallback = (entry.accountUserId ? avatarFallbacks.byUserId.get(entry.accountUserId) : undefined)
        ?? (entry.accountUserEmail ? avatarFallbacks.byEmail.get(entry.accountUserEmail.toLowerCase()) : undefined)
        ?? (entry.userEmail ? avatarFallbacks.byEmail.get(entry.userEmail.toLowerCase()) : undefined);
      if (!entry.userName && fallback?.userName) {
        entry.userName = fallback.userName;
      }
      if (!entry.userImage && fallback?.userImage) {
        entry.userImage = fallback.userImage;
      }
      return true;
    });
  }, [collaboration.activeUsers, effectiveCurrentUser.email, effectiveCurrentUser.id, effectiveCurrentUser.image, effectiveCurrentUser.name]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    collaboration.sendLobbyChat(draftMessage);
    setDraftMessage("");
  };

  const formatChatLabel = (entry: LobbyChatEntry) =>
    entry.userName || entry.userEmail || entry.userId || "Anonymous";

  return (
    <div className="flex h-full items-center justify-center px-4 py-8 overflow-y-auto">
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

        <Tabs defaultValue="group" className="mt-6 min-h-[480px]">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="group">Group tab</TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-2">
              Chat tab
              <div className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium transition-colors group-data-[state=active]:bg-primary group-data-[state=active]:text-primary-foreground">
                <Users className="h-3 w-3" />
                <span>{connectedUsers.length}</span>
              </div>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="group" className="mt-4">
            <GroupTab
              gameId={gameId}
              gameTitle={gameTitle}
              courseName={courseName}
              currentUser={currentUser}
              selectedGroupId={groupId}
              onGroupSelect={onGroupSelect}
            />
          </TabsContent>

          <TabsContent value="chat" className="mt-4">
            <div className="rounded-lg border p-4 min-h-[400px]">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">Chat tab</h2>
                <PresenceStack users={connectedUsers} className="justify-end" />
              </div>
            <div className="mt-3 h-72 overflow-y-auto space-y-3 rounded-md bg-muted/30 p-3">
              {collaboration.lobbyMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No messages yet. Introduce yourselves and agree on a shared app group before starting.
                </p>
              ) : (
                collaboration.lobbyMessages.map((entry) => (
                  <div key={entry.id} className="rounded-md bg-background px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{formatChatLabel(entry)}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap break-words">{entry.text}</p>
                  </div>
                ))
              )}
            </div>
            <form className="mt-3 flex gap-2" onSubmit={handleSubmit}>
              <input
                type="text"
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                placeholder="Say hello or share your planned group"
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
              />
              <Button type="submit" disabled={!collaboration.isConnected || !draftMessage.trim()}>
                Send
              </Button>
            </form>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
