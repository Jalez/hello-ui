'use client';

import { ReactNode, use, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import App from "@/components/App";
import { useGameStore } from "@/components/default/games";
import { CollaborationProvider, useCollaboration } from "@/lib/collaboration";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GroupSelector, PublicGroupLobby, GroupWaitingRoom, normalizeGroupStartGate } from "@/components/groups";
import { useSidebarCollapse } from "@/components/default/sidebar/context/SidebarCollapseContext";
import { GameSummaryView } from "@/components/GameSummary/GameSummaryView";
import { FinishGameView } from "@/components/GameSummary/FinishGameView";
import { apiUrl } from "@/lib/apiUrl";
import { useAppDispatch } from "@/store/hooks/hooks";
import { logDebugClient } from "@/lib/debug-logger";
import { fetchGroupDetailsCached } from "@/lib/group-details-client";
import type { ClientGroupMember } from "@/lib/group-details-client";
import { toast } from "sonner";

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

type PersistedGroupMember = ClientGroupMember;

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
  const scope = (contextId || courseName || "all").trim();
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

// normalizeGroupStartGate moved to components/groups/GroupWaitingRoom.tsx

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

// Shared UI helpers moved to components/groups/PresenceStack.tsx

function CollaborationNotice({ children }: { children: ReactNode }) {
  const collaboration = useCollaboration();
  const [latchedDuplicateError, setLatchedDuplicateError] = useState<string | null>(null);
  const isDuplicateBlocked = collaboration.error?.toLowerCase().includes("already connected in this game")
    || collaboration.error?.toLowerCase().includes("duplicate users are blocked")
    || collaboration.error?.toLowerCase().includes("is already connected.");

  useEffect(() => {
    if (isDuplicateBlocked && collaboration.error) {
      setLatchedDuplicateError(collaboration.error);
    }
  }, [collaboration.error, isDuplicateBlocked]);

  if (!collaboration.error && !latchedDuplicateError) {
    return <>{children}</>;
  }

  if (latchedDuplicateError || isDuplicateBlocked) {
    return (
      <>
        {children}
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-amber-400/40 bg-background p-6 shadow-2xl">
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">Connection blocked</p>
                <h2 className="text-2xl font-semibold text-foreground">Duplicate login detected</h2>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {latchedDuplicateError || collaboration.error}
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
        {collaboration.error}
      </div>
      {children}
    </>
  );
}

// PresenceStack moved to components/groups/PresenceStack.tsx



function GameInstancesResetWatcher({ gameId }: { gameId: string }) {
  const collaboration = useCollaboration();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastHandledResetTsRef = useRef<number | null>(null);

  useEffect(() => {
    const resetMessage = collaboration.lastGameInstancesReset;
    if (!resetMessage || resetMessage.gameId !== gameId) {
      return;
    }

    if (lastHandledResetTsRef.current === resetMessage.ts) {
      return;
    }
    lastHandledResetTsRef.current = resetMessage.ts;

    const actorLabel =
      resetMessage.actorUserName ||
      resetMessage.actorUserEmail ||
      "The creator";

    toast.info(`${actorLabel} reset all saved game instances. Rejoining from a fresh game state.`);

    collaboration.disconnect();

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("groupId");
    nextParams.delete("guestId");
    nextParams.set("mode", "game");
    router.replace(`${pathname}?${nextParams.toString()}`);
  }, [collaboration, dispatch, gameId, pathname, router, searchParams]);

  return null;
}

// PublicGroupLobby moved to components/groups/PublicGroupLobby.tsx

export default function GamePage({ params }: GamePageProps) {
  const { gameId } = use(params);
  const { data: session } = useSession();
  const hasUser = Boolean(session?.user);
  const sessionUserId = session?.userId || session?.user?.email || "";
  const { setCurrentGameId, addGameToStore } = useGameStore();
  const searchParams = useSearchParams();
  const selectedGroupId = searchParams.get("groupId");
  const requestedMode = searchParams.get("mode") === "lobby" ? "lobby" : "game";
  const requestedSkipWaiting = searchParams.get("skipWaiting") === "1";
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Loading game...");
  const [error, setError] = useState<string | null>(null);
  const [requiresGroup, setRequiresGroup] = useState(false);
  const [publicLobby, setPublicLobby] = useState<{ roomId: string; courseName: string | null; contextId: string | null } | null>(null);
  const [currentGroupName, setCurrentGroupName] = useState<string | null>(null);
  const [currentGroupJoinKey, setCurrentGroupJoinKey] = useState<string | null>(null);
  const [currentGroupMembers, setCurrentGroupMembers] = useState<PersistedGroupMember[]>([]);
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
  const isCurrentGameResolved = currentGame?.id === gameId;
  const isGroupWorkMode = currentGame?.collaborationMode === "group";
  const canEditCurrentGame = Boolean(currentGame?.canEdit ?? currentGame?.isOwner);
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
        const isSwitchingGroup = Boolean(currentGame && searchParams.get("groupId") !== currentGame.progressData?.groupId);
        if (!isSwitchingGroup || !currentGame) {
          setIsLoading(true);
          setLoadingMessage("Loading game...");
        }
        setError(null);
        setRequiresGroup(false);
        // Do NOT reset publicLobby here — the LTI-scoped lobby room ID is stable for the
        // entire session. Resetting it on every re-run (e.g. when groupId changes) would
        // fall back to lobby:all:game:xxx, putting group-selected users in a different room
        // from users still in the lobby, causing chat desync.
        setRequiresAccessKey(false);
        setAccessKeyError(null);

        const normalizedParams = new URLSearchParams(searchParams.toString());
        if (normalizedParams.get("mode") !== requestedMode) {
          normalizedParams.set("mode", requestedMode);
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
          const shouldOpenCreatorLobby = canOpenCreatorPreview && !groupId && requestedMode === "lobby";
          if ((!groupId && !canOpenCreatorPreview) || shouldOpenCreatorLobby) {
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

            if (nextLtiInfo?.isLtiMode || shouldOpenCreatorLobby) {
              setLoadingMessage("Opening group lobby...");
              const lobbyRoomId = getPublicLobbyRoomId(gameId, nextLtiInfo?.contextId ?? null, nextLtiInfo?.courseName ?? null);
              addGameToStore(game);
              setCurrentGameId(gameId);
              setRoomId(lobbyRoomId);
              logDebugClient("room_resolution_lti_lobby", {
                gameId,
                roomId: lobbyRoomId,
                contextId: nextLtiInfo?.contextId ?? null,
                courseName: nextLtiInfo?.courseName ?? null,
                href: typeof window !== "undefined" ? window.location.href : null,
              });
              setPublicLobby({
                roomId: lobbyRoomId,
                courseName: nextLtiInfo?.courseName ?? null,
                contextId: nextLtiInfo?.contextId ?? null,
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
          const nextRoomId = getRoomIdForInstance(gameId, instancePayload.instance);
          setRoomId(nextRoomId);
          logDebugClient("room_resolution_group_instance", {
            gameId,
            groupId,
            roomId: nextRoomId,
            instanceId: instancePayload.instance?.id ?? null,
            href: typeof window !== "undefined" ? window.location.href : null,
          });
        } else {
          const instanceParams = new URLSearchParams();
          instanceParams.set("accessContext", "game");
          if (!hasUser && guestId) {
            instanceParams.set("guestId", guestId);
          }
          if (submittedAccessKey) {
            instanceParams.set("key", submittedAccessKey);
          }
          // Allow creators to view another user's individual instance
          const viewUserId = searchParams.get("userId");
          if (viewUserId && game.canEdit) {
            instanceParams.set("userId", viewUserId);
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
            const nextRoomId = getRoomIdForInstance(gameId, instancePayload.instance);
            setRoomId(nextRoomId);
            logDebugClient("room_resolution_individual_instance", {
              gameId,
              roomId: nextRoomId,
              instanceId: instancePayload.instance?.id ?? null,
              href: typeof window !== "undefined" ? window.location.href : null,
            });
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
            const nextRoomId = `individual:${userId}:game:${gameId}`;
            setRoomId(nextRoomId);
            logDebugClient("room_resolution_individual_fallback", {
              gameId,
              roomId: nextRoomId,
              href: typeof window !== "undefined" ? window.location.href : null,
            });
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
  }, [gameId, hasUser, sessionUserId, guestId, setCurrentGameId, searchParams, requestedMode, router, pathname, addGameToStore, loadAttempt, accessKeyReady, submittedAccessKey, isReplayView]);

  const handleGroupSelect = async (groupId: string | null, options?: { joinKey?: string }) => {
    if (!groupId) {
      const normalizedParams = new URLSearchParams(searchParams.toString());
      normalizedParams.delete("groupId");
      normalizedParams.delete("skipWaiting");
      normalizedParams.set("mode", "lobby");
      router.push(`${pathname}?${normalizedParams.toString()}`);
      setCurrentGroupName(null);
      setCurrentGroupJoinKey(null);
      setCurrentGroupMembers([]);
      setRoomId(publicLobby?.roomId ?? `lobby:all:game:${gameId}`);
      return;
    }

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
      const data = await fetchGroupDetailsCached(groupId, {
        gameId,
        preferCreatorAccess: canEditCurrentGame,
      });
      setCurrentGroupName(data.group?.name ?? null);
      setCurrentGroupJoinKey(data.group?.joinKey ?? null);
      setCurrentGroupMembers(Array.isArray(data.members) ? data.members : []);
      logDebugClient("group_join_success", {
        groupId,
        groupName: data.group?.name ?? null,
        joinKey: data.group?.joinKey ?? null,
        memberNames: Array.isArray(data.members)
          ? data.members.map((member: { userName?: string; userEmail?: string; userId?: string }) => member.userName || member.userEmail || member.userId || "unknown")
          : [],
        href: typeof window !== "undefined" ? window.location.href : null,
      });
    } catch {
      setCurrentGroupName(null);
      setCurrentGroupJoinKey(null);
      setCurrentGroupMembers([]);
    }

    const normalizedParams = new URLSearchParams(searchParams.toString());
    normalizedParams.set("mode", "game");
    normalizedParams.set("groupId", groupId);
    normalizedParams.delete("skipWaiting");
    router.push(`${pathname}?${normalizedParams.toString()}`);
    setRequiresGroup(false);
  };

  const handleCreatorSkipWaiting = () => {
    if (!selectedGroupId) {
      return;
    }
    const normalizedParams = new URLSearchParams(searchParams.toString());
    normalizedParams.set("mode", "game");
    normalizedParams.set("groupId", selectedGroupId);
    normalizedParams.set("skipWaiting", "1");
    router.push(`${pathname}?${normalizedParams.toString()}`);
  };

  useEffect(() => {
    const groupId = searchParams.get("groupId");
    if (!groupId || !hasUser || !isCurrentGameResolved) {
      return;
    }

    let cancelled = false;
    const loadGroupDetails = async () => {
      try {
        const data = await fetchGroupDetailsCached(groupId, {
          gameId,
          preferCreatorAccess: canEditCurrentGame,
        });
        if (cancelled) {
          return;
        }
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
  }, [canEditCurrentGame, gameId, hasUser, isCurrentGameResolved, searchParams]);

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
  const showFinishView = searchParams.get("view") === "finish";

  if (showFinishView) {
    return (
      <CollaborationProvider roomId={roomId} user={user}>
        <CollaborationNotice>
          <GameInstancesResetWatcher gameId={gameId} />
          <FinishGameView
            gameId={gameId}
            gameTitle={currentGame?.title}
          />
        </CollaborationNotice>
      </CollaborationProvider>
    );
  }

  if (showSummary) {
    return (
      <GameSummaryView
        gameId={gameId}
        gameTitle={currentGame.title}
        progressData={currentGame.progressData as { finishedAt?: string; finalScore?: { points: number; maxPoints: number } }}
      />
    );
  }

  const gate = currentGame?.progressData?.groupStartGate as Record<string, unknown> | undefined;
  const isStarted = gate?.status === "started";
  const isCreatorPreviewWithoutGroup = isGroupWorkMode && canEditCurrentGame && !selectedGroupId && requestedMode !== "lobby";
  const canSkipWaitingAsCreator = isGroupWorkMode && canEditCurrentGame && Boolean(selectedGroupId);
  const shouldBypassWaitingRoom = canSkipWaitingAsCreator && requestedMode !== "lobby" && requestedSkipWaiting;

  if (isGroupWorkMode && user && !isStarted && !isCreatorPreviewWithoutGroup && !shouldBypassWaitingRoom) {
    // Determine the stable lobby room ID. If we resolved a specific LTI context earlier, use it.
    const lobbyRoomId = publicLobby?.roomId || `lobby:all:game:${gameId}`;
    
    return (
      <CollaborationProvider roomId={lobbyRoomId} user={user}>
        <CollaborationNotice>
          <GameInstancesResetWatcher gameId={gameId} />
          <PublicGroupLobby
            gameId={gameId}
            groupId={selectedGroupId}
            gameTitle={currentGame?.title || "Group Game"}
            courseName={publicLobby?.courseName || null}
            currentUser={user}
            onGroupSelect={handleGroupSelect}
            onSkipWaiting={handleCreatorSkipWaiting}
            canSkipWaiting={canSkipWaitingAsCreator}
          />
        </CollaborationNotice>
      </CollaborationProvider>
    );
  }

  if (requiresGroup) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-8">
        <div className="w-full max-w-xl rounded-lg border bg-card p-6 space-y-4 shadow-sm">
          <h2 className="text-xl font-semibold">Select Group</h2>
          <p className="text-sm text-muted-foreground">
            This game is in Group Work Mode. Choose one of your existing groups to open the shared instance.
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

  return (
    <CollaborationProvider roomId={roomId} user={user}>
      <CollaborationNotice>
        <GameInstancesResetWatcher gameId={gameId} />
        {user && currentGame?.collaborationMode === "group" && roomId?.startsWith("group:") && !shouldBypassWaitingRoom ? (
          <GroupWaitingRoom
            gameTitle={currentGame.title}
            groupId={searchParams.get("groupId") || roomId.split(":")[1] || ""}
            groupName={currentGroupName}
            joinKey={currentGroupJoinKey}
            currentUser={user}
            groupMembers={currentGroupMembers}
            onSkipWaiting={handleCreatorSkipWaiting}
            canSkipWaiting={canSkipWaitingAsCreator}
          />
        ) : (
          <App />
        )}
      </CollaborationNotice>
    </CollaborationProvider>
  );
}
