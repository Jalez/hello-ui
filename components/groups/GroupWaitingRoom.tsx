'use client';

import { useEffect, useMemo, useRef } from "react";
import App from "@/components/App";
import { useGameStore } from "@/components/default/games";
import { useCollaboration } from "@/lib/collaboration";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { startLevelTimerAt } from "@/store/slices/levels.slice";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { PresenceStack, buildAvatarFallbacks } from "./PresenceStack";
import type { GroupStartGateState, UserIdentity } from "@/lib/collaboration/types";
import type { ClientGroupMember } from "@/lib/group-details-client";

const GROUP_START_MIN_READY_COUNT = 2;

export function normalizeGroupStartGate(value: unknown): GroupStartGateState {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const readyUserIds = Array.isArray(source.readyUserIds)
    ? Array.from(new Set(source.readyUserIds.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)))
    : [];
  const rawReadyUsers =
    source.readyUsers && typeof source.readyUsers === "object" && !Array.isArray(source.readyUsers)
      ? source.readyUsers as Record<string, unknown>
      : {};
  const readyUsers = readyUserIds.reduce<GroupStartGateState["readyUsers"]>((acc, userId) => {
    const user = rawReadyUsers[userId];
    const normalizedUser = user && typeof user === "object" && !Array.isArray(user)
      ? user as Record<string, unknown>
      : {};
    acc[userId] = {
      userId,
      ...(typeof normalizedUser.userName === "string" ? { userName: normalizedUser.userName } : {}),
      ...(typeof normalizedUser.userEmail === "string" ? { userEmail: normalizedUser.userEmail } : {}),
      ...(typeof normalizedUser.userImage === "string" ? { userImage: normalizedUser.userImage } : {}),
      ...(typeof normalizedUser.readyAt === "string" ? { readyAt: normalizedUser.readyAt } : {}),
    };
    return acc;
  }, {});

  return {
    status: source.status === "started" ? "started" : "waiting",
    minReadyCount: GROUP_START_MIN_READY_COUNT,
    readyUserIds,
    readyUsers,
    startedAt: typeof source.startedAt === "string" ? source.startedAt : null,
    startedByUserId: typeof source.startedByUserId === "string" ? source.startedByUserId : null,
  };
}

interface GroupWaitingRoomProps {
  gameTitle: string;
  groupId: string;
  groupName?: string | null;
  joinKey?: string | null;
  currentUser: UserIdentity;
  groupMembers: ClientGroupMember[];
  onBack?: () => void;
  isNested?: boolean;
}

export function GroupWaitingRoom({
  gameTitle,
  groupId,
  groupName,
  joinKey,
  currentUser,
  groupMembers,
  onBack,
  isNested,
}: GroupWaitingRoomProps) {
  const collaboration = useCollaboration();
  const dispatch = useAppDispatch();
  const levels = useAppSelector((state) => state.levels);
  const currentGame = useGameStore((state) => state.getCurrentGame());
  const addGameToStore = useGameStore((state) => state.addGameToStore);
  const effectiveCurrentUser = collaboration.effectiveIdentity ?? currentUser;
  const gate = useMemo(
    () => collaboration.groupStartGate ?? normalizeGroupStartGate(currentGame?.progressData?.groupStartGate),
    [collaboration.groupStartGate, currentGame?.progressData],
  );
  const gateSnapshotRef = useRef<string>("");

  const connectedUsers = useMemo(() => {
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
      ...groupMembers,
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

    const roster = groupMembers.map((member) => {
      const key = member.userId || member.userEmail || member.id;
      const liveEntry = presenceByKey.get(key);
      const fallback = avatarFallbacks.byUserId.get(member.userId)
        ?? (member.userEmail ? avatarFallbacks.byEmail.get(member.userEmail.toLowerCase()) : undefined);
      return {
        userId: member.userId,
        userEmail: member.userEmail ?? liveEntry?.userEmail,
        userName: member.userName ?? liveEntry?.userName ?? fallback?.userName ?? undefined,
        userImage: member.userImage ?? liveEntry?.userImage ?? fallback?.userImage ?? undefined,
        color: liveEntry?.color,
        isConnected: Boolean(liveEntry),
      };
    });

    const rosterKeys = new Set(
      roster.map((entry) => entry.userId || entry.userEmail).filter((entry): entry is string => Boolean(entry)),
    );
    const extras = Array.from(presenceByKey.values())
      .filter((entry) => {
        const key = entry.userId || entry.userEmail;
        return Boolean(key) && !rosterKeys.has(key);
      })
      .map((entry) => {
        const fallback = (entry.accountUserId ? avatarFallbacks.byUserId.get(entry.accountUserId) : undefined)
          ?? (entry.accountUserEmail ? avatarFallbacks.byEmail.get(entry.accountUserEmail.toLowerCase()) : undefined)
          ?? (entry.userEmail ? avatarFallbacks.byEmail.get(entry.userEmail.toLowerCase()) : undefined);
        return {
          userId: entry.userId,
          userEmail: entry.userEmail,
          userName: entry.userName ?? fallback?.userName ?? undefined,
          userImage: entry.userImage ?? fallback?.userImage ?? undefined,
          color: entry.color,
          isConnected: true,
        };
      });

    return [...roster, ...extras];
  }, [collaboration.activeUsers, effectiveCurrentUser.email, effectiveCurrentUser.id, effectiveCurrentUser.image, effectiveCurrentUser.name, groupMembers]);

  const isReady = gate.readyUserIds.includes(effectiveCurrentUser.id);
  const isStarted = gate.status === "started";
  const startedAtMs = gate.startedAt ? Date.parse(gate.startedAt) : 0;

  useEffect(() => {
    if (!currentGame) {
      return;
    }

    const nextProgressData = {
      ...(currentGame.progressData && typeof currentGame.progressData === "object" && !Array.isArray(currentGame.progressData)
        ? currentGame.progressData
        : {}),
      groupStartGate: gate,
    };
    const snapshot = JSON.stringify(nextProgressData.groupStartGate);
    if (gateSnapshotRef.current === snapshot) {
      return;
    }
    gateSnapshotRef.current = snapshot;
    addGameToStore({
      ...currentGame,
      progressData: nextProgressData,
    });
  }, [addGameToStore, currentGame, gate]);

  useEffect(() => {
    if (!startedAtMs || !Number.isFinite(startedAtMs)) {
      return;
    }
    if (!levels[0] || Number(levels[0].timeData?.startTime ?? 0) > 0) {
      return;
    }
    dispatch(startLevelTimerAt({ levelId: 1, startTime: startedAtMs }));
  }, [dispatch, levels, startedAtMs]);

  if (isStarted && !isNested) {
    return <App />;
  }

  const content = (
    <div className={cn("w-full space-y-6", !isNested && "max-w-3xl rounded-xl border bg-card p-6 shadow-sm")}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Group Waiting Room</p>
          <h1 className="text-3xl font-bold">{gameTitle}</h1>
          <p className="text-sm text-muted-foreground">
            Group <span className={groupName ? "" : "font-mono"}>{groupName || groupId}</span>
          </p>
        </div>
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="-mt-1">
            ← Back to Groups
          </Button>
        )}
      </div>

      <div className="rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {joinKey ? (
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wider">Group Join Key</p>
              <p className="mt-1 text-2xl font-mono font-semibold tracking-[0.2em]">{joinKey}</p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wider">Group ID</p>
              <p className="mt-1 text-xl font-mono font-semibold">{groupId}</p>
            </div>
          )}
          <PresenceStack users={connectedUsers} readyUserIds={gate.readyUserIds} />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-3">
          <Button
            className="min-w-[200px]"
            variant={isReady ? "outline" : "default"}
            onClick={() => collaboration.setGroupReady(!isReady)}
            disabled={(!collaboration.isConnected && !isReady) || isStarted}
          >
            {!collaboration.isConnected && !isReady ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Connecting...
              </span>
            ) : !isReady ? (
              "Start Game"
            ) : isStarted ? (
              "Starting game..."
            ) : gate.readyUserIds.length < GROUP_START_MIN_READY_COUNT ? (
              `Waiting for ${GROUP_START_MIN_READY_COUNT - gate.readyUserIds.length} more...`
            ) : (
              "Ready! Starting..."
            )}
          </Button>
        </div>
        <p className="max-w-xl text-sm text-muted-foreground">
          The game starts as soon as at least two members are ready. Share the key with teammates so they can join!
        </p>
      </div>

      <div className="text-sm text-muted-foreground">
        {connectedUsers.filter((user) => user.isConnected).length} player
        {connectedUsers.filter((user) => user.isConnected).length === 1 ? "" : "s"} currently connected.
        {!collaboration.isConnected && " Reconnecting to shared room..."}
      </div>
    </div>
  );

  if (isNested) {
    return content;
  }

  return (
    <div className="flex h-full items-center justify-center px-4 py-8 overflow-y-auto">
      {content}
    </div>
  );
}
