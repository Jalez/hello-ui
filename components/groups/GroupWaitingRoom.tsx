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
}

export function GroupWaitingRoom({
  gameTitle,
  groupId,
  groupName,
  joinKey,
  currentUser,
  groupMembers,
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
      const key = entry.userId || entry.userEmail || entry.clientId;
      if (!key || presenceByKey.has(key)) {
        continue;
      }
      presenceByKey.set(key, entry);
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

  if (isStarted) {
    return <App />;
  }

  return (
    <div className="flex h-full items-center justify-center px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-xl border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Group Waiting Room</p>
          <h1 className="text-3xl font-bold">{gameTitle}</h1>
          <p className="text-sm text-muted-foreground">
            Group <span className={groupName ? "" : "font-mono"}>{groupName || groupId}</span>
          </p>
        </div>

        <div className="mt-6 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Group status</p>
              <p className="mt-1 text-xl font-semibold">
                {isStarted ? "Starting game..." : isReady ? "You are ready" : "Waiting for players"}
              </p>
            </div>
            <PresenceStack users={connectedUsers} readyUserIds={gate.readyUserIds} />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {connectedUsers.map((user) => {
              const label = user.userName || user.userEmail || user.userId || "Anonymous";
              const isUserReady = user.userId ? gate.readyUserIds.includes(user.userId) : false;

              // Status text and color logic moved here to match PresenceStack priority
              const statusText = isUserReady ? "Ready" : user.isConnected ? "Connected" : "Offline";
              const statusColorClass = isUserReady
                ? "text-emerald-600"
                : user.isConnected
                  ? "text-blue-600"
                  : "text-muted-foreground";

              return (
                <div
                  key={user.userId || user.userEmail}
                  className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2"
                >
                  <span className="truncate text-sm">{label}</span>
                  <span className={cn("text-xs font-medium", statusColorClass)}>
                    {statusText}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => collaboration.setGroupReady(true)}
              disabled={!collaboration.isConnected || isReady || isStarted}
            >
              Start Game
            </Button>
            <Button
              variant="outline"
              onClick={() => collaboration.setGroupReady(false)}
              disabled={!collaboration.isConnected || !isReady || isStarted}
            >
              Cancel Ready
            </Button>
          </div>
          <p className="max-w-xl text-sm text-muted-foreground">
            The game starts for the whole group as soon as at least two members are ready. Later joiners skip this
            waiting room and enter the running game directly.
          </p>
        </div>

        {joinKey && (
          <div className="mt-4 rounded-lg border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">Group join key</p>
            <p className="mt-1 text-2xl font-mono font-semibold tracking-[0.2em]">{joinKey}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Share this key with teammates so they can join this group from the lobby.
            </p>
          </div>
        )}

        <div className="mt-4 text-sm text-muted-foreground">
          {connectedUsers.filter((user) => user.isConnected).length} player
          {connectedUsers.filter((user) => user.isConnected).length === 1 ? "" : "s"} currently connected.
          {!collaboration.isConnected && " Reconnecting to shared room..."}
        </div>
      </div>
    </div>
  );
}
