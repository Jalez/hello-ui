"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/apiUrl";

export function PurgeOrphanMapsCard() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCount = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/maps/purge-orphans"));
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
      const res = await fetch(apiUrl("/api/maps/purge-orphans"), { method: "POST" });
      if (res.status === 401) {
        setError("Sign in to purge orphan maps");
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
        <CardTitle>Purge orphan maps</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Maps that are not attached to any game can be removed. This only deletes maps that no game uses. Their level
          assignments are removed; you can then purge orphan levels if needed.
        </p>
        {loading ? (
          <p className="text-sm">Checking…</p>
        ) : (
          <>
            <p className="text-sm">
              {count !== null ? (
                <strong>{count} orphan map{count !== 1 ? "s" : ""}</strong>
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
              {purging ? "Purging…" : "Purge orphan maps"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
