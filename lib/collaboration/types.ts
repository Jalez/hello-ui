export interface CanvasCursor {
  roomId: string;
  groupId?: string;
  clientId: string;
  userId: string;
  userName?: string;
  userImage?: string;
  color: string;
  x: number;
  y: number;
  ts: number;
}

export interface EditorCursor {
  roomId: string;
  groupId?: string;
  editorType: "html" | "css" | "js";
  levelIndex: number;
  clientId: string;
  userId: string;
  userName?: string;
  color: string;
  sessionRole?: "active" | "readonly";
  selection: { from: number; to: number };
  ts: number;
}

export interface EditorVersionMap {
  html: number;
  css: number;
  js: number;
}

export interface RoomStateSyncLevel {
  [key: string]: unknown;
  name: string;
  code?: { html: string; css: string; js: string };
  versions?: EditorVersionMap;
}

export interface RoomStateSyncMessage {
  levels: RoomStateSyncLevel[];
  groupStartGate?: GroupStartGateState;
  yjsDocGeneration?: number;
  forceReplaceYDoc?: boolean;
  forceReplaceYjsSyncPayloadBase64?: string;
  ts: number;
}

export interface ProgressSyncMessage {
  progressData: Record<string, unknown>;
  ts: number;
}

export interface GroupStartReadyUser {
  userId: string;
  userName?: string;
  userEmail?: string;
  userImage?: string;
  readyAt?: string;
}

export interface GroupStartGateState {
  status: "waiting" | "started";
  minReadyCount: number;
  readyUserIds: string[];
  readyUsers: Record<string, GroupStartReadyUser>;
  startedAt?: string | null;
  startedByUserId?: string | null;
}

export interface GroupStartSyncMessage {
  roomId: string;
  groupId?: string;
  gate: GroupStartGateState;
  ts: number;
}

export interface LobbyChatEntry {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  userImage?: string;
  text: string;
  createdAt: string;
}

export interface LobbyChatSyncMessage {
  roomId: string;
  messages: LobbyChatEntry[];
  ts: number;
}

export interface EditorChange {
  roomId: string;
  groupId?: string;
  editorType: "html" | "css" | "js";
  clientId: string;
  userId: string;
  baseVersion: number;
  nextVersion: number;
  changeSetJson: unknown;
  levelIndex: number;
  selection?: { from: number; to: number };
  ts: number;
}

export interface EditorChangeApplied {
  roomId: string;
  groupId?: string;
  editorType: "html" | "css" | "js";
  levelIndex: number;
  nextVersion: number;
  content: string;
  ts: number;
}

export interface EditorResync {
  roomId: string;
  groupId?: string;
  editorType: "html" | "css" | "js";
  levelIndex: number;
  content: string;
  version: number;
  ts: number;
}

export interface ActiveUser {
  clientId: string;
  userId: string;
  accountUserId?: string;
  userEmail: string;
  accountUserEmail?: string;
  userName?: string;
  userImage?: string;
  color?: string;
  sessionRole?: "active" | "readonly";
  cursor?: { x: number; y: number };
  activeTab?: EditorType;
  activeLevelIndex?: number;
  isTyping?: boolean;
}

export interface CollaborationState {
  isConnected: boolean;
  isConnecting: boolean;
  activeUsers: ActiveUser[];
  remoteCursors: Map<string, CanvasCursor>;
  editorCursors: Map<string, EditorCursor>;
  roomId: string | null;
  error: string | null;
  clientId: string | null;
}

export interface JoinGamePayload {
  roomId: string;
  groupId?: string;
  userId: string;
  userEmail: string;
  userName?: string;
  userImage?: string;
}

export interface LeaveGamePayload {
  roomId: string;
  groupId?: string;
}

export type EditorType = "html" | "css" | "js";

export interface UserIdentity {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

export interface IdentityAssignedMessage {
  roomId: string;
  userId: string;
  userEmail: string;
  userName?: string;
  userImage?: string;
  accountUserId?: string;
  accountUserEmail?: string;
  duplicateIndex?: number;
  ts: number;
}

export interface TabFocusMessage {
  roomId: string;
  groupId?: string;
  clientId: string;
  userId: string;
  userName?: string;
  userImage?: string;
  editorType: EditorType;
  levelIndex: number;
  ts: number;
}

export interface TypingStatusMessage {
  roomId: string;
  groupId?: string;
  clientId: string;
  userId: string;
  userName?: string;
  editorType: EditorType;
  levelIndex: number;
  isTyping: boolean;
  ts: number;
}

export interface YjsProtocolMessage {
  roomId: string;
  groupId?: string;
  channel: "sync" | "awareness";
  payloadBase64: string;
  yjsDocGeneration?: number;
  ts: number;
}

export interface GameInstancesResetMessage {
  gameId: string;
  deletedCount?: number;
  roomIds?: string[];
  actorUserId?: string;
  actorUserEmail?: string;
  actorUserName?: string;
  reason?: string;
  ts: number;
}

export type CollaborationHealthSeverity = "info" | "warn" | "error";

export interface CollaborationHealthMessage {
  roomId: string;
  groupId?: string;
  eventType: string;
  severity: CollaborationHealthSeverity;
  clientId?: string;
  userId?: string;
  editorType?: EditorType;
  levelIndex?: number;
  details?: Record<string, unknown>;
  ts: number;
}

export interface ClientStateHashMessage {
  roomId: string;
  groupId?: string;
  clientId: string;
  userId: string;
  userEmail?: string;
  engine: "yjs";
  editorType: EditorType;
  levelIndex: number;
  contentHash: string;
  contentLength: number;
  version?: number | null;
  isFocused?: boolean;
  isEditable?: boolean;
  isTyping?: boolean;
  localInputAgeMs?: number | null;
  remoteApplyAgeMs?: number | null;
  ts: number;
}

export interface ClientHealthEventMessage {
  roomId: string;
  groupId?: string;
  clientId: string;
  userId: string;
  userEmail?: string;
  engine: "yjs";
  eventType: string;
  severity: CollaborationHealthSeverity;
  editorType?: EditorType;
  levelIndex?: number;
  details?: Record<string, unknown>;
  ts: number;
}

export interface EditorWatchdogSnapshot {
  editorType: EditorType;
  levelIndex: number;
  content: string;
  version?: number | null;
  isEditable: boolean;
  isFocused: boolean;
  isTyping?: boolean;
  source: "interval" | "local_input" | "remote_apply" | "room_sync" | "focus";
  ts?: number;
}
