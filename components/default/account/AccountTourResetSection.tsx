"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/apiUrl";

export function AccountTourResetSection() {
  const [pending, setPending] = useState(false);

  const handleReset = async () => {
    setPending(true);
    try {
      const res = await fetch(apiUrl("/api/user/tour-spots"), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Could not reset tours.");
        return;
      }
      toast.success("Guided tours will show again the next time they apply.");
    } catch {
      toast.error("Could not reset tours.");
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-6 shadow-sm space-y-3">
      <h2 className="text-lg font-semibold">Guided tours</h2>
      <p className="text-sm text-muted-foreground max-w-prose">
        Product tours (for example on the game screen) only appear once per update. If you dismissed
        them or want to walk through them again, reset your tour progress here.
      </p>
      <div>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={handleReset}>
          {pending ? "Resetting…" : "Show tours again"}
        </Button>
      </div>
    </section>
  );
}
