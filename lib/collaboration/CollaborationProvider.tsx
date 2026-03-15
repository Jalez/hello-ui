"use client";

import React, { createContext, useContext, useCallback, useMemo, useState, useEffect } from "react";
import * as Y from "yjs";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import {
  ActiveUser,
  CanvasCursor,
  CollaborationHealthMessage,
  CollaborationHealthSeverity,
  EditorCursor,
  EditorWatchdogSnapshot,
  GroupStartGateState,
  GroupStartSyncMessage,
  LobbyChatEntry,
  LobbyChatSyncMessage,
  ProgressSyncMessage,
  RoomStateSyncMessage,
  UserIdentity,
  EditorType,
  GameInstancesResetMessage,
} from "./types";
import { useCollaborationConnection } from "./hooks/useCollaborationConnection";
import { useCollaborationCursor } from "./hooks/useCollaborationCursor";
import { useCollaborationPresence } from "./hooks/useCollaborationPresence";
import { extractGroupIdFromRoomId, generateUserColor } from "./utils";
import { decodeBase64ToUint8Array, encodeUint8ArrayToBase64 } from "./yjs-base64";

export type RoomStateSync = RoomStateSyncMessage | null;
export type ProgressSync = ProgressSyncMessage | null;
export type GroupStartSync = GroupStartSyncMessage | null;
export type GameInstancesResetSync = GameInstancesResetMessage | null;
export interface RemoteCodeChange {
  seq: number;
  editorType: EditorType;
  changeSetJson: unknown;
  levelIndex: number;
  baseVersion: number;
  nextVersion: number;
  clientId: string;
  ts: number;
}
export interface RemoteCodeResync {
  seq: number;
  editorType: EditorType;
  levelIndex: number;
  content: string;
  version: number;
  ts: number;
}
export interface LocalCodeAck {
  seq: number;
  editorType: EditorType;
  levelIndex: number;
  nextVersion: number;
  content: string;
  ts: number;
}

const EDITOR_HASH_INTERVAL_MS = 2000;
const STALL_DETECTION_WINDOW_MS = 6000;
const STALL_RETRY_COOLDOWN_MS = 10000;
const LONG_TASK_WARN_MS = 700;
const DIVERGENCE_RECOVERY_WINDOW_MS = 1500;

type LocalEditorWatchState = EditorWatchdogSnapshot & {
  contentHash: string;
  contentLength: number;
  lastObservedAt: number;
  lastHashSentAt: number;
  lastLocalInputAt: number;
  lastRemoteApplyAt: number;
  lastStallEventAt: number;
};

function getEditorWatchKey(editorType: EditorType, levelIndex: number): string {
  return `${levelIndex}:${editorType}`;
}

function hashContent(content: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function sameSelection(
  left: { from: number; to: number } | null | undefined,
  right: { from: number; to: number } | null | undefined,
): boolean {
  if (!left && !right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return left.from === right.from && left.to === right.to;
}

function hasSharedStartTime(roomState: RoomStateSync): boolean {
  const firstLevel = roomState?.levels?.[0];
  const timeData =
    firstLevel && typeof firstLevel === "object" && firstLevel.timeData && typeof firstLevel.timeData === "object"
      ? (firstLevel.timeData as Record<string, unknown>)
      : null;
  return Number(timeData?.startTime ?? 0) > 0;
}

function normalizeGroupStartGateFromRoomState(roomState: RoomStateSync): GroupStartGateState | null {
  const candidate = roomState?.groupStartGate;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const readyUserIds = Array.isArray(candidate.readyUserIds)
    ? candidate.readyUserIds.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
    : [];
  const rawReadyUsers =
    candidate.readyUsers && typeof candidate.readyUsers === "object" && !Array.isArray(candidate.readyUsers)
      ? candidate.readyUsers
      : {};

  return {
    status: candidate.status === "started" ? "started" : "waiting",
    minReadyCount:
      typeof candidate.minReadyCount === "number" && Number.isFinite(candidate.minReadyCount)
        ? candidate.minReadyCount
        : 2,
    readyUserIds,
    readyUsers: readyUserIds.reduce<Record<string, GroupStartGateState["readyUsers"][string]>>((acc, userId) => {
      const readyUser = rawReadyUsers[userId];
      acc[userId] = {
        userId,
        ...(readyUser && typeof readyUser === "object" && !Array.isArray(readyUser) && typeof readyUser.userName === "string"
          ? { userName: readyUser.userName }
          : {}),
        ...(readyUser && typeof readyUser === "object" && !Array.isArray(readyUser) && typeof readyUser.userEmail === "string"
          ? { userEmail: readyUser.userEmail }
          : {}),
        ...(readyUser && typeof readyUser === "object" && !Array.isArray(readyUser) && typeof readyUser.userImage === "string"
          ? { userImage: readyUser.userImage }
          : {}),
        ...(readyUser && typeof readyUser === "object" && !Array.isArray(readyUser) && typeof readyUser.readyAt === "string"
          ? { readyAt: readyUser.readyAt }
          : {}),
      };
      return acc;
    }, {}),
    startedAt: typeof candidate.startedAt === "string" ? candidate.startedAt : null,
    startedByUserId: typeof candidate.startedByUserId === "string" ? candidate.startedByUserId : null,
  };
}

export interface CollaborationContextValue {
  collabEngine: "yjs";
  isYjsEnabled: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  roomId: string | null;
  groupId: string | null;
  clientId: string | null;
  effectiveIdentity: UserIdentity | null;
  activeUsers: ActiveUser[];
  usersByTab: Record<EditorType, ActiveUser[]>;
  remoteCursors: Map<string, CanvasCursor>;
  editorCursors: Map<string, EditorCursor>;
  remoteCodeChanges: RemoteCodeChange[];
  remoteCodeResyncs: RemoteCodeResync[];
  localCodeAcks: LocalCodeAck[];
  lastProgressSync: ProgressSync;
  lastGameInstancesReset: GameInstancesResetSync;
  groupStartGate: GroupStartGateState | null;
  lobbyMessages: LobbyChatEntry[];
  initialRoomState: RoomStateSync;
  lastHealthMessage: CollaborationHealthMessage | null;
  codeSyncReady: boolean;
  yjsReady: boolean;
  yjsDocGeneration: number;
  updateCanvasCursor: (x: number, y: number) => void;
  updateEditorSelection: (editorType: EditorType, levelIndex: number, selection: { from: number; to: number }) => void;
  applyEditorChange: (
    editorType: EditorType,
    changeSetJson: unknown,
    levelIndex: number,
    baseVersion: number,
    selection?: { from: number; to: number }
  ) => void;
  getEditorVersion: (editorType: EditorType, levelIndex: number) => number;
  setActiveTab: (editorType: EditorType, levelIndex: number) => void;
  setTyping: (editorType: EditorType, levelIndex: number, isTyping: boolean) => void;
  resetRoomState: (scope: "level" | "game", levelIndex?: number) => void;
  syncProgressData: (progressData: Record<string, unknown>) => void;
  setGroupReady: (isReady: boolean) => void;
  sendLobbyChat: (text: string) => void;
  reportEditorWatchState: (snapshot: EditorWatchdogSnapshot) => void;
  reportCollaborationHealthEvent: (
    eventType: string,
    severity: CollaborationHealthSeverity,
    details?: Record<string, unknown>,
    scope?: { editorType?: EditorType; levelIndex?: number }
  ) => void;
  getYText: (editorType: EditorType, levelIndex: number) => Y.Text | null;
  getYCodeSnapshot: (editorType: EditorType, levelIndex: number) => string | null;
  connect: () => void;
  disconnect: () => void;
}

export const CollaborationContext = createContext<CollaborationContextValue | null>(null);

interface CollaborationProviderProps {
  children: React.ReactNode;
  roomId?: string | null;
  groupId?: string | null;
  user: UserIdentity | null;
}

export function CollaborationProvider({ children, roomId, groupId, user }: CollaborationProviderProps) {
  const collabEngine = "yjs" as const;
  const isYjsEnabled = true;
  const resolvedRoomId = roomId ?? groupId ?? null;
  const resolvedGroupId = extractGroupIdFromRoomId(resolvedRoomId);
  const [canvasCursors, setCanvasCursors] = useState<Map<string, CanvasCursor>>(new Map());
  const [editorCursors, setEditorCursors] = useState<Map<string, EditorCursor>>(new Map());
  const remoteCodeChanges: RemoteCodeChange[] = [];
  const remoteCodeResyncs: RemoteCodeResync[] = [];
  const localCodeAcks: LocalCodeAck[] = [];
  const [lastProgressSync, setLastProgressSync] = useState<ProgressSync>(null);
  const [lastGameInstancesReset, setLastGameInstancesReset] = useState<GameInstancesResetSync>(null);
  const [groupStartGate, setGroupStartGate] = useState<GroupStartGateState | null>(null);
  const [lobbyMessages, setLobbyMessages] = useState<LobbyChatEntry[]>([]);
  const [initialRoomState, setInitialRoomState] = useState<RoomStateSync>(null);
  const [lastHealthMessage, setLastHealthMessage] = useState<CollaborationHealthMessage | null>(null);
  const [codeSyncReady, setCodeSyncReady] = useState(false);
  const [yjsReady, setYjsReady] = useState(false);
  const [yjsDocGeneration, setYjsDocGeneration] = useState(0);
  const wasConnectedRef = React.useRef(false);
  const hasConnectedOnceRef = React.useRef(false);
  const hasDisconnectedUnexpectedlyRef = React.useRef(false);
  const yDocRef = React.useRef<Y.Doc | null>(null);
  const yAwarenessRef = React.useRef<awarenessProtocol.Awareness | null>(null);
  const serverYjsDocGenerationRef = React.useRef(0);
  const editorWatchStatesRef = React.useRef<Map<string, LocalEditorWatchState>>(new Map());
  const lastTransportMessageAtRef = React.useRef(0);
  const localActiveEditorRef = React.useRef<{ editorType: EditorType; levelIndex: number } | null>(null);
  const lastHealthEventAtRef = React.useRef<Map<string, number>>(new Map());
  const divergenceRecoveryRef = React.useRef<Map<string, { retriedAt: number; replacedAt: number }>>(new Map());

  const markEditorRemoteApply = useCallback((editorType?: EditorType, levelIndex?: number) => {
    const now = Date.now();
    if (editorType && Number.isInteger(levelIndex)) {
      const key = getEditorWatchKey(editorType, levelIndex);
      const existing = editorWatchStatesRef.current.get(key);
      if (existing) {
        editorWatchStatesRef.current.set(key, {
          ...existing,
          lastRemoteApplyAt: now,
          lastObservedAt: now,
        });
      }
      return;
    }

    editorWatchStatesRef.current.forEach((state, key) => {
      editorWatchStatesRef.current.set(key, {
        ...state,
        lastRemoteApplyAt: now,
        lastObservedAt: now,
      });
    });
  }, []);

  const getYTextKey = useCallback((editorType: EditorType, levelIndex: number) => {
    return `level:${levelIndex}:${editorType}`;
  }, []);

  const getYText = useCallback((editorType: EditorType, levelIndex: number) => {
    const doc = yDocRef.current;
    if (!doc) {
      return null;
    }
    return doc.getText(getYTextKey(editorType, levelIndex));
  }, [getYTextKey]);

  const getYCodeSnapshot = useCallback((editorType: EditorType, levelIndex: number) => {
    return getYText(editorType, levelIndex)?.toString() ?? null;
  }, [getYText]);

  const replaceLocalYDoc = useCallback((reason: string, nextServerGeneration?: number | null) => {
    const previousDoc = yDocRef.current;
    if (previousDoc) {
      previousDoc.destroy();
    }
    const previousAwareness = yAwarenessRef.current;
    if (previousAwareness) {
      previousAwareness.destroy();
    }

    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);
    awareness.setLocalState(null);
    yDocRef.current = doc;
    yAwarenessRef.current = awareness;
    if (Number.isInteger(nextServerGeneration) && typeof nextServerGeneration === "number") {
      serverYjsDocGenerationRef.current = nextServerGeneration;
    }

    doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === "remote-yjs") {
        return;
      }

      const encoder = encoding.createEncoder();
      syncProtocol.writeUpdate(encoder, update);
      sendYjsProtocolRef.current?.({
        channel: "sync",
        payloadBase64: encodeUint8ArrayToBase64(encoding.toUint8Array(encoder)),
      });
    });

    awareness.on("update", ({ added, updated, removed }, origin) => {
      if (origin === "remote-yjs-awareness") {
        return;
      }
      const changedClients = added.concat(updated, removed);
      if (changedClients.length === 0) {
        return;
      }
      const encoder = encoding.createEncoder();
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients));
      sendYjsProtocolRef.current?.({
        channel: "awareness",
        payloadBase64: encodeUint8ArrayToBase64(encoding.toUint8Array(encoder)),
      });
    });

    setYjsReady(false);
    setYjsDocGeneration((prev) => prev + 1);
    console.log("[yjs-doc:replace]", {
      roomId: resolvedRoomId,
      reason,
      serverGeneration: serverYjsDocGenerationRef.current,
    });
  }, [resolvedRoomId]);

  // Presence helpers — populated after useCollaborationPresence is called below
  const addUserRef = React.useRef<((u: ActiveUser) => void) | null>(null);
  const setUsersRef = React.useRef<((u: ActiveUser[]) => void) | null>(null);
  const removeUserRef = React.useRef<((id: string) => void) | null>(null);
  const sendYjsProtocolRef = React.useRef<((message: { channel: "sync" | "awareness"; payloadBase64: string }) => void) | null>(null);

  // Queue presence events that arrive before refs are set (e.g. fast current-users after join)
  const pendingPresenceRef = React.useRef<Array<{ type: "user-joined"; user: ActiveUser } | { type: "current-users"; users: ActiveUser[] }>>([]);

  const flushPendingPresence = useCallback(() => {
    const addUser = addUserRef.current;
    const setUsers = setUsersRef.current;
    if (!addUser && !setUsers) return;
    const pending = pendingPresenceRef.current;
    if (pending.length === 0) return;
    pendingPresenceRef.current = [];
    for (const event of pending) {
      if (event.type === "current-users" && setUsers) setUsers(event.users);
      if (event.type === "user-joined" && addUser) addUser(event.user);
    }
  }, []);

  const handleUserJoined = useCallback((joinedUser: ActiveUser) => {
    if (addUserRef.current) {
      addUserRef.current(joinedUser);
    } else {
      pendingPresenceRef.current.push({ type: "user-joined", user: joinedUser });
    }
  }, []);

  const handleCurrentUsers = useCallback((users: ActiveUser[]) => {
    if (setUsersRef.current) {
      setUsersRef.current(users);
    } else {
      pendingPresenceRef.current.push({ type: "current-users", users });
    }
  }, []);

  const handleUserLeftId = useCallback((userId: string) => {
    removeUserRef.current?.(userId);
    setCanvasCursors((prev) => {
      const next = new Map(prev);
      for (const [key, cursor] of next.entries()) {
        if (cursor.userId === userId) {
          next.delete(key);
        }
      }
      return next;
    });
    setEditorCursors((prev) => {
      const next = new Map(prev);
      for (const [key, cursor] of next.entries()) {
        if (cursor.userId === userId) {
          next.delete(key);
        }
      }
      return next;
    });
  }, []);

  const handleUserLeft = useCallback((leftUser: { userId: string; userEmail: string; userName?: string }) => {
    handleUserLeftId(leftUser.userId);
  }, [handleUserLeftId]);

  const handleCanvasCursor = useCallback((cursor: CanvasCursor) => {
    setCanvasCursors((prev) => {
      const next = new Map(prev);
      next.set(cursor.clientId, cursor);
      return next;
    });
  }, []);
  const getEditorVersion = useCallback(() => 0, []);

  const handleRoomStateSync = useCallback((roomState: RoomStateSyncMessage) => {
    markEditorRemoteApply();
    setInitialRoomState(roomState);
    const roomGate = normalizeGroupStartGateFromRoomState(roomState);
    const inferredStarted = hasSharedStartTime(roomState);
    if (roomGate?.status === "started") {
      setGroupStartGate(roomGate);
    } else if (inferredStarted) {
      setGroupStartGate((prev) => ({
        status: "started",
        minReadyCount: roomGate?.minReadyCount ?? prev?.minReadyCount ?? 2,
        readyUserIds: roomGate?.readyUserIds ?? prev?.readyUserIds ?? [],
        readyUsers: roomGate?.readyUsers ?? prev?.readyUsers ?? {},
        startedAt: roomGate?.startedAt ?? prev?.startedAt ?? new Date().toISOString(),
        startedByUserId: roomGate?.startedByUserId ?? prev?.startedByUserId ?? null,
      }));
    } else if (roomGate) {
      setGroupStartGate(roomGate);
    }
    const nextGeneration = Number.isInteger(roomState.yjsDocGeneration) ? roomState.yjsDocGeneration ?? 0 : 0;
    if (!yDocRef.current || nextGeneration !== serverYjsDocGenerationRef.current) {
      replaceLocalYDoc("room_state_generation", nextGeneration);
    }
  }, [markEditorRemoteApply, replaceLocalYDoc]);

  const handleProgressSync = useCallback((message: ProgressSyncMessage) => {
    setLastProgressSync(message);
  }, []);

  const handleGameInstancesReset = useCallback((message: GameInstancesResetMessage) => {
    setLastGameInstancesReset(message);
  }, []);

  const handleGroupStartSync = useCallback((message: GroupStartSyncMessage) => {
    setGroupStartGate(message.gate);
  }, []);

  const handleLobbyChatSync = useCallback((message: LobbyChatSyncMessage) => {
    setLobbyMessages(Array.isArray(message.messages) ? message.messages : []);
  }, []);

  const handleLobbyChatMessage = useCallback((message: LobbyChatEntry) => {
    setLobbyMessages((prev) => [...prev.slice(-99), message]);
  }, []);

  const handleTransportMessage = useCallback(() => {
    lastTransportMessageAtRef.current = Date.now();
  }, []);

  const handleCollaborationHealth = useCallback((message: CollaborationHealthMessage) => {
    setLastHealthMessage(message);
  }, []);

  const handleSocketConnected = useCallback(() => {
    hasDisconnectedUnexpectedlyRef.current = false;
    lastTransportMessageAtRef.current = Date.now();
  }, []);

  const handleSocketDisconnected = useCallback(() => {
    hasDisconnectedUnexpectedlyRef.current = true;
    lastTransportMessageAtRef.current = 0;
    editorWatchStatesRef.current.clear();
    setCodeSyncReady(false);
    setLastHealthMessage(null);
    setCanvasCursors(new Map());
    setEditorCursors(new Map());
  }, []);

  const syncPresenceFromAwareness = useCallback(() => {
    const awareness = yAwarenessRef.current;
    if (!awareness) {
      return;
    }
    const nextUsers: ActiveUser[] = [];
    const nextEditorCursors = new Map<string, EditorCursor>();
    const localState = awareness.getLocalState();
    const localClientId =
      localState && typeof localState === "object" && localState.session && typeof localState.session === "object" && typeof localState.session.clientId === "string"
        ? localState.session.clientId
        : "";
    for (const [, rawState] of awareness.getStates()) {
      if (!rawState || typeof rawState !== "object") {
        continue;
      }
      const session = rawState.session && typeof rawState.session === "object" ? rawState.session : null;
      const userState = rawState.user && typeof rawState.user === "object" ? rawState.user : null;
      const editor = rawState.editor && typeof rawState.editor === "object" ? rawState.editor : null;
      const awarenessClientId = typeof session?.clientId === "string" ? session.clientId : "";
      const userId = typeof userState?.id === "string" ? userState.id : "";
      if (!awarenessClientId || !userId) {
        continue;
      }
      if (localClientId && awarenessClientId === localClientId) {
        continue;
      }
      const editorType = editor?.editorType;
      const levelIndex = Number.isInteger(editor?.levelIndex) ? editor.levelIndex : undefined;
      const isTyping = editor?.isTyping === true;
      nextUsers.push({
        clientId: awarenessClientId,
        userId,
        userEmail: typeof userState?.email === "string" ? userState.email : "",
        userName: typeof userState?.name === "string" ? userState.name : undefined,
        userImage: typeof userState?.image === "string" ? userState.image : undefined,
        activeTab: editorType === "html" || editorType === "css" || editorType === "js" ? editorType : undefined,
        activeLevelIndex: levelIndex,
        isTyping,
      });
      if (
        (editorType === "html" || editorType === "css" || editorType === "js")
        && Number.isInteger(levelIndex)
        && editor?.selection
        && typeof editor.selection === "object"
        && Number.isInteger(editor.selection.from)
        && Number.isInteger(editor.selection.to)
      ) {
        nextEditorCursors.set(`${awarenessClientId}-${editorType}-${levelIndex}`, {
          roomId: resolvedRoomId || "",
          groupId: resolvedGroupId || undefined,
          editorType,
          levelIndex,
          clientId: awarenessClientId,
          userId,
          userName: typeof userState?.name === "string" ? userState.name : undefined,
          color: generateUserColor(typeof userState?.email === "string" ? userState.email : awarenessClientId),
          selection: {
            from: editor.selection.from,
            to: editor.selection.to,
          },
          ts: Date.now(),
        });
      }
    }
    setUsersRef.current?.(nextUsers);
    setEditorCursors(nextEditorCursors);
  }, [resolvedGroupId, resolvedRoomId]);

  const handleYjsProtocol = useCallback((message: { channel: "sync" | "awareness"; payloadBase64: string }) => {
    const doc = yDocRef.current;
    if (!doc || !message.payloadBase64) {
      return;
    }
    if (message.channel === "awareness") {
      const awareness = yAwarenessRef.current;
      if (!awareness) {
        return;
      }
      const rawPayload = decodeBase64ToUint8Array(message.payloadBase64);
      const awarenessDecoder = decoding.createDecoder(rawPayload);
      const awarenessUpdate = decoding.readVarUint8Array(awarenessDecoder);
      awarenessProtocol.applyAwarenessUpdate(
        awareness,
        awarenessUpdate,
        "remote-yjs-awareness",
      );
      syncPresenceFromAwareness();
      return;
    }
    const decoder = decoding.createDecoder(decodeBase64ToUint8Array(message.payloadBase64));
    const encoder = encoding.createEncoder();
    const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, doc, "remote-yjs");
    console.log("[yjs-protocol:apply]", {
      roomId: resolvedRoomId,
      messageType: syncMessageType,
      payloadLength: message.payloadBase64.length,
    });
    if (encoding.length(encoder) > 0) {
      sendYjsProtocolRef.current?.({
        channel: "sync",
        payloadBase64: encodeUint8ArrayToBase64(encoding.toUint8Array(encoder)),
      });
    }
    markEditorRemoteApply();
    if (syncMessageType !== syncProtocol.messageYjsSyncStep1) {
      setYjsReady(true);
    }
  }, [markEditorRemoteApply, resolvedRoomId, syncPresenceFromAwareness]);

  const {
    isConnected,
    isConnecting,
    error,
    clientId,
    connect,
    disconnect,
    sendCanvasCursor,
    requestRoomStateSync,
    sendYjsProtocol,
    sendRoomReset,
    sendProgressSync,
    sendGroupStartReady,
    sendGroupStartUnready,
    sendLobbyChat,
    sendClientStateHash,
    sendClientHealthEvent,
    effectiveIdentity,
  } = useCollaborationConnection({
    roomId: resolvedRoomId,
    user,
    onUserJoined: handleUserJoined,
    onUserLeft: handleUserLeft,
    onConnected: handleSocketConnected,
    onDisconnected: handleSocketDisconnected,
    onCanvasCursor: handleCanvasCursor,
    onCurrentUsers: handleCurrentUsers,
    onRoomStateSync: handleRoomStateSync,
    onProgressSync: handleProgressSync,
    onGameInstancesReset: handleGameInstancesReset,
    onGroupStartSync: handleGroupStartSync,
    onLobbyChatSync: handleLobbyChatSync,
    onLobbyChatMessage: handleLobbyChatMessage,
    onYjsProtocol: handleYjsProtocol,
    onCollaborationHealth: handleCollaborationHealth,
    onTransportMessage: handleTransportMessage,
  });

  useEffect(() => {
    if (!isYjsEnabled) {
      return;
    }
    const awareness = yAwarenessRef.current;
    if (!awareness) {
      return;
    }
    if (!isConnected || !effectiveIdentity || !clientId) {
      awareness.setLocalState(null);
      return;
    }
    const existing = (awareness.getLocalState() || {}) as {
      user?: { id?: string; name?: string; email?: string; image?: string };
      session?: { clientId?: string };
    };
    const userChanged =
      existing.user?.id !== effectiveIdentity.id
      || existing.user?.name !== effectiveIdentity.name
      || existing.user?.email !== effectiveIdentity.email
      || existing.user?.image !== effectiveIdentity.image;
    const sessionChanged = existing.session?.clientId !== clientId;
    if (!userChanged && !sessionChanged) {
      return;
    }
    awareness.setLocalState({
      ...existing,
      user: {
        id: effectiveIdentity.id,
        name: effectiveIdentity.name,
        email: effectiveIdentity.email,
        image: effectiveIdentity.image,
      },
      session: {
        clientId,
      },
    });
  }, [clientId, effectiveIdentity, isConnected, isYjsEnabled]);

  const reportCollaborationHealthEvent = useCallback((
    eventType: string,
    severity: CollaborationHealthSeverity,
    details: Record<string, unknown> = {},
    scope?: { editorType?: EditorType; levelIndex?: number }
  ) => {
    const dedupeKey = `${eventType}:${scope?.levelIndex ?? "na"}:${scope?.editorType ?? "na"}`;
    const now = Date.now();
    const lastSentAt = lastHealthEventAtRef.current.get(dedupeKey) ?? 0;
    if (now - lastSentAt < STALL_RETRY_COOLDOWN_MS) {
      return;
    }
    lastHealthEventAtRef.current.set(dedupeKey, now);
    sendClientHealthEvent({
      eventType,
      severity,
      editorType: scope?.editorType,
      levelIndex: scope?.levelIndex,
      details,
    });
  }, [sendClientHealthEvent]);

  const sendYjsSyncStep1 = useCallback((reason: string) => {
    const doc = yDocRef.current;
    if (!resolvedRoomId || !isConnected || !doc) {
      return;
    }

    const encoder = encoding.createEncoder();
    syncProtocol.writeSyncStep1(encoder, doc);
    const payloadBase64 = encodeUint8ArrayToBase64(encoding.toUint8Array(encoder));
    console.log("[yjs-sync:step1]", {
      roomId: resolvedRoomId,
      reason,
      serverGeneration: serverYjsDocGenerationRef.current,
      payloadLength: payloadBase64.length,
    });
    sendYjsProtocol({
      channel: "sync",
      payloadBase64,
    });
  }, [isConnected, resolvedRoomId, sendYjsProtocol]);

  const maybeSendEditorHash = useCallback((state: LocalEditorWatchState, minIntervalMs: number) => {
    const now = Date.now();
    if (!resolvedRoomId || !isConnected) {
      return;
    }
    if (now - state.lastHashSentAt < minIntervalMs) {
      return;
    }
    const recentlyActive =
      state.isFocused
      || now - state.lastLocalInputAt < STALL_DETECTION_WINDOW_MS
      || now - state.lastRemoteApplyAt < STALL_DETECTION_WINDOW_MS;
    if (!recentlyActive) {
      return;
    }
    sendClientStateHash({
      editorType: state.editorType,
      levelIndex: state.levelIndex,
      contentHash: state.contentHash,
      contentLength: state.contentLength,
      version: state.version ?? null,
      isFocused: state.isFocused,
      isEditable: state.isEditable,
      isTyping: state.isTyping,
      localInputAgeMs: state.lastLocalInputAt > 0 ? now - state.lastLocalInputAt : null,
      remoteApplyAgeMs: state.lastRemoteApplyAt > 0 ? now - state.lastRemoteApplyAt : null,
    });
    editorWatchStatesRef.current.set(getEditorWatchKey(state.editorType, state.levelIndex), {
      ...state,
      lastHashSentAt: now,
    });
  }, [isConnected, resolvedRoomId, sendClientStateHash]);

  const reportEditorWatchState = useCallback((snapshot: EditorWatchdogSnapshot) => {
    const now = snapshot.ts ?? Date.now();
    const key = getEditorWatchKey(snapshot.editorType, snapshot.levelIndex);
    const previous = editorWatchStatesRef.current.get(key);
    const nextState: LocalEditorWatchState = {
      ...snapshot,
      contentHash: hashContent(snapshot.content),
      contentLength: snapshot.content.length,
      lastObservedAt: now,
      lastHashSentAt: previous?.lastHashSentAt ?? 0,
      lastLocalInputAt: snapshot.source === "local_input" ? now : (previous?.lastLocalInputAt ?? 0),
      lastRemoteApplyAt:
        snapshot.source === "remote_apply" || snapshot.source === "room_sync"
          ? now
          : (previous?.lastRemoteApplyAt ?? 0),
      lastStallEventAt: previous?.lastStallEventAt ?? 0,
    };

    editorWatchStatesRef.current.set(key, nextState);
    if (snapshot.isFocused) {
      localActiveEditorRef.current = {
        editorType: snapshot.editorType,
        levelIndex: snapshot.levelIndex,
      };
    } else if (
      localActiveEditorRef.current?.editorType === snapshot.editorType
      && localActiveEditorRef.current?.levelIndex === snapshot.levelIndex
    ) {
      localActiveEditorRef.current = null;
    }

    maybeSendEditorHash(nextState, snapshot.source === "local_input" ? 600 : EDITOR_HASH_INTERVAL_MS);
  }, [maybeSendEditorHash]);

  useEffect(() => {
    sendYjsProtocolRef.current = sendYjsProtocol;
    // Re-broadcast local awareness state now that the send ref is ready.
    // The initial setLocalState (user info) may have fired before this ref was set,
    // causing the awareness update to be silently dropped.
    const awareness = yAwarenessRef.current;
    if (awareness && sendYjsProtocol) {
      const localState = awareness.getLocalState();
      if (localState && typeof localState === "object" && localState.user) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(awareness, [awareness.clientID]),
        );
        sendYjsProtocol({
          channel: "awareness",
          payloadBase64: encodeUint8ArrayToBase64(encoding.toUint8Array(encoder)),
        });
      }
    }
  }, [sendYjsProtocol]);

  useEffect(() => {
    if (!isYjsEnabled) {
      return;
    }

    replaceLocalYDoc("room_mount", 0);
    return () => {
      const doc = yDocRef.current;
      if (doc) {
        doc.destroy();
      }
      yDocRef.current = null;
      const awareness = yAwarenessRef.current;
      if (awareness) {
        awareness.destroy();
      }
      yAwarenessRef.current = null;
      serverYjsDocGenerationRef.current = 0;
    };
  }, [isYjsEnabled, replaceLocalYDoc, resolvedRoomId]);

  useEffect(() => {
    if (!resolvedRoomId || !isConnected) {
      return;
    }

    if (!initialRoomState) {
      const timer = setTimeout(() => {
        requestRoomStateSync("startup_missing_room_state");
      }, 1000);
      return () => clearTimeout(timer);
    }

    if (isYjsEnabled && !yjsReady) {
      const timer = setTimeout(() => {
        sendYjsSyncStep1("startup_missing_yjs_sync");
      }, 150);
      return () => clearTimeout(timer);
    }

    if (groupStartGate?.status === "started" && !hasSharedStartTime(initialRoomState)) {
      const timer = setTimeout(() => {
        requestRoomStateSync("startup_missing_shared_start");
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [groupStartGate?.status, initialRoomState, isConnected, isYjsEnabled, requestRoomStateSync, resolvedRoomId, sendYjsSyncStep1, yjsReady]);

  useEffect(() => {
    const wasConnected = wasConnectedRef.current;
    wasConnectedRef.current = isConnected;

    if (!resolvedRoomId || !isConnected) {
      return;
    }

    const isReconnect = hasConnectedOnceRef.current && !wasConnected;
    hasConnectedOnceRef.current = true;

    if (!isReconnect) {
      return;
    }

    const timer = setTimeout(() => {
      requestRoomStateSync("reconnect_recover");
      if (isYjsEnabled) {
        sendYjsSyncStep1("reconnect_recover");
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [isConnected, isYjsEnabled, requestRoomStateSync, resolvedRoomId, sendYjsSyncStep1]);

  const { activeUsers, usersByTab, addUser, setUsers, removeUser, clearUsers } = useCollaborationPresence({});

  useEffect(() => {
    if (!lastHealthMessage || !resolvedRoomId || !isConnected) {
      return;
    }

    if (lastHealthMessage.eventType !== "divergence_detected") {
      return;
    }

    let replaceTimer: number | null = null;

    const timer = window.setTimeout(() => {
      requestRoomStateSync(`health:${lastHealthMessage.eventType}`);
      if (isYjsEnabled) {
        const scopeKey = `${lastHealthMessage.levelIndex ?? "na"}:${lastHealthMessage.editorType ?? "na"}`;
        const recoveryState = divergenceRecoveryRef.current.get(scopeKey) || { retriedAt: 0, replacedAt: 0 };
        const now = Date.now();
        if (recoveryState.retriedAt === 0 || now - recoveryState.retriedAt > DIVERGENCE_RECOVERY_WINDOW_MS) {
          divergenceRecoveryRef.current.set(scopeKey, {
            ...recoveryState,
            retriedAt: now,
          });
          sendYjsSyncStep1(`health_retry:${scopeKey}`);
          if (
            typeof lastHealthMessage.editorType === "string"
            && Number.isInteger(lastHealthMessage.levelIndex)
          ) {
            const watchKey = getEditorWatchKey(lastHealthMessage.editorType, lastHealthMessage.levelIndex);
            const retryIssuedAt = now;
            replaceTimer = window.setTimeout(() => {
              if (!isConnected) {
                return;
              }
              const latestRecoveryState = divergenceRecoveryRef.current.get(scopeKey);
              if (!latestRecoveryState || latestRecoveryState.retriedAt !== retryIssuedAt) {
                return;
              }
              const latestWatchState = editorWatchStatesRef.current.get(watchKey);
              if (latestWatchState && latestWatchState.lastRemoteApplyAt >= retryIssuedAt) {
                return;
              }
              if (latestRecoveryState.replacedAt >= retryIssuedAt) {
                return;
              }
              divergenceRecoveryRef.current.set(scopeKey, {
                retriedAt: retryIssuedAt,
                replacedAt: Date.now(),
              });
              replaceLocalYDoc(`health_retry_timeout:${scopeKey}`, serverYjsDocGenerationRef.current);
              window.setTimeout(() => {
                sendYjsSyncStep1(`health_retry_timeout:${scopeKey}`);
              }, 80);
            }, DIVERGENCE_RECOVERY_WINDOW_MS + 100);
          }
          return;
        }

        if (now - recoveryState.replacedAt > DIVERGENCE_RECOVERY_WINDOW_MS) {
          divergenceRecoveryRef.current.set(scopeKey, {
            retriedAt: recoveryState.retriedAt,
            replacedAt: now,
          });
          replaceLocalYDoc(`health_replace:${scopeKey}`, serverYjsDocGenerationRef.current);
          setTimeout(() => {
            sendYjsSyncStep1(`health_replace:${scopeKey}`);
          }, 80);
          return;
        }
      }
    }, 150);

    return () => {
      window.clearTimeout(timer);
      if (replaceTimer) {
        window.clearTimeout(replaceTimer);
      }
    };
  }, [isConnected, isYjsEnabled, lastHealthMessage, replaceLocalYDoc, requestRoomStateSync, resolvedRoomId, sendYjsSyncStep1]);

  useEffect(() => {
    if (!resolvedRoomId || !isConnected) {
      return;
    }

    const interval = window.setInterval(() => {
      const now = Date.now();
      const latestTransportAt = lastTransportMessageAtRef.current;

      editorWatchStatesRef.current.forEach((state, key) => {
        maybeSendEditorHash(state, EDITOR_HASH_INTERVAL_MS);

        const remoteTypers = activeUsers.filter((user) =>
          user.isTyping
          && user.activeTab === state.editorType
          && user.activeLevelIndex === state.levelIndex
        ).length;
        const recentLocalTyping = now - state.lastLocalInputAt < STALL_DETECTION_WINDOW_MS;
        const transportStale = latestTransportAt > 0 && now - latestTransportAt > STALL_DETECTION_WINDOW_MS;
        const remoteApplyStale = state.lastRemoteApplyAt > 0 && now - state.lastRemoteApplyAt > STALL_DETECTION_WINDOW_MS;
        const focusedEditable = state.isFocused && state.isEditable;

        if (
          focusedEditable
          && recentLocalTyping
          && remoteTypers > 0
          && (transportStale || remoteApplyStale)
          && now - state.lastStallEventAt > STALL_RETRY_COOLDOWN_MS
        ) {
          editorWatchStatesRef.current.set(key, {
            ...state,
            lastStallEventAt: now,
          });
          reportCollaborationHealthEvent("editor_stalled", "error", {
            transportAgeMs: latestTransportAt > 0 ? now - latestTransportAt : null,
            remoteApplyAgeMs: state.lastRemoteApplyAt > 0 ? now - state.lastRemoteApplyAt : null,
            remoteTypers,
            contentHash: state.contentHash,
            contentLength: state.contentLength,
            version: state.version ?? null,
          }, {
            editorType: state.editorType,
            levelIndex: state.levelIndex,
          });
          requestRoomStateSync(`stall:${state.editorType}:${state.levelIndex}`);
          if (isYjsEnabled) {
            sendYjsSyncStep1(`stall:${state.editorType}:${state.levelIndex}`);
          }
        }
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [
    activeUsers,
    isConnected,
    isYjsEnabled,
    maybeSendEditorHash,
    reportCollaborationHealthEvent,
    requestRoomStateSync,
    resolvedRoomId,
    sendYjsSyncStep1,
  ]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof PerformanceObserver === "undefined" || !resolvedRoomId || !isConnected) {
      return;
    }

    const observer = new PerformanceObserver((entryList) => {
      const activeEditor = localActiveEditorRef.current;
      for (const entry of entryList.getEntries()) {
        if (entry.duration < LONG_TASK_WARN_MS) {
          continue;
        }
        reportCollaborationHealthEvent("main_thread_blocked", "warn", {
          durationMs: Math.round(entry.duration),
          entryType: entry.entryType,
          name: entry.name,
        }, activeEditor ?? undefined);
      }
    });

    observer.observe({ entryTypes: ["longtask"] });
    return () => observer.disconnect();
  }, [isConnected, reportCollaborationHealthEvent, resolvedRoomId]);

  // Wire refs so handleUserJoined / handleCurrentUsers / handleUserLeftId can call them; flush any events that arrived early
  React.useLayoutEffect(() => {
    addUserRef.current = addUser;
    setUsersRef.current = setUsers;
    removeUserRef.current = removeUser;
    flushPendingPresence();
    // Delayed flush in case presence events were queued after this layout effect (e.g. fast current-users)
    const t = setTimeout(flushPendingPresence, 80);
    return () => clearTimeout(t);
  }, [addUser, setUsers, removeUser, flushPendingPresence]);

  const { updateLocalCursor } = useCollaborationCursor({
    sendCursor: sendCanvasCursor,
    onRemoteCursor: handleCanvasCursor,
  });

  useEffect(() => {
    return () => {
      clearUsers();
      setCanvasCursors(new Map());
      setEditorCursors(new Map());
    };
  }, [clearUsers]);

  useEffect(() => {
    if (!resolvedRoomId || isConnected || !hasDisconnectedUnexpectedlyRef.current) {
      return;
    }

    clearUsers();
  }, [clearUsers, isConnected, resolvedRoomId]);

  useEffect(() => {
    queueMicrotask(() => {
      setLastProgressSync(null);
      setLastGameInstancesReset(null);
      setGroupStartGate(null);
      setLobbyMessages([]);
      setInitialRoomState(null);
      setLastHealthMessage(null);
      setCodeSyncReady(false);
      setYjsReady(false);
      setYjsDocGeneration(0);
      setCanvasCursors(new Map());
      setEditorCursors(new Map());
    });
    wasConnectedRef.current = false;
    hasConnectedOnceRef.current = false;
    lastTransportMessageAtRef.current = 0;
    editorWatchStatesRef.current.clear();
    localActiveEditorRef.current = null;
    lastHealthEventAtRef.current.clear();
    divergenceRecoveryRef.current.clear();
    serverYjsDocGenerationRef.current = 0;
  }, [resolvedRoomId]);

  const updateCanvasCursor = useCallback(
    (x: number, y: number) => {
      updateLocalCursor(x, y);
    },
    [updateLocalCursor]
  );

  const updateAwarenessEditorState = useCallback((patch: {
    editorType?: EditorType;
    levelIndex?: number;
    selection?: { from: number; to: number } | null;
    isTyping?: boolean;
  }) => {
    const awareness = yAwarenessRef.current;
    if (!awareness) {
      return;
    }
    const current = awareness.getLocalState() || {};
    const currentEditor =
      current.editor && typeof current.editor === "object" && !Array.isArray(current.editor)
        ? current.editor
        : {};
    const nextEditor = {
      ...currentEditor,
      ...(patch.editorType ? { editorType: patch.editorType } : {}),
      ...(Number.isInteger(patch.levelIndex) ? { levelIndex: patch.levelIndex } : {}),
      ...(typeof patch.isTyping === "boolean" ? { isTyping: patch.isTyping } : {}),
      ...(patch.selection ? { selection: patch.selection } : {}),
    };
    const changed =
      currentEditor.editorType !== nextEditor.editorType
      || currentEditor.levelIndex !== nextEditor.levelIndex
      || currentEditor.isTyping !== nextEditor.isTyping
      || !sameSelection(
        currentEditor.selection as { from: number; to: number } | null | undefined,
        nextEditor.selection as { from: number; to: number } | null | undefined
      );
    if (!changed) {
      return;
    }
    awareness.setLocalState({
      ...current,
      editor: nextEditor,
    });
  }, []);

  const updateEditorSelection = useCallback(
    (editorType: EditorType, levelIndex: number, selection: { from: number; to: number }) => {
      updateAwarenessEditorState({ editorType, levelIndex, selection });
    },
    [updateAwarenessEditorState]
  );

  const setActiveTab = useCallback(
    (editorType: EditorType, levelIndex: number) => {
      localActiveEditorRef.current = { editorType, levelIndex };
      updateAwarenessEditorState({ editorType, levelIndex, isTyping: false });
    },
    [updateAwarenessEditorState]
  );

  const setTyping = useCallback(
    (editorType: EditorType, levelIndex: number, isTyping: boolean) => {
      updateAwarenessEditorState({ editorType, levelIndex, isTyping });
    },
    [updateAwarenessEditorState]
  );

  const resetRoomState = useCallback((scope: "level" | "game", levelIndex?: number) => {
    sendRoomReset(scope, levelIndex);
  }, [sendRoomReset]);

  const syncProgressData = useCallback((progressData: Record<string, unknown>) => {
    sendProgressSync(progressData);
  }, [sendProgressSync]);

  const setGroupReady = useCallback((isReady: boolean) => {
    if (isReady) {
      sendGroupStartReady();
      return;
    }
    sendGroupStartUnready();
  }, [sendGroupStartReady, sendGroupStartUnready]);

  const applyEditorChangeWrapper = useCallback(
    (
      _editorType: EditorType,
      _changeSetJson: unknown,
      _levelIndex: number,
      _baseVersion: number,
      _selection?: { from: number; to: number }
    ) => {
      // Yjs is the only document sync path; local changes flow through Y.Text bindings.
    },
    []
  );

  const resolvedCodeSyncReady = Boolean(initialRoomState) && yjsReady;

  const value = useMemo<CollaborationContextValue>(
    () => ({
      collabEngine,
      isYjsEnabled,
      isConnected,
      isConnecting,
      error,
      roomId: resolvedRoomId,
      groupId: resolvedGroupId,
      clientId,
      effectiveIdentity,
      activeUsers,
      usersByTab,
      remoteCursors: canvasCursors,
      editorCursors,
      remoteCodeChanges,
      remoteCodeResyncs,
      localCodeAcks,
      lastProgressSync,
      lastGameInstancesReset,
      groupStartGate,
      lobbyMessages,
      initialRoomState,
      lastHealthMessage,
      codeSyncReady: resolvedCodeSyncReady,
      yjsReady,
      yjsDocGeneration,
      updateCanvasCursor,
      updateEditorSelection,
      applyEditorChange: applyEditorChangeWrapper,
      getEditorVersion,
      setActiveTab,
      setTyping,
      resetRoomState,
      syncProgressData,
      setGroupReady,
      sendLobbyChat,
      reportEditorWatchState,
      reportCollaborationHealthEvent,
      getYText,
      getYCodeSnapshot,
      connect,
      disconnect,
    }),
    [
      collabEngine,
      isYjsEnabled,
      isConnected,
      isConnecting,
      error,
      resolvedRoomId,
      resolvedGroupId,
      clientId,
      effectiveIdentity,
      activeUsers,
      usersByTab,
      canvasCursors,
      editorCursors,
      remoteCodeChanges,
      remoteCodeResyncs,
      localCodeAcks,
      lastProgressSync,
      lastGameInstancesReset,
      groupStartGate,
      lobbyMessages,
      initialRoomState,
      lastHealthMessage,
      resolvedCodeSyncReady,
      yjsReady,
      yjsDocGeneration,
      updateCanvasCursor,
      updateEditorSelection,
      applyEditorChangeWrapper,
      getEditorVersion,
      setActiveTab,
      setTyping,
      resetRoomState,
      syncProgressData,
      setGroupReady,
      sendLobbyChat,
      reportEditorWatchState,
      reportCollaborationHealthEvent,
      getYText,
      getYCodeSnapshot,
      connect,
      disconnect,
    ]
  );

  return (
    <CollaborationContext.Provider value={value}>
      {children}
    </CollaborationContext.Provider>
  );
}

export function useCollaboration(): CollaborationContextValue {
  const context = useContext(CollaborationContext);
  if (!context) {
    throw new Error("useCollaboration must be used within a CollaborationProvider");
  }
  return context;
}

export function useOptionalCollaboration(): CollaborationContextValue | null {
  return useContext(CollaborationContext);
}

export function useYjsLevelCodeSnapshot(
  levelIndex: number,
  fallbackCode: { html: string; css: string; js: string },
) {
  const collaboration = useOptionalCollaboration();
  const getYText = collaboration?.getYText;
  const yjsDocGeneration = collaboration?.yjsDocGeneration ?? 0;
  const [code, setCode] = useState(fallbackCode);

  useEffect(() => {
    if (!getYText || levelIndex < 0) {
      setCode(fallbackCode);
      return;
    }

    const editorTypes: EditorType[] = ["html", "css", "js"];
    const sync = () => {
      setCode({
        html: getYText("html", levelIndex)?.toString() ?? fallbackCode.html,
        css: getYText("css", levelIndex)?.toString() ?? fallbackCode.css,
        js: getYText("js", levelIndex)?.toString() ?? fallbackCode.js,
      });
    };

    sync();
    const texts = editorTypes.map((editorType) => getYText(editorType, levelIndex)).filter((text): text is Y.Text => Boolean(text));
    const observer = () => {
      sync();
    };
    texts.forEach((text) => text.observe(observer));
    return () => {
      texts.forEach((text) => text.unobserve(observer));
    };
  }, [
    fallbackCode.css,
    fallbackCode.html,
    fallbackCode.js,
    getYText,
    levelIndex,
    yjsDocGeneration,
  ]);

  return code;
}
