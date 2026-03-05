"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/account/profile", label: "Profile" },
  { href: "/account/integrations", label: "Integrations" },
  { href: "/account/generation", label: "Generation" },
];

export function AccountSubnav() {
  const pathname = usePathname();

  return (
    <nav className="rounded-lg border bg-card p-2 shadow-sm md:sticky md:top-4">
      <ul className="flex flex-col gap-1">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
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
