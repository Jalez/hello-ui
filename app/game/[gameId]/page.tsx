'use client';

import { use, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import App from "@/components/App";
import { useGameStore } from "@/components/default/games";
import { CollaborationProvider } from "@/lib/collaboration";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GroupSelector } from "@/components/groups";
import { useSidebarCollapse } from "@/components/default/sidebar/context/SidebarCollapseContext";
import { GameSummaryView } from "@/components/GameSummary/GameSummaryView";
import { apiUrl } from "@/lib/apiUrl";

interface GamePageProps {
  params: Promise<{
    gameId: string;
  }>;
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

export default function GamePage({ params }: GamePageProps) {
  const { gameId } = use(params);
  const { data: session } = useSession();
  const { setCurrentGameId, addGameToStore } = useGameStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresGroup, setRequiresGroup] = useState(false);
  const [requiresAccessKey, setRequiresAccessKey] = useState(false);
  const [accessKey, setAccessKey] = useState("");
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
  const currentGame = useGameStore((s) => s.getCurrentGame());
  const isFinished =
    currentGame?.progressData &&
    typeof currentGame.progressData === "object" &&
    "finishedAt" in currentGame.progressData;

  useEffect(() => {
    const storedAccessKey = readStoredAccessKey(gameId);
    queueMicrotask(() => {
      setAccessKey(storedAccessKey);
      setAccessKeyReady(true);
    });
  }, [gameId]);

  useEffect(() => {
    if (session?.user) {
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
  }, [session?.user]);

  useEffect(() => {
    const initializeGame = async () => {
      if (!accessKeyReady) return;
      if (!session?.user && !guestId) return;

      try {
        setIsLoading(true);
        setError(null);
        setRequiresGroup(false);
        setRequiresAccessKey(false);
        setAccessKeyError(null);

        const normalizedParams = new URLSearchParams(searchParams.toString());
        if (normalizedParams.get("mode") !== "game") {
          normalizedParams.set("mode", "game");
          router.replace(`${pathname}?${normalizedParams.toString()}`);
        }

        const gameParams = new URLSearchParams();
        gameParams.set("accessContext", "game");
        if (accessKey) {
          gameParams.set("key", accessKey);
        }
        const gameRes = await fetch(apiUrl(`/api/games/${gameId}${gameParams.toString() ? `?${gameParams.toString()}` : ""}`));
        if (!gameRes.ok) {
          const payload = await gameRes.json().catch(() => ({}));
          if (gameRes.status === 403 && (payload.requiresAccessKey || payload.reason === "access_key_required" || payload.reason === "access_key_invalid")) {
            clearStoredAccessKey(gameId);
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
        if (accessKey.trim()) {
          persistAccessKey(gameId, accessKey.trim());
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

        if (game?.accessKeyRequired && !accessKey) {
          setRequiresAccessKey(true);
          setAccessKeyError("Access key required");
          setIsLoading(false);
          return;
        }

        if (game.collaborationMode === "group") {
          if (!session?.user) {
            setError("Authentication required for group games");
            setIsLoading(false);
            return;
          }
          const groupId = searchParams.get("groupId");
          const canOpenCreatorPreview = Boolean(game.canEdit);
          if (!groupId && !canOpenCreatorPreview) {
            setRequiresGroup(true);
            setIsLoading(false);
            return;
          }

          const instanceParams = new URLSearchParams();
          instanceParams.set("accessContext", "game");
          if (groupId) {
            instanceParams.set("groupId", groupId);
          }
          if (!session?.user && guestId) {
            instanceParams.set("guestId", guestId);
          }
          if (accessKey) {
            instanceParams.set("key", accessKey);
          }
          const instanceRes = await fetch(apiUrl(`/api/games/${gameId}/instance?${instanceParams.toString()}`));
          if (!instanceRes.ok) {
            const payload = await instanceRes.json().catch(() => ({}));
            if (instanceRes.status === 403 && (payload.requiresAccessKey || payload.reason === "access_key_required" || payload.reason === "access_key_invalid")) {
              clearStoredAccessKey(gameId);
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
          addGameToStore({ ...game, progressData: instancePayload.instance?.progressData ?? {} });
          setRoomId(getRoomIdForInstance(gameId, instancePayload.instance));
        } else {
          const instanceParams = new URLSearchParams();
          instanceParams.set("accessContext", "game");
          if (!session?.user && guestId) {
            instanceParams.set("guestId", guestId);
          }
          if (accessKey) {
            instanceParams.set("key", accessKey);
          }
          const instanceRes = await fetch(apiUrl(`/api/games/${gameId}/instance${instanceParams.toString() ? `?${instanceParams.toString()}` : ""}`));
          if (instanceRes.ok) {
            const instancePayload = await instanceRes.json();
            addGameToStore({ ...game, progressData: instancePayload.instance?.progressData ?? {} });
            setRoomId(getRoomIdForInstance(gameId, instancePayload.instance));
          } else {
            const payload = await instanceRes.json().catch(() => ({}));
            if (instanceRes.status === 403 && (payload.requiresAccessKey || payload.reason === "access_key_required" || payload.reason === "access_key_invalid")) {
              clearStoredAccessKey(gameId);
              setRequiresAccessKey(true);
              setAccessKeyError(payload.error || "Access key required");
              setIsLoading(false);
              return;
            }
            addGameToStore(game);
            const userId = session?.user
              ? (session.userId || session.user.email || "")
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
  }, [gameId, session, guestId, setCurrentGameId, searchParams, router, pathname, addGameToStore, loadAttempt, accessKeyReady, accessKey]);

  const handleGroupSelect = (groupId: string) => {
    const normalizedParams = new URLSearchParams(searchParams.toString());
    normalizedParams.set("mode", "game");
    normalizedParams.set("groupId", groupId);
    router.push(`${pathname}?${normalizedParams.toString()}`);
    setRequiresGroup(false);
    setIsLoading(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading game…</p>
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
            If you do not see a group here, ask the game creator or your instructor to add you before entering.
          </p>
          <GroupSelector
            selectedGroupId={searchParams.get("groupId")}
            onGroupSelect={handleGroupSelect}
          />
        </div>
      </div>
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
            value={accessKey}
            onChange={(event) => setAccessKey(event.target.value)}
            placeholder="Enter access key"
          />
          {accessKeyError && <p className="text-sm text-red-600">{accessKeyError}</p>}
          <button
            className="w-full rounded bg-primary text-primary-foreground px-3 py-2 text-sm"
            onClick={() => {
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
        gameTitle={currentGame.title}
        progressData={currentGame.progressData as { finishedAt?: string; finalScore?: { points: number; maxPoints: number } }}
      />
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

  return (
    <CollaborationProvider roomId={roomId} user={user}>
      <App />
    </CollaborationProvider>
  );
}
