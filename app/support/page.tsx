import Link from "next/link";

import { PageContainer } from "@/components/scriba/ui/PageContainer";

const supportName = process.env.NEXT_PUBLIC_SUPPORT_CONTACT_NAME?.trim();
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();

export default function SupportPage() {
  return (
    <PageContainer className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Support</h1>
          <p className="text-muted-foreground">
            For game-specific guidance, use the help modals available in creator and game views.
            This page is for contact and operational support information.
          </p>
        </div>

        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">How To Get Help</h2>
          <div className="mt-3 space-y-3 text-sm text-muted-foreground">
            <p>
              If you run into technical problems, first collect the relevant context:
              game id, group name, approximate time, and what users saw on screen.
            </p>
            {supportEmail ? (
              <p>
                Contact{" "}
                <span className="font-medium text-foreground">
                  {supportName || "support"}
                </span>{" "}
                at{" "}
                <a className="text-primary underline underline-offset-2" href={`mailto:${supportEmail}`}>
                  {supportEmail}
                </a>.
              </p>
            ) : (
              <p>
                Contact the course staff or the application maintainer using your normal support channel.
                You can set <code>NEXT_PUBLIC_SUPPORT_EMAIL</code> and optionally{" "}
                <code>NEXT_PUBLIC_SUPPORT_CONTACT_NAME</code> to show direct contact details here.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Useful Pages</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link className="text-primary underline underline-offset-2" href="/account/generation">
                Account generation settings
              </Link>
              {" "}for user-managed AI configuration.
            </li>
            <li>
              <Link className="text-primary underline underline-offset-2" href="/account">
                Account settings
              </Link>
              {" "}for profile and integration settings.
            </li>
          </ul>
        </section>
      </div>
    </PageContainer>
  );
}
