"use client";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { compactMenuButtonClass } from "@/components/General/CompactMenuButton";
import { useSidebarCollapse } from "@/components/default/sidebar/context/SidebarCollapseContext";
import { cn } from "@/lib/utils/cn";
import type { LucideIcon } from "lucide-react";

export type WorkbenchSidebarToolRowProps = {
  id: string;
  label: string;
  tooltip?: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  variant?: "default" | "outline" | "ghost" | "secondary";
  destructive?: boolean;
  iconClassName?: string;
  "data-testid"?: string;
};

export function WorkbenchSidebarToolRow({
  id,
  label,
  tooltip,
  icon: Icon,
  onClick,
  disabled,
  active,
  variant = "outline",
  destructive,
  iconClassName,
  "data-testid": dataTestId,
}: WorkbenchSidebarToolRowProps) {
  const { isMobile } = useSidebarCollapse();
  const tooltipText = tooltip ?? label;

  const resolvedVariant = destructive
    ? "ghost"
    : (active ? "secondary" : (variant ?? "outline"));

  const button = isMobile ? (
    <Button
      type="button"
      size="sm"
      variant={resolvedVariant}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={typeof active === "boolean" ? active : undefined}
      title={disabled ? tooltipText : undefined}
      data-testid={dataTestId}
      id={id}
      className={cn(
        compactMenuButtonClass,
        "h-auto min-h-0 w-full min-w-0 overflow-hidden whitespace-normal border-0 px-0.5 py-1 font-normal leading-tight shadow-none",
        destructive && "text-destructive hover:bg-destructive/10 hover:text-destructive",
        "[&_svg]:h-3.5 [&_svg]:w-3.5",
      )}
    >
      <span className="w-full min-w-0 max-w-full text-balance text-center text-[clamp(8px,22cqw,11px)] font-medium uppercase leading-snug tracking-[0.06em] text-muted-foreground break-words [overflow-wrap:anywhere]">
        {label}
      </span>
      <Icon className={cn("h-3.5 w-3.5 shrink-0", iconClassName)} />
    </Button>
  ) : (
    <Button
      type="button"
      size="icon"
      variant={resolvedVariant}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={typeof active === "boolean" ? active : undefined}
      data-testid={dataTestId}
      id={id}
      title={disabled && tooltipText ? tooltipText : undefined}
      className={cn(
        "h-9 w-9 shrink-0 border-0 shadow-none",
        destructive && "text-destructive hover:bg-destructive/10 hover:text-destructive",
      )}
    >
      <Icon className={cn("h-4 w-4", iconClassName)} />
    </Button>
  );

  if (!isMobile && tooltipText) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex justify-center",
              disabled && "cursor-not-allowed",
            )}
          >
            {disabled ? (
              <span className="inline-flex [&_button]:pointer-events-none">{button}</span>
            ) : (
              button
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[220px] text-[11px] leading-snug">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <span className="inline-flex w-full justify-center">
      {button}
    </span>
  );
}
