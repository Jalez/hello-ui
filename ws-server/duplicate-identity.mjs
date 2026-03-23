export function createDuplicateIdentityService({
  getRoomUsers,
}) {
  function normalizeDuplicateBaseName(name, email, userId) {
    return name || email || userId || "Anonymous";
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
  return {
    resolveDuplicateIdentity,
  };
}
