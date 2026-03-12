"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Code2, Eye, Users } from "lucide-react";
import { apiUrl, stripBasePath } from "@/lib/apiUrl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CompactMenuButton } from "@/components/General/CompactMenuButton";

interface CreatorMenuProps {
  gameId: string;
  collaborationMode: "individual" | "group";
}

export function CreatorMenu({ gameId, collaborationMode }: CreatorMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const normalizedPathname = stripBasePath(pathname);
  const searchParams = useSearchParams();
  const isCreatorRoute = normalizedPathname.startsWith("/creator/");

  const openCreatorMode = useCallback(() => {
    router.push(apiUrl(`/creator/${gameId}`));
  }, [gameId, router]);

  const openCreatorPreview = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", "game");
    params.delete("groupId");
    router.push(apiUrl(`/game/${gameId}?${params.toString()}`));
  }, [gameId, router, searchParams]);

  const triggerLabel = "Creator";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <CompactMenuButton icon={Users} label={triggerLabel} text={triggerLabel} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 border-0 shadow-lg">
        <DropdownMenuLabel>Creator</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!isCreatorRoute && (
          <DropdownMenuItem onSelect={openCreatorMode}>
            <Code2 className="mr-2 h-4 w-4" />
            Switch to Creator Mode
          </DropdownMenuItem>
        )}
        {collaborationMode === "group" && (
          <DropdownMenuItem onSelect={openCreatorPreview}>
            <Eye className="mr-2 h-4 w-4" />
            <div className="flex flex-col">
              <span>Creator Preview</span>
              <span className="text-xs text-muted-foreground">
                Open the isolated preview without a group
              </span>
            </div>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
