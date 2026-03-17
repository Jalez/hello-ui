"use client";

import { useCallback, useState, useMemo } from "react";
import { logCollaborationStep } from "../logCollaborationStep";
import { ActiveUser, EditorType } from "../types";
import { generateUserColor } from "../utils";

interface UseCollaborationPresenceOptions {
  onUserJoined?: (user: ActiveUser) => void;
  onUserLeft?: (userId: string) => void;
}

interface UseCollaborationPresenceReturn {
  activeUsers: ActiveUser[];
  usersByTab: Record<EditorType, ActiveUser[]>;
  addUser: (user: ActiveUser) => void;
  removeUser: (identity: { clientId?: string; userId?: string }) => void;
  setUsers: (users: ActiveUser[]) => void;
  clearUsers: () => void;
  getUserByClientId: (clientId: string) => ActiveUser | undefined;
  updateUserTab: (clientId: string, editorType: EditorType, levelIndex: number) => void;
  updateUserTyping: (clientId: string, editorType: EditorType, levelIndex: number, isTyping: boolean) => void;
  clearUserTyping: (clientId: string) => void;
}

/**
 * COLLABORATION STEP 15.1:
 * This hook keeps the frontend's in-memory roster of collaborators up to date.
 * In plain language, it is the shared "who is here and what editor are they in"
 * store that the UI uses for avatars, tabs, typing badges, and carets.
 */
export function useCollaborationPresence(
  options: UseCollaborationPresenceOptions = {}
): UseCollaborationPresenceReturn {
  logCollaborationStep("15.1", "useCollaborationPresence");
  const { onUserJoined, onUserLeft } = options;

  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);

  /**
   * COLLABORATION STEP 15.2:
   * Add a newly seen collaborator into local presence state once the room tells
   * us they joined or awareness reveals them for the first time.
   */
  const addUser = useCallback(
    (user: ActiveUser) => {
      logCollaborationStep("15.2", "addUser", {
        clientId: user.clientId,
        userId: user.userId,
      });
      setActiveUsers((prev) => {
        const existing = prev.find((u) => u.clientId === user.clientId);
        if (existing) {
          return prev;
        }
        const newUser = {
          ...user,
          color: user.color || generateUserColor(user.userEmail),
        };
        onUserJoined?.(newUser);
        return [...prev, newUser];
      });
    },
    [onUserJoined]
  );

  /**
   * COLLABORATION STEP 19.3:
   * Remove a collaborator from local presence state when their socket leaves or
   * disconnects so stale avatars and carets do not linger on screen.
   */
  const removeUser = useCallback(
    ({ clientId, userId }: { clientId?: string; userId?: string }) => {
      logCollaborationStep("19.3", "removeUser", {
        clientId: clientId ?? null,
        userId: userId ?? null,
      });
      setActiveUsers((prev) => {
        const filtered = prev.filter((u) => {
          if (clientId) {
            return u.clientId !== clientId;
          }
          if (userId) {
            return u.userId !== userId;
          }
          return true;
        });
        if (filtered.length !== prev.length) {
          onUserLeft?.(userId || clientId || "");
        }
        return filtered;
      });
    },
    [onUserLeft]
  );

  /**
   * COLLABORATION STEP 15.3:
   * Replace the full collaborator list from an authoritative snapshot, while
   * deduplicating sessions so the frontend has one clean record per client.
   */
  const setUsers = useCallback((users: ActiveUser[]) => {
    logCollaborationStep("15.3", "setUsers", {
      userCount: users.length,
    });
    const uniqueUsers = new Map<string, ActiveUser>();
    for (const user of users) {
      const dedupeKey = user.clientId;
      if (!dedupeKey || uniqueUsers.has(dedupeKey)) {
        continue;
      }
      uniqueUsers.set(dedupeKey, {
        ...user,
        color: user.color || generateUserColor(user.userEmail),
      });
    }
    setActiveUsers(Array.from(uniqueUsers.values()));
  }, []);

  /**
   * COLLABORATION STEP 19.4:
   * Clear all cached presence when the room changes or the socket drops so the
   * next session starts from a clean slate.
   */
  const clearUsers = useCallback(() => {
    logCollaborationStep("19.4", "clearUsers");
    setActiveUsers([]);
  }, []);

  /**
   * COLLABORATION STEP 15.4:
   * Look up one collaborator by their session id when another part of the UI
   * needs to decorate that specific user's cursor or status.
   */
  const getUserByClientId = useCallback(
    (clientId: string): ActiveUser | undefined => {
      logCollaborationStep("15.4", "getUserByClientId", { clientId });
      return activeUsers.find((u) => u.clientId === clientId);
    },
    [activeUsers]
  );

  /**
   * COLLABORATION STEP 15.5:
   * Update which editor tab and level a collaborator is currently focused on so
   * the UI can show where attention has moved.
   */
  const updateUserTab = useCallback((clientId: string, editorType: EditorType, levelIndex: number) => {
    logCollaborationStep("15.5", "updateUserTab", {
      clientId,
      editorType,
      levelIndex,
    });
    setActiveUsers((prev) => {
      let changed = false;
      const next = prev.map((u) => {
        if (u.clientId !== clientId) {
          return u;
        }
        if (u.activeTab === editorType && u.activeLevelIndex === levelIndex && !u.isTyping) {
          return u;
        }
        changed = true;
        return { ...u, activeTab: editorType, activeLevelIndex: levelIndex, isTyping: false };
      });
      return changed ? next : prev;
    });
  }, []);

  /**
   * COLLABORATION STEP 15.6:
   * Update the typing badge for a collaborator when awareness says they started
   * or stopped actively editing in a specific editor.
   */
  const updateUserTyping = useCallback(
    (clientId: string, editorType: EditorType, levelIndex: number, isTyping: boolean) => {
      logCollaborationStep("15.6", "updateUserTyping", {
        clientId,
        editorType,
        levelIndex,
        isTyping,
      });
      setActiveUsers((prev) => {
        let changed = false;
        const next = prev.map((u) => {
          if (u.clientId !== clientId) {
            return u;
          }
          if (
            u.activeTab === editorType &&
            u.activeLevelIndex === levelIndex &&
            Boolean(u.isTyping) === Boolean(isTyping)
          ) {
            return u;
          }
          changed = true;
          return { ...u, activeTab: editorType, activeLevelIndex: levelIndex, isTyping };
        });
        return changed ? next : prev;
      });
    },
    []
  );

  /**
   * COLLABORATION STEP 15.7:
   * Force-clear typing state for one collaborator when we need a defensive reset,
   * for example after leaving a tab or ending a typing burst.
   */
  const clearUserTyping = useCallback((clientId: string) => {
    logCollaborationStep("15.7", "clearUserTyping", { clientId });
    setActiveUsers((prev) =>
      prev.map((u) =>
        u.clientId === clientId ? { ...u, isTyping: false } : u
      )
    );
  }, []);

  const usersByTab = useMemo<Record<EditorType, ActiveUser[]>>(() => {
    const result: Record<EditorType, ActiveUser[]> = {
      html: [],
      css: [],
      js: [],
    };
    for (const user of activeUsers) {
      if (user.activeTab) {
        result[user.activeTab].push(user);
      }
    }
    return result;
  }, [activeUsers]);

  return {
    activeUsers,
    usersByTab,
    addUser,
    removeUser,
    setUsers,
    clearUsers,
    getUserByClientId,
    updateUserTab,
    updateUserTyping,
    clearUserTyping,
  };
}
