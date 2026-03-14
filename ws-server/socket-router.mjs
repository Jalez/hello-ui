import { randomUUID } from "crypto";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as syncProtocol from "y-protocols/sync";
import { ChangeSet } from "@codemirror/state";

export function createSocketMessageRouter(deps) {
  const {
    maybeDelaySocketHandling,
    parseEnvelope,
    sendMessage,
    getConnectionState,
    getConnectionId,
    setConnectionState,
    parseRoomContext,
    extractGameIdFromRoomId,
    extractGroupIdFromRoomId,
    isLobbyRoom,
    isYjsEnabled,
    getRoomUsers,
    addUserToRoom,
    removeUserFromRoom,
    ensureLobbyState,
    ensureRoomState,
    serializeRoomStateSync,
    serializeGroupStartSync,
    findDuplicateUsersInGame,
    isDuplicateGroupUserAllowed,
    resolveDuplicateIdentity,
    broadcastToRoom,
    logRoomSnapshot,
    getOrCreateYDoc,
    decodeBase64Update,
    sendYjsProtocol,
    editorTypes,
    getRoomClientHashes,
    evaluateClientStateHashes,
    rooms,
    ensureLevelState,
    getDocumentText,
    summarizeEditorPayload,
    markRoomDirty,
    isGroupInstanceContext,
    applyStartedGateToLevels,
    ensureGroupStartGate,
    fetchLevelsForMapName,
    createRoomState,
    serializeProgressData,
    createLevelState,
    roomEditorState,
    createRoomYDoc,
    getRoomYDocGeneration,
    roomWriteBuffer,
    saveProgressToDB,
    serializeCodeLevels,
  } = deps;

  const resolveRoomId = (socket, data) => data?.roomId || data?.groupId || getConnectionState(socket)?.roomId || null;

  return async (socket, rawMessage) => {
    await maybeDelaySocketHandling();
    const envelope = parseEnvelope(rawMessage.toString());
    if (!envelope) {
      sendMessage(socket, "error", { error: "Invalid message" });
      return;
    }

    const data = envelope.payload && typeof envelope.payload === "object" ? envelope.payload : {};
    const socketId = getConnectionId(socket);

    switch (envelope.type) {
      case "join-game": {
        const roomId = resolveRoomId(socket, data);
        if (!roomId) {
          return;
        }

        const ctx = parseRoomContext(roomId);
        const gameId = extractGameIdFromRoomId(roomId);

        setConnectionState(socket, { roomId });
        const baseUserData = {
          clientId: data.clientId || socketId,
          userId: data.userId || "",
          userEmail: data.userEmail || "",
          userName: data.userName || undefined,
          userImage: data.userImage || undefined,
          accountUserId: data.userId || "",
          accountUserEmail: data.userEmail || "",
          activeTab: null,
          activeLevelIndex: null,
          isTyping: false,
        };
        const existingDuplicates = findDuplicateUsersInGame(gameId, baseUserData);
        if (gameId && existingDuplicates.length > 0 && !await isDuplicateGroupUserAllowed(gameId)) {
          const conflictingUser = existingDuplicates[0];
          const attemptedLabel = baseUserData.userName || baseUserData.userEmail || "this account";
          const attemptedEmail = baseUserData.userEmail ? ` (${baseUserData.userEmail})` : "";
          const conflictingLabel = conflictingUser.userName || conflictingUser.userEmail || "this account";
          const conflictingEmail = conflictingUser.userEmail ? ` (${conflictingUser.userEmail})` : "";
          const summarizeIdentity = (label, email) => {
            const combined = `${label}${email}`;
            return combined.length > 40 ? `${combined.slice(0, 37)}...` : combined;
          };
          const attemptedSummary = summarizeIdentity(attemptedLabel, attemptedEmail);
          const conflictingSummary = summarizeIdentity(conflictingLabel, conflictingEmail);
          const duplicateError =
            `This browser is being identified as ${JSON.stringify(`${attemptedLabel}${attemptedEmail}`)}, ` +
            `but ${JSON.stringify(`${conflictingLabel}${conflictingEmail}`)} is already connected in this game. ` +
            `Turn group submission off from the A+ navbar setting, or ask the creator to enable duplicate users in Game Settings. ` +
            `Allowing duplicates may cause instability and desyncs.`;
          const duplicateCloseReason =
            `Identified as ${attemptedSummary}; ${conflictingSummary} is already connected.`;
          sendMessage(socket, "error", {
            error: duplicateError,
            code: "duplicate_users_blocked",
            roomId,
            ts: Date.now(),
          });
          setTimeout(() => {
            try {
              socket.close(4008, duplicateCloseReason);
            } catch {
              // Ignore close races if the socket is already gone.
            }
          }, 50);
          return;
        }
        const resolvedIdentity = resolveDuplicateIdentity(roomId, baseUserData);
        const userData = {
          ...baseUserData,
          userId: resolvedIdentity.effectiveUserId,
          userName: resolvedIdentity.effectiveUserName,
          duplicateIndex: resolvedIdentity.duplicateIndex,
        };
        addUserToRoom(roomId, socket, userData);

        broadcastToRoom(roomId, "user-joined", userData, socket);

        const currentUsers = Array.from(getRoomUsers(roomId).values());
        sendMessage(socket, "current-users", { users: currentUsers });
        sendMessage(socket, "identity-assigned", {
          roomId,
          userId: userData.userId,
          userEmail: userData.userEmail,
          userName: userData.userName,
          userImage: userData.userImage,
          accountUserId: userData.accountUserId,
          accountUserEmail: userData.accountUserEmail,
          duplicateIndex: userData.duplicateIndex || 0,
          ts: Date.now(),
        });

        if (ctx) {
          const state = await ensureRoomState(roomId, ctx);
          sendMessage(socket, "room-state-sync", serializeRoomStateSync(roomId, state));
          const groupStartSync = serializeGroupStartSync(roomId, state);
          if (groupStartSync) {
            sendMessage(socket, "group-start-sync", groupStartSync);
          }
          console.log(`[room-state-sync:emit] room=${roomId} target=${socketId} levelsCount=${state.levels.length}`);
        } else if (isLobbyRoom(roomId)) {
          const lobbyState = ensureLobbyState(roomId);
          sendMessage(socket, "lobby-chat-sync", {
            roomId,
            messages: lobbyState.messages,
            ts: Date.now(),
          });
        } else {
          console.log(`[room-state-sync:skip] room=${roomId} target=${socketId} reason=invalid-room-context`);
        }

        console.log(`[join-game] user=${userData.userEmail} room=${roomId} total=${currentUsers.length}`);
        logRoomSnapshot("join", roomId, { by: socketId });
        return;
      }
      case "request-room-state-sync": {
        const roomId = resolveRoomId(socket, data);
        if (!roomId) {
          return;
        }

        const ctx = parseRoomContext(roomId);
        if (!ctx) {
          console.log(`[room-state-sync:skip] room=${roomId} target=${socketId} reason=invalid-room-context-request`);
          return;
        }

        const state = await ensureRoomState(roomId, ctx);
        sendMessage(socket, "room-state-sync", serializeRoomStateSync(roomId, state));
        const groupStartSync = serializeGroupStartSync(roomId, state);
        if (groupStartSync) {
          sendMessage(socket, "group-start-sync", groupStartSync);
        }
        console.log(
          `[room-state-sync:emit] room=${roomId} target=${socketId} reason=request levelsCount=${state.levels.length}`
        );
        return;
      }
      case "yjs-protocol": {
        if (!isYjsEnabled()) {
          return;
        }

        const roomId = resolveRoomId(socket, data);
        if (
          !roomId
          || data.channel !== "sync"
          || typeof data.payloadBase64 !== "string"
          || data.payloadBase64.length === 0
        ) {
          return;
        }

        const ctx = parseRoomContext(roomId);
        if (!ctx) {
          return;
        }

        const state = await ensureRoomState(roomId, ctx);
        const doc = getOrCreateYDoc(roomId, state);
        const decoder = decoding.createDecoder(decodeBase64Update(data.payloadBase64));
        const encoder = encoding.createEncoder();
        const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, doc, socket);
        console.log(
          `[yjs-protocol:recv] room=${roomId} socket=${socketId} messageType=${syncMessageType} payloadLen=${data.payloadBase64.length}`
        );
        sendYjsProtocol(socket, roomId, "sync", encoder);
        return;
      }
      case "client-state-hash": {
        const roomId = resolveRoomId(socket, data);
        if (
          !roomId
          || !data.clientId
          || !data.userId
          || !editorTypes.includes(data.editorType)
          || !Number.isInteger(data.levelIndex)
          || typeof data.contentHash !== "string"
        ) {
          return;
        }

        const report = {
          roomId,
          groupId: extractGroupIdFromRoomId(roomId),
          clientId: data.clientId,
          userId: data.userId,
          userEmail: typeof data.userEmail === "string" ? data.userEmail : "",
          engine: data.engine === "yjs" ? "yjs" : "custom",
          editorType: data.editorType,
          levelIndex: data.levelIndex,
          contentHash: data.contentHash,
          contentLength: Number.isInteger(data.contentLength) ? data.contentLength : 0,
          version: Number.isInteger(data.version) ? data.version : null,
          isFocused: data.isFocused === true,
          isEditable: data.isEditable !== false,
          isTyping: data.isTyping === true,
          localInputAgeMs: Number.isInteger(data.localInputAgeMs) ? data.localInputAgeMs : null,
          remoteApplyAgeMs: Number.isInteger(data.remoteApplyAgeMs) ? data.remoteApplyAgeMs : null,
          receivedAt: Date.now(),
        };
        getRoomClientHashes(roomId).set(report.clientId, report);
        await evaluateClientStateHashes(roomId, report);
        return;
      }
      case "client-health-event": {
        const roomId = resolveRoomId(socket, data);
        if (!roomId || typeof data.eventType !== "string" || !data.clientId || !data.userId) {
          return;
        }
        const severity = data.severity === "error" ? "error" : data.severity === "warn" ? "warn" : "info";
        const logLine =
          `[client-health:${severity}] room=${roomId} clientId=${data.clientId} userId=${data.userId} ` +
          `editorType=${data.editorType || "none"} levelIndex=${Number.isInteger(data.levelIndex) ? data.levelIndex : "none"} ` +
          `event=${data.eventType} details=${JSON.stringify(data.details || {})}`;
        if (severity === "error") {
          console.error(logLine);
        } else if (severity === "warn") {
          console.warn(logLine);
        } else {
          console.log(logLine);
        }
        return;
      }
      case "leave-game": {
        const roomId = resolveRoomId(socket, data);
        if (!roomId) {
          return;
        }

        const userData = removeUserFromRoom(roomId, socket);
        setConnectionState(socket, { roomId: null });

        if (userData) {
          broadcastToRoom(
            roomId,
            "user-left",
            {
              userId: userData.userId,
              userEmail: userData.userEmail,
              userName: userData.userName,
            },
            socket
          );
          console.log(`[leave-game] user=${userData.userEmail} room=${roomId}`);
          logRoomSnapshot("leave", roomId, { by: socketId });
        }
        return;
      }
      case "lobby-chat-send": {
        const roomId = resolveRoomId(socket, data);
        if (!roomId || !isLobbyRoom(roomId)) {
          return;
        }

        const text = typeof data.text === "string" ? data.text.trim() : "";
        if (!text) {
          return;
        }

        const lobbyState = ensureLobbyState(roomId);
        const entry = {
          id: randomUUID(),
          userId: typeof data.userId === "string" ? data.userId : "",
          ...(typeof data.userEmail === "string" ? { userEmail: data.userEmail } : {}),
          ...(typeof data.userName === "string" ? { userName: data.userName } : {}),
          ...(typeof data.userImage === "string" ? { userImage: data.userImage } : {}),
          text,
          createdAt: new Date().toISOString(),
        };
        lobbyState.messages = [...lobbyState.messages.slice(-99), entry];

        sendMessage(socket, "lobby-chat-message", entry);
        broadcastToRoom(roomId, "lobby-chat-message", entry, socket);
        return;
      }
      case "canvas-cursor": {
        const roomId = resolveRoomId(socket, data);
        if (!roomId) {
          return;
        }
        broadcastToRoom(roomId, "canvas-cursor", data, socket);
        return;
      }
      case "editor-cursor": {
        const roomId = resolveRoomId(socket, data);
        if (!roomId) {
          return;
        }
        console.log(
          `[editor-cursor:recv] room=${roomId} from=${socketId} editorType=${data.editorType} levelIndex=${data.levelIndex} selection=${JSON.stringify(data.selection)}`
        );
        broadcastToRoom(roomId, "editor-cursor", data, socket);
        return;
      }
      case "editor-change": {
        if (isYjsEnabled()) {
          return;
        }
        const roomId = resolveRoomId(socket, data);
        if (!roomId) {
          return;
        }

        const ctx = parseRoomContext(roomId);
        if (!ctx) {
          return;
        }

        const levelIndex = Number.isInteger(data.levelIndex) ? data.levelIndex : 0;
        const state = await ensureRoomState(roomId, ctx);
        const levelState = ensureLevelState(state, levelIndex);
        const editorType = editorTypes.includes(data.editorType) ? data.editorType : "html";
        const currentVersion = levelState.versions[editorType] || 0;

        if (data.baseVersion !== currentVersion) {
          sendMessage(socket, "editor-resync", {
            roomId,
            groupId: extractGroupIdFromRoomId(roomId),
            editorType,
            levelIndex,
            content: levelState.code[editorType],
            version: currentVersion,
            ts: Date.now(),
          });
          console.log(
            `[editor-change:resync] room=${roomId} from=${socketId} groupId=${extractGroupIdFromRoomId(roomId) || "none"} editorType=${editorType} levelIndex=${levelIndex} clientBase=${data.baseVersion} serverVersion=${currentVersion} serverContentLen=${levelState.code[editorType].length} roomUsers=${getRoomUsers(roomId).size || 0}`
          );
          return;
        }

        try {
          const changeSet = ChangeSet.fromJSON(data.changeSetJson);
          const nextContent = changeSet.apply(getDocumentText(levelState.code[editorType])).toString();
          const nextVersion = currentVersion + 1;
          const previousContentLength = levelState.code[editorType].length;

          levelState.code[editorType] = nextContent;
          levelState.versions[editorType] = nextVersion;
          markRoomDirty(roomId, ctx);

          const payload = {
            roomId,
            groupId: extractGroupIdFromRoomId(roomId),
            editorType,
            clientId: data.clientId,
            userId: data.userId,
            baseVersion: currentVersion,
            nextVersion,
            changeSetJson: data.changeSetJson,
            levelIndex,
            selection: data.selection,
            ts: Date.now(),
          };

          console.log(`[editor-change:store] room=${roomId} from=${socketId} ${JSON.stringify(summarizeEditorPayload(payload))}`);
          sendMessage(socket, "editor-change-applied", {
            roomId,
            groupId: extractGroupIdFromRoomId(roomId),
            editorType,
            levelIndex,
            nextVersion,
            content: nextContent,
            ts: Date.now(),
          });

          const recipients = Math.max((getRoomUsers(roomId).size || 1) - 1, 0);
          console.log(`[editor-change:emit] room=${roomId} from=${socketId} groupId=${extractGroupIdFromRoomId(roomId) || "none"} recipients=${recipients} prevLen=${previousContentLength} nextLen=${nextContent.length} roomUsers=${getRoomUsers(roomId).size || 0} ${JSON.stringify(summarizeEditorPayload(payload))}`);
          broadcastToRoom(roomId, "editor-change", payload, socket);
        } catch (error) {
          sendMessage(socket, "editor-resync", {
            roomId,
            groupId: extractGroupIdFromRoomId(roomId),
            editorType,
            levelIndex,
            content: levelState.code[editorType],
            version: currentVersion,
            ts: Date.now(),
          });
          console.error(
            `[editor-change:error] room=${roomId} from=${socketId} groupId=${extractGroupIdFromRoomId(roomId) || "none"} editorType=${editorType} levelIndex=${levelIndex} serverContentLen=${levelState.code[editorType].length} roomUsers=${getRoomUsers(roomId).size || 0} ${error.message}`
          );
        }
        return;
      }
      case "tab-focus": {
        const roomId = resolveRoomId(socket, data);
        if (!roomId) {
          return;
        }

        const room = rooms.get(roomId);
        if (room && room.has(socket)) {
          const userData = room.get(socket);
          userData.activeTab = data.editorType;
          userData.activeLevelIndex = Number.isInteger(data.levelIndex) ? data.levelIndex : 0;
          userData.isTyping = false;
          room.set(socket, userData);

          broadcastToRoom(
            roomId,
            "tab-focus",
            {
              roomId,
              groupId: extractGroupIdFromRoomId(roomId),
              clientId: userData.clientId,
              userId: userData.userId,
              userName: userData.userName,
              userImage: userData.userImage,
              editorType: data.editorType,
              levelIndex: userData.activeLevelIndex,
              ts: Date.now(),
            },
            socket
          );
          console.log(`[tab-focus] room=${roomId} from=${socketId} editorType=${data.editorType} levelIndex=${userData.activeLevelIndex}`);
        }
        return;
      }
      case "typing-status": {
        const roomId = resolveRoomId(socket, data);
        if (!roomId) {
          return;
        }

        const room = rooms.get(roomId);
        if (room && room.has(socket)) {
          const userData = room.get(socket);
          const nextIsTyping = Boolean(data.isTyping);
          const nextEditorType = data.editorType ?? userData.activeTab ?? null;
          const nextLevelIndex = Number.isInteger(data.levelIndex)
            ? data.levelIndex
            : (Number.isInteger(userData.activeLevelIndex) ? userData.activeLevelIndex : 0);
          const shouldBroadcast =
            userData.isTyping !== nextIsTyping ||
            userData.activeTab !== nextEditorType ||
            userData.activeLevelIndex !== nextLevelIndex;

          if (!shouldBroadcast) {
            return;
          }

          userData.isTyping = nextIsTyping;
          userData.activeTab = nextEditorType;
          userData.activeLevelIndex = nextLevelIndex;
          room.set(socket, userData);

          broadcastToRoom(
            roomId,
            "typing-status",
            {
              roomId,
              groupId: extractGroupIdFromRoomId(roomId),
              clientId: userData.clientId,
              userId: userData.userId,
              userName: userData.userName,
              editorType: nextEditorType,
              levelIndex: nextLevelIndex,
              isTyping: nextIsTyping,
              ts: Date.now(),
            },
            socket
          );
          console.log(`[typing-status] room=${roomId} from=${socketId} editorType=${nextEditorType} levelIndex=${nextLevelIndex} isTyping=${nextIsTyping}`);
        }
        return;
      }
      case "progress-sync": {
        const roomId = resolveRoomId(socket, data);
        if (!roomId) {
          return;
        }

        const ctx = parseRoomContext(roomId);
        if (!ctx || ctx.kind !== "instance") {
          return;
        }

        const state = await ensureRoomState(roomId, ctx);
        const incomingProgress =
          data?.progressData && typeof data.progressData === "object" && !Array.isArray(data.progressData)
            ? data.progressData
            : null;
        if (!incomingProgress) {
          return;
        }

        if (isGroupInstanceContext(ctx) && "groupStartGate" in incomingProgress) {
          delete incomingProgress.groupStartGate;
        }

        state.progressData = {
          ...state.progressData,
          ...incomingProgress,
          levels: state.progressData.levels,
        };
        applyStartedGateToLevels(state);

        broadcastToRoom(roomId, "progress-sync", {
          progressData: incomingProgress,
          ts: Date.now(),
        }, socket);
        console.log(`[progress-sync] room=${roomId} from=${socketId} keys=${Object.keys(incomingProgress).join(",")}`);
        if (Array.isArray(state.progressData.levels) && Array.isArray(incomingProgress.levels)) {
          incomingProgress.levels.forEach((incomingLevel, levelIndex) => {
            const previousLevel = state.progressData.levels[levelIndex] || {};
            ["lockHTML", "lockCSS", "lockJS"].forEach((lockKey) => {
              if (typeof incomingLevel?.[lockKey] === "boolean" && incomingLevel[lockKey] !== previousLevel?.[lockKey]) {
                console.log(
                  `[lock-state] room=${roomId} from=${socketId} gameId=${ctx.gameId} groupId=${ctx.groupId || "none"} instanceId=${state.instanceId || "none"} levelIndex=${levelIndex} key=${lockKey} prev=${Boolean(previousLevel?.[lockKey])} next=${Boolean(incomingLevel[lockKey])}`
                );
              }
            });
          });
        }
        return;
      }
      case "group-start-ready":
      case "group-start-unready": {
        const roomId = resolveRoomId(socket, data);
        if (!roomId) {
          return;
        }

        const ctx = parseRoomContext(roomId);
        if (!isGroupInstanceContext(ctx)) {
          return;
        }

        const userId = typeof data.userId === "string" ? data.userId : "";
        if (!userId) {
          return;
        }

        const state = await ensureRoomState(roomId, ctx);
        const gate = ensureGroupStartGate(state);
        if (!gate) {
          return;
        }

        if (gate.status === "started") {
          const startedSync = serializeGroupStartSync(roomId, state);
          if (startedSync) {
            sendMessage(socket, "group-start-sync", startedSync);
          }
          return;
        }

        if (envelope.type === "group-start-ready") {
          if (!gate.readyUserIds.includes(userId)) {
            gate.readyUserIds = [...gate.readyUserIds, userId];
          }
          gate.readyUsers = {
            ...gate.readyUsers,
            [userId]: {
              userId,
              ...(typeof data.userName === "string" ? { userName: data.userName } : {}),
              ...(typeof data.userEmail === "string" ? { userEmail: data.userEmail } : {}),
              ...(typeof data.userImage === "string" ? { userImage: data.userImage } : {}),
              readyAt: new Date().toISOString(),
            },
          };
        } else {
          gate.readyUserIds = gate.readyUserIds.filter((entry) => entry !== userId);
          const nextReadyUsers = { ...gate.readyUsers };
          delete nextReadyUsers[userId];
          gate.readyUsers = nextReadyUsers;
        }

        if (gate.readyUserIds.length >= gate.minReadyCount) {
          gate.status = "started";
          gate.startedAt = new Date().toISOString();
          gate.startedByUserId = userId;
          applyStartedGateToLevels(state);
          sendMessage(socket, "room-state-sync", serializeRoomStateSync(roomId, state));
          broadcastToRoom(roomId, "room-state-sync", serializeRoomStateSync(roomId, state), socket);
        }

        state.progressData = {
          ...state.progressData,
          groupStartGate: gate,
        };
        markRoomDirty(roomId, ctx);

        const syncPayload = serializeGroupStartSync(roomId, state);
        if (syncPayload) {
          sendMessage(socket, "group-start-sync", syncPayload);
          broadcastToRoom(roomId, "group-start-sync", syncPayload, socket);
        }

        broadcastToRoom(roomId, "progress-sync", {
          progressData: { groupStartGate: gate },
          ts: Date.now(),
        }, socket);
        sendMessage(socket, "progress-sync", {
          progressData: { groupStartGate: gate },
          ts: Date.now(),
        });
        console.log(
          `[group-start:${envelope.type === "group-start-ready" ? "ready" : "unready"}] room=${roomId} from=${socketId} userId=${userId} readyCount=${gate.readyUserIds.length}/${gate.minReadyCount} status=${gate.status}`
        );
        logRoomSnapshot(envelope.type === "group-start-ready" ? "start-ready" : "start-unready", roomId, {
          by: socketId,
          readyCount: gate.readyUserIds.length,
          status: gate.status,
        });
        return;
      }
      case "reset-room-state": {
        const roomId = resolveRoomId(socket, data);
        if (!roomId) {
          return;
        }

        const ctx = parseRoomContext(roomId);
        if (!ctx || ctx.kind !== "instance") {
          return;
        }

        const room = rooms.get(roomId);
        const resetUser = room?.get(socket) || null;
        const scope = data?.scope === "game" ? "game" : "level";
        const levelIndex = Number.isInteger(data?.levelIndex) ? data.levelIndex : 0;
        const currentState = await ensureRoomState(roomId, ctx);
        console.log(
          `[room-state-reset:start] room=${roomId} by=${socketId} groupId=${extractGroupIdFromRoomId(roomId) || "none"} scope=${scope} levelIndex=${levelIndex} levelsCount=${currentState.levels.length} mapName=${currentState.mapName || "none"}`
        );
        let templateLevels = currentState.mapName
          ? await fetchLevelsForMapName(currentState.mapName)
          : [];

        if (templateLevels.length === 0) {
          templateLevels = Array.isArray(currentState.templateLevels)
            ? currentState.templateLevels
            : [];
        }
        if (templateLevels.length === 0) {
          console.warn(
            `[room-state-reset:skip] room=${roomId} by=${socketId} reason=no-template-levels scope=${scope} levelIndex=${levelIndex}`
          );
          return;
        }

        const nextState = createRoomState(ctx, serializeProgressData(currentState), {
          templateLevels,
          mapName: currentState.mapName,
        });
        if (scope === "game") {
          nextState.levels = templateLevels.map((templateLevel) => createLevelState(templateLevel));
        } else {
          const templateLevel = templateLevels[levelIndex];
          if (!templateLevel) {
            return;
          }
          nextState.levels[levelIndex] = createLevelState(templateLevel);
        }
        applyStartedGateToLevels(nextState);
        roomEditorState.set(roomId, nextState);
        if (isYjsEnabled()) {
          const nextGeneration = Math.max(getRoomYDocGeneration(roomId) + 1, 1);
          createRoomYDoc(roomId, nextState, nextGeneration);
        }

        const existingBuffer = roomWriteBuffer.get(roomId);
        if (existingBuffer?.timer) {
          clearTimeout(existingBuffer.timer);
        }
        roomWriteBuffer.delete(roomId);

        const result = await saveProgressToDB(ctx, serializeCodeLevels(roomId, nextState));
        if (!result.ok && !result.permanentFailure) {
          markRoomDirty(roomId, ctx);
        }
        console.log(
          `[room-state-reset:save] room=${roomId} by=${socketId} ok=${result.ok} permanentFailure=${result.permanentFailure} dirty=${!result.ok && !result.permanentFailure} scope=${scope} levelIndex=${levelIndex}`
        );

        const resyncIndices =
          scope === "game"
            ? nextState.levels.map((_, index) => index)
            : [levelIndex];
        if (!isYjsEnabled()) {
          for (const resyncLevelIndex of resyncIndices) {
            const resyncLevel = nextState.levels[resyncLevelIndex];
            if (!resyncLevel) {
              continue;
            }
            for (const editorType of editorTypes) {
              const content = resyncLevel.code[editorType];
              broadcastToRoom(roomId, "editor-resync", {
                roomId,
                groupId: extractGroupIdFromRoomId(roomId),
                editorType,
                levelIndex: resyncLevelIndex,
                content,
                version: resyncLevel.versions[editorType] || 0,
                ts: Date.now(),
              });
              console.log(
                `[room-state-reset:resync] room=${roomId} by=${socketId} groupId=${extractGroupIdFromRoomId(roomId) || "none"} editorType=${editorType} levelIndex=${resyncLevelIndex} version=${resyncLevel.versions[editorType] || 0} contentLen=${typeof content === "string" ? content.length : 0}`
              );
            }
          }
        }

        broadcastToRoom(roomId, "room-state-sync", serializeRoomStateSync(roomId, nextState));
        const groupStartSync = serializeGroupStartSync(roomId, nextState);
        if (groupStartSync) {
          broadcastToRoom(roomId, "group-start-sync", groupStartSync);
        }
        const resetNotice = {
          scope,
          levelIndex,
          userId: resetUser?.userId || (typeof data?.userId === "string" ? data.userId : ""),
          ...(typeof resetUser?.userName === "string" && resetUser.userName
            ? { userName: resetUser.userName }
            : {}),
          ...(typeof resetUser?.userEmail === "string" && resetUser.userEmail
            ? { userEmail: resetUser.userEmail }
            : {}),
          at: new Date().toISOString(),
        };
        broadcastToRoom(roomId, "progress-sync", {
          progressData: { resetNotice },
          ts: Date.now(),
        }, socket);
        console.log(`[room-state-sync:emit] room=${roomId} by=${socketId} reason=reset scope=${scope} levelIndex=${levelIndex}`);
        return;
      }
      default:
        return;
    }
  };
}
