"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/apiUrl";

export function PurgeOrphanLevelsCard() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCount = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/levels/purge-orphans"));
      if (res.status === 401) {
        setCount(null);
        return;
      }
      if (res.status === 403) {
        setError("Admin required");
        setCount(null);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || data.message || "Failed to load");
        return;
      }
      const data = await res.json();
      setCount(data.count ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  const handlePurge = async () => {
    setPurging(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/levels/purge-orphans"), { method: "POST" });
      if (res.status === 401) {
        setError("Sign in to purge orphan levels");
        return;
      }
      if (res.status === 403) {
        setError("Admin required");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || data.message || "Purge failed");
        return;
      }
      await fetchCount();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setPurging(false);
    }
  };

  if (count === null && !loading && !error) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Purge orphan levels</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Levels that are not attached to any game map can be removed to free space. This only deletes levels that have no map
          assignment.
        </p>
        {loading ? (
          <p className="text-sm">Checking…</p>
        ) : (
          <>
            <p className="text-sm">
              {count !== null ? (
                <strong>{count} orphan level{count !== 1 ? "s" : ""}</strong>
              ) : (
                "—"
              )}{" "}
              can be purged.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              variant="destructive"
              size="sm"
              disabled={purging || (count !== null && count === 0)}
              onClick={handlePurge}
            >
              {purging ? "Purging…" : "Purge orphan levels"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
