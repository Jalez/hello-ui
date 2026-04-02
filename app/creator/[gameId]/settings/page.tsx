'use client';

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  Save,
  Trash2,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useGameStore } from "@/components/default/games";
import { useAppSelector } from "@/store/hooks/hooks";
import { apiUrl } from "@/lib/apiUrl";
import {
  DEFAULT_DRAWBOARD_CAPTURE_MODE,
  DEFAULT_MANUAL_DRAWBOARD_CAPTURE,
  DEFAULT_REMOTE_SYNC_DEBOUNCE_MS,
  DEFAULT_DRAWBOARD_RELOAD_DEBOUNCE_MS,
} from "@/lib/gameRuntimeConfig";

type Collaborator = {
  user_id: string;
  added_by: string;
  created_at: string;
};

interface CreatorSettingsPageProps {
  params: Promise<{
    gameId: string;
  }>;
}

type SettingsDraft = {
  description: string;
  isPublic: boolean;
  collaborationMode: "individual" | "group";
  allowDuplicateUsers: boolean;
  thumbnailUrl: string;
  hideSidebar: boolean;
  accessWindowEnabled: boolean;
  accessStartsAtInput: string;
  accessEndsAtInput: string;
  accessKeyRequired: boolean;
  accessKey: string;
  drawboardCaptureMode: "browser" | "playwright";
  manualDrawboardCapture: boolean;
  remoteSyncDebounceMs: number;
  drawboardReloadDebounceMs: number;
};

function createAccessKey(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function toDateTimeInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function toIsoOrNull(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function createDraft(game: {
  description?: string | null;
  isPublic: boolean;
  collaborationMode: "individual" | "group";
  allowDuplicateUsers?: boolean;
  thumbnailUrl: string | null;
  hideSidebar: boolean;
  accessWindowEnabled: boolean;
  accessStartsAt: string | null;
  accessEndsAt: string | null;
  accessKeyRequired: boolean;
  accessKey?: string | null;
  drawboardCaptureMode?: "browser" | "playwright";
  manualDrawboardCapture?: boolean;
  remoteSyncDebounceMs?: number;
  drawboardReloadDebounceMs?: number;
}): SettingsDraft {
  const captureMode =
    game.drawboardCaptureMode === "playwright" || game.drawboardCaptureMode === "browser"
      ? game.drawboardCaptureMode
      : DEFAULT_DRAWBOARD_CAPTURE_MODE;
  const debounce =
    typeof game.remoteSyncDebounceMs === "number" && Number.isFinite(game.remoteSyncDebounceMs)
      ? Math.min(10_000, Math.max(0, Math.round(game.remoteSyncDebounceMs)))
      : DEFAULT_REMOTE_SYNC_DEBOUNCE_MS;
  const reloadDebounce =
    typeof game.drawboardReloadDebounceMs === "number" && Number.isFinite(game.drawboardReloadDebounceMs)
      ? Math.min(10_000, Math.max(0, Math.round(game.drawboardReloadDebounceMs)))
      : DEFAULT_DRAWBOARD_RELOAD_DEBOUNCE_MS;

  return {
    description: game.description ?? "",
    isPublic: game.isPublic,
    collaborationMode: game.collaborationMode,
    allowDuplicateUsers: game.allowDuplicateUsers !== false,
    thumbnailUrl: game.thumbnailUrl ?? "",
    hideSidebar: game.hideSidebar,
    accessWindowEnabled: game.accessWindowEnabled,
    accessStartsAtInput: toDateTimeInputValue(game.accessStartsAt),
    accessEndsAtInput: toDateTimeInputValue(game.accessEndsAt),
    accessKeyRequired: game.accessKeyRequired,
    accessKey: game.accessKey ?? "",
    drawboardCaptureMode: captureMode,
    manualDrawboardCapture:
      typeof game.manualDrawboardCapture === "boolean"
        ? game.manualDrawboardCapture
        : DEFAULT_MANUAL_DRAWBOARD_CAPTURE,
    remoteSyncDebounceMs: debounce,
    drawboardReloadDebounceMs: reloadDebounce,
  };
}

export default function CreatorSettingsPage({ params }: CreatorSettingsPageProps) {
  const { gameId } = use(params);
  const { data: session } = useSession();
  const hasUser = Boolean(session?.user);
  const { loadGameById, setCurrentGameId, getCurrentGame, updateGame } = useGameStore();

  const levels = useAppSelector((state) => state.levels);
  const solutionUrls = useAppSelector((state) => state.solutionUrls);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [initialDraft, setInitialDraft] = useState<SettingsDraft | null>(null);

  const [copied, setCopied] = useState(false);
  const [copiedLti, setCopiedLti] = useState(false);
  const [copiedAccessKey, setCopiedAccessKey] = useState(false);

  const [collaboratorEmail, setCollaboratorEmail] = useState("");
  /** Search text in the combobox; kept separate from `collaboratorEmail` so the chosen label shows immediately after pick. */
  const [collaboratorSearch, setCollaboratorSearch] = useState("");
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [collaboratorError, setCollaboratorError] = useState<string | null>(null);
  const [collaboratorSuggestions, setCollaboratorSuggestions] = useState<{ email: string; name: string | null }[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const game = getCurrentGame();
  const canEdit = Boolean(game?.canEdit ?? game?.isOwner);
  const canManageCollaborators = Boolean(game?.canManageCollaborators);
  const canRemoveCollaborators = Boolean(game?.canRemoveCollaborators);

  useEffect(() => {
    const initializeGame = async () => {
      if (!hasUser) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const loaded = await loadGameById(gameId);
        if (!loaded) {
          setError("Game not found");
          setIsLoading(false);
          return;
        }

        if (!(loaded.canEdit ?? loaded.isOwner)) {
          setError("You do not have permission to edit this game's settings.");
          setIsLoading(false);
          return;
        }

        setCurrentGameId(gameId);
        const nextDraft = createDraft(loaded);
        setDraft(nextDraft);
        setInitialDraft(nextDraft);

        if (loaded.canManageCollaborators) {
          const response = await fetch(apiUrl(`/api/games/${loaded.id}/collaborators`));
          if (response.ok) {
            const data = await response.json();
            setCollaborators(Array.isArray(data.collaborators) ? data.collaborators : []);
          }
        }

        setIsLoading(false);
      } catch (err) {
        console.error("Error loading creator settings:", err);
        setError("Failed to load game settings");
        setIsLoading(false);
      }
    };

    initializeGame();
  }, [gameId, hasUser, loadGameById, setCurrentGameId]);

  const hasChanges = useMemo(() => {
    if (!draft || !initialDraft) return false;
    return JSON.stringify(draft) !== JSON.stringify(initialDraft);
  }, [draft, initialDraft]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = game?.id ? `${origin}/game/${game.id}?mode=game` : null;
  const ltiLaunchUrl = game?.id ? `${origin}${apiUrl(`/api/lti/game/${game.id}`)}` : null;

  const levelSolutionThumbnails = useMemo(
    () =>
      levels
        .flatMap((level) => {
          const scenarioId = level.scenarios?.find((scenario) => Boolean(solutionUrls[scenario.scenarioId]))?.scenarioId;
          if (!scenarioId) {
            return [];
          }

          return [{
            levelName: String(level.name),
            scenarioId,
            url: solutionUrls[scenarioId] as string,
          }];
        }),
    [levels, solutionUrls],
  );

  const collaboratorOptions: ComboboxOption[] = useMemo(() => {
    const fromSuggestions = collaboratorSuggestions.map((suggestion) => ({
      value: suggestion.email,
      label: suggestion.name ? `${suggestion.name} (${suggestion.email})` : suggestion.email,
      keywords: [suggestion.email, suggestion.name || ""],
    }));
    const typed = collaboratorEmail.trim();
    // Keep a stable option after pick or when suggestions clear (options were only search hits).
    if (typed && !fromSuggestions.some((o) => o.value === typed)) {
      return [{ value: typed, label: typed }, ...fromSuggestions];
    }
    return fromSuggestions;
  }, [collaboratorSuggestions, collaboratorEmail]);

  const scenarioLabel = (scenarioId: string) => {
    for (const level of levels) {
      const scenario = level.scenarios?.find((s) => s.scenarioId === scenarioId);
      if (scenario) return `${level.name} - ${scenarioId}`;
    }
    return scenarioId;
  };

  const handleSave = async () => {
    if (!game || !draft) return;

    if (draft.accessKeyRequired && !draft.accessKey.trim()) {
      setSaveError("Access key is required when access key protection is enabled.");
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(null);

      await updateGame(game.id, {
        description: draft.description.trim() || null,
        isPublic: draft.isPublic,
        collaborationMode: draft.collaborationMode,
        allowDuplicateUsers: draft.allowDuplicateUsers,
        thumbnailUrl: draft.thumbnailUrl.trim() || null,
        hideSidebar: draft.hideSidebar,
        accessWindowEnabled: draft.accessWindowEnabled,
        accessStartsAt: toIsoOrNull(draft.accessStartsAtInput),
        accessEndsAt: toIsoOrNull(draft.accessEndsAtInput),
        accessKeyRequired: draft.accessKeyRequired,
        accessKey: draft.accessKeyRequired ? draft.accessKey.trim() : null,
        drawboardCaptureMode: draft.drawboardCaptureMode,
        manualDrawboardCapture: draft.manualDrawboardCapture,
        remoteSyncDebounceMs: draft.remoteSyncDebounceMs,
        drawboardReloadDebounceMs: draft.drawboardReloadDebounceMs,
      });

      setInitialDraft(draft);
      setSaveSuccess("Settings saved.");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateShareLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLtiUrl = async () => {
    if (!ltiLaunchUrl) return;
    await navigator.clipboard.writeText(ltiLaunchUrl);
    setCopiedLti(true);
    setTimeout(() => setCopiedLti(false), 2000);
  };

  const handleCopyAccessKey = async () => {
    if (!draft?.accessKey) return;
    await navigator.clipboard.writeText(draft.accessKey);
    setCopiedAccessKey(true);
    setTimeout(() => setCopiedAccessKey(false), 2000);
  };


  const handleAddCollaborator = async () => {
    if (!game || !canManageCollaborators || !collaboratorEmail.trim()) return;

    try {
      setCollaboratorError(null);
      const response = await fetch(apiUrl(`/api/games/${game.id}/collaborators`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: collaboratorEmail.trim() }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to add collaborator");
      }

      setCollaborators(Array.isArray(data.collaborators) ? data.collaborators : collaborators);
      setCollaboratorEmail("");
      setCollaboratorSearch("");
    } catch (err) {
      setCollaboratorError(err instanceof Error ? err.message : "Failed to add collaborator");
    }
  };

  const handleRemoveCollaborator = async (email: string) => {
    if (!game || !canRemoveCollaborators) return;

    try {
      setCollaboratorError(null);
      const response = await fetch(apiUrl(`/api/games/${game.id}/collaborators/${encodeURIComponent(email)}`), {
        method: "DELETE",
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to remove collaborator");
      }

      setCollaborators((current) => current.filter((c) => c.user_id !== email));
    } catch (err) {
      setCollaboratorError(err instanceof Error ? err.message : "Failed to remove collaborator");
    }
  };

  useEffect(() => {
    if (!game?.id || !canManageCollaborators) {
      setCollaboratorSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    const query = collaboratorSearch.trim();
    if (query.length < 2) {
      setCollaboratorSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    const timerId = setTimeout(async () => {
      try {
        setLoadingSuggestions(true);
        const response = await fetch(
          apiUrl(`/api/games/${game.id}/collaborators/suggestions?q=${encodeURIComponent(query)}`),
        );
        if (!response.ok) {
          throw new Error("Failed to load suggestions");
        }
        const data = await response.json();
        setCollaboratorSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      } catch {
        setCollaboratorSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 180);

    return () => clearTimeout(timerId);
  }, [collaboratorSearch, canManageCollaborators, game?.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading game settings...</p>
        </div>
      </div>
    );
  }

  if (error || !game || !draft || !canEdit) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Game Settings</CardTitle>
            <CardDescription>{error ?? "Unable to load settings."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href={`/creator/${gameId}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Creator
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto w-full max-w-4xl px-6 py-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Game Settings</h1>
            <p className="text-sm text-muted-foreground">{game.title || "Untitled Game"}</p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/creator/${gameId}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Creator
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl p-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
              <CardDescription>Shown on public game cards instead of the internal map identifier.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={draft.description}
                onChange={(event) => {
                  setDraft((current) => (current ? { ...current, description: event.target.value } : current));
                  setSaveSuccess(null);
                }}
                placeholder="Add a short description for this game..."
                className="min-h-[120px]"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Visibility</CardTitle>
              <CardDescription>Choose whether this game is public or private.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => {
                  setDraft((current) => (current ? { ...current, isPublic: !current.isPublic } : current));
                  setSaveSuccess(null);
                }}
              >
                {draft.isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                <span>{draft.isPublic ? "Public" : "Private"}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {draft.isPublic ? "Visible in public games" : "Only invited creators can edit"}
                </span>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UsersRound className="h-4 w-4" /> Work Mode
              </CardTitle>
              <CardDescription>Group mode routes users to shared workspace. Individual mode isolates players.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={draft.collaborationMode === "individual" ? "default" : "outline"}
                  onClick={() => {
                    setDraft((current) => (current ? { ...current, collaborationMode: "individual" } : current));
                    setSaveSuccess(null);
                  }}
                >
                  Individual
                </Button>
                <Button
                  variant={draft.collaborationMode === "group" ? "default" : "outline"}
                  onClick={() => {
                    setDraft((current) => (current ? { ...current, collaborationMode: "group" } : current));
                    setSaveSuccess(null);
                  }}
                >
                  Group
                </Button>
              </div>
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Allow duplicate users</p>
                    <p className="text-xs text-muted-foreground">
                      On by default. Allows multiple browser sessions for the same account.
                    </p>
                  </div>
                  <Switch
                    checked={draft.allowDuplicateUsers}
                    onCheckedChange={(checked) => {
                      setDraft((current) => (current ? { ...current, allowDuplicateUsers: checked } : current));
                      setSaveSuccess(null);
                    }}
                  />
                </div>
                {!draft.allowDuplicateUsers && (
                  <p className="text-xs text-amber-700">
                    Duplicate sessions are blocked. Players opening a second browser tab or window will be disconnected.
                    {draft.collaborationMode === "group" && " In group mode, this also blocks the same account from joining multiple group rooms."}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Drawboard and editor sync</CardTitle>
              <CardDescription>
                How artboard screenshots are captured and how quickly editor changes sync to previews. Applies after you save; no server restart.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="drawboard-capture-mode">Capture mode</Label>
                <Select
                  value={draft.drawboardCaptureMode}
                  onValueChange={(value: "browser" | "playwright") => {
                    setDraft((current) =>
                      current ? { ...current, drawboardCaptureMode: value } : current,
                    );
                    setSaveSuccess(null);
                  }}
                >
                  <SelectTrigger id="drawboard-capture-mode" className="max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="browser">Browser (default)</SelectItem>
                    <SelectItem value="playwright">Playwright (server render)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Browser uses canvas export in the iframe; Playwright renders on the server.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3 gap-3">
                <div>
                  <p className="text-sm font-medium">Manual drawboard capture</p>
                  <p className="text-xs text-muted-foreground">
                    When on, snapshots run only when you use Capture on each artboard (default off: capture on edit).
                  </p>
                </div>
                <Switch
                  checked={draft.manualDrawboardCapture}
                  onCheckedChange={(checked) => {
                    setDraft((current) =>
                      current ? { ...current, manualDrawboardCapture: checked } : current,
                    );
                    setSaveSuccess(null);
                  }}
                />
              </div>
              <div className="space-y-2 max-w-md">
                <Label htmlFor="remote-sync-debounce">Remote sync debounce (ms)</Label>
                <Input
                  id="remote-sync-debounce"
                  type="number"
                  min={0}
                  max={10_000}
                  value={draft.remoteSyncDebounceMs}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    const next = Number.isFinite(parsed)
                      ? Math.min(10_000, Math.max(0, parsed))
                      : DEFAULT_REMOTE_SYNC_DEBOUNCE_MS;
                    setDraft((current) =>
                      current ? { ...current, remoteSyncDebounceMs: next } : current,
                    );
                    setSaveSuccess(null);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Delay before Yjs and drawboard capture mirror into Redux (0–10000 ms). Default 500.
                </p>
              </div>
              <div className="space-y-2 max-w-md">
                <Label htmlFor="drawboard-reload-debounce">Drawboard reload debounce (ms)</Label>
                <Input
                  id="drawboard-reload-debounce"
                  type="number"
                  min={0}
                  max={10_000}
                  value={draft.drawboardReloadDebounceMs}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    const next = Number.isFinite(parsed)
                      ? Math.min(10_000, Math.max(0, parsed))
                      : DEFAULT_DRAWBOARD_RELOAD_DEBOUNCE_MS;
                    setDraft((current) =>
                      current ? { ...current, drawboardReloadDebounceMs: next } : current,
                    );
                    setSaveSuccess(null);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Delay before the drawboard iframe reloads after editor changes (0–10000 ms). Default 48.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Share Link</CardTitle>
              <CardDescription>Copy a player link for this game.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input readOnly value={shareUrl || ""} className="text-xs h-9" />
                <Button size="icon" variant="outline" className="shrink-0 h-9 w-9" onClick={handleCopyLink}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0 h-9 w-9"
                  title="Copy link"
                  onClick={handleGenerateShareLink}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              {ltiLaunchUrl && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-semibold">A+ LTI Launch URL</p>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use this as the Launch URL in A+ / Moodle to identify users and post grades.
                  </p>
                  <div className="flex gap-2">
                    <Input readOnly value={ltiLaunchUrl} className="text-xs h-9" />
                    <Button size="icon" variant="outline" className="shrink-0 h-9 w-9" onClick={handleCopyLtiUrl}>
                      {copiedLti ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sidebar for Players</CardTitle>
              <CardDescription>Applied on gameplay routes.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="flex items-center gap-2 text-sm">
                  {draft.hideSidebar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span>{draft.hideSidebar ? "Hide sidebar for players" : "Show sidebar for players"}</span>
                </div>
                <Switch
                  checked={draft.hideSidebar}
                  onCheckedChange={(checked) => {
                    setDraft((current) => (current ? { ...current, hideSidebar: checked } : current));
                    setSaveSuccess(null);
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="h-4 w-4" /> Access Window
              </CardTitle>
              <CardDescription>Optionally limit when share-link players can open this game.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm font-medium">Enable access window</span>
                <Switch
                  checked={draft.accessWindowEnabled}
                  onCheckedChange={(checked) => {
                    setDraft((current) => (current ? { ...current, accessWindowEnabled: checked } : current));
                    setSaveSuccess(null);
                  }}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input
                  type="datetime-local"
                  value={draft.accessStartsAtInput}
                  onChange={(event) => {
                    setDraft((current) => (current ? { ...current, accessStartsAtInput: event.target.value } : current));
                    setSaveSuccess(null);
                  }}
                />
                <Input
                  type="datetime-local"
                  value={draft.accessEndsAtInput}
                  onChange={(event) => {
                    setDraft((current) => (current ? { ...current, accessEndsAtInput: event.target.value } : current));
                    setSaveSuccess(null);
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <KeyRound className="h-4 w-4" /> Access Key
              </CardTitle>
              <CardDescription>Require and manage access key for share-link players.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm font-medium">Require access key</span>
                <Switch
                  checked={draft.accessKeyRequired}
                  onCheckedChange={(checked) => {
                    setDraft((current) => (current ? { ...current, accessKeyRequired: checked } : current));
                    setSaveSuccess(null);
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Input
                  value={draft.accessKey}
                  onChange={(event) => {
                    setDraft((current) => (current ? { ...current, accessKey: event.target.value } : current));
                    setSaveSuccess(null);
                  }}
                  className="font-mono text-xs"
                  placeholder="No key generated"
                />
                <Button size="icon" variant="outline" onClick={handleCopyAccessKey} disabled={!draft.accessKey}>
                  {copiedAccessKey ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDraft((current) =>
                      current ? { ...current, accessKeyRequired: true, accessKey: createAccessKey() } : current,
                    );
                    setSaveSuccess(null);
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-1" /> Regenerate
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> Creator Access
              </CardTitle>
              <CardDescription>Add or remove collaborators who can edit this game.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {canManageCollaborators ? (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Combobox
                      value={collaboratorEmail.trim() || undefined}
                      inputValue={collaboratorSearch}
                      onInputChange={(v) => {
                        setCollaboratorSearch(v);
                        if (collaboratorEmail && v.length > 0) {
                          setCollaboratorEmail("");
                        }
                      }}
                      onValueChange={(email) => {
                        setCollaboratorEmail(email);
                        setCollaboratorSearch("");
                      }}
                      options={collaboratorOptions}
                      isLoading={loadingSuggestions}
                      loadingText="Loading collaborators..."
                      placeholder="Select collaborator"
                      searchPlaceholder="Type name or email..."
                      emptyText="No users found"
                      renderValue={(selected) => selected?.label || "Select collaborator"}
                    />
                  </div>
                  <Button variant="outline" onClick={handleAddCollaborator}>
                    <UserPlus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">You can edit this game but cannot manage collaborators.</p>
              )}

              {canManageCollaborators && collaboratorSearch.trim().length >= 2 && (
                <p className="text-xs text-muted-foreground">
                  {loadingSuggestions
                    ? "Searching users..."
                    : collaboratorSuggestions.length > 0
                      ? "Suggestions available in the collaborator dropdown."
                      : "No matching users found."}
                </p>
              )}

              {collaboratorError && <p className="text-xs text-red-600">{collaboratorError}</p>}

              <div className="space-y-1">
                {collaborators.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No additional creators yet.</p>
                ) : (
                  collaborators.map((collaborator) => (
                    <div key={collaborator.user_id} className="flex items-center justify-between border rounded px-2 py-1 text-sm">
                      <span className="font-mono text-xs">{collaborator.user_id}</span>
                      {canRemoveCollaborators && (
                        <Button size="icon" variant="ghost" onClick={() => handleRemoveCollaborator(collaborator.user_id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Thumbnail</CardTitle>
              <CardDescription>Set custom thumbnail URL or use a generated level solution. Recommended size: 300 x 300.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {draft.thumbnailUrl && (
                <div className="relative aspect-square w-full max-w-[300px] rounded-md overflow-hidden border bg-muted">
                  <img src={draft.thumbnailUrl} alt="Thumbnail preview" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="thumbnail-url">Thumbnail URL</Label>
                <Input
                  id="thumbnail-url"
                  value={draft.thumbnailUrl}
                  onChange={(event) => {
                    setDraft((current) => (current ? { ...current, thumbnailUrl: event.target.value } : current));
                    setSaveSuccess(null);
                  }}
                  placeholder="https://..."
                />
              </div>
              {levelSolutionThumbnails.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Or use a level solution as the thumbnail:</p>
                  <div className="flex flex-wrap gap-2">
                    {levelSolutionThumbnails.map(({ levelName, scenarioId, url }) => (
                      <button
                        key={scenarioId}
                        title={scenarioLabel(scenarioId)}
                        onClick={() => {
                          setDraft((current) => (current ? { ...current, thumbnailUrl: url } : current));
                          setSaveSuccess(null);
                        }}
                        className="relative rounded border overflow-hidden w-24 h-24 hover:ring-2 ring-primary transition"
                      >
                        <img src={url} alt={scenarioLabel(scenarioId)} className="w-full h-full object-cover" />
                        <span className="absolute inset-x-0 bottom-0 bg-background/85 px-1 py-0.5 text-[10px] font-medium truncate">
                          {levelName}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto w-full max-w-4xl px-6 py-3 flex items-center justify-between gap-3">
          <div className="text-sm min-h-5">
            {saveError && <p className="text-red-600">{saveError}</p>}
            {saveSuccess && <p className="text-emerald-600">{saveSuccess}</p>}
          </div>
          <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
