"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { extractGroupIdFromRoomId, generateClientId, generateUserColor, getWebSocketUrl } from "../utils";
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
  socket: WebSocket | null;
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

interface WebSocketEnvelope<T = unknown> {
  type: string;
  payload: T;
  ts?: number;
}

function parseEnvelope(data: string): WebSocketEnvelope | null {
  try {
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== "object" || typeof parsed.type !== "string") {
      return null;
    }
    return parsed as WebSocketEnvelope;
  } catch {
    return null;
  }
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

  const socketRef = useRef<WebSocket | null>(null);
  const clientIdRef = useRef<string | null>(null);
  const userColorRef = useRef<string | null>(null);
  const typingStatusRef = useRef<Record<string, boolean>>({});
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isConnectedRef = useRef(false);
  const reconnectFnRef = useRef<(() => void) | null>(null);
  const manualDisconnectRef = useRef(false);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [socketState, setSocketState] = useState<WebSocket | null>(null);

  const userIdentity = user ? `${user.id}|${user.email}` : null;

  const sendMessage = useCallback((type: string, payload: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(
      JSON.stringify({
        type,
        payload,
        ts: Date.now(),
      } satisfies WebSocketEnvelope<Record<string, unknown>>)
    );
  }, []);

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

    const newClientId = generateClientId();
    clientIdRef.current = newClientId;
    if (!userColorRef.current) {
      userColorRef.current = generateUserColor(currentUser.email);
    }

    let disposed = false;

    const clearReconnectTimeout = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const cleanupSocket = () => {
      clearReconnectTimeout();
      const socket = socketRef.current;
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
        socketRef.current = null;
      }
      setSocketState(null);
      typingStatusRef.current = {};
      isConnectedRef.current = false;
    };

    const connectSocket = () => {
      if (disposed || socketRef.current) {
        return;
      }

      const wsUrl = getWebSocketUrl();
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      setSocketState(socket);
      setIsConnecting(true);

      socket.onopen = () => {
        if (disposed) {
          socket.close();
          return;
        }

        isConnectedRef.current = true;
        typingStatusRef.current = {};
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        setClientId(newClientId);
        reconnectAttemptsRef.current = 0;

        logDebugClient("ws_socket_connect", {
          clientId: newClientId,
          roomId,
          userId: currentUser.id,
          userEmail: currentUser.email,
          wsUrl,
        });

        socket.send(
          JSON.stringify({
            type: "join-game",
            payload: {
              roomId,
              groupId: parsedGroupId ?? undefined,
              clientId: newClientId,
              userId: currentUser.id,
              userEmail: currentUser.email,
              userName: currentUser.name,
              userImage: currentUser.image,
            },
            ts: Date.now(),
          } satisfies WebSocketEnvelope<Record<string, unknown>>)
        );

        logDebugClient("ws_join_game_emitted", {
          roomId,
          userId: currentUser.id,
          userEmail: currentUser.email,
        });

        optionsRef.current.onConnected?.();
      };

      socket.onmessage = (event) => {
        if (typeof event.data !== "string") {
          return;
        }

        const envelope = parseEnvelope(event.data);
        if (!envelope) {
          return;
        }

        const payload = envelope.payload;

        switch (envelope.type) {
          case "error": {
            const nextError =
              payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
                ? (payload as { error: string }).error
                : "Unknown error";
            setError(nextError);
            optionsRef.current.onError?.(nextError);
            return;
          }
          case "user-joined": {
            const data = payload as {
              clientId?: string;
              userId: string;
              userEmail: string;
              userName?: string;
              userImage?: string;
              activeTab?: EditorType;
              activeLevelIndex?: number;
              isTyping?: boolean;
            };
            const current = optionsRef.current.user;
            if (!current || data.userEmail === current.email) {
              return;
            }
            const joinedClientId = data.clientId ?? "";
            if (joinedClientId) {
              queueMicrotask(() => optionsRef.current.onUserJoined?.({
                clientId: joinedClientId,
                userId: data.userId,
                userEmail: data.userEmail,
                userName: data.userName,
                userImage: data.userImage,
                activeTab: data.activeTab,
                activeLevelIndex: data.activeLevelIndex,
                isTyping: data.isTyping,
              }));
            }
            return;
          }
          case "user-left": {
            const data = payload as { userId: string; userEmail: string; userName?: string };
            optionsRef.current.onUserLeft?.(data);
            return;
          }
          case "current-users": {
            const data = payload as {
              users?: Array<{
                clientId?: string;
                userId?: string;
                userEmail: string;
                userName?: string;
                userImage?: string;
                color?: string;
                activeTab?: EditorType;
                activeLevelIndex?: number;
                isTyping?: boolean;
              }>;
            };
            if (data.users && Array.isArray(data.users)) {
              const mapped = data.users
                .filter((entry) => entry && (entry.clientId ?? "").length > 0)
                .map((entry) => ({
                  clientId: entry.clientId ?? "",
                  userId: entry.userId || "",
                  userEmail: entry.userEmail,
                  userName: entry.userName,
                  userImage: entry.userImage,
                  color: entry.color || generateUserColor(entry.userEmail),
                  activeTab: entry.activeTab,
                  activeLevelIndex: Number.isInteger(entry.activeLevelIndex) ? entry.activeLevelIndex : undefined,
                  isTyping: Boolean(entry.isTyping),
                }));
              if (mapped.length > 0) {
                queueMicrotask(() => optionsRef.current.onCurrentUsers?.(mapped));
              }
            }
            return;
          }
          case "canvas-cursor": {
            const data = payload as CanvasCursor & { clientId: string };
            if (data.clientId !== clientIdRef.current) {
              optionsRef.current.onCanvasCursor?.(data);
            }
            return;
          }
          case "editor-cursor": {
            const data = payload as EditorCursor & { clientId: string };
            if (data.clientId !== clientIdRef.current) {
              optionsRef.current.onEditorCursor?.(data);
            }
            return;
          }
          case "editor-change": {
            const data = payload as EditorChange;
            if (data.clientId === clientIdRef.current) {
              logDebugClient("ws_editor_change_ignored_self", {
                clientId: data.clientId,
                editorType: data.editorType,
                nextVersion: data.nextVersion,
              });
              return;
            }
            optionsRef.current.onEditorChange?.(data);
            return;
          }
          case "editor-change-applied":
            optionsRef.current.onEditorChangeApplied?.(payload as EditorChangeApplied);
            return;
          case "editor-resync":
            optionsRef.current.onEditorResync?.(payload as EditorResync);
            return;
          case "tab-focus": {
            const data = payload as TabFocusMessage & { clientId: string };
            if (data.clientId !== clientIdRef.current) {
              optionsRef.current.onTabFocus?.(data);
            }
            return;
          }
          case "typing-status": {
            const data = payload as TypingStatusMessage & { clientId: string };
            if (data.clientId !== clientIdRef.current) {
              optionsRef.current.onTypingStatus?.(data);
            }
            return;
          }
          case "room-state-sync":
            optionsRef.current.onRoomStateSync?.(payload as RoomStateSyncMessage);
            return;
          case "progress-sync":
            optionsRef.current.onProgressSync?.(payload as ProgressSyncMessage);
            return;
          default:
            return;
        }
      };

      socket.onerror = () => {
        setIsConnected(false);
        setIsConnecting(false);
        setError("WebSocket connection error");
        optionsRef.current.onError?.("WebSocket connection error");
      };

      socket.onclose = () => {
        const wasConnected = isConnectedRef.current;
        if (socketRef.current === socket) {
          socketRef.current = null;
          setSocketState(null);
        }
        isConnectedRef.current = false;
        typingStatusRef.current = {};
        setIsConnected(false);
        setIsConnecting(false);

        if (disposed || manualDisconnectRef.current) {
          return;
        }

        if (wasConnected) {
          optionsRef.current.onDisconnected?.();
        }

        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!disposed && !manualDisconnectRef.current) {
              connectSocket();
            }
          }, RECONNECT_DELAY_MS);
        } else {
          setError("Failed to reconnect after multiple attempts");
          optionsRef.current.onError?.("Failed to reconnect after multiple attempts");
        }
      };
    };

    reconnectFnRef.current = connectSocket;
    manualDisconnectRef.current = false;
    connectSocket();

    return () => {
      disposed = true;
      reconnectFnRef.current = null;
      cleanupSocket();
    };
  }, [roomId, parsedGroupId, userIdentity]);

  const disconnect = useCallback(() => {
    manualDisconnectRef.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    const socket = socketRef.current;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
      socketRef.current = null;
    }
    isConnectedRef.current = false;
    typingStatusRef.current = {};
    setIsConnected(false);
    setIsConnecting(false);
    setClientId(null);
    setSocketState(null);
    clientIdRef.current = null;
  }, []);

  const leaveGame = useCallback(() => {
    if (roomId) {
      sendMessage("leave-game", {
        roomId,
        groupId: parsedGroupId ?? undefined,
      });
    }
    disconnect();
  }, [disconnect, parsedGroupId, roomId, sendMessage]);

  const sendCanvasCursor = useCallback((x: number, y: number) => {
    if (roomId && user && clientIdRef.current) {
      sendMessage("canvas-cursor", {
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
  }, [parsedGroupId, roomId, sendMessage, user]);

  const sendEditorCursor = useCallback((editorType: "html" | "css" | "js", levelIndex: number, selection: { from: number; to: number }) => {
    if (roomId && user && clientIdRef.current) {
      sendMessage("editor-cursor", {
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
  }, [parsedGroupId, roomId, sendMessage, user]);

  const sendEditorChange = useCallback((
    editorType: EditorType,
    levelIndex: number,
    baseVersion: number,
    changeSetJson: unknown,
    selection?: { from: number; to: number }
  ) => {
    if (roomId && user && clientIdRef.current) {
      sendMessage("editor-change", {
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
  }, [parsedGroupId, roomId, sendMessage, user]);

  const sendTabFocus = useCallback((editorType: EditorType, levelIndex: number) => {
    if (roomId && user && clientIdRef.current) {
      sendMessage("tab-focus", {
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
  }, [parsedGroupId, roomId, sendMessage, user]);

  const sendTypingStatus = useCallback((editorType: EditorType, levelIndex: number, isTyping: boolean) => {
    if (roomId && user && clientIdRef.current) {
      const nextIsTyping = Boolean(isTyping);
      const typingKey = `${levelIndex}:${editorType}`;
      if (typingStatusRef.current[typingKey] === nextIsTyping) {
        return;
      }
      typingStatusRef.current[typingKey] = nextIsTyping;

      sendMessage("typing-status", {
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
  }, [parsedGroupId, roomId, sendMessage, user]);

  const sendRoomReset = useCallback((scope: "level" | "game", levelIndex?: number) => {
    if (roomId && user && clientIdRef.current) {
      sendMessage("reset-room-state", {
        roomId,
        groupId: parsedGroupId ?? undefined,
        clientId: clientIdRef.current,
        userId: user.id,
        scope,
        levelIndex,
        ts: Date.now(),
      });
    }
  }, [parsedGroupId, roomId, sendMessage, user]);

  const sendProgressSync = useCallback((progressData: Record<string, unknown>) => {
    if (roomId && user && clientIdRef.current) {
      sendMessage("progress-sync", {
        roomId,
        groupId: parsedGroupId ?? undefined,
        clientId: clientIdRef.current,
        userId: user.id,
        progressData,
        ts: Date.now(),
      });
    }
  }, [parsedGroupId, roomId, sendMessage, user]);

  const connect = useCallback(() => {
    manualDisconnectRef.current = false;
    if (!socketRef.current) {
      reconnectFnRef.current?.();
    }
  }, []);

  return {
    socket: socketState,
    isConnected,
    isConnecting,
    error,
    clientId,
    connect,
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
