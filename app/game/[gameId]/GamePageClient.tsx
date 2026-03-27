'use client';

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import App from "@/components/App";
import { useGameStore } from "@/components/default/games";
import { CollaborationProvider, useCollaboration } from "@/lib/collaboration";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GroupSelector, PublicGroupLobby, GroupWaitingRoom } from "@/components/groups";
import { useSidebarCollapse } from "@/components/default/sidebar/context/SidebarCollapseContext";
import { GameSummaryView } from "@/components/GameSummary/GameSummaryView";
import { FinishGameView } from "@/components/GameSummary/FinishGameView";
import { apiUrl } from "@/lib/apiUrl";
import { useAppDispatch } from "@/store/hooks/hooks";
import { logDebugClient } from "@/lib/debug-logger";
import { fetchGroupDetailsCached } from "@/lib/group-details-client";
import type { ClientGroupMember } from "@/lib/group-details-client";
import { toast } from "sonner";
import { CollaborationNotice } from "@/components/collaboration/CollaborationNotice";
import { getCurrentUserFinishState } from "@/lib/gameFinishState";

interface GamePageProps {
  params: Promise<{
    gameId: string;
  }>;
}

interface LtiSessionInfo {
  isLtiMode: boolean;
  isInIframe?: boolean;
  courseName: string | null;
  contextId: string | null;
  role?: "instructor" | "member";
}

type PersistedGroupMember = ClientGroupMember;

interface LmsGroupOption {
  id: string;
  memberNames: string[];
  timestamp: string | null;
}

const ACCESS_KEY_STORAGE_PREFIX = "ui-designer-game-access-key:";

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
  const searchParamsString = searchParams.toString();
  const selectedGroupId = searchParams.get("groupId");
  const requestedMode = searchParams.get("mode") === "lobby" ? "lobby" : "game";
  const requestedSkipWaiting = searchParams.get("skipWaiting") === "1";
  const requestedView = searchParams.get("view");
  const requestedUserId = searchParams.get("userId");
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Loading game...");
  const [isResolvingLmsGroups, setIsResolvingLmsGroups] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasInitializedRef = useRef(false);
  const [requiresGroup, setRequiresGroup] = useState(false);
  const [publicLobby, setPublicLobby] = useState<{ roomId: string; courseName: string | null; contextId: string | null } | null>(null);
  const [ltiSessionInfo, setLtiSessionInfo] = useState<LtiSessionInfo | null>(null);
  const [currentGroupName, setCurrentGroupName] = useState<string | null>(null);
  const [currentGroupJoinKey, setCurrentGroupJoinKey] = useState<string | null>(null);
  const [currentGroupMembers, setCurrentGroupMembers] = useState<PersistedGroupMember[]>([]);
  const [lmsGroupPicker, setLmsGroupPicker] = useState<{
    open: boolean;
    loading: boolean;
    groups: LmsGroupOption[];
    error: string | null;
  }>({
    open: false,
    loading: false,
    groups: [],
    error: null,
  });
  const [requiresAccessKey, setRequiresAccessKey] = useState(false);
  const [accessKeyInput, setAccessKeyInput] = useState("");
  const [submittedAccessKey, setSubmittedAccessKey] = useState("");
  const [accessKeyError, setAccessKeyError] = useState<string | null>(null);
  const [hideSidebar, setHideSidebar] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [accessKeyReady, setAccessKeyReady] = useState(false);
  const { setIsVisible: setSidebarVisible } = useSidebarCollapse();
  const initializedGroupIdRef = useRef<string | null>(null);
  const initializedModeRef = useRef<"game" | "lobby" | null>(null);
  const initializedViewRef = useRef<string | null>(null);

  // Hide sidebar on the access key prompt screen when the game requires it.
  // The Sidebar's own effect reclaims control once requiresAccessKey is cleared.
  useEffect(() => {
    if (requiresAccessKey && hideSidebar) {
      setSidebarVisible(false);
    }
  }, [requiresAccessKey, hideSidebar, setSidebarVisible]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [guestId, setGuestId] = useState<string>("");
  const iframeGroupRequestAttemptedRef = useRef(false);
  const iframeGroupRequestSettledRef = useRef(false);
  const isReplayView = requestedView === "play";
  const currentGame = useGameStore((state) => {
    if (!state.currentGameId) {
      return null;
    }

    return state.games.find((candidate) => candidate.id === state.currentGameId) ?? null;
  });
  const isCurrentGameResolved = currentGame?.id === gameId;
  const isGroupWorkMode = currentGame?.collaborationMode === "group";
  const canEditCurrentGame = Boolean(currentGame?.canEdit ?? currentGame?.isOwner);

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
        const isSwitchingGroup =
          hasInitializedRef.current &&
          initializedGroupIdRef.current !== selectedGroupId;
        const isModeTransition =
          hasInitializedRef.current &&
          initializedModeRef.current !== requestedMode;
        const isViewTransition =
          hasInitializedRef.current &&
          initializedViewRef.current !== requestedView;
        // Only show loading spinner on first init or explicit group switch.
        // Re-runs from dep changes (session refetch, store updates) must NOT
        // set isLoading=true — that unmounts CollaborationProvider and kills
        // the WebSocket connection, creating an infinite reconnect loop.
        if (!hasInitializedRef.current || isSwitchingGroup || isModeTransition || isViewTransition) {
          setIsLoading(true);
          setLoadingMessage("Loading game...");
        }
        setError(null);
        setRequiresGroup(false);
        setLtiSessionInfo(null);
        // Do NOT reset publicLobby here — the LTI-scoped lobby room ID is stable for the
        // entire session. Resetting it on every re-run (e.g. when groupId changes) would
        // fall back to lobby:all:game:xxx, putting group-selected users in a different room
        // from users still in the lobby, causing chat desync.
        setRequiresAccessKey(false);
        setAccessKeyError(null);

        const normalizedParams = new URLSearchParams(searchParamsString);
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
          const groupId = selectedGroupId;
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
            setLtiSessionInfo(nextLtiInfo);

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
          if (requestedUserId && game.canEdit) {
            instanceParams.set("userId", requestedUserId);
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

        hasInitializedRef.current = true;
        initializedGroupIdRef.current = selectedGroupId;
        initializedModeRef.current = requestedMode;
        initializedViewRef.current = requestedView;
        setCurrentGameId(gameId);
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading game:", err);
        setError("Failed to load game");
        setIsLoading(false);
      }
    };

    initializeGame();
  }, [accessKeyReady, addGameToStore, gameId, guestId, hasUser, isReplayView, loadAttempt, pathname, requestedMode, requestedUserId, requestedView, router, searchParamsString, selectedGroupId, sessionUserId, setCurrentGameId, submittedAccessKey]);

  const handleGroupSelect = useCallback(async (groupId: string | null, options?: { joinKey?: string }) => {
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
  }, [canEditCurrentGame, gameId, hasUser, pathname, publicLobby?.roomId, router, searchParams, session?.user?.email]);

  const resolveLmsGroupSelection = useCallback(async (lmsGroupId: string) => {
    setIsResolvingLmsGroups(true);
    setLoadingMessage("Opening LMS group...");
    setLmsGroupPicker((current) => ({
      ...current,
      error: null,
    }));

    try {
      const response = await fetch(apiUrl(`/api/games/${gameId}/lti-groups/resolve`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lmsGroupId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.groupId) {
        throw new Error(payload.error || "Failed to open LMS group");
      }

      await handleGroupSelect(payload.groupId);
      setLmsGroupPicker({
        open: false,
        loading: false,
        groups: [],
        error: null,
      });
    } catch (err) {
      setLmsGroupPicker((current) => ({
        ...current,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to open LMS group",
      }));
    } finally {
      setIsResolvingLmsGroups(false);
    }
  }, [gameId, handleGroupSelect]);

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
    if (
      iframeGroupRequestSettledRef.current ||
      selectedGroupId ||
      !publicLobby ||
      !ltiSessionInfo?.isLtiMode ||
      !ltiSessionInfo?.isInIframe ||
      typeof window === "undefined" ||
      window.parent === window
    ) {
      return;
    }

    iframeGroupRequestAttemptedRef.current = true;
    const requestId = `edu-game-groups-${gameId}-${Date.now()}`;
    let finished = false;

    setLmsGroupPicker({
      open: false,
      loading: true,
      groups: [],
      error: null,
    });
    setIsResolvingLmsGroups(true);
    setLoadingMessage("Resolving your LMS groups...");

    const normalizeGroups = (payload: unknown): LmsGroupOption[] => {
      const rawGroups =
        payload && typeof payload === "object" && !Array.isArray(payload) && Array.isArray((payload as { groups?: unknown[] }).groups)
          ? (payload as { groups: unknown[] }).groups
          : [];

      return rawGroups
        .map((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            return null;
          }
          const candidate = entry as {
            id?: string | number;
            members?: unknown[];
            timestamp?: unknown;
          };
          const id = candidate.id == null ? "" : String(candidate.id).trim();
          if (!id) {
            return null;
          }
          return {
            id,
            memberNames: Array.isArray(candidate.members)
              ? candidate.members.filter((member): member is string => typeof member === "string" && member.length > 0)
              : [],
            timestamp: typeof candidate.timestamp === "string" ? candidate.timestamp : null,
          };
        })
        .filter((entry): entry is LmsGroupOption => Boolean(entry));
    };

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object" || Array.isArray(data) || data.requestId !== requestId) {
        return;
      }

      if (data.type === "edu-game-groups-loading") {
        setLmsGroupPicker((current) => ({
          ...current,
          open: false,
          loading: true,
          error: null,
        }));
        return;
      }

      if (data.type !== "edu-game-groups-data") {
        return;
      }

      finished = true;
      iframeGroupRequestSettledRef.current = true;
      window.removeEventListener("message", handleMessage);
      const normalizedGroups = normalizeGroups(data.groups);

      if (!data.success || normalizedGroups.length === 0) {
        setIsResolvingLmsGroups(false);
        setLmsGroupPicker({
          open: false,
          loading: false,
          groups: [],
          error: null,
        });
        return;
      }

      if (normalizedGroups.length === 1) {
        void resolveLmsGroupSelection(normalizedGroups[0].id);
        return;
      }

      setIsResolvingLmsGroups(false);
      setLmsGroupPicker({
        open: true,
        loading: false,
        groups: normalizedGroups,
        error: null,
      });
    };

    const timeoutId = window.setTimeout(() => {
      if (finished) {
        return;
      }
      iframeGroupRequestSettledRef.current = true;
      setIsResolvingLmsGroups(false);
      window.removeEventListener("message", handleMessage);
      setLmsGroupPicker({
        open: false,
        loading: false,
        groups: [],
        error: null,
      });
    }, 5000);

    window.addEventListener("message", handleMessage);
    window.parent.postMessage({
      type: "edu-game-get-groups",
      requestId,
    }, "*");

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("message", handleMessage);
      if (!finished) {
        iframeGroupRequestAttemptedRef.current = false;
      }
    };
  }, [gameId, ltiSessionInfo, publicLobby, resolveLmsGroupSelection, selectedGroupId]);

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

  if (isResolvingLmsGroups) {
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
            selectedGroupId={selectedGroupId}
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
  const currentUserFinishState = getCurrentUserFinishState(
    currentGame?.progressData,
    (user?.id ?? sessionUserId) || null,
  );
  const isFinished = Boolean(currentUserFinishState?.finishedAt);

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

  const showSummary = isFinished && currentGame?.progressData && requestedView !== "play";
  const showFinishView = requestedView === "finish";
  const collaborationGroupId =
    selectedGroupId || (roomId?.startsWith("group:") ? roomId.split(":")[1] || null : null);

  if (showFinishView) {
    return (
      <CollaborationProvider roomId={roomId} groupId={collaborationGroupId} user={user}>
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
        progressData={{
          finishedAt: currentUserFinishState?.finishedAt,
          finalScore: currentUserFinishState?.finalScore,
        }}
        currentUserId={(user?.id ?? sessionUserId) || null}
        isGroupGameplay={Boolean(selectedGroupId)}
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
      <CollaborationProvider roomId={lobbyRoomId} groupId={selectedGroupId || null} user={user}>
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
            lmsGroupPicker={{
              ...lmsGroupPicker,
              onOpenChange: (open) => {
                setLmsGroupPicker((current) => ({
                  ...current,
                  open,
                }));
              },
              onSelect: (groupId) => {
                void resolveLmsGroupSelection(groupId);
              },
            }}
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
            selectedGroupId={selectedGroupId}
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
    <CollaborationProvider roomId={roomId} groupId={collaborationGroupId} user={user}>
      <CollaborationNotice>
        <GameInstancesResetWatcher gameId={gameId} />
        {user && currentGame?.collaborationMode === "group" && roomId?.startsWith("group:") && !shouldBypassWaitingRoom ? (
          <GroupWaitingRoom
            gameTitle={currentGame.title}
            groupId={selectedGroupId || roomId.split(":")[1] || ""}
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
