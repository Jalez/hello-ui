"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { PageLoadingSpinner } from "@/components/scriba/ui/PageLoadingSpinner";
import { apiUrl } from "@/lib/apiUrl";

function normalizeCallbackUrl(callbackUrl: string | null): string {
  if (!callbackUrl) {
    return apiUrl("/");
  }

  try {
    const decoded = decodeURIComponent(callbackUrl);
    if (decoded.startsWith("/")) {
      return apiUrl(decoded);
    }
    return decoded;
  } catch {
    return apiUrl("/");
  }
}

function SignInContent() {
  const isDevAuthEnabled = process.env.NODE_ENV === "development";
  const [isLoading, setIsLoading] = useState(false);
  const [isDevSigningIn, setIsDevSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [devUsername, setDevUsername] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const isInitialized = status !== "loading";

  const authError = useMemo(() => {
    const errorParam = searchParams.get("error");
    if (!errorParam) {
      return null;
    }

    console.error("OAuth callback error:", errorParam);
    if (errorParam === "OAuthCallback") {
      return "Authentication failed. Please try signing in again.";
    }

    return `Authentication error: ${errorParam}`;
  }, [searchParams]);

  useEffect(() => {
    // Check if user is already signed in and redirect
    if (isInitialized && session?.user) {
      router.push(normalizeCallbackUrl(searchParams.get("callbackUrl")));
    }
  }, [isInitialized, router, searchParams, session?.user]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setSignInError(null);
    try {
      // Use callbackUrl from query params, fallback to home page
      const callbackUrl = normalizeCallbackUrl(searchParams.get("callbackUrl"));
      await signIn("google", { callbackUrl });
    } catch (error) {
      console.error("Sign in error:", error);
      setSignInError("Failed to initiate sign in. Please try again.");
      setIsLoading(false);
    }
  };

  const handleDevSignIn = async () => {
    const normalizedUsername = devUsername.trim().toLowerCase();
    if (!normalizedUsername) {
      setSignInError("Enter a local test username first.");
      return;
    }

    setIsDevSigningIn(true);
    setSignInError(null);

    try {
      const callbackUrl = normalizeCallbackUrl(searchParams.get("callbackUrl"));
      const result = await signIn("dev-user", {
        username: normalizedUsername,
        callbackUrl,
        redirect: false,
      });

      if (result?.error) {
        setSignInError(result.error);
        setIsDevSigningIn(false);
        return;
      }

      router.push(callbackUrl);
    } catch (error) {
      console.error("Dev sign in error:", error);
      setSignInError("Failed to sign in as local test user.");
      setIsDevSigningIn(false);
    }
  };

  const error = signInError ?? authError;

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">Sign in to your account</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Sign in with Google to access PDF processing features
          </p>
          {error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>
        <div className="mt-8 space-y-6">
          {isDevAuthEnabled && (
            <div className="rounded-md border border-border bg-card p-4 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Local Multi-User Testing</h3>
                <p className="text-sm text-muted-foreground">
                  Use separate browser profiles and sign in as names like <code>alice</code>, <code>bob</code>, and <code>carol</code>.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={devUsername}
                  onChange={(event) => setDevUsername(event.target.value)}
                  placeholder="alice"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                  data-testid="dev-username-input"
                />
                <button
                  type="button"
                  onClick={handleDevSignIn}
                  disabled={isDevSigningIn}
                  className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="dev-signin-button"
                >
                  {isDevSigningIn ? "Signing in..." : "Use Local User"}
                </button>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading || isDevSigningIn}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              "Signing in..."
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" role="img" aria-label="Google logo">
                  <title>Google</title>
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SignIn() {
  return (
    <Suspense fallback={<PageLoadingSpinner text="Loading sign in..." fullPage={true} />}>
      <SignInContent />
    </Suspense>
  );
}
