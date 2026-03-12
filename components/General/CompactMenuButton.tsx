"use client";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { LucideIcon } from "lucide-react";

export const compactMenuButtonClass =
  "h-auto w-full min-w-0 justify-center gap-1 px-2 py-1.5 max-[519px]:flex-col";

export const compactMenuLabelClass =
  "text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground";

type CompactMenuButtonProps = ButtonProps & {
  icon: LucideIcon;
  label: string;
  text?: string;
  showText?: "always" | "wide" | "never";
};

export function CompactMenuButton({
  icon: Icon,
  label,
  text = label,
  showText = "wide",
  className,
  ...props
}: CompactMenuButtonProps) {
  const content = props.children ?? (
    <>
      {(showText === "never" || showText === "wide") && (
        <span className={cn(compactMenuLabelClass, showText === "wide" && "min-[520px]:hidden")}>
          {label}
        </span>
      )}
      <Icon className="h-4 w-4" />
      {showText !== "never" && (
        <span
          className={cn(
            "text-xs font-medium",
            showText === "wide" ? "hidden min-[520px]:inline" : "inline",
          )}
        >
          {text}
        </span>
      )}
    </>
  );

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(compactMenuButtonClass, className)}
      {...props}
    >
      {content}
    </Button>
  );
}
