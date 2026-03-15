'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils/cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function getInitials(label: string): string {
  return label
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function buildAvatarFallbacks(
  users: Array<{
    userId?: string;
    accountUserId?: string;
    userEmail?: string | null;
    accountUserEmail?: string | null;
    userName?: string | null;
    userImage?: string | null;
  }>,
): {
  byUserId: Map<string, { userName?: string | null; userImage?: string | null }>;
  byEmail: Map<string, { userName?: string | null; userImage?: string | null }>;
} {
  const fallbackByUserId = new Map<string, { userName?: string | null; userImage?: string | null }>();
  const fallbackByEmail = new Map<string, { userName?: string | null; userImage?: string | null }>();
  for (const user of users) {
    for (const userIdKey of [user.accountUserId, user.userId]) {
      if (!userIdKey) {
        continue;
      }
      const existing = fallbackByUserId.get(userIdKey);
      fallbackByUserId.set(userIdKey, {
        userName: existing?.userName ?? user.userName,
        userImage: existing?.userImage ?? user.userImage,
      });
    }

    for (const emailValue of [user.accountUserEmail, user.userEmail]) {
      const emailKey = typeof emailValue === "string" ? emailValue.toLowerCase() : "";
      if (!emailKey) {
        continue;
      }
      const existing = fallbackByEmail.get(emailKey);
      fallbackByEmail.set(emailKey, {
        userName: existing?.userName ?? user.userName,
        userImage: existing?.userImage ?? user.userImage,
      });
    }
  }
  return {
    byUserId: fallbackByUserId,
    byEmail: fallbackByEmail,
  };
}

export function PresenceStack({
  users,
  readyUserIds = [],
  className,
}: {
  users: Array<{
    userId?: string;
    userEmail?: string;
    userName?: string;
    userImage?: string;
    color?: string;
    isConnected?: boolean;
  }>;
  readyUserIds?: string[];
  className?: string;
}) {
  return (
    <div className={cn("flex items-center -space-x-2 isolate", className)}>
      {users.map((user, idx) => {
        const label = user.userName || user.userEmail || user.userId || "Anonymous";
        const isReady = user.userId ? readyUserIds.includes(user.userId) : false;
        const isConnected = user.isConnected !== false; // Default to true if not provided (e.g. in PublicLobby where all are active)
        
        // Single color priority: Ready > Connected > Disconnected
        const statusColor = isReady 
          ? "rgb(16 185 129)" // emerald-500
          : isConnected 
            ? (user.color || "rgb(59 130 246)") // user color or blue-500
            : "rgb(156 163 175)"; // gray-400

        return (
          <Tooltip key={user.userId || user.userEmail}>
            <TooltipTrigger asChild>
              <Avatar
                className={cn(
                  "h-9 w-9 border-2 bg-background relative"
                )}
                style={{ borderColor: statusColor, zIndex: users.length - idx }}
              >
                {user.userImage && <AvatarImage src={user.userImage} alt={label} />}
                <AvatarFallback className="text-xs font-medium">
                  {getInitials(label)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">
                {isReady ? "Ready" : isConnected ? "Online" : "Offline"}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
