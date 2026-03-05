import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import type { ReactNode } from "react";
import { authOptions } from "@/lib/auth";
import { AccountSubnav } from "@/components/default/account/AccountSubnav";

interface AccountLayoutProps {
  children: ReactNode;
}

export default async function AccountLayout({ children }: AccountLayoutProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  return (
    <div className="h-full overflow-y-auto bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Account Settings</h1>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
          <aside>
            <AccountSubnav />
          </aside>
          <section>{children}</section>
        </div>
      </div>
    </div>
  );
}
