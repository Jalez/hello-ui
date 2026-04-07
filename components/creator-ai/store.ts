"use client";

import { create } from "zustand";

export type CreatorAiEditorTarget = "template" | "solution";
export type CreatorAiEditorLanguage = "html" | "css" | "js";

interface CreatorAiChatState {
  open: boolean;
  activeLanguage: CreatorAiEditorLanguage;
  activeTarget: CreatorAiEditorTarget;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  setActiveEditorContext: (
    activeLanguage: CreatorAiEditorLanguage,
    activeTarget: CreatorAiEditorTarget,
  ) => void;
}

export const useCreatorAiChatStore = create<CreatorAiChatState>((set) => ({
  open: false,
  activeLanguage: "html",
  activeTarget: "template",
  setOpen: (open) => set({ open }),
  toggleOpen: () => set((state) => ({ open: !state.open })),
  setActiveEditorContext: (activeLanguage, activeTarget) =>
    set({ activeLanguage, activeTarget }),
}));
