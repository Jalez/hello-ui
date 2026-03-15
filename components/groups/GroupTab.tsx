'use client';

import { useMemo, useState, useEffect } from "react";
import { CollaborationProvider } from "@/lib/collaboration";
import { GroupSelector } from "./GroupSelector";
import { GroupWaitingRoom } from "./GroupWaitingRoom";
import { fetchGroupDetailsCached } from "@/lib/group-details-client";
import type { UserIdentity } from "@/lib/collaboration/types";
import type { ClientGroupMember } from "@/lib/group-details-client";

interface GroupTabProps {
  gameId: string;
  gameTitle: string;
  courseName: string | null;
  currentUser: UserIdentity;
  selectedGroupId: string | null;
  onGroupSelect: (groupId: string | null) => void;
}

export function GroupTab({
  gameId,
  gameTitle,
  courseName,
  currentUser,
  selectedGroupId,
  onGroupSelect,
}: GroupTabProps) {
  const [currentGroupName, setCurrentGroupName] = useState<string | null>(null);
  const [currentGroupJoinKey, setCurrentGroupJoinKey] = useState<string | null>(null);
  const [currentGroupMembers, setCurrentGroupMembers] = useState<ClientGroupMember[]>([]);

  useEffect(() => {
    if (!selectedGroupId) {
      setCurrentGroupName(null);
      setCurrentGroupJoinKey(null);
      setCurrentGroupMembers([]);
      return;
    }

    let cancelled = false;
    const loadGroupDetails = async () => {
      try {
        const data = await fetchGroupDetailsCached(selectedGroupId);
        if (cancelled) return;
        setCurrentGroupName(data.group?.name ?? null);
        setCurrentGroupJoinKey(data.group?.joinKey ?? null);
        setCurrentGroupMembers(Array.isArray(data.members) ? data.members : []);
      } catch {
        if (!cancelled) {
          setCurrentGroupName(null);
          setCurrentGroupJoinKey(null);
          setCurrentGroupMembers([]);
        }
      }
    };

    loadGroupDetails();
    return () => {
      cancelled = true;
    };
  }, [selectedGroupId]);

  if (selectedGroupId) {
    // When a group is selected, we wrap in its own provider for the group room
    return (
      <CollaborationProvider roomId={`group:${selectedGroupId}`} user={currentUser}>
        <GroupWaitingRoom
          gameTitle={gameTitle}
          groupId={selectedGroupId}
          groupName={currentGroupName}
          joinKey={currentGroupJoinKey}
          currentUser={currentUser}
          groupMembers={currentGroupMembers}
          onBack={() => onGroupSelect(null)}
          isNested={true}
        />
      </CollaborationProvider>
    );
  }

  return (
    <div className="rounded-lg border p-4 min-h-[400px]">
      <h2 className="text-lg font-semibold">Select or Create Group</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick an existing group or create a new one to start playing with teammates.
      </p>
      <div className="mt-3">
        <GroupSelector
          selectedGroupId={null}
          onGroupSelect={onGroupSelect}
          showRefreshButton
          allowCreate
          createContext={{
            ltiContextTitle: courseName,
            resourceLinkId: gameId,
          }}
          createPlaceholder="Example: Team 2 / UI Squad"
          currentUserId={currentUser.id}
        />
      </div>
    </div>
  );
}
