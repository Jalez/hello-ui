"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  ActiveUser,
  CanvasCursor,
  EditorChange,
  EditorChangeApplied,
  EditorCursor,
  EditorResync,
  ProgressSyncMessage,
  RoomStateSyncMessage,
  UserIdentity,
  TabFocusMessage,
  TypingStatusMessage,
  EditorType,
} from "../types";
import { extractGroupIdFromRoomId, generateClientId, generateUserColor, getWebSocketConfig } from "../utils";
import { RECONNECT_DELAY_MS, MAX_RECONNECT_ATTEMPTS } from "../constants";
import { logDebugClient } from "@/lib/debug-logger";

interface UseCollaborationConnectionOptions {
  roomId: string | null;
  user: UserIdentity | null;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: string) => void;
  onUserJoined?: (user: ActiveUser) => void;
  onUserLeft?: (user: { userId: string; userEmail: string; userName?: string }) => void;
  onCanvasCursor?: (cursor: CanvasCursor) => void;
  onEditorCursor?: (cursor: EditorCursor) => void;
  onEditorChange?: (change: EditorChange) => void;
  onEditorChangeApplied?: (message: EditorChangeApplied) => void;
  onEditorResync?: (message: EditorResync) => void;
  onCurrentUsers?: (users: ActiveUser[]) => void;
  onTabFocus?: (message: TabFocusMessage) => void;
  onTypingStatus?: (message: TypingStatusMessage) => void;
  onRoomStateSync?: (roomState: RoomStateSyncMessage) => void;
  onProgressSync?: (message: ProgressSyncMessage) => void;
}

interface UseCollaborationConnectionReturn {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  clientId: string | null;
  connect: () => void;
  disconnect: () => void;
  joinGame: (roomId: string) => void;
  leaveGame: () => void;
  sendCanvasCursor: (x: number, y: number) => void;
  sendEditorCursor: (editorType: EditorType, levelIndex: number, selection: { from: number; to: number }) => void;
  sendEditorChange: (
    editorType: EditorType,
    levelIndex: number,
    baseVersion: number,
    changeSetJson: unknown,
    selection?: { from: number; to: number }
  ) => void;
  sendTabFocus: (editorType: EditorType, levelIndex: number) => void;
  sendTypingStatus: (editorType: EditorType, levelIndex: number, isTyping: boolean) => void;
  sendRoomReset: (scope: "level" | "game", levelIndex?: number) => void;
  sendProgressSync: (progressData: Record<string, unknown>) => void;
}

export function useCollaborationConnection(
  options: UseCollaborationConnectionOptions
): UseCollaborationConnectionReturn {
  const { roomId, user } = options;
  const parsedGroupId = extractGroupIdFromRoomId(roomId);

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const socketRef = useRef<Socket | null>(null);
  const clientIdRef = useRef<string | null>(null);
  const userColorRef = useRef<string | null>(null);
  const typingStatusRef = useRef<Record<string, boolean>>({});
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isConnectedRef = useRef(false);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [socketState, setSocketState] = useState<Socket | null>(null);

  const userIdentity = user ? `${user.id}|${user.email}` : null;

  useEffect(() => {
    if (!roomId || !userIdentity) {
      return;
    }
    const opts = optionsRef.current;
    const currentUser = opts.user;
    if (!currentUser) {
      return;
    }

    logDebugClient("ws_connection_start", {
      roomId,
      userId: currentUser.id,
      userEmail: currentUser.email,
      userName: currentUser.name,
    });

    if (socketRef.current?.connected) {
      return;
    }

    const newClientId = generateClientId();
    clientIdRef.current = newClientId;
    if (!userColorRef.current) {
      userColorRef.current = generateUserColor(currentUser.email);
    }

    const { url: wsUrl, path: wsPath } = getWebSocketConfig();

    const socket = io(wsUrl, {
      path: wsPath,
      addTrailingSlash: false,
      auth: {
        userId: currentUser.id,
        userEmail: currentUser.email,
        userName: currentUser.name,
        userImage: currentUser.image,
        roomId,
      },
      transports: ["websocket", "polling"],
      reconnection: false,
    });

    socketRef.current = socket;
    isConnectedRef.current = false;

    const clearReconnectTimeout = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const disconnectSocket = () => {
      clearReconnectTimeout();
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      typingStatusRef.current = {};
      isConnectedRef.current = false;
    };

    socket.on("connect", () => {
      isConnectedRef.current = true;
      typingStatusRef.current = {};
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
      setClientId(newClientId);
      setSocketState(socket);
      reconnectAttemptsRef.current = 0;
      const u = optionsRef.current.user;
      if (!u) return;

      logDebugClient("ws_socket_connect", {
        socketId: socket.id,
        clientId: newClientId,
        roomId,
        userId: u.id,
        userEmail: u.email,
      });

      socket.emit("join-game", {
        roomId,
        groupId: parsedGroupId ?? undefined,
        clientId: newClientId,
        userId: u.id,
        userEmail: u.email,
        userName: u.name,
        userImage: u.image,
      });

      logDebugClient("ws_join_game_emitted", {
        roomId,
        userId: u.id,
        userEmail: u.email,
      });

      optionsRef.current.onConnected?.();
    });

    socket.on("disconnect", (reason) => {
      isConnectedRef.current = false;
      typingStatusRef.current = { html: false, css: false, js: false };
      setIsConnected(false);
      setIsConnecting(false);
      optionsRef.current.onDisconnected?.();

      if (reason === "io server disconnect") {
        return;
      }

      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        reconnectTimeoutRef.current = setTimeout(() => {
          if (socketRef.current && !isConnectedRef.current) {
            socketRef.current.connect();
          }
        }, RECONNECT_DELAY_MS);
      } else {
        setError("Failed to reconnect after multiple attempts");
        optionsRef.current.onError?.("Failed to reconnect after multiple attempts");
      }
    });

    socket.on("connect_error", (err) => {
      setIsConnected(false);
      setIsConnecting(false);
      setError(err.message);
      optionsRef.current.onError?.(err.message);
    });

    socket.on("error", (data: { error?: string }) => {
      setError(data.error || "Unknown error");
      optionsRef.current.onError?.(data.error || "Unknown error");
    });

    socket.on("user-joined", (data: { clientId?: string; userId: string; userEmail: string; userName?: string; userImage?: string; activeTab?: EditorType; activeLevelIndex?: number; isTyping?: boolean }) => {
      const u = optionsRef.current.user;
      if (!u || data.userEmail === u.email) return;
      const joinedClientId = data.clientId ?? "";
      if (joinedClientId) {
        const payload = {
          clientId: joinedClientId,
          userId: data.userId,
          userEmail: data.userEmail,
          userName: data.userName,
          userImage: data.userImage,
          activeTab: data.activeTab,
          activeLevelIndex: data.activeLevelIndex,
          isTyping: data.isTyping,
        };
        queueMicrotask(() => optionsRef.current.onUserJoined?.(payload));
      }
    });

    socket.on("user-left", (data: { userId: string; userEmail: string; userName?: string }) => {
      optionsRef.current.onUserLeft?.({
        userId: data.userId,
        userEmail: data.userEmail,
        userName: data.userName,
      });
    });

    socket.on("current-users", (data: { users?: Array<{ clientId?: string; userId?: string; userEmail: string; userName?: string; userImage?: string; color?: string; activeTab?: EditorType; activeLevelIndex?: number; isTyping?: boolean }> }) => {
      if (data.users && Array.isArray(data.users)) {
        const mapped = data.users
          .filter((u) => u && (u.clientId ?? "").length > 0)
          .map((u) => ({
            clientId: u.clientId ?? "",
            userId: u.userId || "",
            userEmail: u.userEmail,
            userName: u.userName,
            userImage: u.userImage,
            color: u.color || generateUserColor(u.userEmail),
            activeTab: u.activeTab,
            activeLevelIndex: Number.isInteger(u.activeLevelIndex) ? u.activeLevelIndex : undefined,
            isTyping: Boolean(u.isTyping),
          }));
        if (mapped.length > 0) {
          queueMicrotask(() => optionsRef.current.onCurrentUsers?.(mapped));
        }
      }
    });

    socket.on("canvas-cursor", (data: CanvasCursor & { clientId: string }) => {
      if (data.clientId !== clientIdRef.current) {
        optionsRef.current.onCanvasCursor?.(data);
      }
    });

    socket.on("editor-cursor", (data: EditorCursor & { clientId: string }) => {
      if (data.clientId !== clientIdRef.current) {
        optionsRef.current.onEditorCursor?.(data);
      }
    });

    socket.on("editor-change", (data: EditorChange) => {
      if (data.clientId === clientIdRef.current) {
        logDebugClient("ws_editor_change_ignored_self", {
          clientId: data.clientId,
          editorType: data.editorType,
          nextVersion: data.nextVersion,
        });
        return;
      }
      optionsRef.current.onEditorChange?.(data);
    });

    socket.on("editor-change-applied", (data: EditorChangeApplied) => {
      optionsRef.current.onEditorChangeApplied?.(data);
    });

    socket.on("editor-resync", (data: EditorResync) => {
      optionsRef.current.onEditorResync?.(data);
    });

    socket.on("tab-focus", (data: TabFocusMessage & { clientId: string }) => {
      if (data.clientId !== clientIdRef.current) {
        optionsRef.current.onTabFocus?.(data);
      }
    });

    socket.on("typing-status", (data: TypingStatusMessage & { clientId: string }) => {
      if (data.clientId !== clientIdRef.current) {
        optionsRef.current.onTypingStatus?.(data);
      }
    });

    socket.on("room-state-sync", (data: RoomStateSyncMessage) => {
      optionsRef.current.onRoomStateSync?.(data);
    });

    socket.on("progress-sync", (data: ProgressSyncMessage) => {
      optionsRef.current.onProgressSync?.(data);
    });

    return () => {
      clearReconnectTimeout();
      disconnectSocket();
    };
  }, [roomId, parsedGroupId, userIdentity]);

  const sendCanvasCursor = useCallback((x: number, y: number) => {
    if (socketRef.current && roomId && user && clientIdRef.current) {
      socketRef.current.emit("canvas-cursor", {
        roomId,
        groupId: parsedGroupId ?? undefined,
        clientId: clientIdRef.current,
        userId: user.id,
        userName: user.name,
        color: userColorRef.current,
        x,
        y,
        ts: Date.now(),
      });
    }
  }, [roomId, parsedGroupId, user]);

  const sendEditorCursor = useCallback((editorType: "html" | "css" | "js", levelIndex: number, selection: { from: number; to: number }) => {
    if (socketRef.current && roomId && user && clientIdRef.current) {
      socketRef.current.emit("editor-cursor", {
        roomId,
        groupId: parsedGroupId ?? undefined,
        editorType,
        levelIndex,
        clientId: clientIdRef.current,
        userId: user.id,
        userName: user.name,
        color: userColorRef.current,
        selection,
        ts: Date.now(),
      });
    }
  }, [roomId, parsedGroupId, user]);

  const sendEditorChange = useCallback((
    editorType: EditorType,
    levelIndex: number,
    baseVersion: number,
    changeSetJson: unknown,
    selection?: { from: number; to: number }
  ) => {
    if (socketRef.current && roomId && user && clientIdRef.current) {
      socketRef.current.emit("editor-change", {
        roomId,
        groupId: parsedGroupId ?? undefined,
        editorType,
        clientId: clientIdRef.current,
        userId: user.id,
        baseVersion,
        changeSetJson,
        levelIndex,
        selection,
        ts: Date.now(),
      });
    }
  }, [roomId, parsedGroupId, user]);

  const sendTabFocus = useCallback((editorType: EditorType, levelIndex: number) => {
    if (socketRef.current && roomId && user && clientIdRef.current) {
      socketRef.current.emit("tab-focus", {
        roomId,
        groupId: parsedGroupId ?? undefined,
        editorType,
        levelIndex,
        clientId: clientIdRef.current,
        userId: user.id,
        userName: user.name,
        ts: Date.now(),
      });
    }
  }, [roomId, parsedGroupId, user]);

  const sendTypingStatus = useCallback((editorType: EditorType, levelIndex: number, isTyping: boolean) => {
    if (socketRef.current && roomId && user && clientIdRef.current) {
      const nextIsTyping = Boolean(isTyping);
      const typingKey = `${levelIndex}:${editorType}` as const;
      if ((typingStatusRef.current as Record<string, boolean>)[typingKey] === nextIsTyping) {
        return;
      }
      (typingStatusRef.current as Record<string, boolean>)[typingKey] = nextIsTyping;

      socketRef.current.emit("typing-status", {
        roomId,
        groupId: parsedGroupId ?? undefined,
        editorType,
        levelIndex,
        clientId: clientIdRef.current,
        userId: user.id,
        userName: user.name,
        isTyping: nextIsTyping,
        ts: Date.now(),
      });
    }
  }, [roomId, parsedGroupId, user]);

  const sendRoomReset = useCallback((scope: "level" | "game", levelIndex?: number) => {
    if (socketRef.current && roomId && user && clientIdRef.current) {
      socketRef.current.emit("reset-room-state", {
        roomId,
        groupId: parsedGroupId ?? undefined,
        clientId: clientIdRef.current,
        userId: user.id,
        scope,
        levelIndex,
        ts: Date.now(),
      });
    }
  }, [roomId, parsedGroupId, user]);

  const sendProgressSync = useCallback((progressData: Record<string, unknown>) => {
    if (socketRef.current && roomId && user && clientIdRef.current) {
      socketRef.current.emit("progress-sync", {
        roomId,
        groupId: parsedGroupId ?? undefined,
        clientId: clientIdRef.current,
        userId: user.id,
        progressData,
        ts: Date.now(),
      });
    }
  }, [roomId, parsedGroupId, user]);

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    isConnectedRef.current = false;
    typingStatusRef.current = {};
    setIsConnected(false);
    setIsConnecting(false);
    setClientId(null);
    setSocketState(null);
    clientIdRef.current = null;
  };

  const leaveGame = () => {
    if (socketRef.current && roomId) {
      socketRef.current.emit("leave-game", {
        roomId,
        groupId: parsedGroupId ?? undefined,
      });
    }
    disconnect();
  };

  return {
    socket: socketState,
    isConnected,
    isConnecting,
    error,
    clientId,
    connect: () => {},
    disconnect,
    joinGame: () => {},
    leaveGame,
    sendCanvasCursor,
    sendEditorCursor,
    sendEditorChange,
    sendTabFocus,
    sendTypingStatus,
    sendRoomReset,
    sendProgressSync,
  };
}
