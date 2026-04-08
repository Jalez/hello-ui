"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "basics", label: "Basics" },
  { href: "access", label: "Access" },
  { href: "runtime", label: "Runtime" },
  { href: "collaborators", label: "Collaborators" },
];

export function CreatorGameSettingsSubnav({ gameId }: { gameId: string }) {
  const pathname = usePathname();
  const base = `/creator/${gameId}/settings`;

  return (
    <nav className="rounded-lg border bg-card p-2 shadow-sm md:sticky md:top-4">
      <ul className="flex gap-2 overflow-x-auto md:flex-col md:gap-1">
        {tabs.map((tab) => {
          const href = `${base}/${tab.href}`;
          const isActive = pathname === href;
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                className={cn(
                  "flex w-full items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
