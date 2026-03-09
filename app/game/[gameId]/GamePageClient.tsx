'use client';

import { FormEvent, use, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import App from "@/components/App";
import { useGameStore } from "@/components/default/games";
import { CollaborationProvider, useCollaboration } from "@/lib/collaboration";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GroupSelector } from "@/components/groups";
import { useSidebarCollapse } from "@/components/default/sidebar/context/SidebarCollapseContext";
import { GameSummaryView } from "@/components/GameSummary/GameSummaryView";
import { apiUrl } from "@/lib/apiUrl";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { GroupStartGateState, LobbyChatEntry, UserIdentity } from "@/lib/collaboration/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { startLevelTimerAt } from "@/store/slices/levels.slice";

interface GamePageProps {
  params: Promise<{
    gameId: string;
  }>;
}

interface LtiSessionInfo {
  isLtiMode: boolean;
  courseName: string | null;
  contextId: string | null;
  role?: "instructor" | "member";
}

const ACCESS_KEY_STORAGE_PREFIX = "ui-designer-game-access-key:";
const GROUP_START_MIN_READY_COUNT = 2;

function getAccessKeyStorageKey(gameId: string): string {
  return `${ACCESS_KEY_STORAGE_PREFIX}${gameId}`;
}

function readStoredAccessKey(gameId: string): string {
  if (typeof window === "undefined") {
    return "";
  }

  const storageKey = getAccessKeyStorageKey(gameId);
  try {
    const sessionValue = window.sessionStorage.getItem(storageKey);
    if (sessionValue) {
      return sessionValue;
    }
  } catch {
    // Ignore storage failures in restricted environments.
  }

  try {
    return window.localStorage.getItem(storageKey) || "";
  } catch {
    return "";
  }
}

function persistAccessKey(gameId: string, accessKey: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const storageKey = getAccessKeyStorageKey(gameId);
  try {
    window.sessionStorage.setItem(storageKey, accessKey);
  } catch {
    // Ignore storage failures in restricted environments.
  }
  try {
    window.localStorage.setItem(storageKey, accessKey);
  } catch {
    // Ignore storage failures in restricted environments.
  }
}

function clearStoredAccessKey(gameId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const storageKey = getAccessKeyStorageKey(gameId);
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Ignore storage failures in restricted environments.
  }
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore storage failures in restricted environments.
  }
}

function getRoomIdForInstance(
  gameId: string,
  instance: { scope?: string; groupId?: string | null; userId?: string | null } | null | undefined,
): string | null {
  if (!instance) {
    return null;
  }

  if (instance.scope === "group" && instance.groupId) {
    return `group:${instance.groupId}:game:${gameId}`;
  }

  if (instance.scope === "individual" && instance.userId) {
    return `individual:${instance.userId}:game:${gameId}`;
  }

  return null;
}

function getPublicLobbyRoomId(gameId: string, contextId: string | null, courseName: string | null): string {
  const scope = (contextId || courseName || "unresolved-lti-group").trim();
  return `lobby:${encodeURIComponent(scope)}:game:${gameId}`;
}

function sanitizeReplayProgressData(progressData: Record<string, unknown>, replaying: boolean) {
  if (!replaying) {
    return progressData;
  }

  const nextProgressData = { ...progressData };
  delete nextProgressData.finishedAt;
  delete nextProgressData.finalScore;
  return nextProgressData;
}

function normalizeGroupStartGate(value: unknown): GroupStartGateState {
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

function hasSharedStartTime(initialRoomState: { levels?: Array<Record<string, unknown>> } | null): boolean {
  const firstLevel = initialRoomState?.levels?.[0];
  if (!firstLevel || typeof firstLevel !== "object" || Array.isArray(firstLevel)) {
    return false;
  }
  const timeData =
    firstLevel.timeData && typeof firstLevel.timeData === "object" && !Array.isArray(firstLevel.timeData)
      ? firstLevel.timeData as Record<string, unknown>
      : null;
  return Number(timeData?.startTime ?? 0) > 0;
}

function getInitials(label: string): string {
  return label
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function PresenceStack({
  users,
  readyUserIds = [],
  className,
}: {
  users: Array<{
    userId?: string;
    userEmail?: string;
    userName?: string;
    userImage?: string;
    color?: string;
  }>;
  readyUserIds?: string[];
  className?: string;
}) {
  return (
    <div className={cn("flex items-center -space-x-2", className)}>
      {users.map((user) => {
        const label = user.userName || user.userEmail || user.userId || "Anonymous";
        const isReady = user.userId ? readyUserIds.includes(user.userId) : false;
        return (
          <Avatar
            key={user.userId || user.userEmail}
            className={cn(
              "h-9 w-9 border-2 border-background ring-1 ring-border",
              isReady && "ring-2 ring-emerald-500"
            )}
            style={{ borderColor: user.color || undefined }}
            title={`${label}${isReady ? " • Ready" : ""}`}
          >
            {user.userImage && <AvatarImage src={user.userImage} alt={label} />}
            <AvatarFallback className="text-xs font-medium">
              {getInitials(label)}
            </AvatarFallback>
          </Avatar>
        );
      })}
    </div>
  );
}

function GroupWaitingRoom({
  gameTitle,
  groupId,
  groupName,
  joinKey,
  currentUser,
}: {
  gameTitle: string;
  groupId: string;
  groupName?: string | null;
  joinKey?: string | null;
  currentUser: UserIdentity;
}) {
  const collaboration = useCollaboration();
  const dispatch = useAppDispatch();
  const levels = useAppSelector((state) => state.levels);
  const currentGame = useGameStore((state) => state.getCurrentGame());
  const addGameToStore = useGameStore((state) => state.addGameToStore);
  const gate = useMemo(
    () => collaboration.groupStartGate ?? normalizeGroupStartGate(currentGame?.progressData?.groupStartGate),
    [collaboration.groupStartGate, currentGame?.progressData],
  );
  const gateSnapshotRef = useRef<string>("");

  const connectedUsers = useMemo(() => {
    const seen = new Set<string>();
    const combined = [
      {
        userId: currentUser.id,
        userEmail: currentUser.email,
        userName: currentUser.name,
        userImage: currentUser.image,
        clientId: "self",
      },
      ...collaboration.activeUsers,
    ];

    return combined.filter((entry) => {
      const key = entry.userId || entry.userEmail || entry.clientId;
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [collaboration.activeUsers, currentUser.email, currentUser.id, currentUser.image, currentUser.name]);

  const isReady = gate.readyUserIds.includes(currentUser.id);
  const isStarted = gate.status === "started";
  const startedAtMs = gate.startedAt ? Date.parse(gate.startedAt) : 0;
  const waitingForSharedStart = isStarted && !hasSharedStartTime(collaboration.initialRoomState);

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

  if (isStarted && !waitingForSharedStart) {
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
          {connectedUsers.length} player{connectedUsers.length === 1 ? "" : "s"} in this room.
          {!collaboration.isConnected && " Reconnecting to shared room..."}
        </div>
      </div>
    </div>
  );
}

function PublicGroupLobby({
  gameId,
  groupId,
  gameTitle,
  courseName,
  currentUser,
  onGroupSelect,
}: {
  gameId: string;
  groupId: string | null;
  gameTitle: string;
  courseName: string | null;
  currentUser: UserIdentity;
  onGroupSelect: (groupId: string) => void | Promise<void>;
}) {
  const collaboration = useCollaboration();
  const [draftMessage, setDraftMessage] = useState("");

  const connectedUsers = useMemo(() => {
    const seen = new Set<string>();
    const combined = [
      {
        userId: currentUser.id,
        userEmail: currentUser.email,
        userName: currentUser.name,
        userImage: currentUser.image,
      },
      ...collaboration.activeUsers,
    ];

    return combined.filter((entry) => {
      const key = entry.userId || entry.userEmail;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [collaboration.activeUsers, currentUser.email, currentUser.id, currentUser.image, currentUser.name]);

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
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Lobby status</p>
              <p className="mt-1 text-2xl font-semibold">{connectedUsers.length} online</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {collaboration.isConnected ? "Connected" : "Connecting..."}
            </p>
          </div>
          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <p><strong className="text-foreground">1.</strong> Create an app group or pick an existing one.</p>
            <p><strong className="text-foreground">2.</strong> Ask your teammates to join the same group.</p>
            <p><strong className="text-foreground">3.</strong> Enter the group waiting room and start together.</p>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            This temporary lobby and its chat disappear automatically when everyone leaves.
          </p>
        </div>

        <Tabs defaultValue="chat" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chat">Lobby Chat</TabsTrigger>
            <TabsTrigger value="group">Enter Your Group</TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="mt-4">
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">Lobby Chat</h2>
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

          <TabsContent value="group" className="mt-4">
            <div className="rounded-lg border p-4">
              <h2 className="text-lg font-semibold">Enter Your Group</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Use your app group here. If none exists yet, create one with a name your teammates can recognize.
              </p>
              <div className="mt-3">
                <GroupSelector
                  selectedGroupId={groupId}
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function GamePage({ params }: GamePageProps) {
  const { gameId } = use(params);
  const { data: session } = useSession();
  const hasUser = Boolean(session?.user);
  const sessionUserId = session?.userId || session?.user?.email || "";
  const { setCurrentGameId, addGameToStore } = useGameStore();
  const searchParams = useSearchParams();
  const selectedGroupId = searchParams.get("groupId");
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Loading game...");
  const [error, setError] = useState<string | null>(null);
  const [requiresGroup, setRequiresGroup] = useState(false);
  const [publicLobby, setPublicLobby] = useState<{ roomId: string; courseName: string | null; contextId: string | null } | null>(null);
  const [currentGroupName, setCurrentGroupName] = useState<string | null>(null);
  const [currentGroupJoinKey, setCurrentGroupJoinKey] = useState<string | null>(null);
  const [requiresAccessKey, setRequiresAccessKey] = useState(false);
  const [accessKeyInput, setAccessKeyInput] = useState("");
  const [submittedAccessKey, setSubmittedAccessKey] = useState("");
  const [accessKeyError, setAccessKeyError] = useState<string | null>(null);
  const [hideSidebar, setHideSidebar] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [accessKeyReady, setAccessKeyReady] = useState(false);
  const { setIsVisible: setSidebarVisible } = useSidebarCollapse();

  // Hide sidebar on the access key prompt screen when the game requires it.
  // The Sidebar's own effect reclaims control once requiresAccessKey is cleared.
  useEffect(() => {
    if (requiresAccessKey && hideSidebar) {
      setSidebarVisible(false);
    }
  }, [requiresAccessKey, hideSidebar, setSidebarVisible]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [guestId, setGuestId] = useState<string>("");
  const isReplayView = searchParams.get("view") === "play";
  const currentGame = useGameStore((s) => s.getCurrentGame());
  const isFinished =
    currentGame?.progressData &&
    typeof currentGame.progressData === "object" &&
    "finishedAt" in currentGame.progressData;

  useEffect(() => {
    const storedAccessKey = readStoredAccessKey(gameId);
    queueMicrotask(() => {
      setAccessKeyInput(storedAccessKey);
      setSubmittedAccessKey(storedAccessKey);
      setAccessKeyReady(true);
    });
  }, [gameId]);

  useEffect(() => {
    if (hasUser) {
      queueMicrotask(() => {
        setGuestId("");
      });
      return;
    }
    const storageKey = "ui-designer-guest-id";
    let nextGuestId = localStorage.getItem(storageKey) || "";
    if (!nextGuestId) {
      nextGuestId = crypto.randomUUID();
      localStorage.setItem(storageKey, nextGuestId);
    }
    queueMicrotask(() => {
      setGuestId(nextGuestId);
    });
  }, [hasUser]);

  useEffect(() => {
    const initializeGame = async () => {
      if (!accessKeyReady) return;
      if (!hasUser && !guestId) return;

      try {
        setIsLoading(true);
        setLoadingMessage("Loading game...");
        setError(null);
        setRequiresGroup(false);
        setPublicLobby(null);
        setRequiresAccessKey(false);
        setAccessKeyError(null);

        const normalizedParams = new URLSearchParams(searchParams.toString());
        if (normalizedParams.get("mode") !== "game") {
          normalizedParams.set("mode", "game");
          router.replace(`${pathname}?${normalizedParams.toString()}`);
        }

        const gameParams = new URLSearchParams();
        gameParams.set("accessContext", "game");
        if (submittedAccessKey) {
          gameParams.set("key", submittedAccessKey);
        }
        const gameRes = await fetch(apiUrl(`/api/games/${gameId}${gameParams.toString() ? `?${gameParams.toString()}` : ""}`));
        if (!gameRes.ok) {
          const payload = await gameRes.json().catch(() => ({}));
          if (gameRes.status === 403 && (payload.requiresAccessKey || payload.reason === "access_key_required" || payload.reason === "access_key_invalid")) {
            clearStoredAccessKey(gameId);
            setSubmittedAccessKey("");
            setRequiresAccessKey(true);
            setAccessKeyError(payload.error || "Access key required");
            setHideSidebar(payload.hideSidebar ?? false);
            setIsLoading(false);
            return;
          }
          setError(payload.error || payload.message || "Game not found");
          setIsLoading(false);
          return;
        }
        const game = await gameRes.json();
        setHideSidebar(Boolean(game?.hideSidebar));
        if (submittedAccessKey.trim()) {
          persistAccessKey(gameId, submittedAccessKey.trim());
        }

        const now = Date.now();
        const accessStartsAtMs = game?.accessStartsAt ? new Date(game.accessStartsAt).getTime() : null;
        const accessEndsAtMs = game?.accessEndsAt ? new Date(game.accessEndsAt).getTime() : null;
        if (game?.accessWindowEnabled) {
          if (typeof accessStartsAtMs === "number" && !Number.isNaN(accessStartsAtMs) && now < accessStartsAtMs) {
            setError("Game is not open yet");
            setIsLoading(false);
            return;
          }
          if (typeof accessEndsAtMs === "number" && !Number.isNaN(accessEndsAtMs) && now > accessEndsAtMs) {
            setError("Game access window has ended");
            setIsLoading(false);
            return;
          }
        }

        if (game?.accessKeyRequired && !submittedAccessKey) {
          setRequiresAccessKey(true);
          setAccessKeyError("Access key required");
          setIsLoading(false);
          return;
        }

        if (game.collaborationMode === "group") {
          if (!hasUser) {
            setError("Authentication required for group games");
            setIsLoading(false);
            return;
          }
          const groupId = searchParams.get("groupId");
          const canOpenCreatorPreview = Boolean(game.canEdit);
          if (!groupId && !canOpenCreatorPreview) {
            let nextLtiInfo: LtiSessionInfo | null = null;
            try {
              setLoadingMessage("Resolving your group from the course workspace...");
              const ltiResponse = await fetch(apiUrl("/api/games/lti-session"));
              if (ltiResponse.ok) {
                nextLtiInfo = await ltiResponse.json();
              }
            } catch {
              // Ignore LTI session probe failures and fall back to the normal group picker.
            }

            if (nextLtiInfo?.isLtiMode) {
              setLoadingMessage("Opening group lobby...");
              const lobbyRoomId = getPublicLobbyRoomId(gameId, nextLtiInfo.contextId, nextLtiInfo.courseName);
              addGameToStore(game);
              setCurrentGameId(gameId);
              setRoomId(lobbyRoomId);
              setPublicLobby({
                roomId: lobbyRoomId,
                courseName: nextLtiInfo.courseName,
                contextId: nextLtiInfo.contextId,
              });
            } else {
              setRequiresGroup(true);
            }
            setIsLoading(false);
            return;
          }

          const instanceParams = new URLSearchParams();
          instanceParams.set("accessContext", "game");
          if (groupId) {
            instanceParams.set("groupId", groupId);
          }
          if (!hasUser && guestId) {
            instanceParams.set("guestId", guestId);
          }
          if (submittedAccessKey) {
            instanceParams.set("key", submittedAccessKey);
          }
          setLoadingMessage("Opening shared group game...");
          const instanceRes = await fetch(apiUrl(`/api/games/${gameId}/instance?${instanceParams.toString()}`));
          if (!instanceRes.ok) {
            const payload = await instanceRes.json().catch(() => ({}));
            if (instanceRes.status === 403 && (payload.requiresAccessKey || payload.reason === "access_key_required" || payload.reason === "access_key_invalid")) {
              clearStoredAccessKey(gameId);
              setSubmittedAccessKey("");
              setRequiresAccessKey(true);
              setAccessKeyError(payload.error || "Access key required");
              setIsLoading(false);
              return;
            }
            setError(payload.error || "Failed to load group game instance");
            setIsLoading(false);
            return;
          }
          const instancePayload = await instanceRes.json();
          const rawProgressData =
            instancePayload.instance?.progressData &&
            typeof instancePayload.instance.progressData === "object" &&
            !Array.isArray(instancePayload.instance.progressData)
              ? instancePayload.instance.progressData
              : {};
          const progressData = sanitizeReplayProgressData(rawProgressData, isReplayView);
          console.log("[GamePage] loaded group instance", {
            gameId,
            isReplayView,
            rawKeys: Object.keys(rawProgressData),
            sanitizedKeys: Object.keys(progressData),
          });
          addGameToStore({ ...game, progressData });
          setRoomId(getRoomIdForInstance(gameId, instancePayload.instance));
        } else {
          const instanceParams = new URLSearchParams();
          instanceParams.set("accessContext", "game");
          if (!hasUser && guestId) {
            instanceParams.set("guestId", guestId);
          }
          if (submittedAccessKey) {
            instanceParams.set("key", submittedAccessKey);
          }
          setLoadingMessage("Opening game...");
          const instanceRes = await fetch(apiUrl(`/api/games/${gameId}/instance${instanceParams.toString() ? `?${instanceParams.toString()}` : ""}`));
          if (instanceRes.ok) {
            const instancePayload = await instanceRes.json();
            const rawProgressData =
              instancePayload.instance?.progressData &&
              typeof instancePayload.instance.progressData === "object" &&
              !Array.isArray(instancePayload.instance.progressData)
                ? instancePayload.instance.progressData
                : {};
            const progressData = sanitizeReplayProgressData(rawProgressData, isReplayView);
            console.log("[GamePage] loaded individual instance", {
              gameId,
              isReplayView,
              rawKeys: Object.keys(rawProgressData),
              sanitizedKeys: Object.keys(progressData),
            });
            addGameToStore({ ...game, progressData });
            setRoomId(getRoomIdForInstance(gameId, instancePayload.instance));
          } else {
            const payload = await instanceRes.json().catch(() => ({}));
            if (instanceRes.status === 403 && (payload.requiresAccessKey || payload.reason === "access_key_required" || payload.reason === "access_key_invalid")) {
              clearStoredAccessKey(gameId);
              setSubmittedAccessKey("");
              setRequiresAccessKey(true);
              setAccessKeyError(payload.error || "Access key required");
              setIsLoading(false);
              return;
            }
            addGameToStore(game);
            const userId = hasUser
              ? sessionUserId
              : guestId;
            setRoomId(`individual:${userId}:game:${gameId}`);
          }
        }

        setCurrentGameId(gameId);
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading game:", err);
        setError("Failed to load game");
        setIsLoading(false);
      }
    };

    initializeGame();
  }, [gameId, hasUser, sessionUserId, guestId, setCurrentGameId, searchParams, router, pathname, addGameToStore, loadAttempt, accessKeyReady, submittedAccessKey, isReplayView]);

  const handleGroupSelect = async (groupId: string, options?: { joinKey?: string }) => {
    if (hasUser && session?.user?.email) {
      const membershipResponse = await fetch(apiUrl(`/api/groups/${groupId}/members`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          joinKey: options?.joinKey,
        }),
      });

      if (!membershipResponse.ok) {
        const membershipData = await membershipResponse.json().catch(() => ({}));
        throw new Error(membershipData.error || "Failed to join group");
      }
    }

    try {
      const response = await fetch(apiUrl(`/api/groups/${groupId}`));
      if (response.ok) {
        const data = await response.json();
        setCurrentGroupName(data.group?.name ?? null);
        setCurrentGroupJoinKey(data.group?.joinKey ?? null);
      } else {
        setCurrentGroupName(null);
        setCurrentGroupJoinKey(null);
      }
    } catch {
      setCurrentGroupName(null);
      setCurrentGroupJoinKey(null);
    }

    const normalizedParams = new URLSearchParams(searchParams.toString());
    normalizedParams.set("mode", "game");
    normalizedParams.set("groupId", groupId);
    router.push(`${pathname}?${normalizedParams.toString()}`);
    setRequiresGroup(false);
    setIsLoading(true);
  };

  useEffect(() => {
    const groupId = searchParams.get("groupId");
    if (!groupId || !hasUser) {
      return;
    }

    let cancelled = false;
    const loadGroupDetails = async () => {
      try {
        const response = await fetch(apiUrl(`/api/groups/${groupId}`));
        if (!response.ok || cancelled) {
          return;
        }
        const data = await response.json();
        if (cancelled) {
          return;
        }
        setCurrentGroupName(data.group?.name ?? null);
        setCurrentGroupJoinKey(data.group?.joinKey ?? null);
      } catch {
        if (!cancelled) {
          setCurrentGroupName(null);
          setCurrentGroupJoinKey(null);
        }
      }
    };

    loadGroupDetails();
    return () => {
      cancelled = true;
    };
  }, [hasUser, searchParams]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">{error}</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Please check if the game exists and you have access to it.
          </p>
        </div>
      </div>
    );
  }

  if (requiresGroup) {
    return (
      <div className="flex items-center justify-center h-screen px-4">
        <div className="w-full max-w-xl rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-xl font-semibold">Select Group</h2>
          <p className="text-sm text-muted-foreground">
            This game is in Group Work Mode. Choose one of your existing groups to open the shared instance.
          </p>
          <p className="text-sm text-muted-foreground">
            If you do not see the right group yet, create one here or return to the public lobby and coordinate with your teammates.
          </p>
          <GroupSelector
            selectedGroupId={searchParams.get("groupId")}
            onGroupSelect={handleGroupSelect}
            allowCreate
            createContext={{ resourceLinkId: gameId }}
            createPlaceholder="Create a group name"
            currentUserId={sessionUserId}
          />
        </div>
      </div>
    );
  }

  const user = session?.user
    ? {
      id: session.userId || session.user.email || "",
      email: session.user.email || "",
      name: session.user.name ?? undefined,
      image: session.user.image ?? undefined,
    }
    : guestId
      ? {
        id: guestId,
        email: `guest-${guestId}@local`,
        name: "Guest",
        image: undefined,
      }
      : null;

  if (publicLobby && user) {
    return (
      <CollaborationProvider roomId={publicLobby.roomId} user={user}>
        <PublicGroupLobby
          gameId={gameId}
          groupId={selectedGroupId}
          gameTitle={currentGame?.title || "Group Game"}
          courseName={publicLobby.courseName}
          currentUser={user}
          onGroupSelect={handleGroupSelect}
        />
      </CollaborationProvider>
    );
  }

  if (requiresAccessKey) {
    return (
      <div className="flex items-center justify-center h-screen px-4">
        <div className="w-full max-w-sm rounded border p-6 space-y-3">
          <h2 className="text-xl font-semibold">Access Key Required</h2>
          <p className="text-sm text-muted-foreground">
            This game requires a special key. Ask the creator for the current key.
          </p>
          <input
            type="password"
            className="w-full rounded border px-3 py-2 text-sm"
            value={accessKeyInput}
            onChange={(event) => setAccessKeyInput(event.target.value)}
            placeholder="Enter access key"
          />
          {accessKeyError && <p className="text-sm text-red-600">{accessKeyError}</p>}
          <button
            className="w-full rounded bg-primary text-primary-foreground px-3 py-2 text-sm"
            onClick={() => {
              setSubmittedAccessKey(accessKeyInput);
              setIsLoading(true);
              setError(null);
              setLoadAttempt((value) => value + 1);
            }}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  const showSummary = isFinished && currentGame?.progressData && searchParams.get("view") !== "play";
  if (showSummary) {
    return (
      <GameSummaryView
        gameId={gameId}
        gameTitle={currentGame.title}
        progressData={currentGame.progressData as { finishedAt?: string; finalScore?: { points: number; maxPoints: number } }}
      />
    );
  }

  return (
    <CollaborationProvider roomId={roomId} user={user}>
      {user && currentGame?.collaborationMode === "group" && roomId?.startsWith("group:") ? (
        <GroupWaitingRoom
          gameTitle={currentGame.title}
          groupId={searchParams.get("groupId") || roomId.split(":")[1] || ""}
          groupName={currentGroupName}
          joinKey={currentGroupJoinKey}
          currentUser={user}
        />
      ) : (
        <App />
      )}
    </CollaborationProvider>
  );
}
