import { getSql, type DatabaseResult } from "@/app/api/_lib/db";
import { getLevelsForMap } from "@/app/api/_lib/services/mapService";

function getRows(result: DatabaseResult | null | undefined): Record<string, unknown>[] {
  if (!result) return [];
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  return Array.isArray(result.rows) ? (result.rows as Record<string, unknown>[]) : [];
}

type PointsByLevelEntry = {
  points?: number;
  maxPoints?: number;
  accuracy?: number;
  bestTime?: string;
  scenarios?: { scenarioId: string; accuracy: number }[];
};

type ProgressTelemetryUser = {
  userId: string;
  displayName?: string;
  email?: string;
  pasteCount?: number;
  largePasteCount?: number;
  focusLossCount?: number;
  activeEditMs?: number;
  editCount?: number;
  resetLevelCount?: number;
  resetGameCount?: number;
  levels?: Record<string, {
    pasteCount?: number;
    largePasteCount?: number;
    focusLossCount?: number;
    activeEditMs?: number;
    editCount?: number;
    resetCount?: number;
  }>;
};

type ProgressTelemetry = {
  users?: Record<string, ProgressTelemetryUser>;
};

export type FinalizeAttemptInput = {
  gameId: string;
  mapName: string;
  instanceId: string;
  scope: "individual" | "group";
  userId: string | null;
  groupId: string | null;
  playerDisplayName: string | null;
  points: number;
  maxPoints: number;
  progressData: Record<string, unknown>;
  pointsByLevel?: Record<string, PointsByLevelEntry>;
  finishedAt: Date;
};

function clampInt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function parseBestTimeToMs(value?: string): number | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) return null;
  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return clampInt((minutes * 60 + seconds) * 1000);
  }
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return clampInt((hours * 3600 + minutes * 60 + seconds) * 1000);
  }
  return null;
}

function getStartedAt(progressData: Record<string, unknown>): Date | null {
  const levels = Array.isArray(progressData.levels) ? progressData.levels as Array<Record<string, unknown>> : [];
  const startTimes = levels
    .map((level) => {
      const timeData =
        level.timeData && typeof level.timeData === "object" && !Array.isArray(level.timeData)
          ? level.timeData as Record<string, unknown>
          : {};
      return Number(timeData.startTime ?? 0);
    })
    .filter((value) => Number.isFinite(value) && value > 0);
  if (startTimes.length === 0) return null;
  return new Date(Math.min(...startTimes));
}

function getTelemetry(progressData: Record<string, unknown>): ProgressTelemetry {
  const telemetry = progressData.gameplayTelemetry;
  if (!telemetry || typeof telemetry !== "object" || Array.isArray(telemetry)) {
    return {};
  }
  return telemetry as ProgressTelemetry;
}

function getDifficulty(value: unknown): string | null {
  const difficulty = typeof value === "string" ? value.toLowerCase() : "";
  return difficulty === "easy" || difficulty === "medium" || difficulty === "hard" ? difficulty : null;
}

export async function finalizeGameAttempt(input: FinalizeAttemptInput) {
  const sql = await getSql();
  const telemetry = getTelemetry(input.progressData);
  const levels = await getLevelsForMap(input.mapName);
  const levelEntries = levels.map((level, levelIndex) => {
    const saved = input.pointsByLevel?.[level.name] ?? {};
    return {
      levelIndex,
      levelName: level.name,
      points: clampInt(Number(saved.points ?? 0)),
      maxPoints: clampInt(Number(saved.maxPoints ?? Number(level.json?.maxPoints ?? 0))),
      accuracyPercent: clampInt(Number(saved.accuracy ?? 0)),
      bestTimeMs: parseBestTimeToMs(saved.bestTime),
      rawBestTime: typeof saved.bestTime === "string" ? saved.bestTime : null,
      difficulty: getDifficulty(level.json?.difficulty),
      metadata: {
        identifier: level.identifier,
        scenarioCount: Array.isArray(level.json?.scenarios) ? level.json.scenarios.length : 0,
      },
    };
  });

  const startedAt = getStartedAt(input.progressData);
  const fallbackDurationMs = (() => {
    const times = levelEntries
      .map((entry) => entry.bestTimeMs)
      .filter((value): value is number => value != null && Number.isFinite(value) && value > 0);
    if (times.length === 0) {
      return null;
    }
    return clampInt(times.reduce((sum, value) => sum + value, 0));
  })();
  const durationMs = startedAt
    ? clampInt(input.finishedAt.getTime() - startedAt.getTime())
    : fallbackDurationMs;
  const accuracyPercent = input.maxPoints > 0 ? clampInt((input.points / input.maxPoints) * 100) : 0;

  let attemptNumber = 1;
  if (input.scope === "group" && input.groupId) {
    const countResult = await sql.query(
      "SELECT COUNT(*)::int AS count FROM game_attempts WHERE game_id = $1 AND group_id = $2",
      [input.gameId, input.groupId],
    );
    attemptNumber = Number(getRows(countResult)[0]?.count ?? 0) + 1;
  } else if (input.userId) {
    const countResult = await sql.query(
      "SELECT COUNT(*)::int AS count FROM game_attempts WHERE game_id = $1 AND user_id = $2",
      [input.gameId, input.userId],
    );
    attemptNumber = Number(getRows(countResult)[0]?.count ?? 0) + 1;
  }

  const attemptId = crypto.randomUUID();
  await sql.query(
    `INSERT INTO game_attempts (
      id, game_id, instance_id, user_id, group_id, scope, player_display_name,
      started_at, finished_at, duration_ms, final_points, max_points, accuracy_percent,
      attempt_number, is_finished, metadata, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13,
      $14, true, $15, NOW(), NOW()
    )`,
    [
      attemptId,
      input.gameId,
      input.instanceId,
      input.userId,
      input.groupId,
      input.scope,
      input.playerDisplayName,
      startedAt,
      input.finishedAt,
      durationMs,
      clampInt(input.points),
      clampInt(input.maxPoints),
      accuracyPercent,
      attemptNumber,
      {
        levelCount: levelEntries.length,
      },
    ],
  );

  for (const levelEntry of levelEntries) {
    await sql.query(
      `INSERT INTO game_attempt_levels (
        id, attempt_id, level_index, level_name, points, max_points,
        accuracy_percent, best_time_ms, raw_best_time, difficulty, metadata, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, NOW()
      )`,
      [
        crypto.randomUUID(),
        attemptId,
        levelEntry.levelIndex,
        levelEntry.levelName,
        levelEntry.points,
        levelEntry.maxPoints,
        levelEntry.accuracyPercent,
        levelEntry.bestTimeMs,
        levelEntry.rawBestTime,
        levelEntry.difficulty,
        levelEntry.metadata,
      ],
    );
  }

  const telemetryUsers = telemetry.users && typeof telemetry.users === "object" ? Object.values(telemetry.users) : [];
  let participantRows = telemetryUsers;
  if (input.scope === "group" && input.groupId && participantRows.length === 0) {
    const groupMembersResult = await sql.query(
      `SELECT gm.user_id, COALESCE(u.name, u.email, gm.user_id::text) AS display_name, u.email
       FROM group_members gm
       LEFT JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1
       ORDER BY display_name ASC`,
      [input.groupId],
    );
    participantRows = getRows(groupMembersResult).map((row) => ({
      userId: String(row.user_id),
      displayName: row.display_name as string,
      email: row.email as string | undefined,
    }));
  }

  for (const participant of participantRows) {
    const contributionScore =
      clampInt(Number(participant.editCount ?? 0)) +
      Math.round(clampInt(Number(participant.activeEditMs ?? 0)) / 1000) +
      clampInt(Number(participant.resetLevelCount ?? 0));

    await sql.query(
      `INSERT INTO game_attempt_participants (
        id, attempt_id, user_id, display_name, contribution_score, paste_count, large_paste_count,
        focus_loss_count, active_edit_ms, edit_count, reset_level_count, reset_game_count, metadata, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, NOW()
      )`,
      [
        crypto.randomUUID(),
        attemptId,
        participant.userId || null,
        participant.displayName || input.playerDisplayName,
        contributionScore,
        clampInt(Number(participant.pasteCount ?? 0)),
        clampInt(Number(participant.largePasteCount ?? 0)),
        clampInt(Number(participant.focusLossCount ?? 0)),
        clampInt(Number(participant.activeEditMs ?? 0)),
        clampInt(Number(participant.editCount ?? 0)),
        clampInt(Number(participant.resetLevelCount ?? 0)),
        clampInt(Number(participant.resetGameCount ?? 0)),
        {
          email: participant.email ?? null,
          levels: participant.levels ?? {},
        },
      ],
    );

    const levelMetrics = participant.levels && typeof participant.levels === "object" ? Object.entries(participant.levels) : [];
    const summaryEvents = [
      { type: "paste", value: clampInt(Number(participant.pasteCount ?? 0)) },
      { type: "large_paste", value: clampInt(Number(participant.largePasteCount ?? 0)) },
      { type: "focus_blur", value: clampInt(Number(participant.focusLossCount ?? 0)) },
      { type: "reset_level", value: clampInt(Number(participant.resetLevelCount ?? 0)) },
      { type: "reset_game", value: clampInt(Number(participant.resetGameCount ?? 0)) },
      { type: "typing_window", value: clampInt(Number(participant.activeEditMs ?? 0)) },
      { type: "edit_count", value: clampInt(Number(participant.editCount ?? 0)) },
    ];

    for (const event of summaryEvents) {
      if (event.value <= 0) continue;
      await sql.query(
        `INSERT INTO game_attempt_events (id, attempt_id, user_id, level_index, event_type, event_value, created_at)
         VALUES ($1, $2, $3, NULL, $4, $5, NOW())`,
        [
          crypto.randomUUID(),
          attemptId,
          participant.userId || null,
          event.type,
          { count: event.value },
        ],
      );
    }

    for (const [levelIndex, metrics] of levelMetrics) {
      await sql.query(
        `INSERT INTO game_attempt_events (id, attempt_id, user_id, level_index, event_type, event_value, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          crypto.randomUUID(),
          attemptId,
          participant.userId || null,
          Number(levelIndex),
          "level_telemetry",
          metrics,
        ],
      );
    }
  }

  return {
    attemptId,
    attemptNumber,
    durationMs,
    accuracyPercent,
  };
}

export async function getLeaderboardForGame(gameId: string, actorUserId?: string | null) {
  const sql = await getSql();
  const countResult = await sql.query(
    "SELECT COUNT(*)::int AS count FROM game_attempts WHERE game_id = $1 AND is_finished = true",
    [gameId],
  );
  const leaderboardResult = await sql.query(
    `SELECT
        ga.id,
        ga.scope,
        ga.finished_at,
        ga.duration_ms,
        ga.final_points,
        ga.max_points,
        ga.accuracy_percent,
        ga.player_display_name,
        COALESCE(ga.player_display_name, u.name, u.email, 'Anonymous') AS display_name
      FROM game_attempts ga
      LEFT JOIN users u ON u.id = ga.user_id
      WHERE ga.game_id = $1 AND ga.is_finished = true
      ORDER BY ga.final_points DESC, ga.duration_ms ASC NULLS LAST, ga.finished_at ASC
      LIMIT 50`,
    [gameId],
  );
  const rows = getRows(leaderboardResult).map((row, index) => ({
    rank: index + 1,
    attemptId: String(row.id),
    scope: String(row.scope),
    finishedAt: row.finished_at,
    durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
    finalPoints: Number(row.final_points ?? 0),
    maxPoints: Number(row.max_points ?? 0),
    accuracyPercent: Number(row.accuracy_percent ?? 0),
    displayName: String(row.display_name ?? "Anonymous"),
  }));

  let myStats = null;
  if (actorUserId) {
    const myRowsResult = await sql.query(
      `SELECT
          ga.id,
          ga.finished_at,
          ga.duration_ms,
          ga.final_points,
          ga.max_points,
          ga.accuracy_percent
        FROM game_attempts ga
        WHERE ga.game_id = $1 AND ga.user_id = $2 AND ga.is_finished = true
        ORDER BY ga.final_points DESC, ga.duration_ms ASC NULLS LAST, ga.finished_at DESC
        LIMIT 10`,
      [gameId, actorUserId],
    );
    const myRows = getRows(myRowsResult);
    if (myRows.length > 0) {
      const best = myRows[0];
      const bestRank = rows.find((row) => row.attemptId === String(best.id))?.rank ?? null;
      myStats = {
        bestAttemptId: String(best.id),
        bestRank,
        bestScore: Number(best.final_points ?? 0),
        bestMaxPoints: Number(best.max_points ?? 0),
        bestDurationMs: best.duration_ms == null ? null : Number(best.duration_ms),
        recentAttempts: myRows.map((row) => ({
          attemptId: String(row.id),
          finishedAt: row.finished_at,
          finalPoints: Number(row.final_points ?? 0),
          maxPoints: Number(row.max_points ?? 0),
          durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
          accuracyPercent: Number(row.accuracy_percent ?? 0),
        })),
      };
    }
  }

  return {
    entries: rows,
    summary: {
      totalAttempts: Number(getRows(countResult)[0]?.count ?? 0),
      topScore: rows[0]?.finalPoints ?? 0,
      topDurationMs: rows[0]?.durationMs ?? null,
      myStats,
      timeToBeatTop: rows[0]?.durationMs ?? null,
      timeToBeatTop10: rows.length >= 10 ? rows[9].durationMs : rows[rows.length - 1]?.durationMs ?? null,
    },
  };
}

export async function resetLeaderboardForGame(gameId: string) {
  const sql = await getSql();

  const eventResult = await sql.query(
    `DELETE FROM game_attempt_events
     WHERE attempt_id IN (SELECT id FROM game_attempts WHERE game_id = $1)
     RETURNING id`,
    [gameId],
  );
  const participantResult = await sql.query(
    `DELETE FROM game_attempt_participants
     WHERE attempt_id IN (SELECT id FROM game_attempts WHERE game_id = $1)
     RETURNING id`,
    [gameId],
  );
  const levelResult = await sql.query(
    `DELETE FROM game_attempt_levels
     WHERE attempt_id IN (SELECT id FROM game_attempts WHERE game_id = $1)
     RETURNING id`,
    [gameId],
  );
  const attemptResult = await sql.query(
    "DELETE FROM game_attempts WHERE game_id = $1 RETURNING id",
    [gameId],
  );

  return {
    deletedEvents: getRows(eventResult).length,
    deletedParticipants: getRows(participantResult).length,
    deletedLevels: getRows(levelResult).length,
    deletedAttempts: getRows(attemptResult).length,
  };
}

export async function getCreatorStatistics(gameId: string) {
  const sql = await getSql();

  const overviewResult = await sql.query(
    `SELECT
        COUNT(*)::int AS total_attempts,
        COUNT(DISTINCT user_id)::int AS unique_players,
        COUNT(DISTINCT group_id)::int AS unique_groups,
        AVG(duration_ms)::float AS avg_duration_ms,
        AVG(final_points)::float AS avg_final_points,
        AVG(max_points)::float AS avg_max_points,
        AVG(accuracy_percent)::float AS avg_accuracy_percent,
        SUM(CASE WHEN scope = 'group' THEN 1 ELSE 0 END)::int AS group_attempts,
        SUM(CASE WHEN scope = 'individual' THEN 1 ELSE 0 END)::int AS individual_attempts
      FROM game_attempts
      WHERE game_id = $1 AND is_finished = true`,
    [gameId],
  );
  const overviewRow = getRows(overviewResult)[0] ?? {};

  const levelsResult = await sql.query(
    `SELECT
        gal.level_name,
        gal.level_index,
        gal.difficulty,
        COUNT(*)::int AS attempts,
        AVG(gal.points)::float AS avg_points,
        AVG(gal.max_points)::float AS avg_max_points,
        AVG(gal.accuracy_percent)::float AS avg_accuracy_percent,
        AVG(gal.best_time_ms)::float AS avg_best_time_ms
      FROM game_attempt_levels gal
      INNER JOIN game_attempts ga ON ga.id = gal.attempt_id
      WHERE ga.game_id = $1
      GROUP BY gal.level_name, gal.level_index, gal.difficulty
      ORDER BY gal.level_index ASC, gal.level_name ASC`,
    [gameId],
  );

  const participantsResult = await sql.query(
    `SELECT
        COALESCE(gap.display_name, u.name, u.email, 'Anonymous') AS display_name,
        gap.user_id,
        COUNT(*)::int AS attempts,
        SUM(gap.contribution_score)::int AS contribution_score,
        SUM(gap.paste_count)::int AS paste_count,
        SUM(gap.large_paste_count)::int AS large_paste_count,
        SUM(gap.focus_loss_count)::int AS focus_loss_count,
        SUM(gap.active_edit_ms)::int AS active_edit_ms,
        SUM(gap.edit_count)::int AS edit_count,
        SUM(gap.reset_level_count)::int AS reset_level_count,
        SUM(gap.reset_game_count)::int AS reset_game_count
      FROM game_attempt_participants gap
      INNER JOIN game_attempts ga ON ga.id = gap.attempt_id
      LEFT JOIN users u ON u.id = gap.user_id
      WHERE ga.game_id = $1
      GROUP BY COALESCE(gap.display_name, u.name, u.email, 'Anonymous'), gap.user_id
      ORDER BY contribution_score DESC, active_edit_ms DESC`,
    [gameId],
  );

  return {
    overview: {
      totalAttempts: Number(overviewRow.total_attempts ?? 0),
      uniquePlayers: Number(overviewRow.unique_players ?? 0),
      uniqueGroups: Number(overviewRow.unique_groups ?? 0),
      averageDurationMs: overviewRow.avg_duration_ms == null ? null : Math.round(Number(overviewRow.avg_duration_ms)),
      averageFinalPoints: overviewRow.avg_final_points == null ? null : Math.round(Number(overviewRow.avg_final_points)),
      averageMaxPoints: overviewRow.avg_max_points == null ? null : Math.round(Number(overviewRow.avg_max_points)),
      averageAccuracyPercent: overviewRow.avg_accuracy_percent == null ? null : Math.round(Number(overviewRow.avg_accuracy_percent)),
      groupAttempts: Number(overviewRow.group_attempts ?? 0),
      individualAttempts: Number(overviewRow.individual_attempts ?? 0),
    },
    levels: getRows(levelsResult).map((row) => ({
      levelName: String(row.level_name),
      levelIndex: Number(row.level_index ?? 0),
      difficulty: row.difficulty ? String(row.difficulty) : null,
      attempts: Number(row.attempts ?? 0),
      averagePoints: row.avg_points == null ? null : Math.round(Number(row.avg_points)),
      averageMaxPoints: row.avg_max_points == null ? null : Math.round(Number(row.avg_max_points)),
      averageAccuracyPercent: row.avg_accuracy_percent == null ? null : Math.round(Number(row.avg_accuracy_percent)),
      averageBestTimeMs: row.avg_best_time_ms == null ? null : Math.round(Number(row.avg_best_time_ms)),
    })),
    participants: getRows(participantsResult).map((row) => ({
      displayName: String(row.display_name),
      userId: row.user_id ? String(row.user_id) : null,
      attempts: Number(row.attempts ?? 0),
      contributionScore: Number(row.contribution_score ?? 0),
      pasteCount: Number(row.paste_count ?? 0),
      largePasteCount: Number(row.large_paste_count ?? 0),
      focusLossCount: Number(row.focus_loss_count ?? 0),
      activeEditMs: Number(row.active_edit_ms ?? 0),
      editCount: Number(row.edit_count ?? 0),
      resetLevelCount: Number(row.reset_level_count ?? 0),
      resetGameCount: Number(row.reset_game_count ?? 0),
    })),
  };
}
