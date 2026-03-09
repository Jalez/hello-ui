import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { createHash, randomUUID } from "crypto";
import {
  isLti10Launch,
  extractLtiUserInfo,
  getLtiRole,
  Lti10Data,
  extractLtiOutcomeService,
} from "@/lib/lti/types";
import { resolveLtiIdentity } from "@/lib/lti/identity";
import { getOrCreateUserByEmail, updateUserProfile } from "@/app/api/_lib/services/userService";
import { getSql } from "@/app/api/_lib/db";
import { extractRows } from "@/app/api/_lib/db/shared";
import { logDebug } from "@/lib/debug-logger";
import { createOneTimeCode } from "@/lib/lti/one-time-code";

// POST /api/lti/game/[gameId]
// LTI 1.0 launch endpoint for a specific game ID.
// A+ (or any LMS) configures this URL as the launch URL for an embedded exercise.
// After validating credentials and authenticating the user, it redirects to /game/[gameId].
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;

    logDebug("lti_game_start", { gameId });

    const contentType = request.headers.get("content-type") || "";
    let body: Record<string, string> = {};

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        body[key] = value.toString();
      });
    } else {
      body = await request.json();
    }

    if (!isLti10Launch(body)) {
      return NextResponse.json({ error: "Not a valid LTI 1.0 launch" }, { status: 400 });
    }

    const ltiData = body as Lti10Data;
    const customFields = Object.fromEntries(
      Object.entries(ltiData).filter(([key, value]) => key.startsWith("custom_") && !!value)
    );

    // Log exact incoming LTI params so we can confirm what the LMS sends (e.g. groupID vs custom_group_id)
    const allParamNames = Object.keys(body).sort();
    const groupAndContextParams = Object.fromEntries(
      Object.entries(body).filter(
        ([key]) =>
          key.includes("group") ||
          key.includes("context") ||
          key.startsWith("custom_") ||
          key.startsWith("resource_link")
      )
    );

    logDebug("lti_game_lti_raw", {
      allParamNames,
      groupAndContextParams,
    });
    // Always log LTI payload (param names + group/context) so we can confirm what the LMS sends
    console.log("[LTI launch] params:", allParamNames.join(", "), "| group/context:", JSON.stringify(groupAndContextParams));

    logDebug("lti_game_lti_data", {
      user_id: ltiData.user_id,
      lis_person_contact_email_primary: ltiData.lis_person_contact_email_primary,
      lis_person_sourcedid: ltiData.lis_person_sourcedid,
      lis_person_name_given: ltiData.lis_person_name_given,
      lis_person_name_family: ltiData.lis_person_name_family,
      custom_user_id: ltiData.custom_user_id,
      custom_student_id: ltiData.custom_student_id,
      ext_user_username: ltiData.ext_user_username,
      ext_user_id: ltiData.ext_user_id,
      oauth_nonce: ltiData.oauth_nonce,
      customFields,
      context_id: ltiData.context_id,
      oauth_consumer_key: ltiData.oauth_consumer_key,
    });

    const sql = await getSql();

    // Validate consumer key against per-user credentials in DB
    const credResult = await sql.query(
      "SELECT consumer_key, consumer_secret FROM lti_credentials WHERE consumer_key = $1",
      [ltiData.oauth_consumer_key]
    );
    const credRows = extractRows(credResult) as Array<{ consumer_key: string; consumer_secret: string }>;
    if (!credRows || credRows.length === 0) {
      return NextResponse.json({ error: "Consumer key not found" }, { status: 401 });
    }
    const { consumer_key, consumer_secret } = credRows[0];

    const userInfo = extractLtiUserInfo(ltiData);
    const identity = resolveLtiIdentity(ltiData, consumer_key);
    const requireStrongIdentity = process.env.LTI_REQUIRE_STRONG_IDENTITY_PLAY
      ? process.env.LTI_REQUIRE_STRONG_IDENTITY_PLAY === "true"
      : process.env.LTI_REQUIRE_STRONG_IDENTITY === "true";

    if (
      identity.confidence === "weak" &&
      requireStrongIdentity
    ) {
      logDebug("lti_game_identity_rejected", {
        reason: "weak_identity",
        identitySource: identity.source,
      });
      return NextResponse.json(
        {
          error:
            "LTI launch rejected: LMS did not provide a strong unique user identifier (e.g. lis_person_sourcedid/custom_user_id).",
        },
        { status: 422 }
      );
    }

    const browserScopedIdentity = process.env.LTI_PLAY_BROWSER_SCOPED_IDENTITY === "true";
    let browserId = request.cookies.get("lti_browser_id")?.value || "";
    let shouldSetBrowserIdCookie = false;

    if (browserScopedIdentity && !browserId) {
      browserId = randomUUID();
      shouldSetBrowserIdCookie = true;
    }

    const ltiUniqueEmail = browserScopedIdentity
      ? `lti-${createHash("sha256").update(`${identity.key}:browser:${browserId}`).digest("hex").slice(0, 24)}@lti.local`
      : identity.email;

    logDebug("lti_game_resolved_email", {
      identitySource: identity.source,
      identityConfidence: identity.confidence,
      browserScopedIdentity,
      userInfoEmail: userInfo.email,
      ltiUniqueEmail,
    });

    const user = await getOrCreateUserByEmail(ltiUniqueEmail);

    logDebug("lti_game_db_user", {
      dbUserId: user.id,
      dbUserEmail: user.email,
      dbUserName: user.name,
    });

    if (userInfo.name && !user.name) {
      await updateUserProfile(user.id, { name: userInfo.name });
    }

    // Group-mode gameplay is app-owned. LTI launch may carry group information,
    // but we no longer bind gameplay grouping directly to LMS/Plussa groups.
    // The game route will use the app's own group-selection / lobby flow.
    const groupName = userInfo.contextTitle || userInfo.contextId || `LTI Group ${Date.now()}`;
    const role = getLtiRole(userInfo.roles);

    logDebug("lti_game_group", {
      groupId: null,
      groupName,
      groupContextKey: null,
      groupScopeSource: "pending",
      groupScopeValue: null,
      role,
    });
    console.log(
      "[LTI launch] group scope:",
      "pending",
      "value:",
      null,
      "groupId:",
      null
    );

    const outcomeService = extractLtiOutcomeService(ltiData, consumer_key, consumer_secret);
    const documentTarget = ltiData.launch_presentation_document_target || "window";
    const returnUrl = ltiData.launch_presentation_return_url;

    const ltiSession = {
      userId: user.id,
      userEmail: user.email,
      userName: user.name || userInfo.name || user.email,
      groupId: null,
      groupName: groupName,
      groupResolution: "pending",
      role,
      outcomeService,
      documentTarget,
      returnUrl,
      ltiData: {
        context_id: ltiData.context_id,
        context_title: ltiData.context_title,
        resource_link_id: ltiData.resource_link_id,
        user_id: ltiData.user_id,
        roles: ltiData.roles,
        lis_outcome_service_url: ltiData.lis_outcome_service_url,
        lis_result_sourcedid: ltiData.lis_result_sourcedid,
        custom_context_api: ltiData.custom_context_api,
        custom_context_api_id: ltiData.custom_context_api_id,
        custom_user_api_token: ltiData.custom_user_api_token,
        custom_student_id: ltiData.custom_student_id,
        _aplus_group: ltiData._aplus_group,
      },
    };

    // Look up the game by ID and decide routing mode:
    // - group: redirect to /game/[gameId] with required groupId context
    // - individual: redirect to /game/[gameId]
    let collaborationMode: "individual" | "group" = "individual";
    let resolvedGameId: string | null = null;
    const gameResult = await sql.query(
      "SELECT id, group_id, collaboration_mode FROM projects WHERE id = $1 LIMIT 1",
      [gameId]
    );
    const gameRows = extractRows(gameResult) as Array<{ id: string; group_id: string | null; collaboration_mode: string | null }>;
    if (!gameRows?.length) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    resolvedGameId = gameRows[0].id;
    collaborationMode = gameRows[0].collaboration_mode === "group" ? "group" : "individual";

    // App root URL for redirects. Prefer APP_ROOT_URL (server-only) so prod redirects stay correct behind a proxy.
    const appRootUrl =
      process.env.APP_ROOT_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.NEXTAUTH_URL?.replace(/\/api\/auth\/?$/, "") ?? `http://${request.headers.get("host") || "localhost:3000"}`);
    const isSecure = appRootUrl.startsWith("https");

    // Issue a short-lived JWT so /auth/lti-login can create a real NextAuth session
    const ltiSignInToken = jwt.sign(
      { userId: user.id, email: user.email, name: user.name || userInfo.name || user.email },
      process.env.NEXTAUTH_SECRET!,
      { expiresIn: "5m", issuer: "lti-launch" }
    );

    logDebug("lti_game_jwt_created", {
      jwtUserId: user.id,
      jwtEmail: user.email,
      jwtName: user.name || userInfo.name || user.email,
      redirectGroupId: null,
      collaborationMode,
    });

    const dest = `/game/${resolvedGameId}?mode=game`;

    // Redirect with a one-time code instead of the JWT in the URL (code is exchanged server-side for the token).
    const code = createOneTimeCode(ltiSignInToken, dest);
    // Use base path from app root URL so redirect stays under app root (e.g. /css-artist/auth/lti-login).
    const appRootParsed = new URL(appRootUrl);
    const basePath = (appRootParsed.pathname || "/").replace(/\/+$/, "") || "";
    const loginPath = `${basePath}/auth/lti-login`.replace(/\/+/g, "/") || "/auth/lti-login";
    const loginUrl = new URL(loginPath, appRootUrl);
    loginUrl.searchParams.set("code", code);
    loginUrl.searchParams.set("dest", dest);

    const response = NextResponse.redirect(loginUrl);

    // Set lti_session so the play page and any outcome-service calls have the full LTI context
    response.cookies.set("lti_session", JSON.stringify(ltiSession), {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    if (browserScopedIdentity && shouldSetBrowserIdCookie) {
      response.cookies.set("lti_browser_id", browserId, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 180,
        path: "/",
      });
    }

    logDebug("lti_game_redirect", {
      redirectUrl: loginUrl.origin + loginUrl.pathname + "?code=...&dest=" + encodeURIComponent(dest),
      cookieSet: true,
    });

    return response;
  } catch (error) {
    logDebug("lti_game_error", { error: String(error) });
    return NextResponse.json({ error: "Failed to process LTI launch" }, { status: 500 });
  }
}
