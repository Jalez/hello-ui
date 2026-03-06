"use client";

import React, { createContext, useContext, useCallback, useMemo, useState, useEffect } from "react";
import {
  ActiveUser,
  CanvasCursor,
  EditorCursor,
  EditorChange,
  EditorChangeApplied,
  EditorResync,
  RoomStateSyncMessage,
  UserIdentity,
  EditorType,
  TabFocusMessage,
  TypingStatusMessage,
} from "./types";
import { useCollaborationConnection } from "./hooks/useCollaborationConnection";
import { useCollaborationCursor } from "./hooks/useCollaborationCursor";
import { useCollaborationPresence } from "./hooks/useCollaborationPresence";
import { useCollaborationEditor } from "./hooks/useCollaborationEditor";
import { extractGroupIdFromRoomId } from "./utils";

export interface RemoteCodeChange {
  editorType: EditorType;
  changeSetJson: unknown;
  levelIndex: number;
  nextVersion: number;
  clientId: string;
  ts: number;
}

export interface RemoteCodeResync {
  editorType: EditorType;
  levelIndex: number;
  content: string;
  version: number;
  ts: number;
}

export type RoomStateSync = RoomStateSyncMessage | null;

interface CollaborationContextValue {
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
  lastRemoteCodeChange: RemoteCodeChange | null;
  lastRemoteCodeResync: RemoteCodeResync | null;
  initialRoomState: RoomStateSync;
  codeSyncReady: boolean;
  updateCanvasCursor: (x: number, y: number) => void;
  updateEditorSelection: (editorType: EditorType, selection: { from: number; to: number }) => void;
  applyEditorChange: (
    editorType: EditorType,
    changeSetJson: unknown,
    levelIndex: number,
    selection?: { from: number; to: number }
  ) => void;
  setActiveTab: (editorType: EditorType) => void;
  setTyping: (editorType: EditorType, isTyping: boolean) => void;
  resetRoomState: (scope: "level" | "game", levelIndex?: number) => void;
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
  const resolvedRoomId = roomId ?? groupId ?? null;
  const resolvedGroupId = extractGroupIdFromRoomId(resolvedRoomId);
  const [canvasCursors, setCanvasCursors] = useState<Map<string, CanvasCursor>>(new Map());
  const [editorCursors, setEditorCursors] = useState<Map<string, EditorCursor>>(new Map());
  const [lastRemoteCodeChange, setLastRemoteCodeChange] = useState<RemoteCodeChange | null>(null);
  const [lastRemoteCodeResync, setLastRemoteCodeResync] = useState<RemoteCodeResync | null>(null);
  const [initialRoomState, setInitialRoomState] = useState<RoomStateSync>(null);
  const [codeSyncReady, setCodeSyncReady] = useState(false);

  // Presence helpers — populated after useCollaborationPresence is called below
  const addUserRef = React.useRef<((u: ActiveUser) => void) | null>(null);
  const setUsersRef = React.useRef<((u: ActiveUser[]) => void) | null>(null);
  const removeUserRef = React.useRef<((id: string) => void) | null>(null);
  const updateUserTabRef = React.useRef<((clientId: string, editorType: EditorType) => void) | null>(null);
  const updateUserTypingRef = React.useRef<((clientId: string, editorType: EditorType, isTyping: boolean) => void) | null>(null);
  const sendEditorCursorRef = React.useRef<((editorType: EditorType, selection: { from: number; to: number }) => void) | null>(null);
  const sendEditorChangeRef = React.useRef<((editorType: EditorType, levelIndex: number, baseVersion: number, changeSetJson: unknown, selection?: { from: number; to: number }) => void) | null>(null);

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

  const sendCursorThroughRef = useCallback((editorType: EditorType, selection: { from: number; to: number }) => {
    sendEditorCursorRef.current?.(editorType, selection);
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

  const { updateLocalSelection, applyLocalChange, setEditorVersion, syncEditorVersions, resetEditorVersions } = useCollaborationEditor({
    sendCursor: sendCursorThroughRef,
    sendChange: sendChangeThroughRef,
  });

  const handleEditorCursor = useCallback((cursor: EditorCursor) => {
    setEditorCursors((prev) => {
      const next = new Map(prev);
      next.set(`${cursor.clientId}-${cursor.editorType}`, cursor);
      return next;
    });
  }, []);

  const handleEditorChange = useCallback((change: EditorChange) => {
    setEditorVersion(change.editorType, change.levelIndex, change.nextVersion);
    setLastRemoteCodeChange({
      editorType: change.editorType,
      changeSetJson: change.changeSetJson,
      levelIndex: change.levelIndex,
      nextVersion: change.nextVersion,
      clientId: change.clientId,
      ts: Date.now(),
    });
  }, [setEditorVersion]);

  const handleEditorChangeApplied = useCallback((message: EditorChangeApplied) => {
    setEditorVersion(message.editorType, message.levelIndex, message.nextVersion);
  }, [setEditorVersion]);

  const handleEditorResync = useCallback((message: EditorResync) => {
    setEditorVersion(message.editorType, message.levelIndex, message.version);
    setLastRemoteCodeResync({
      editorType: message.editorType,
      levelIndex: message.levelIndex,
      content: message.content,
      version: message.version,
      ts: Date.now(),
    });
  }, [setEditorVersion]);

  const handleRoomStateSync = useCallback((roomState: RoomStateSyncMessage) => {
    syncEditorVersions(roomState);
    setInitialRoomState(roomState);
    setCodeSyncReady(true);
  }, [syncEditorVersions]);

  const handleTabFocus = useCallback((message: TabFocusMessage) => {
    updateUserTabRef.current?.(message.clientId, message.editorType);
    setEditorCursors((prev) => {
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (key.startsWith(`${message.clientId}-`) && key !== `${message.clientId}-${message.editorType}`) {
          next.delete(key);
        }
      }
      return next;
    });
  }, []);

  const handleTypingStatus = useCallback((message: TypingStatusMessage) => {
    updateUserTypingRef.current?.(message.clientId, message.editorType, message.isTyping);
  }, []);

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
    sendRoomReset,
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
  });

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
      setLastRemoteCodeChange(null);
      setLastRemoteCodeResync(null);
      setInitialRoomState(null);
      setCodeSyncReady(false);
      setCanvasCursors(new Map());
      setEditorCursors(new Map());
    });
    resetEditorVersions();
  }, [resolvedRoomId, resetEditorVersions]);

  const updateCanvasCursor = useCallback(
    (x: number, y: number) => {
      updateLocalCursor(x, y);
    },
    [updateLocalCursor]
  );

  const updateEditorSelection = useCallback(
    (editorType: EditorType, selection: { from: number; to: number }) => {
      updateLocalSelection(editorType, selection);
    },
    [updateLocalSelection]
  );

  const setActiveTab = useCallback(
    (editorType: EditorType) => {
      sendTabFocus(editorType);
    },
    [sendTabFocus]
  );

  const setTyping = useCallback(
    (editorType: EditorType, isTyping: boolean) => {
      sendTypingStatus(editorType, isTyping);
    },
    [sendTypingStatus]
  );

  const resetRoomState = useCallback((scope: "level" | "game", levelIndex?: number) => {
    sendRoomReset(scope, levelIndex);
  }, [sendRoomReset]);

  const applyEditorChangeWrapper = useCallback(
    (editorType: EditorType, changeSetJson: unknown, levelIndex: number, selection?: { from: number; to: number }) => {
      applyLocalChange(editorType, changeSetJson, levelIndex, selection);
    },
    [applyLocalChange]
  );

  const value = useMemo<CollaborationContextValue>(
    () => ({
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
      lastRemoteCodeChange,
      lastRemoteCodeResync,
      initialRoomState,
      codeSyncReady,
      updateCanvasCursor,
      updateEditorSelection,
      applyEditorChange: applyEditorChangeWrapper,
      setActiveTab,
      setTyping,
      resetRoomState,
      connect,
      disconnect,
    }),
    [
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
      lastRemoteCodeChange,
      lastRemoteCodeResync,
      initialRoomState,
      codeSyncReady,
      updateCanvasCursor,
      updateEditorSelection,
      applyEditorChangeWrapper,
      setActiveTab,
      setTyping,
      resetRoomState,
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
