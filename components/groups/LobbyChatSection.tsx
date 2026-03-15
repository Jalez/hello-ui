'use client';

import { FormEvent, useState, useMemo } from "react";
import { useCollaboration } from "@/lib/collaboration";
import type { CollaborationContextValue } from "@/lib/collaboration";
import { Button } from "@/components/ui/button";
import { PresenceStack, buildAvatarFallbacks } from "./PresenceStack";
import type { LobbyChatEntry, UserIdentity } from "@/lib/collaboration/types";

interface LobbyChatSectionProps {
  currentUser: UserIdentity;
  title?: string;
  placeholder?: string;
  emptyMessage?: string;
  collaboration?: CollaborationContextValue; // Explicit collaboration object override
}

export function LobbyChatSection({
  currentUser,
  title = "Chat tab",
  placeholder = "Say hello...",
  emptyMessage = "No messages yet.",
  collaboration: collaborationProp,
}: LobbyChatSectionProps) {
  const collaborationInternal = useCollaboration();
  const collaboration = collaborationProp || collaborationInternal;
  
  const [draftMessage, setDraftMessage] = useState("");
  const effectiveCurrentUser = collaboration.effectiveIdentity ?? currentUser;

  const connectedUsers = useMemo(() => {
    const presenceByKey = new Map<string, any>();
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
      ...collaboration.activeUsers,
    ]) {
      const email = entry.accountUserEmail || entry.userEmail;
      const key = email?.toLowerCase() || entry.userId || entry.clientId;
      if (!key || presenceByKey.has(key)) continue;
      
      const userId = entry.accountUserId || entry.userId;
      const fallback = (userId ? avatarFallbacks.byUserId.get(userId) : undefined)
        ?? (email ? avatarFallbacks.byEmail.get(email.toLowerCase()) : undefined);

      presenceByKey.set(key, {
        ...entry,
        userId,
        userName: entry.userName || fallback?.userName || undefined,
        userImage: entry.userImage || fallback?.userImage || undefined,
      });
    }

    return Array.from(presenceByKey.values());
  }, [collaboration.activeUsers, effectiveCurrentUser.email, effectiveCurrentUser.id, effectiveCurrentUser.image, effectiveCurrentUser.name]);

  const readyUserIds = useMemo(() => {
    const gate = collaboration.groupStartGate;
    if (!gate || !Array.isArray(gate.readyUserIds)) return [];
    return gate.readyUserIds;
  }, [collaboration.groupStartGate]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draftMessage.trim()) return;
    collaboration.sendLobbyChat(draftMessage);
    setDraftMessage("");
  };

  const formatChatLabel = (entry: LobbyChatEntry) =>
    entry.userName || entry.userEmail || entry.userId || "Anonymous";

  return (
    <div className="rounded-lg border p-4 min-h-[400px]">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <PresenceStack users={connectedUsers} readyUserIds={readyUserIds} className="justify-end" />
      </div>
      <div className="mt-3 h-[300px] overflow-y-auto space-y-3 rounded-md bg-muted/30 p-3">
        {collaboration.lobbyMessages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
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
          placeholder={placeholder}
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={!collaboration.isConnected || !draftMessage.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
