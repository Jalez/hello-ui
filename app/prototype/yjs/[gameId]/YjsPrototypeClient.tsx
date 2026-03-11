"use client";

import { html } from "@codemirror/lang-html";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { use, useEffect, useMemo, useState } from "react";

import CodeEditor from "@/components/Editors/CodeEditor/CodeEditor";
import { UserPresence } from "@/components/collaboration/UserPresence";
import { CollaborationProvider, useCollaboration } from "@/lib/collaboration";
import { apiUrl } from "@/lib/apiUrl";

interface PrototypeClientProps {
  params: Promise<{
    gameId: string;
  }>;
}

interface InstanceResponse {
  gameId: string;
  collaborationMode: "group" | "individual";
  mapName: string;
  instance: {
    id: string;
    scope: "group" | "individual";
    groupId: string | null;
    userId: string | null;
    progressData: Record<string, unknown>;
  };
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

function resolveHtmlTemplate(progressData: Record<string, unknown> | undefined): string {
  const levels = Array.isArray(progressData?.levels) ? progressData.levels : [];
  const firstLevel = levels[0];
  if (!firstLevel || typeof firstLevel !== "object") {
    return "";
  }

  const code = (firstLevel as { code?: { html?: unknown } }).code;
  return typeof code?.html === "string" ? code.html : "";
}

function PrototypeRoom({
  gameId,
  roomId,
  user,
  template,
  instanceId,
}: {
  gameId: string;
  roomId: string;
  user: { id: string; email: string; name?: string; image?: string };
  template: string;
  instanceId: string;
}) {
  return (
    <CollaborationProvider roomId={roomId} user={user}>
      <PrototypeRoomContents
        gameId={gameId}
        roomId={roomId}
        template={template}
        instanceId={instanceId}
      />
    </CollaborationProvider>
  );
}

function PrototypeRoomContents({
  gameId,
  roomId,
  template,
  instanceId,
}: {
  gameId: string;
  roomId: string;
  template: string;
  instanceId: string;
}) {
  const collaboration = useCollaboration();
  const [mirroredHtml, setMirroredHtml] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <header className="border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">Yjs Prototype</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <span data-testid="prototype-game-id">{gameId}</span>
              {" · "}
              <span data-testid="prototype-room-id">{roomId}</span>
              {" · "}
              <span data-testid="prototype-instance-id">{instanceId}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded border border-slate-200 px-3 py-1 text-xs dark:border-slate-700">
              engine: <span data-testid="prototype-engine">{collaboration.collabEngine}</span>
            </div>
            <div className="rounded border border-slate-200 px-3 py-1 text-xs dark:border-slate-700">
              yjs: <span data-testid="prototype-yjs-ready">{collaboration.yjsReady ? "ready" : "pending"}</span>
            </div>
            <div className="rounded border border-slate-200 px-3 py-1 text-xs dark:border-slate-700">
              sync: <span data-testid="prototype-sync-ready">{collaboration.codeSyncReady ? "ready" : "pending"}</span>
            </div>
            <UserPresence />
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-6">
        <div className="rounded border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
            Minimal collaborative editor surface. This bypasses the full game flow and uses the real group instance room directly.
          </p>
          <div className="min-h-[420px] overflow-hidden rounded border border-slate-200 dark:border-slate-700">
            <CodeEditor
              key={`prototype-html:${instanceId}`}
              lang={html()}
              title="HTML"
              template={template}
              codeUpdater={({ html: nextHtml }) => {
                if (typeof nextHtml === "string") {
                  setMirroredHtml(nextHtml);
                }
              }}
              locked={false}
              type="Template"
              levelIdentifier={`prototype:${instanceId}:html`}
            />
          </div>
        </div>
        <section className="rounded border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-2 text-sm font-medium">Mirrored HTML</h2>
          <pre
            data-testid="prototype-mirrored-html"
            className="max-h-56 overflow-auto rounded bg-slate-100 p-3 text-xs dark:bg-slate-950"
          >
            {mirroredHtml ?? template}
          </pre>
        </section>
      </main>
    </div>
  );
}

export default function YjsPrototypeClient({ params }: PrototypeClientProps) {
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [instanceResponse, setInstanceResponse] = useState<InstanceResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const gameId = resolvedParams.gameId;
  const groupId = searchParams.get("groupId");

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (!session?.user?.email) {
      setLoadError("Authentication required");
      setIsLoading(false);
      return;
    }

    if (!groupId) {
      setLoadError("groupId query parameter is required");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadInstance() {
      try {
        setIsLoading(true);
        setLoadError(null);
        const qs = new URLSearchParams({
          accessContext: "game",
          groupId,
        });
        const response = await fetch(apiUrl(`/api/games/${gameId}/instance?${qs.toString()}`), {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Failed to resolve instance (${response.status})`);
        }
        const payload = (await response.json()) as InstanceResponse;
        setInstanceResponse(payload);
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        setLoadError(String(error));
      } finally {
        setIsLoading(false);
      }
    }

    void loadInstance();
    return () => controller.abort();
  }, [gameId, groupId, session?.user?.email, status]);

  const user = useMemo(() => {
    if (!session?.user?.email) {
      return null;
    }
    return {
      id: session.userId || session.user.email,
      email: session.user.email,
      name: session.user.name ?? undefined,
      image: session.user.image ?? undefined,
    };
  }, [session]);

  const roomId = getRoomIdForInstance(gameId, instanceResponse?.instance);
  const template = resolveHtmlTemplate(instanceResponse?.instance?.progressData);

  if (status === "loading" || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-slate-600 dark:text-slate-300">Loading Yjs prototype…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center px-6">
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {loadError}
        </div>
      </div>
    );
  }

  if (!user || !instanceResponse?.instance || !roomId) {
    return (
      <div className="flex h-screen items-center justify-center px-6">
        <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
          Instance not available.
        </div>
      </div>
    );
  }

  return (
    <PrototypeRoom
      key={instanceResponse.instance.id}
      gameId={gameId}
      roomId={roomId}
      user={user}
      template={template}
      instanceId={instanceResponse.instance.id}
    />
  );
}
