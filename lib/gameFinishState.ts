"use client";

export interface UserFinishState {
  finishedAt?: string;
  finalScore?: { points: number; maxPoints: number };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function getCurrentUserFinishState(
  progressData: unknown,
  userId: string | null | undefined,
): UserFinishState | null {
  const record = asRecord(progressData);
  if (!record) {
    return null;
  }

  if (userId) {
    const userFinishStates = asRecord(record.userFinishStates);
    const rawUserState = userFinishStates ? asRecord(userFinishStates[userId]) : null;
    if (rawUserState && typeof rawUserState.finishedAt === "string") {
      const finalScore = asRecord(rawUserState.finalScore);
      return {
        finishedAt: rawUserState.finishedAt,
        finalScore:
          typeof finalScore?.points === "number" && typeof finalScore?.maxPoints === "number"
            ? { points: finalScore.points, maxPoints: finalScore.maxPoints }
            : undefined,
      };
    }
  }

  if (typeof record.finishedAt === "string") {
    const finalScore = asRecord(record.finalScore);
    return {
      finishedAt: record.finishedAt,
      finalScore:
        typeof finalScore?.points === "number" && typeof finalScore?.maxPoints === "number"
          ? { points: finalScore.points, maxPoints: finalScore.maxPoints }
          : undefined,
    };
  }

  return null;
}

export function clearCurrentUserFinishState(
  progressData: Record<string, unknown>,
  userId: string | null | undefined,
  isGroupGameplay: boolean,
): Record<string, unknown> {
  const nextProgressData = { ...progressData };

  if (isGroupGameplay && userId) {
    const userFinishStates = asRecord(nextProgressData.userFinishStates);
    if (userFinishStates && userFinishStates[userId]) {
      const nextUserFinishStates = { ...userFinishStates };
      delete nextUserFinishStates[userId];
      if (Object.keys(nextUserFinishStates).length > 0) {
        nextProgressData.userFinishStates = nextUserFinishStates;
      } else {
        delete nextProgressData.userFinishStates;
      }
    }
  }

  delete nextProgressData.finishedAt;
  delete nextProgressData.finalScore;
  return nextProgressData;
}
