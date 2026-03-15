/**
 * @typedef {object} WsRuntimeContext
 * @property {(raw: string) => ({ type: string, payload?: unknown } | null)} parseEnvelope
 * @property {() => Promise<void>} maybeDelaySocketHandling
 * @property {(socket: import("ws").WebSocket, type: string, payload: object) => void} sendMessage
 * @property {(socket: import("ws").WebSocket) => ({ id?: string, roomId?: string | null } | null)} getConnectionState
 * @property {(socket: import("ws").WebSocket) => string} getConnectionId
 * @property {(socket: import("ws").WebSocket, nextState: object) => void} setConnectionState
 * @property {() => boolean} isYjsEnabled
 * @property {(roomId: string) => Map<import("ws").WebSocket, any>} getRoomUsers
 * @property {(roomId: string, socket: import("ws").WebSocket, userData: any) => void} addUserToRoom
 * @property {(roomId: string, socket: import("ws").WebSocket) => any} removeUserFromRoom
 * @property {(roomId: string) => { messages: Array<any> }} ensureLobbyState
 * @property {(roomId: string, ctx: any) => Promise<any>} ensureRoomState
 * @property {(roomId: string, state: any) => object} serializeRoomStateSync
 * @property {(roomId: string, state: any) => (object | null)} serializeGroupStartSync
 * @property {(gameId: string, baseUserData: any) => Array<any>} findDuplicateUsersInGame
 * @property {(gameId: string) => Promise<boolean>} isDuplicateGroupUserAllowed
 * @property {(roomId: string, userData: any) => { effectiveUserId: string, effectiveUserName?: string, duplicateIndex: number }} resolveDuplicateIdentity
 * @property {(roomId: string, type: string, payload: any, excludeSocket?: import("ws").WebSocket | null) => void} broadcastToRoom
 * @property {(reason: string, roomId: string, extra?: object) => void} logRoomSnapshot
 * @property {(roomId: string, state: any) => any} getOrCreateYDoc
 * @property {(value: string) => Uint8Array} decodeBase64Update
 * @property {(socket: import("ws").WebSocket, roomId: string, channel: "sync" | "awareness", encoder: any) => void} sendYjsProtocol
 * @property {(roomId: string, state: any, update: Uint8Array, socket: import("ws").WebSocket) => void} applyYjsAwarenessUpdate
 * @property {(socket: import("ws").WebSocket, roomId: string, state: any) => void} sendFullAwarenessState
 * @property {string[]} editorTypes
 * @property {(roomId: string) => Map<string, any>} getRoomClientHashes
 * @property {(roomId: string, report: any) => Promise<void>} evaluateClientStateHashes
 * @property {Map<string, Map<import("ws").WebSocket, any>>} rooms
 * @property {(roomId: string, ctx: any) => void} markRoomDirty
 * @property {(ctx: any) => boolean} isGroupInstanceContext
 * @property {(state: any) => any} applyStartedGateToLevels
 * @property {(state: any) => any} ensureGroupStartGate
 * @property {(mapName: string) => Promise<Array<any>>} fetchLevelsForMapName
 * @property {(ctx: any, progressData: any, options?: any) => any} createRoomState
 * @property {(state: any) => any} serializeProgressData
 * @property {(level: any) => any} createLevelState
 * @property {Map<string, any>} roomEditorState
 * @property {(roomId: string, state: any, generation: number) => any} createRoomYDoc
 * @property {(roomId: string) => number} getRoomYDocGeneration
 * @property {Map<string, { ctx: any, timer?: NodeJS.Timeout | null }>} roomWriteBuffer
 * @property {(ctx: any, levels: Array<any>) => Promise<{ ok: boolean, permanentFailure?: boolean }>} saveProgressToDB
 * @property {(roomId: string, state: any) => Array<any>} serializeCodeLevels
 */

export const WS_RUNTIME_CONTEXT_DOC = true;
