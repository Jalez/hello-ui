"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActiveUser,
  CanvasCursor,
  ClientHealthEventMessage,
  ClientStateHashMessage,
  CollaborationHealthMessage,
  EditorChange,
  EditorChangeApplied,
  EditorCursor,
  EditorResync,
  GroupStartSyncMessage,
  IdentityAssignedMessage,
  LobbyChatEntry,
  LobbyChatSyncMessage,
  ProgressSyncMessage,
  RoomStateSyncMessage,
  UserIdentity,
  TabFocusMessage,
  TypingStatusMessage,
  EditorType,
  YjsSyncMessage,
  YjsSyncRequestMessage,
  YjsUpdateMessage,
  GameInstancesResetMessage,
} from "../types";
import { getClientCollaborationEngine } from "../engine";
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
  onGroupStartSync?: (message: GroupStartSyncMessage) => void;
  onLobbyChatSync?: (message: LobbyChatSyncMessage) => void;
  onLobbyChatMessage?: (message: LobbyChatEntry) => void;
  onYjsSync?: (message: YjsSyncMessage) => void;
  onYjsReset?: (message: YjsSyncMessage) => void;
  onYjsUpdate?: (message: YjsUpdateMessage) => void;
  onGameInstancesReset?: (message: GameInstancesResetMessage) => void;
  onIdentityAssigned?: (message: IdentityAssignedMessage) => void;
  onCollaborationHealth?: (message: CollaborationHealthMessage) => void;
  onTransportMessage?: (type: string) => void;
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
  requestRoomStateSync: (reason?: string) => void;
  requestYjsSync: () => void;
  sendYjsUpdate: (updateBase64: string) => void;
  sendRoomReset: (scope: "level" | "game", levelIndex?: number) => void;
  sendProgressSync: (progressData: Record<string, unknown>) => void;
  sendGroupStartReady: () => void;
  sendGroupStartUnready: () => void;
  sendLobbyChat: (text: string) => void;
  sendClientStateHash: (message: Omit<ClientStateHashMessage, "roomId" | "groupId" | "clientId" | "userId" | "userEmail" | "engine" | "ts">) => void;
  sendClientHealthEvent: (message: Omit<ClientHealthEventMessage, "roomId" | "groupId" | "clientId" | "userId" | "userEmail" | "engine" | "ts">) => void;
  effectiveIdentity: UserIdentity | null;
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
  const collabEngine = getClientCollaborationEngine();
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
  const effectiveIdentityRef = useRef<UserIdentity | null>(user);
  const terminalErrorRef = useRef<string | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [socketState, setSocketState] = useState<WebSocket | null>(null);
  const [effectiveIdentity, setEffectiveIdentity] = useState<UserIdentity | null>(user);

  const userIdentity = user ? `${user.id}|${user.email}` : null;

  useEffect(() => {
    setEffectiveIdentity(user);
    effectiveIdentityRef.current = user;
    terminalErrorRef.current = null;
  }, [userIdentity, user]);

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
        terminalErrorRef.current = null;
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
        optionsRef.current.onTransportMessage?.(envelope.type);

        switch (envelope.type) {
          case "error": {
            const errorPayload = payload as { error?: unknown; code?: unknown } | null;
            const nextError =
              errorPayload && typeof errorPayload === "object" && typeof errorPayload.error === "string"
                ? errorPayload.error
                : "Unknown error";
            if (errorPayload && typeof errorPayload.code === "string" && errorPayload.code === "duplicate_users_blocked") {
              terminalErrorRef.current = nextError;
              manualDisconnectRef.current = true;
            }
            setError(nextError);
            optionsRef.current.onError?.(nextError);
            return;
          }
          case "user-joined": {
            const data = payload as {
              clientId?: string;
              userId: string;
              accountUserId?: string;
              userEmail: string;
              accountUserEmail?: string;
              userName?: string;
              userImage?: string;
              activeTab?: EditorType;
              activeLevelIndex?: number;
              isTyping?: boolean;
            };
            const current = effectiveIdentityRef.current ?? optionsRef.current.user;
            if (!current) {
              return;
            }
            if (data.userId === current.id) {
              return;
            }
            const joinedClientId = data.clientId ?? "";
            if (joinedClientId) {
              queueMicrotask(() => optionsRef.current.onUserJoined?.({
                clientId: joinedClientId,
                userId: data.userId,
                accountUserId: data.accountUserId,
                userEmail: data.userEmail,
                accountUserEmail: data.accountUserEmail,
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
                accountUserId?: string;
                userEmail: string;
                accountUserEmail?: string;
                userName?: string;
                userImage?: string;
                color?: string;
                activeTab?: EditorType;
                activeLevelIndex?: number;
                isTyping?: boolean;
              }>;
            };
            if (data.users && Array.isArray(data.users)) {
              const current = optionsRef.current.user;
              const selfIdentity = effectiveIdentityRef.current ?? current;
              const mapped = data.users
                .filter((entry) => entry && (entry.clientId ?? "").length > 0)
                .filter((entry) => {
                  if (!selfIdentity) {
                    return true;
                  }

                  if (entry.userId && entry.userId === selfIdentity.id) {
                    return false;
                  }

                  if (!entry.userId && entry.userEmail && entry.userEmail === selfIdentity.email) {
                    return false;
                  }

                  return true;
                })
                .map((entry) => ({
                  clientId: entry.clientId ?? "",
                  userId: entry.userId || "",
                  accountUserId: entry.accountUserId,
                  userEmail: entry.userEmail,
                  accountUserEmail: entry.accountUserEmail,
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
          case "group-start-sync":
            optionsRef.current.onGroupStartSync?.(payload as GroupStartSyncMessage);
            return;
          case "identity-assigned": {
            const data = payload as IdentityAssignedMessage;
            const previousIdentity = effectiveIdentityRef.current ?? optionsRef.current.user;
            const nextIdentity: UserIdentity = {
              id: data.userId,
              email: data.userEmail,
              name: data.userName ?? previousIdentity?.name,
              image: data.userImage ?? previousIdentity?.image,
            };
            setEffectiveIdentity(nextIdentity);
            effectiveIdentityRef.current = nextIdentity;
            optionsRef.current.onIdentityAssigned?.(data);
            return;
          }
          case "lobby-chat-sync":
            optionsRef.current.onLobbyChatSync?.(payload as LobbyChatSyncMessage);
            return;
          case "lobby-chat-message":
            optionsRef.current.onLobbyChatMessage?.(payload as LobbyChatEntry);
            return;
          case "yjs-sync":
            optionsRef.current.onYjsSync?.(payload as YjsSyncMessage);
            return;
          case "yjs-reset":
            optionsRef.current.onYjsReset?.(payload as YjsSyncMessage);
            return;
          case "yjs-update":
            optionsRef.current.onYjsUpdate?.(payload as YjsUpdateMessage);
            return;
          case "game-instances-reset":
            optionsRef.current.onGameInstancesReset?.(payload as GameInstancesResetMessage);
            return;
          case "collaboration-health":
            optionsRef.current.onCollaborationHealth?.(payload as CollaborationHealthMessage);
            return;
          default:
            return;
        }
      };

      socket.onerror = () => {
        setIsConnected(false);
        setIsConnecting(false);
        if (terminalErrorRef.current) {
          setError(terminalErrorRef.current);
          optionsRef.current.onError?.(terminalErrorRef.current);
        }
      };

      socket.onclose = (event) => {
        const wasConnected = isConnectedRef.current;
        logDebugClient("ws_socket_close", {
          roomId,
          clientId: clientIdRef.current,
          userId: currentUser.id,
          userEmail: currentUser.email,
          code: event.code,
          reason: event.reason,
          readyState: socket.readyState,
        });
        if (socketRef.current === socket) {
          socketRef.current = null;
          setSocketState(null);
        }
        isConnectedRef.current = false;
        typingStatusRef.current = {};
        setIsConnected(false);
        setIsConnecting(false);

        if (event.code === 4008) {
          const nextError = terminalErrorRef.current
            || event.reason
            || "Duplicate users are blocked for this game. Turn group submission off in A+ or ask the creator to enable duplicate users in Game Settings.";
          terminalErrorRef.current = nextError;
          manualDisconnectRef.current = true;
          setError(nextError);
          optionsRef.current.onError?.(nextError);
          return;
        }

        if (disposed || manualDisconnectRef.current) {
          if (terminalErrorRef.current) {
            setError(terminalErrorRef.current);
            optionsRef.current.onError?.(terminalErrorRef.current);
          }
          return;
        }

        if (wasConnected) {
          optionsRef.current.onDisconnected?.();
        }

        if (terminalErrorRef.current) {
          setError(terminalErrorRef.current);
          optionsRef.current.onError?.(terminalErrorRef.current);
          return;
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
    if (roomId && effectiveIdentity && clientIdRef.current) {
      sendMessage("canvas-cursor", {
        roomId,
        groupId: parsedGroupId ?? undefined,
        clientId: clientIdRef.current,
        userId: effectiveIdentity.id,
        userName: effectiveIdentity.name,
        color: userColorRef.current,
        x,
        y,
        ts: Date.now(),
      });
    }
  }, [effectiveIdentity, parsedGroupId, roomId, sendMessage]);

  const sendEditorCursor = useCallback((editorType: "html" | "css" | "js", levelIndex: number, selection: { from: number; to: number }) => {
    if (roomId && effectiveIdentity && clientIdRef.current) {
      sendMessage("editor-cursor", {
        roomId,
        groupId: parsedGroupId ?? undefined,
        editorType,
        levelIndex,
        clientId: clientIdRef.current,
        userId: effectiveIdentity.id,
        userName: effectiveIdentity.name,
        color: userColorRef.current,
        selection,
        ts: Date.now(),
      });
    }
  }, [effectiveIdentity, parsedGroupId, roomId, sendMessage]);

  const sendEditorChange = useCallback((
    editorType: EditorType,
    levelIndex: number,
    baseVersion: number,
    changeSetJson: unknown,
    selection?: { from: number; to: number }
  ) => {
    if (roomId && effectiveIdentity && clientIdRef.current) {
      sendMessage("editor-change", {
        roomId,
        groupId: parsedGroupId ?? undefined,
        editorType,
        clientId: clientIdRef.current,
        userId: effectiveIdentity.id,
        baseVersion,
        changeSetJson,
        levelIndex,
        selection,
        ts: Date.now(),
      });
    }
  }, [effectiveIdentity, parsedGroupId, roomId, sendMessage]);

  const sendTabFocus = useCallback((editorType: EditorType, levelIndex: number) => {
    if (roomId && effectiveIdentity && clientIdRef.current) {
      sendMessage("tab-focus", {
        roomId,
        groupId: parsedGroupId ?? undefined,
        editorType,
        levelIndex,
        clientId: clientIdRef.current,
        userId: effectiveIdentity.id,
        userName: effectiveIdentity.name,
        ts: Date.now(),
      });
    }
  }, [effectiveIdentity, parsedGroupId, roomId, sendMessage]);

  const sendTypingStatus = useCallback((editorType: EditorType, levelIndex: number, isTyping: boolean) => {
    if (roomId && effectiveIdentity && clientIdRef.current) {
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
        userId: effectiveIdentity.id,
        userName: effectiveIdentity.name,
        isTyping: nextIsTyping,
        ts: Date.now(),
      });
    }
  }, [effectiveIdentity, parsedGroupId, roomId, sendMessage]);

  const requestRoomStateSync = useCallback((reason = "client_request") => {
    if (!roomId) {
      return;
    }
    sendMessage("request-room-state-sync", {
      roomId,
      groupId: parsedGroupId ?? undefined,
      reason,
    });
    logDebugClient("ws_room_state_sync_requested", {
      roomId,
      groupId: parsedGroupId,
      reason,
    });
  }, [parsedGroupId, roomId, sendMessage]);

  const requestYjsSync = useCallback(() => {
    if (!roomId) {
      return;
    }

    logDebugClient("ws_yjs_sync_requested", {
      roomId,
      groupId: parsedGroupId,
    });
    sendMessage("yjs-sync-request", {
      roomId,
      groupId: parsedGroupId ?? undefined,
    } satisfies YjsSyncRequestMessage);
  }, [parsedGroupId, roomId, sendMessage]);

  const sendYjsUpdate = useCallback((updateBase64: string) => {
    if (!roomId || !updateBase64) {
      return;
    }

    logDebugClient("ws_yjs_update_emit", {
      roomId,
      groupId: parsedGroupId,
      updateLength: updateBase64.length,
    });
    sendMessage("yjs-update", {
      roomId,
      groupId: parsedGroupId ?? undefined,
      updateBase64,
      ts: Date.now(),
    } satisfies YjsUpdateMessage);
  }, [parsedGroupId, roomId, sendMessage]);

  const sendRoomReset = useCallback((scope: "level" | "game", levelIndex?: number) => {
    if (roomId && effectiveIdentity && clientIdRef.current) {
      logDebugClient("ws_reset_room_emit", {
        roomId,
        groupId: parsedGroupId ?? null,
        userId: effectiveIdentity.id,
        userEmail: effectiveIdentity.email,
        clientId: clientIdRef.current,
        scope,
        levelIndex: Number.isInteger(levelIndex) ? levelIndex : null,
      });
      sendMessage("reset-room-state", {
        roomId,
        groupId: parsedGroupId ?? undefined,
        clientId: clientIdRef.current,
        userId: effectiveIdentity.id,
        scope,
        levelIndex,
        ts: Date.now(),
      });
      return;
    }

    logDebugClient("ws_reset_room_skipped", {
      roomId: roomId ?? null,
      hasUser: Boolean(effectiveIdentity),
      hasClientId: Boolean(clientIdRef.current),
      scope,
      levelIndex: Number.isInteger(levelIndex) ? levelIndex : null,
    });
  }, [effectiveIdentity, parsedGroupId, roomId, sendMessage]);

  const sendProgressSync = useCallback((progressData: Record<string, unknown>) => {
    if (roomId && effectiveIdentity && clientIdRef.current) {
      sendMessage("progress-sync", {
        roomId,
        groupId: parsedGroupId ?? undefined,
        clientId: clientIdRef.current,
        userId: effectiveIdentity.id,
        progressData,
        ts: Date.now(),
      });
    }
  }, [effectiveIdentity, parsedGroupId, roomId, sendMessage]);

  const sendGroupStartReady = useCallback(() => {
    if (roomId && effectiveIdentity && clientIdRef.current) {
      sendMessage("group-start-ready", {
        roomId,
        groupId: parsedGroupId ?? undefined,
        clientId: clientIdRef.current,
        userId: effectiveIdentity.id,
        userEmail: effectiveIdentity.email,
        userName: effectiveIdentity.name,
        userImage: effectiveIdentity.image,
        ts: Date.now(),
      });
    }
  }, [effectiveIdentity, parsedGroupId, roomId, sendMessage]);

  const sendGroupStartUnready = useCallback(() => {
    if (roomId && effectiveIdentity && clientIdRef.current) {
      sendMessage("group-start-unready", {
        roomId,
        groupId: parsedGroupId ?? undefined,
        clientId: clientIdRef.current,
        userId: effectiveIdentity.id,
        userEmail: effectiveIdentity.email,
        userName: effectiveIdentity.name,
        userImage: effectiveIdentity.image,
        ts: Date.now(),
      });
    }
  }, [effectiveIdentity, parsedGroupId, roomId, sendMessage]);

  const sendLobbyChat = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !roomId || !effectiveIdentity || !clientIdRef.current) {
      return;
    }
    sendMessage("lobby-chat-send", {
      roomId,
      clientId: clientIdRef.current,
      userId: effectiveIdentity.id,
      userEmail: effectiveIdentity.email,
      userName: effectiveIdentity.name,
      userImage: effectiveIdentity.image,
      text: trimmed,
      ts: Date.now(),
    });
  }, [effectiveIdentity, roomId, sendMessage]);

  const sendClientStateHash = useCallback((message: Omit<ClientStateHashMessage, "roomId" | "groupId" | "clientId" | "userId" | "userEmail" | "engine" | "ts">) => {
    if (!roomId || !effectiveIdentity || !clientIdRef.current) {
      return;
    }
    sendMessage("client-state-hash", {
      roomId,
      groupId: parsedGroupId ?? undefined,
      clientId: clientIdRef.current,
      userId: effectiveIdentity.id,
      userEmail: effectiveIdentity.email,
      engine: collabEngine,
      ...message,
      ts: Date.now(),
    } satisfies ClientStateHashMessage);
  }, [collabEngine, effectiveIdentity, parsedGroupId, roomId, sendMessage]);

  const sendClientHealthEvent = useCallback((message: Omit<ClientHealthEventMessage, "roomId" | "groupId" | "clientId" | "userId" | "userEmail" | "engine" | "ts">) => {
    if (!roomId || !effectiveIdentity || !clientIdRef.current) {
      return;
    }
    sendMessage("client-health-event", {
      roomId,
      groupId: parsedGroupId ?? undefined,
      clientId: clientIdRef.current,
      userId: effectiveIdentity.id,
      userEmail: effectiveIdentity.email,
      engine: collabEngine,
      ...message,
      ts: Date.now(),
    } satisfies ClientHealthEventMessage);
  }, [collabEngine, effectiveIdentity, parsedGroupId, roomId, sendMessage]);

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
    requestRoomStateSync,
    requestYjsSync,
    sendYjsUpdate,
    sendRoomReset,
    sendProgressSync,
    sendGroupStartReady,
    sendGroupStartUnready,
    sendLobbyChat,
    sendClientStateHash,
    sendClientHealthEvent,
    effectiveIdentity,
  };
}
