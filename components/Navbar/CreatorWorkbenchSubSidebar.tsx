"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { useSidebarCollapse } from "@/components/default/sidebar/context/SidebarCollapseContext";
import { cn } from "@/lib/utils/cn";
import type { SubNavbarItem } from "./SubNavbar";
import { WorkbenchSidebarToolRow } from "./WorkbenchSidebarToolRow";

export type CreatorWorkbenchPanelId = "events" | "creator" | "game";

export type CreatorWorkbenchSection = {
  id: CreatorWorkbenchPanelId;
  visible: boolean;
  title: string;
  /** Toolbar rows (e.g. interaction controls) */
  items?: SubNavbarItem[];
  /** Extra blocks below toolbar rows (e.g. level tools, game tools) */
  children?: React.ReactNode;
};

type CreatorWorkbenchSubSidebarProps = {
  sections: CreatorWorkbenchSection[];
};

export function CreatorWorkbenchSubSidebar({ sections }: CreatorWorkbenchSubSidebarProps) {
  const { isMobile } = useSidebarCollapse();
  const visibleSections = sections.filter((s) => s.visible);
  const showSectionTitles = visibleSections.length > 1;

  return (
    <TooltipProvider>
      <aside
        aria-label="Creator workbench tools"
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-0 overflow-x-hidden overflow-y-auto overscroll-y-contain border-border bg-background/70 py-1.5 [container-type:inline-size]",
          isMobile ? "min-w-[90px] max-w-[148px] border-r px-1" : "w-14 shrink-0 border-r px-1",
        )}
      >
        {visibleSections.map((section, index) => (
          <div
            key={section.id}
            className={cn(
              "flex flex-col gap-0.5",
              index > 0 && "mt-1.5 border-t border-border pt-1.5",
            )}
          >
            {showSectionTitles ? (
              <div
                className={cn(
                  "w-full min-w-0 px-0.5 text-center font-semibold uppercase leading-snug [overflow-wrap:anywhere]",
                  isMobile
                    ? "text-[clamp(8px,20cqw,11px)] tracking-[0.08em] text-muted-foreground"
                    : "text-[8px] tracking-[0.1em] text-muted-foreground",
                )}
              >
                {section.title}
              </div>
            ) : null}
            {section.items?.map((item) => {
              if (!item.icon || !item.onClick) {
                return null;
              }

              return (
                <WorkbenchSidebarToolRow
                  key={`${section.id}-${item.id}`}
                  id={`${section.id}-${item.id}`}
                  label={item.label}
                  tooltip={item.tooltip}
                  icon={item.icon}
                  onClick={item.onClick}
                  disabled={item.disabled}
                  active={item.active}
                  variant={item.variant}
                  iconClassName={item.iconClassName}
                />
              );
            })}
            {section.children ? (
              <div
                className={cn(
                  "flex min-w-0 w-full flex-col gap-0.5 overflow-x-hidden",
                  (section.items?.length ?? 0) > 0 && "mt-1 border-t border-border pt-1.5",
                  !isMobile && "items-center",
                  isMobile &&
                    "[&_button]:min-h-0 [&_button]:min-w-0 [&_button]:overflow-hidden [&_button]:whitespace-normal [&_button]:py-1 [&_button]:text-[clamp(8px,22cqw,11px)] [&_button]:font-normal [&_button]:leading-snug [&_span]:min-w-0 [&_span]:max-w-full [&_span]:text-[clamp(8px,22cqw,11px)] [&_span]:leading-snug [&_span]:tracking-[0.05em] [&_span]:break-words [&_span]:[overflow-wrap:anywhere] [&_svg]:h-3.5 [&_svg]:w-3.5",
                )}
              >
                {section.children}
              </div>
            ) : null}
          </div>
        ))}
      </aside>
    </TooltipProvider>
  );
}
