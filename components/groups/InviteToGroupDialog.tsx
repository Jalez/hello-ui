"use client";

import React, { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";

interface InviteToGroupDialogProps {
  groupId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onMemberAdded?: () => void;
  trigger?: React.ReactNode;
}

export function InviteToGroupDialog({
  groupId,
  open,
  onOpenChange,
  onMemberAdded,
  trigger,
}: InviteToGroupDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"instructor" | "member">("member");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const roleOptions: ComboboxOption[] = [
    { value: "member", label: "Member", keywords: ["member", "student"] },
    { value: "instructor", label: "Instructor", keywords: ["instructor", "teacher"] },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(apiUrl(`/api/groups/${groupId}/members`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add member");
      }

      setEmail("");
      setSuccess(true);
      onMemberAdded?.();

      setTimeout(() => {
        onOpenChange?.(false);
        setSuccess(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Invite to Group</DialogTitle>
            <DialogDescription>
              Add a user to this group by their email address.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="col-span-3"
                disabled={isLoading}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                Role
              </Label>
              <div className="col-span-3">
                <Combobox
                  value={role}
                  onValueChange={(value) => setRole(value as "instructor" | "member")}
                  options={roleOptions}
                  disabled={isLoading}
                  placeholder="Select role"
                  searchPlaceholder="Search role..."
                  emptyText="No role found."
                />
              </div>
            </div>
            {error && (
              <p className="col-span-4 text-center text-sm text-destructive">{error}</p>
            )}
            {success && (
              <p className="col-span-4 text-center text-sm text-green-600">
                Member added successfully!
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Adding..." : "Add Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
