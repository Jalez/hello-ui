"use client";

import { HelpCircle, LogOut, User } from "lucide-react";
import Link from "next/link";
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { HelpModal } from "@/components/Help/HelpModal";

interface UserDropdownContentProps {
    getUserName: () => string;
    handleSignOut: () => void;
}

export const UserDropdownContent: React.FC<UserDropdownContentProps> = ({ getUserName, handleSignOut }) => {
    return (
        <DropdownMenuContent align="start" className="w-64 z-[10010]">
            <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col">
                    <span className="font-medium text-sm">{getUserName()}</span>
                </div>{" "}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
                <Link href="/account" className="flex items-center cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Account</span>
                </Link>
            </DropdownMenuItem>
            <HelpModal
                mode="creator"
                trigger={(
                    <DropdownMenuItem className="flex items-center cursor-pointer">
                        <HelpCircle className="mr-2 h-4 w-4" />
                        <span>Help & Support</span>
                    </DropdownMenuItem>
                )}
            />

            <ThemeSwitcher />
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-red-600 dark:text-red-400">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign Out</span>
            </DropdownMenuItem>
        </DropdownMenuContent>
    );
};
