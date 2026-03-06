"use client";

import type React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { CreatorHelpContent } from "./CreatorHelpContent";
import { GameHelpContent } from "./GameHelpContent";

export type HelpMode = "creator" | "game";

interface HelpModalProps {
  mode: HelpMode;
  trigger: React.ReactNode;
}

export function HelpModal({ mode, trigger }: HelpModalProps) {
  const title = mode === "creator" ? "UI Designer Help" : "Game Help (For Players)";

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[85vh] overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[85vh] overflow-y-auto p-6">
          {mode === "creator" ? <CreatorHelpContent /> : <GameHelpContent />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
