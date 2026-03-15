"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useNotificationStore } from "@/components/default/notifications";

interface Group {
  id: string;
  name: string;
  ltiContextId?: string;
  ltiContextTitle?: string;
  resourceLinkId?: string;
  createdBy?: string | null;
  isMember?: boolean;
}

interface GroupSelectorProps {
  selectedGroupId?: string | null;
  onGroupSelect: (groupId: string, options?: { joinKey?: string }) => void | Promise<void>;
  className?: string;
  showRefreshButton?: boolean;
  allowCreate?: boolean;
  createContext?: {
    ltiContextId?: string | null;
    ltiContextTitle?: string | null;
    resourceLinkId?: string | null;
  };
  createPlaceholder?: string;
  currentUserId?: string | null;
}

function buildGroupMeta(group: Group): string | null {
  const parts: string[] = [];

  if (group.ltiContextTitle && group.ltiContextTitle.trim() !== group.name.trim()) {
    parts.push(group.ltiContextTitle.trim());
  }

  parts.push(`ID ${group.id.slice(0, 8)}`);
  return parts.join(" • ");
}

function buildGroupLabel(group: Group): string {
  const meta = buildGroupMeta(group);
  let label = meta ? `${group.name} (${meta})` : group.name;
  if (group.isMember) {
    label = `✓ ${label}`;
  }
  return label;
}

export function GroupSelector({
  selectedGroupId,
  onGroupSelect,
  className,
  showRefreshButton = false,
  allowCreate = false,
  createContext,
  createPlaceholder = "Create a new group",
  currentUserId,
}: GroupSelectorProps) {
  const showSuccess = useNotificationStore((state) => state.showSuccess);
  const showError = useNotificationStore((state) => state.showError);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [pendingGroupId, setPendingGroupId] = useState<string>(selectedGroupId || "");
  const [joinKey, setJoinKey] = useState("");

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.name.localeCompare(b.name)),
    [groups]
  );
  const selectedGroup = sortedGroups.find((group) => group.id === pendingGroupId) ?? null;
  const requiresJoinKey = Boolean(
    selectedGroup &&
    !selectedGroup.isMember &&
    selectedGroup.createdBy !== currentUserId
  );

  const fetchGroups = useCallback(async (options?: { background?: boolean; notifyOnComplete?: boolean }) => {
    const background = options?.background === true;
    const notifyOnComplete = options?.notifyOnComplete === true;
    try {
      if (background) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      const params = new URLSearchParams();
      if (createContext?.ltiContextId) {
        params.set("ltiContextId", createContext.ltiContextId);
      }
      if (createContext?.resourceLinkId) {
        params.set("resourceLinkId", createContext.resourceLinkId);
      }

      const response = await fetch(
        params.size > 0 ? `${apiUrl("/api/groups")}?${params.toString()}` : apiUrl("/api/groups")
      );

      if (!response.ok) {
        throw new Error("Failed to fetch groups");
      }

      const { groups: fetchedGroups } = await response.json();
      setGroups(fetchedGroups);

      if (notifyOnComplete) {
        showSuccess(`Groups refreshed (${Array.isArray(fetchedGroups) ? fetchedGroups.length : 0}).`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch groups";
      setError(message);

      if (notifyOnComplete) {
        showError(message);
      }
    } finally {
      if (background) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [createContext?.ltiContextId, createContext?.resourceLinkId, showError, showSuccess]);

  const handleCreateGroup = async () => {
    const trimmedName = createName.trim();
    if (!trimmedName) {
      setError("Group name is required");
      return;
    }

    try {
      setIsCreating(true);
      setError(null);
      const response = await fetch(apiUrl("/api/groups"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          ...(createContext?.ltiContextId ? { ltiContextId: createContext.ltiContextId } : {}),
          ...(createContext?.ltiContextTitle ? { ltiContextTitle: createContext.ltiContextTitle } : {}),
          ...(createContext?.resourceLinkId ? { resourceLinkId: createContext.resourceLinkId } : {}),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.group?.id) {
        throw new Error(data.error || "Failed to create group");
      }

      setCreateName("");
      await fetchGroups();
      setPendingGroupId(data.group.id);
      await onGroupSelect(data.group.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenSelectedGroup = async () => {
    if (!selectedGroup) {
      return;
    }

    try {
      setError(null);
      
      // Memory: save this group as the last visited one for this resource context
      if (typeof window !== "undefined" && createContext?.resourceLinkId) {
        const storageKey = `last-visited-group:${createContext.resourceLinkId}`;
        window.sessionStorage.setItem(storageKey, selectedGroup.id);
      }

      await onGroupSelect(selectedGroup.id, requiresJoinKey ? { joinKey } : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open group");
    }
  };

  useEffect(() => {
    const init = async () => {
      await fetchGroups();
      
      // After fetching groups, try to set a sensible default if none is already selected
      if (!selectedGroupId && createContext?.resourceLinkId && typeof window !== "undefined") {
        const storageKey = `last-visited-group:${createContext.resourceLinkId}`;
        const lastVisitedId = window.sessionStorage.getItem(storageKey);
        
        setGroups((currentGroups) => {
          if (lastVisitedId && currentGroups.some(g => g.id === lastVisitedId)) {
            setPendingGroupId(lastVisitedId);
          } else {
            // Fallback to the first group the user is already part of
            const joinedGroup = currentGroups.find(g => g.isMember);
            if (joinedGroup) {
              setPendingGroupId(joinedGroup.id);
            }
          }
          return currentGroups;
        });
      }
    };
    init();
  }, [fetchGroups, selectedGroupId, createContext?.resourceLinkId]);

  useEffect(() => {
    setPendingGroupId(selectedGroupId || "");
  }, [selectedGroupId]);

  return (
    <div className={`w-full space-y-2 ${className || ""}`}>
      <Select value={pendingGroupId} onValueChange={setPendingGroupId}>
        <SelectTrigger className="w-full min-w-0 max-w-full" disabled={isLoading && sortedGroups.length === 0}>
          <SelectValue
            placeholder={isLoading && sortedGroups.length === 0 ? "Loading groups..." : "Select a group"}
            className="truncate"
          >
            {selectedGroup ? (
              <span className="block truncate" title={buildGroupLabel(selectedGroup)}>
                {buildGroupLabel(selectedGroup)}
              </span>
            ) : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {sortedGroups.length === 0 ? (
            <SelectItem value="_none" disabled>
              No groups available
            </SelectItem>
          ) : (
            sortedGroups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {buildGroupLabel(group)}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {sortedGroups.length === 0 && (
        <p className="text-sm text-muted-foreground">
          You are not a member of any group yet.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {selectedGroup && (
        <div className="rounded-md border bg-muted/20 p-3 space-y-2">
          {requiresJoinKey ? (
            <>
              <p className="text-sm font-medium">Enter group key to join</p>
              <Input
                value={joinKey}
                onChange={(event) => setJoinKey(event.target.value.toUpperCase())}
                placeholder="Group key"
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              You are already part of this group, so no key is needed to enter it.
            </p>
          )}
          <Button
            onClick={handleOpenSelectedGroup}
            disabled={requiresJoinKey && !joinKey.trim()}
          >
            Open Group
          </Button>
        </div>
      )}
      {allowCreate && (
        <div className="rounded-md border bg-muted/20 p-3 space-y-2">
          <p className="text-sm font-medium">Create your own group</p>
          <div className="flex gap-2">
            <Input
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder={createPlaceholder}
            />
            <Button onClick={handleCreateGroup} disabled={isCreating || !createName.trim()}>
              {isCreating ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      )}
      {showRefreshButton && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchGroups({ background: true, notifyOnComplete: true })}
          disabled={isLoading || isRefreshing}
        >
          {isRefreshing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Refresh Groups
            </>
          ) : (
            "Refresh Groups"
          )}
        </Button>
      )}
    </div>
  );
}
