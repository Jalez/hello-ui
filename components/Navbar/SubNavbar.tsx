import type { LucideIcon } from "lucide-react";

/** Shared item model for creator workbench toolbars (see CreatorWorkbenchSubSidebar). */
export type SubNavbarItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  variant?: "default" | "outline" | "ghost" | "secondary";
  tooltip?: string;
  /** Larger or scaled icons (e.g. circle affordances); passed to WorkbenchSidebarToolRow. */
  iconClassName?: string;
};
