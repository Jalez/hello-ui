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
  clientId: string;
  userId: string;
  userName?: string;
  color: string;
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
  code: { html: string; css: string; js: string };
  versions: EditorVersionMap;
}

export interface RoomStateSyncMessage {
  levels: RoomStateSyncLevel[];
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
  userEmail: string;
  userName?: string;
  userImage?: string;
  color?: string;
  cursor?: { x: number; y: number };
  activeTab?: EditorType;
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

export interface TabFocusMessage {
  roomId: string;
  groupId?: string;
  clientId: string;
  userId: string;
  userName?: string;
  userImage?: string;
  editorType: EditorType;
  ts: number;
}

export interface TypingStatusMessage {
  roomId: string;
  groupId?: string;
  clientId: string;
  userId: string;
  userName?: string;
  editorType: EditorType;
  isTyping: boolean;
  ts: number;
}
