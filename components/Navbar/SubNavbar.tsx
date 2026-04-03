'use client';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { LucideIcon } from "lucide-react";

export type SubNavbarItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  variant?: "default" | "outline" | "ghost" | "secondary";
  kind?: "button" | "badge";
  tooltip?: string;
};

type SubNavbarProps = {
  items: SubNavbarItem[];
  children?: React.ReactNode;
};

export function SubNavbar({
  items,
  children,
}: SubNavbarProps) {
  return (
    <div className="bg-background/70">
      <TooltipProvider>
        <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap px-3 py-1">
          {items.map((item) => {
            if (item.kind === "badge") {
              return (
                <Badge key={item.id} variant="outline" className="h-7 border-0 px-2 font-normal">
                  {item.label}
                </Badge>
              );
            }

            const Icon = item.icon;
            const button = (
              <Button
                type="button"
                size="sm"
                variant={item.active ? "secondary" : (item.variant ?? "outline")}
                disabled={item.disabled}
                onClick={item.onClick}
                aria-pressed={typeof item.active === "boolean" ? item.active : undefined}
                className="h-7 gap-1 border-0 px-2 shadow-none"
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
                <span>{item.label}</span>
              </Button>
            );

            if (!item.tooltip) {
              return (
                <span key={item.id} className="inline-flex">
                  {button}
                </span>
              );
            }

            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    {button}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <div className="max-w-[220px] text-xs">
                    {item.tooltip}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
          {children}
        </div>
      </TooltipProvider>
    </div>
  );
}
