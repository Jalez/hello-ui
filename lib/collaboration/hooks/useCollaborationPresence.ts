"use client";

import { useCallback, useState, useMemo } from "react";
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
  removeUser: (userId: string) => void;
  setUsers: (users: ActiveUser[]) => void;
  clearUsers: () => void;
  getUserByClientId: (clientId: string) => ActiveUser | undefined;
  updateUserTab: (clientId: string, editorType: EditorType, levelIndex: number) => void;
  updateUserTyping: (clientId: string, editorType: EditorType, levelIndex: number, isTyping: boolean) => void;
  clearUserTyping: (clientId: string) => void;
}

export function useCollaborationPresence(
  options: UseCollaborationPresenceOptions = {}
): UseCollaborationPresenceReturn {
  const { onUserJoined, onUserLeft } = options;

  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);

  const addUser = useCallback(
    (user: ActiveUser) => {
      setActiveUsers((prev) => {
        const existing = prev.find((u) => u.userId === user.userId);
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

  const removeUser = useCallback(
    (userId: string) => {
      setActiveUsers((prev) => {
        const filtered = prev.filter((u) => u.userId !== userId);
        if (filtered.length !== prev.length) {
          onUserLeft?.(userId);
        }
        return filtered;
      });
    },
    [onUserLeft]
  );

  const setUsers = useCallback((users: ActiveUser[]) => {
    setActiveUsers(
      users.map((u) => ({
        ...u,
        color: u.color || generateUserColor(u.userEmail),
      }))
    );
  }, []);

  const clearUsers = useCallback(() => {
    setActiveUsers([]);
  }, []);

  const getUserByClientId = useCallback(
    (clientId: string): ActiveUser | undefined => {
      return activeUsers.find((u) => u.clientId === clientId);
    },
    [activeUsers]
  );

  const updateUserTab = useCallback((clientId: string, editorType: EditorType, levelIndex: number) => {
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

  const updateUserTyping = useCallback(
    (clientId: string, editorType: EditorType, levelIndex: number, isTyping: boolean) => {
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

  const clearUserTyping = useCallback((clientId: string) => {
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
