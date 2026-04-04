"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useLevelSaver } from "./hooks/useLevelSaver";

type CreatorAutosaveContextValue = ReturnType<typeof useLevelSaver>;

const CreatorAutosaveContext = createContext<CreatorAutosaveContextValue | null>(null);

/**
 * Keeps level autosave running whenever the creator workbench is shown.
 * CreatorControls used to mount useLevelSaver directly; after the workbench
 * subnavbar defaulted to "Interactions", that hook was often unmounted while
 * users still edited scenarios — so changes were never persisted.
 */
export function CreatorAutosaveProvider({ children }: { children: ReactNode }) {
  const value = useLevelSaver();
  return (
    <CreatorAutosaveContext.Provider value={value}>{children}</CreatorAutosaveContext.Provider>
  );
}

export function useCreatorAutosaveControls() {
  const ctx = useContext(CreatorAutosaveContext);
  if (!ctx) {
    throw new Error("useCreatorAutosaveControls must be used within CreatorAutosaveProvider");
  }
  return ctx;
}
