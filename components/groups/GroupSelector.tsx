"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface Group {
  id: string;
  name: string;
  ltiContextId?: string;
  ltiContextTitle?: string;
}

interface GroupSelectorProps {
  selectedGroupId?: string | null;
  onGroupSelect: (groupId: string) => void;
  className?: string;
}

export function GroupSelector({
  selectedGroupId,
  onGroupSelect,
  className,
}: GroupSelectorProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(apiUrl("/api/groups"));

      if (!response.ok) {
        throw new Error("Failed to fetch groups");
      }

      const { groups: fetchedGroups } = await response.json();
      setGroups(fetchedGroups);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch groups");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  if (isLoading) {
    return (
      <div className={className}>
        <Select disabled>
          <SelectTrigger>
            <SelectValue placeholder="Loading groups..." />
          </SelectTrigger>
        </Select>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchGroups} className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className || ""}`}>
      <Select value={selectedGroupId || ""} onValueChange={onGroupSelect}>
        <SelectTrigger className="w-[240px]">
          <SelectValue placeholder="Select a group" />
        </SelectTrigger>
        <SelectContent>
          {groups.length === 0 ? (
            <SelectItem value="_none" disabled>
              No groups available
            </SelectItem>
          ) : (
            groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground">
          You are not a member of any group yet.
        </p>
      )}
    </div>
  );
}
