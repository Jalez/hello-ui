function buildInstanceQueryParams(ctx) {
  if (ctx.kind !== "instance") {
    return "";
  }
  const params = new URLSearchParams();
  params.set("accessContext", "game");
  if (ctx.groupId) params.set("groupId", ctx.groupId);
  if (ctx.userId) params.set("userId", ctx.userId);
  return params.toString();
}

export function createWsApiClient({ apiBaseUrl, wsServiceToken }) {
  async function fetchInstanceSnapshotFromDB(ctx) {
    const qs = buildInstanceQueryParams(ctx);
    const url = `${apiBaseUrl}/api/games/${ctx.gameId}/instance${qs ? `?${qs}` : ""}`;

    try {
      const response = await fetch(url, {
        headers: {
          "x-ws-service-token": wsServiceToken,
        },
      });
      if (!response.ok) {
        console.error(`[db-fetch:error] status=${response.status} url=${url}`);
        return null;
      }
      const data = await response.json();
      return {
        instanceId: data?.instance?.id ?? null,
        progressData: data?.instance?.progressData ?? null,
        mapName: typeof data?.mapName === "string" ? data.mapName : "",
      };
    } catch (err) {
      console.error(`[db-fetch:error] url=${url}`, err.message);
      return null;
    }
  }

  async function saveProgressToDB(ctx, progressData) {
    if (ctx.kind !== "instance") {
      return { ok: true, permanentFailure: false };
    }

    const qs = buildInstanceQueryParams(ctx);
    const url = `${apiBaseUrl}/api/games/${ctx.gameId}/instance${qs ? `?${qs}` : ""}`;

    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-ws-service-token": wsServiceToken,
        },
        body: JSON.stringify({ progressData }),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error(`[db-save:error] status=${response.status} url=${url}${errorText ? ` body=${errorText}` : ""}`);
        return {
          ok: false,
          permanentFailure: response.status === 404,
        };
      }
      console.log(`[db-save:ok] gameId=${ctx.gameId}`);
      return { ok: true, permanentFailure: false };
    } catch (err) {
      console.error(`[db-save:error] url=${url}`, err.message);
      return { ok: false, permanentFailure: false };
    }
  }

  async function fetchCreatorLevels(ctx) {
    const url = `${apiBaseUrl}/api/maps/levels/${encodeURIComponent(ctx.mapName)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`[creator-fetch:error] status=${response.status} url=${url}`);
        return [];
      }

      const levels = await response.json();
      return Array.isArray(levels) ? levels : [];
    } catch (err) {
      console.error(`[creator-fetch:error] url=${url}`, err.message);
      return [];
    }
  }

  async function fetchLevelsForMapName(mapName) {
    const url = `${apiBaseUrl}/api/maps/levels/${encodeURIComponent(mapName)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`[map-fetch:error] status=${response.status} url=${url}`);
        return [];
      }

      const levels = await response.json();
      return Array.isArray(levels) ? levels : [];
    } catch (err) {
      console.error(`[map-fetch:error] url=${url}`, err.message);
      return [];
    }
  }

  return {
    fetchInstanceSnapshotFromDB,
    saveProgressToDB,
    fetchCreatorLevels,
    fetchLevelsForMapName,
  };
}
