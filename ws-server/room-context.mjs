export function isLobbyRoom(roomId) {
  return typeof roomId === "string" && roomId.startsWith("lobby:");
}

export function extractGroupIdFromRoomId(roomId) {
  if (typeof roomId !== "string" || !roomId.startsWith("group:")) {
    return undefined;
  }

  const afterPrefix = roomId.slice("group:".length);
  const gameSeparatorIndex = afterPrefix.indexOf(":game:");
  if (gameSeparatorIndex === -1) {
    return afterPrefix || undefined;
  }

  const parsedGroupId = afterPrefix.slice(0, gameSeparatorIndex);
  return parsedGroupId || undefined;
}

export function parseRoomContext(roomId) {
  if (typeof roomId !== "string") return null;

  const groupMatch = roomId.match(/^group:(.+?):game:(.+)$/);
  if (groupMatch) {
    return { kind: "instance", gameId: groupMatch[2], groupId: groupMatch[1], userId: null };
  }

  const individualMatch = roomId.match(/^individual:(.+?):game:(.+)$/);
  if (individualMatch) {
    return { kind: "instance", gameId: individualMatch[2], groupId: null, userId: individualMatch[1] };
  }

  const creatorMatch = roomId.match(/^creator:(.+?):map:(.+)$/);
  if (creatorMatch) {
    return {
      kind: "creator",
      gameId: creatorMatch[1],
      mapName: decodeURIComponent(creatorMatch[2]),
      groupId: null,
      userId: null,
    };
  }

  return null;
}

export function extractGameIdFromRoomId(roomId) {
  if (typeof roomId !== "string") {
    return null;
  }

  const instanceContext = parseRoomContext(roomId);
  if (instanceContext?.gameId) {
    return instanceContext.gameId;
  }

  const lobbyMatch = roomId.match(/^lobby:.+:game:(.+)$/);
  if (lobbyMatch) {
    return lobbyMatch[1] || null;
  }

  return null;
}
