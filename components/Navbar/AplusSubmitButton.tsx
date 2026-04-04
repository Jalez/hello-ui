"use client";

import { type ReactNode, useCallback } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { stripBasePath } from "@/lib/apiUrl";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import PoppingTitle from "@/components/General/PoppingTitle";
import { cn } from "@/lib/utils/cn";

type NavbarActionDisplayMode = "icon-label" | "icon";

interface AplusSubmitButtonProps {
  displayMode?: NavbarActionDisplayMode;
  shouldShake?: boolean;
  renderTrigger?: (options: { openDialog: () => void }) => ReactNode;
  /** When using renderTrigger in a narrow rail (e.g. workbench sidebar), center the trigger like other tool rows. */
  centerTrigger?: boolean;
}

export const AplusSubmitButton = ({
  displayMode = "icon",
  shouldShake = false,
  renderTrigger,
  centerTrigger = false,
}: AplusSubmitButtonProps) => {
  const params = useParams();
  const pathname = usePathname();
  const normalizedPathname = stripBasePath(pathname);
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameIdParam = params?.gameId;
  const gameId = typeof gameIdParam === "string" ? gameIdParam : Array.isArray(gameIdParam) ? gameIdParam[0] : null;
  const isGameRoute = normalizedPathname.startsWith("/game/") && Boolean(gameId);

  const openFinishView = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("view", "finish");
    const nextQuery = nextParams.toString();
    router.push(nextQuery ? `${normalizedPathname}?${nextQuery}` : normalizedPathname);
  }, [normalizedPathname, router, searchParams]);

  if (!isGameRoute || !gameId) {
    return null;
  }

  const openDialog = openFinishView;

  const trigger = renderTrigger ? renderTrigger({ openDialog }) : (
    displayMode === "icon" ? (
      <PoppingTitle topTitle="Finish game">
        <Button
          size="icon"
          variant="ghost"
          onClick={openDialog}
          title="Finish game and save result"
        >
          <Flag className="h-5 w-5" />
        </Button>
      </PoppingTitle>
    ) : (
      <Button
        size="sm"
        variant="ghost"
        className="w-full justify-start gap-2"
        onClick={openDialog}
        title="Finish game and save result"
      >
        <Flag className="h-5 w-5" />
        <span>Finish game</span>
      </Button>
    )
  );

  return (
    <span
      className={cn(
        renderTrigger
          ? centerTrigger
            ? "flex w-full justify-center"
            : "block w-full"
          : displayMode === "icon-label"
            ? "block w-full"
            : "inline-flex",
        shouldShake && "animate-shake-burst",
      )}
    >
      {trigger}
    </span>
  );
};
