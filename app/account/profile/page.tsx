import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export default async function AccountProfilePage() {
  const session = await getServerSession(authOptions);

  return (
    <section className="rounded-lg border bg-card p-6 space-y-3 shadow-sm">
      <h2 className="text-lg font-semibold">Profile</h2>
      <div className="space-y-1 text-sm">
        <div>
          <span className="text-muted-foreground">Name: </span>
          <span>{session?.user?.name ?? "—"}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Email: </span>
          <span>{session?.user?.email ?? "—"}</span>
        </div>
      </div>
    </section>
  );
}
