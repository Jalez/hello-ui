"use client";

import React, { createContext, useContext, useCallback, useMemo, useState, useEffect } from "react";
import * as Y from "yjs";
import {
  ActiveUser,
  CanvasCursor,
  EditorCursor,
  EditorChange,
  EditorChangeApplied,
  EditorResync,
  GroupStartGateState,
  GroupStartSyncMessage,
  LobbyChatEntry,
  LobbyChatSyncMessage,
  ProgressSyncMessage,
  RoomStateSyncMessage,
  UserIdentity,
  EditorType,
  TabFocusMessage,
  TypingStatusMessage,
  GameInstancesResetMessage,
} from "./types";
import { getClientCollaborationEngine } from "./engine";
import { useCollaborationConnection } from "./hooks/useCollaborationConnection";
import { useCollaborationCursor } from "./hooks/useCollaborationCursor";
import { useCollaborationPresence } from "./hooks/useCollaborationPresence";
import { useCollaborationEditor } from "./hooks/useCollaborationEditor";
import { extractGroupIdFromRoomId } from "./utils";
import { decodeBase64ToUint8Array, encodeUint8ArrayToBase64 } from "./yjs-base64";

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

export type RoomStateSync = RoomStateSyncMessage | null;
export type ProgressSync = ProgressSyncMessage | null;
export type GroupStartSync = GroupStartSyncMessage | null;
export type GameInstancesResetSync = GameInstancesResetMessage | null;

function hasSharedStartTime(roomState: RoomStateSync): boolean {
  const firstLevel = roomState?.levels?.[0];
  const timeData =
    firstLevel && typeof firstLevel === "object" && firstLevel.timeData && typeof firstLevel.timeData === "object"
      ? (firstLevel.timeData as Record<string, unknown>)
      : null;
  return Number(timeData?.startTime ?? 0) > 0;
}

interface CollaborationContextValue {
  collabEngine: "custom" | "yjs";
  isYjsEnabled: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  roomId: string | null;
  groupId: string | null;
  clientId: string | null;
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
  getYText: (editorType: EditorType, levelIndex: number) => Y.Text | null;
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
  const collabEngine = getClientCollaborationEngine();
  const isYjsEnabled = collabEngine === "yjs";
  const resolvedRoomId = roomId ?? groupId ?? null;
  const resolvedGroupId = extractGroupIdFromRoomId(resolvedRoomId);
  const [canvasCursors, setCanvasCursors] = useState<Map<string, CanvasCursor>>(new Map());
  const [editorCursors, setEditorCursors] = useState<Map<string, EditorCursor>>(new Map());
  const [remoteCodeChanges, setRemoteCodeChanges] = useState<RemoteCodeChange[]>([]);
  const [remoteCodeResyncs, setRemoteCodeResyncs] = useState<RemoteCodeResync[]>([]);
  const [localCodeAcks, setLocalCodeAcks] = useState<LocalCodeAck[]>([]);
  const [lastProgressSync, setLastProgressSync] = useState<ProgressSync>(null);
  const [lastGameInstancesReset, setLastGameInstancesReset] = useState<GameInstancesResetSync>(null);
  const [groupStartGate, setGroupStartGate] = useState<GroupStartGateState | null>(null);
  const [lobbyMessages, setLobbyMessages] = useState<LobbyChatEntry[]>([]);
  const [initialRoomState, setInitialRoomState] = useState<RoomStateSync>(null);
  const [codeSyncReady, setCodeSyncReady] = useState(false);
  const [yjsReady, setYjsReady] = useState(false);
  const [yjsDocGeneration, setYjsDocGeneration] = useState(0);
  const remoteEventSeqRef = React.useRef(0);
  const wasConnectedRef = React.useRef(false);
  const hasConnectedOnceRef = React.useRef(false);
  const yDocRef = React.useRef<Y.Doc | null>(null);

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

  // Presence helpers — populated after useCollaborationPresence is called below
  const addUserRef = React.useRef<((u: ActiveUser) => void) | null>(null);
  const setUsersRef = React.useRef<((u: ActiveUser[]) => void) | null>(null);
  const removeUserRef = React.useRef<((id: string) => void) | null>(null);
  const updateUserTabRef = React.useRef<((clientId: string, editorType: EditorType, levelIndex: number) => void) | null>(null);
  const updateUserTypingRef = React.useRef<((clientId: string, editorType: EditorType, levelIndex: number, isTyping: boolean) => void) | null>(null);
  const sendEditorCursorRef = React.useRef<((editorType: EditorType, levelIndex: number, selection: { from: number; to: number }) => void) | null>(null);
  const sendEditorChangeRef = React.useRef<((editorType: EditorType, levelIndex: number, baseVersion: number, changeSetJson: unknown, selection?: { from: number; to: number }) => void) | null>(null);
  const sendYjsUpdateRef = React.useRef<((updateBase64: string) => void) | null>(null);

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

  const sendCursorThroughRef = useCallback((editorType: EditorType, levelIndex: number, selection: { from: number; to: number }) => {
    sendEditorCursorRef.current?.(editorType, levelIndex, selection);
  }, []);

  const sendChangeThroughRef = useCallback((
    editorType: EditorType,
    levelIndex: number,
    baseVersion: number,
    changeSetJson: unknown,
    selection?: { from: number; to: number }
  ) => {
    sendEditorChangeRef.current?.(editorType, levelIndex, baseVersion, changeSetJson, selection);
  }, []);

  const { updateLocalSelectionForLevel, applyLocalChange, setEditorVersion, getEditorVersion, syncEditorVersions, resetEditorVersions } = useCollaborationEditor({
    sendCursor: sendCursorThroughRef,
    sendChange: sendChangeThroughRef,
  });

  const handleEditorCursor = useCallback((cursor: EditorCursor) => {
    setEditorCursors((prev) => {
      const next = new Map(prev);
      next.set(`${cursor.clientId}-${cursor.editorType}-${cursor.levelIndex}`, cursor);
      return next;
    });
  }, []);

  const handleEditorChange = useCallback((change: EditorChange) => {
    if (isYjsEnabled) {
      return;
    }
    setEditorVersion(change.editorType, change.levelIndex, change.nextVersion);
    const seq = ++remoteEventSeqRef.current;
    setRemoteCodeChanges((prev) => [
      ...prev.slice(-99),
      {
        seq,
        editorType: change.editorType,
        changeSetJson: change.changeSetJson,
        levelIndex: change.levelIndex,
        baseVersion: change.baseVersion,
        nextVersion: change.nextVersion,
        clientId: change.clientId,
        ts: Date.now(),
      },
    ]);
  }, [isYjsEnabled, setEditorVersion]);

  const handleEditorChangeApplied = useCallback((message: EditorChangeApplied) => {
    if (isYjsEnabled) {
      return;
    }
    setEditorVersion(message.editorType, message.levelIndex, message.nextVersion);
    const seq = ++remoteEventSeqRef.current;
    setLocalCodeAcks((prev) => [
      ...prev.slice(-49),
      {
        seq,
        editorType: message.editorType,
        levelIndex: message.levelIndex,
        nextVersion: message.nextVersion,
        content: message.content,
        ts: Date.now(),
      },
    ]);
  }, [isYjsEnabled, setEditorVersion]);

  const handleEditorResync = useCallback((message: EditorResync) => {
    if (isYjsEnabled) {
      return;
    }
    setEditorVersion(message.editorType, message.levelIndex, message.version);
    const seq = ++remoteEventSeqRef.current;
    setRemoteCodeResyncs((prev) => [
      ...prev.slice(-49),
      {
        seq,
        editorType: message.editorType,
        levelIndex: message.levelIndex,
        content: message.content,
        version: message.version,
        ts: Date.now(),
      },
    ]);
  }, [isYjsEnabled, setEditorVersion]);

  const handleRoomStateSync = useCallback((roomState: RoomStateSyncMessage) => {
    setInitialRoomState(roomState);
    if (!isYjsEnabled) {
      syncEditorVersions(roomState);
      setCodeSyncReady(true);
      return;
    }
  }, [isYjsEnabled, syncEditorVersions]);

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

  const handleTabFocus = useCallback((message: TabFocusMessage) => {
    updateUserTabRef.current?.(message.clientId, message.editorType, message.levelIndex);
    setEditorCursors((prev) => {
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (
          key.startsWith(`${message.clientId}-`) &&
          key !== `${message.clientId}-${message.editorType}-${message.levelIndex}`
        ) {
          next.delete(key);
        }
      }
      return next;
    });
  }, []);

  const handleTypingStatus = useCallback((message: TypingStatusMessage) => {
    updateUserTypingRef.current?.(message.clientId, message.editorType, message.levelIndex, message.isTyping);
  }, []);

  const handleYjsSync = useCallback((message: { updateBase64: string }) => {
    const doc = yDocRef.current;
    if (!doc || !message.updateBase64) {
      return;
    }
    console.log("[yjs-sync:apply]", {
      roomId: resolvedRoomId,
      updateLength: message.updateBase64.length,
    });
    Y.applyUpdate(doc, decodeBase64ToUint8Array(message.updateBase64), "remote-yjs");
    setYjsReady(true);
  }, [resolvedRoomId]);

  const handleYjsReset = useCallback((message: { updateBase64: string }) => {
    if (!message.updateBase64) {
      return;
    }
    // Destroy old Y.Doc and create a fresh one to avoid CRDT tombstone conflicts
    const oldDoc = yDocRef.current;
    if (oldDoc) {
      oldDoc.destroy();
    }
    const freshDoc = new Y.Doc();
    yDocRef.current = freshDoc;
    console.log("[yjs-reset:apply]", {
      roomId: resolvedRoomId,
      updateLength: message.updateBase64.length,
    });
    Y.applyUpdate(freshDoc, decodeBase64ToUint8Array(message.updateBase64), "remote-yjs");
    // Wire up outbound update handler on the new doc
    freshDoc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === "remote-yjs" || origin === "hydrate-room-state") {
        return;
      }
      sendYjsUpdateRef.current?.(encodeUint8ArrayToBase64(update));
    });
    setYjsReady(true);
    setYjsDocGeneration((prev) => prev + 1);
  }, [resolvedRoomId]);

  const handleYjsUpdate = useCallback((message: { updateBase64: string }) => {
    const doc = yDocRef.current;
    if (!doc || !message.updateBase64) {
      return;
    }
    console.log("[yjs-update:apply]", {
      roomId: resolvedRoomId,
      updateLength: message.updateBase64.length,
    });
    Y.applyUpdate(doc, decodeBase64ToUint8Array(message.updateBase64), "remote-yjs");
    setYjsReady(true);
  }, [resolvedRoomId]);

  const {
    isConnected,
    isConnecting,
    error,
    clientId,
    connect,
    disconnect,
    sendCanvasCursor,
    sendEditorCursor,
    sendEditorChange,
    sendTabFocus,
    sendTypingStatus,
    requestRoomStateSync,
    requestYjsSync,
    sendYjsUpdate,
    sendRoomReset,
    sendProgressSync,
    sendGroupStartReady,
    sendGroupStartUnready,
    sendLobbyChat,
  } = useCollaborationConnection({
    roomId: resolvedRoomId,
    user,
    onUserJoined: handleUserJoined,
    onUserLeft: handleUserLeft,
    onCanvasCursor: handleCanvasCursor,
    onEditorCursor: handleEditorCursor,
    onEditorChange: handleEditorChange,
    onEditorChangeApplied: handleEditorChangeApplied,
    onEditorResync: handleEditorResync,
    onCurrentUsers: handleCurrentUsers,
    onTabFocus: handleTabFocus,
    onTypingStatus: handleTypingStatus,
    onRoomStateSync: handleRoomStateSync,
    onProgressSync: handleProgressSync,
    onGameInstancesReset: handleGameInstancesReset,
    onGroupStartSync: handleGroupStartSync,
    onLobbyChatSync: handleLobbyChatSync,
    onLobbyChatMessage: handleLobbyChatMessage,
    onYjsSync: handleYjsSync,
    onYjsReset: handleYjsReset,
    onYjsUpdate: handleYjsUpdate,
  });

  useEffect(() => {
    sendYjsUpdateRef.current = sendYjsUpdate;
  }, [sendYjsUpdate]);

  useEffect(() => {
    if (!isYjsEnabled) {
      return;
    }

    const doc = new Y.Doc();
    yDocRef.current = doc;

    const handleDocUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === "remote-yjs" || origin === "hydrate-room-state") {
        return;
      }
      console.log("[yjs-doc:update:emit]", {
        roomId: resolvedRoomId,
        origin: String(origin),
        updateBytes: update.byteLength,
      });
      sendYjsUpdate(encodeUint8ArrayToBase64(update));
    };

    doc.on("update", handleDocUpdate);
    return () => {
      doc.off("update", handleDocUpdate);
      doc.destroy();
      yDocRef.current = null;
    };
  }, [isYjsEnabled, resolvedRoomId, sendYjsUpdate]);

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
        requestYjsSync();
      }, 150);
      return () => clearTimeout(timer);
    }

    if (groupStartGate?.status === "started" && !hasSharedStartTime(initialRoomState)) {
      const timer = setTimeout(() => {
        requestRoomStateSync("startup_missing_shared_start");
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [groupStartGate?.status, initialRoomState, isConnected, isYjsEnabled, requestRoomStateSync, requestYjsSync, resolvedRoomId, yjsReady]);

  useEffect(() => {
    const wasConnected = wasConnectedRef.current;
    wasConnectedRef.current = isConnected;

    if (!resolvedRoomId || !isConnected) {
      return;
    }

    const isReconnect = hasConnectedOnceRef.current && !wasConnected;
    hasConnectedOnceRef.current = true;

    if (!isReconnect || !initialRoomState) {
      return;
    }

    const timer = setTimeout(() => {
      requestRoomStateSync("reconnect_recover");
    }, 250);

    return () => clearTimeout(timer);
  }, [initialRoomState, isConnected, requestRoomStateSync, resolvedRoomId]);

  useEffect(() => {
    if (isYjsEnabled) {
      return;
    }
    if (!resolvedRoomId || !isConnected || remoteCodeResyncs.length === 0) {
      return;
    }

    const latestResync = remoteCodeResyncs[remoteCodeResyncs.length - 1];
    const timer = setTimeout(() => {
      requestRoomStateSync(`editor_resync_recover:${latestResync.editorType}:${latestResync.levelIndex}`);
    }, 200);

    return () => clearTimeout(timer);
  }, [isConnected, isYjsEnabled, remoteCodeResyncs, requestRoomStateSync, resolvedRoomId]);

  const { activeUsers, usersByTab, addUser, setUsers, removeUser, clearUsers, updateUserTab, updateUserTyping } = useCollaborationPresence({});

  // Wire refs so handleUserJoined / handleCurrentUsers / handleUserLeftId can call them; flush any events that arrived early
  React.useLayoutEffect(() => {
    addUserRef.current = addUser;
    setUsersRef.current = setUsers;
    removeUserRef.current = removeUser;
    updateUserTabRef.current = updateUserTab;
    updateUserTypingRef.current = updateUserTyping;
    flushPendingPresence();
    // Delayed flush in case presence events were queued after this layout effect (e.g. fast current-users)
    const t = setTimeout(flushPendingPresence, 80);
    return () => clearTimeout(t);
  }, [addUser, setUsers, removeUser, updateUserTab, updateUserTyping, flushPendingPresence]);

  const { updateLocalCursor } = useCollaborationCursor({
    sendCursor: sendCanvasCursor,
    onRemoteCursor: handleCanvasCursor,
  });

  useEffect(() => {
    sendEditorCursorRef.current = sendEditorCursor;
    sendEditorChangeRef.current = sendEditorChange;
    return () => {
      sendEditorCursorRef.current = null;
      sendEditorChangeRef.current = null;
    };
  }, [sendEditorCursor, sendEditorChange]);

  useEffect(() => {
    return () => {
      clearUsers();
      setCanvasCursors(new Map());
      setEditorCursors(new Map());
      resetEditorVersions();
    };
  }, [clearUsers, resetEditorVersions]);

  useEffect(() => {
    queueMicrotask(() => {
      setRemoteCodeChanges([]);
      setRemoteCodeResyncs([]);
      setLastProgressSync(null);
      setLastGameInstancesReset(null);
      setGroupStartGate(null);
      setLobbyMessages([]);
      setInitialRoomState(null);
      setCodeSyncReady(false);
      setYjsReady(false);
      setYjsDocGeneration(0);
      setCanvasCursors(new Map());
      setEditorCursors(new Map());
    });
    wasConnectedRef.current = false;
    hasConnectedOnceRef.current = false;
    resetEditorVersions();
  }, [resolvedRoomId, resetEditorVersions]);

  const updateCanvasCursor = useCallback(
    (x: number, y: number) => {
      updateLocalCursor(x, y);
    },
    [updateLocalCursor]
  );

  const updateEditorSelection = useCallback(
    (editorType: EditorType, levelIndex: number, selection: { from: number; to: number }) => {
      updateLocalSelectionForLevel(editorType, levelIndex, selection);
    },
    [updateLocalSelectionForLevel]
  );

  const setActiveTab = useCallback(
    (editorType: EditorType, levelIndex: number) => {
      sendTabFocus(editorType, levelIndex);
    },
    [sendTabFocus]
  );

  const setTyping = useCallback(
    (editorType: EditorType, levelIndex: number, isTyping: boolean) => {
      sendTypingStatus(editorType, levelIndex, isTyping);
    },
    [sendTypingStatus]
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
      editorType: EditorType,
      changeSetJson: unknown,
      levelIndex: number,
      baseVersion: number,
      selection?: { from: number; to: number }
    ) => {
      applyLocalChange(editorType, changeSetJson, levelIndex, baseVersion, selection);
    },
    [applyLocalChange]
  );

  const resolvedCodeSyncReady = isYjsEnabled ? Boolean(initialRoomState) && yjsReady : codeSyncReady;

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
      getYText,
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
      getYText,
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
