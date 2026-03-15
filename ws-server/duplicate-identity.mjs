export function createDuplicateIdentityService({
  dbPool,
  gameDuplicateSettingsCache,
  gameDuplicateSettingsTtlMs,
  rooms,
  getRoomUsers,
  extractGameIdFromRoomId,
}) {
  function normalizeDuplicateBaseName(name, email, userId) {
    return name || email || userId || "Anonymous";
  }

  async function isDuplicateGroupUserAllowed(gameId) {
    if (!gameId) {
      return false;
    }

    const now = Date.now();
    const cached = gameDuplicateSettingsCache.get(gameId);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    if (!dbPool) {
      return false;
    }

    try {
      const result = await dbPool.query(
        "SELECT allow_duplicate_group_users FROM projects WHERE id = $1 LIMIT 1",
        [gameId],
      );
      const value = result.rows[0]?.allow_duplicate_group_users === true;
      gameDuplicateSettingsCache.set(gameId, {
        value,
        expiresAt: now + gameDuplicateSettingsTtlMs,
      });
      return value;
    } catch (error) {
      console.error("[duplicate-group-users:lookup-error]", error);
      return false;
    }
  }

  function parseDuplicateSessionIndex(userId, baseUserId) {
    if (!userId || !baseUserId) {
      return null;
    }
    if (userId === baseUserId) {
      return 1;
    }
    const prefix = `${baseUserId}::session-`;
    if (!userId.startsWith(prefix)) {
      return null;
    }
    const suffix = Number.parseInt(userId.slice(prefix.length), 10);
    return Number.isInteger(suffix) && suffix >= 2 ? suffix : null;
  }

  function resolveDuplicateIdentity(roomId, userData) {
    const roomUsers = Array.from(getRoomUsers(roomId).values());
    const duplicates = roomUsers.filter((entry) => {
      if (userData.userId && entry.accountUserId) {
        return entry.accountUserId === userData.userId;
      }
      if (userData.userEmail && entry.accountUserEmail) {
        return entry.accountUserEmail === userData.userEmail;
      }
      return false;
    });

    if (duplicates.length === 0) {
      return {
        effectiveUserId: userData.userId || userData.clientId,
        effectiveUserName: userData.userName,
        duplicateIndex: 0,
      };
    }

    const baseUserId = userData.userId || userData.clientId;
    const baseName = normalizeDuplicateBaseName(userData.userName, userData.userEmail, baseUserId);
    const usedIndexes = new Set(
      duplicates
        .map((entry) => parseDuplicateSessionIndex(entry.userId || "", baseUserId))
        .filter((value) => Number.isInteger(value))
    );

    let duplicateIndex = 2;
    while (usedIndexes.has(duplicateIndex)) {
      duplicateIndex += 1;
    }

    return {
      effectiveUserId: `${baseUserId}::session-${duplicateIndex}`,
      effectiveUserName: `${baseName} (${duplicateIndex})`,
      duplicateIndex,
    };
  }

  function findDuplicateUsersInGame(gameId, baseUserData) {
    if (!gameId) {
      return [];
    }

    const duplicates = [];
    for (const [candidateRoomId, roomUsers] of rooms.entries()) {
      if (extractGameIdFromRoomId(candidateRoomId) !== gameId) {
        continue;
      }

      for (const entry of roomUsers.values()) {
        if (baseUserData.userId && entry.accountUserId && entry.accountUserId === baseUserData.userId) {
          duplicates.push(entry);
          continue;
        }
        if (baseUserData.userEmail && entry.accountUserEmail && entry.accountUserEmail === baseUserData.userEmail) {
          duplicates.push(entry);
        }
      }
    }

    return duplicates;
  }

  return {
    isDuplicateGroupUserAllowed,
    resolveDuplicateIdentity,
    findDuplicateUsersInGame,
  };
}
