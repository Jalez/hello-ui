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
import { getSql } from "@/app/api/_lib/db";
import { extractRows } from "@/app/api/_lib/db/shared";
import { logDebug } from "@/lib/debug-logger";
import { createOneTimeCode } from "@/lib/lti/one-time-code";

function sanitizeLtiLaunchBody(body: Record<string, string>) {
  const redactedKeys = new Set([
    "oauth_signature",
    "oauth_consumer_secret",
    "custom_user_api_token",
  ]);

  return Object.fromEntries(
    Object.entries(body).map(([key, value]) => [
      key,
      redactedKeys.has(key) ? "[redacted]" : value,
    ]),
  );
}

async function resolveAplusAppGroup(params: {
  sql: Awaited<ReturnType<typeof getSql>>;
  resourceLinkId: string;
  contextTitle: string | null;
  aplusGroup: string;
  userId: string;
  role: "instructor" | "member";
}) {
  const groupName = `A+ Group ${params.aplusGroup}`;
  console.log("[LTI launch] app-group lookup start:", params.resourceLinkId, groupName);
  const existingResult = await params.sql.query(
    `SELECT id, name
     FROM groups
     WHERE resource_link_id = $1
       AND name = $2
       AND created_by IS NULL
       AND COALESCE(lti_context_title, '') = COALESCE($3, '')
     ORDER BY created_at ASC
     LIMIT 1`,
    [params.resourceLinkId, groupName, params.contextTitle],
  );
  const existingRows = extractRows(existingResult) as Array<{ id: string; name: string }>;
  console.log("[LTI launch] app-group lookup done:", existingRows[0]?.id ?? null);

  let resolvedGroup = existingRows[0] ?? null;
  if (!resolvedGroup) {
    console.log("[LTI launch] app-group create start:", groupName);
    const createResult = await params.sql.query(
      `INSERT INTO groups (name, join_key, lti_context_title, resource_link_id, created_by)
       VALUES ($1, $2, $3, $4, NULL)
       RETURNING id, name`,
      [
        groupName,
        randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase(),
        params.contextTitle,
        params.resourceLinkId,
      ],
    );
    const createdRows = extractRows(createResult) as Array<{ id: string; name: string }>;
    resolvedGroup = createdRows[0];
    console.log("[LTI launch] app-group create done:", resolvedGroup?.id ?? null);
  }

  console.log("[LTI launch] app-group membership upsert start:", resolvedGroup.id, params.userId);
  await params.sql.query(
    `INSERT INTO group_members (group_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (group_id, user_id)
     DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()`,
    [resolvedGroup.id, params.userId, params.role],
  );
  console.log("[LTI launch] app-group membership upsert done:", resolvedGroup.id, params.userId);

  return {
    groupId: resolvedGroup.id,
    groupName: resolvedGroup.name,
  };
}

async function getOrCreateLtiUser(params: {
  sql: Awaited<ReturnType<typeof getSql>>;
  email: string;
  name?: string;
}) {
  const existingResult = await params.sql.query(
    `SELECT id, email, name
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [params.email],
  );
  const existingRows = extractRows(existingResult) as Array<{ id: string; email: string; name: string | null }>;
  if (existingRows[0]) {
    if (params.name && !existingRows[0].name) {
      const updatedResult = await params.sql.query(
        `UPDATE users
         SET name = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING id, email, name`,
        [existingRows[0].id, params.name],
      );
      const updatedRows = extractRows(updatedResult) as Array<{ id: string; email: string; name: string | null }>;
      return updatedRows[0];
    }
    return existingRows[0];
  }

  const createdResult = await params.sql.query(
    `INSERT INTO users (email, name)
     VALUES ($1, $2)
     RETURNING id, email, name`,
    [params.email, params.name ?? null],
  );
  const createdRows = extractRows(createdResult) as Array<{ id: string; email: string; name: string | null }>;
  return createdRows[0];
}

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

    if (process.env.NODE_ENV === "development" || process.env.DEBUG_LOGS === "true") {
      const sanitizedBody = sanitizeLtiLaunchBody(body);
      logDebug("lti_game_launch_payload", {
        contentType,
        body: sanitizedBody,
      });
      console.log("[LTI launch] sanitized body:", JSON.stringify(sanitizedBody));
    }

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
    console.log("[LTI launch] credential ok:", consumer_key);

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

    // Strong LMS identities should always resolve to one stable app user.
    // Browser-scoped identity is only a fallback for weak launches where the LMS
    // did not provide a reliable unique identifier and we explicitly allow them.
    const browserScopedIdentity =
      process.env.LTI_PLAY_BROWSER_SCOPED_IDENTITY === "true" &&
      identity.confidence === "weak";
    let browserId = request.cookies.get("lti_browser_id")?.value || "";
    let shouldSetBrowserIdCookie = false;

    if (browserScopedIdentity && !browserId) {
      browserId = randomUUID();
      shouldSetBrowserIdCookie = true;
    }

    const ltiUniqueEmail = browserScopedIdentity
      ? `lti-${createHash("sha256").update(`${identity.key}:browser:${browserId}`).digest("hex").slice(0, 24)}@lti.local`
      : identity.email;
    console.log("[LTI launch] resolved email:", ltiUniqueEmail);

    logDebug("lti_game_resolved_email", {
      identitySource: identity.source,
      identityConfidence: identity.confidence,
      browserScopedIdentity,
      userInfoEmail: userInfo.email,
      ltiUniqueEmail,
    });

    const user = await getOrCreateLtiUser({
      sql,
      email: ltiUniqueEmail,
      name: userInfo.name,
    });
    console.log("[LTI launch] user ok:", user.id, user.email);

    logDebug("lti_game_db_user", {
      dbUserId: user.id,
      dbUserEmail: user.email,
      dbUserName: user.name,
    });

    // Look up the game by ID and decide routing mode:
    // - group: redirect to /game/[gameId] with required groupId context
    // - individual: redirect to /game/[gameId]
    let collaborationMode: "individual" | "group" = "individual";
    let resolvedGameId: string | null = null;
    console.log("[LTI launch] game lookup start:", gameId);
    const gameResult = await sql.query(
      "SELECT id, collaboration_mode FROM projects WHERE id = $1 LIMIT 1",
      [gameId]
    );
    const gameRows = extractRows(gameResult) as Array<{ id: string; collaboration_mode: string | null }>;
    console.log("[LTI launch] game lookup rows:", gameRows.length);
    if (!gameRows?.length) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    resolvedGameId = gameRows[0].id;
    collaborationMode = gameRows[0].collaboration_mode === "group" ? "group" : "individual";
    console.log("[LTI launch] game resolved:", resolvedGameId, collaborationMode);

    const role = getLtiRole(userInfo.roles);
    const explicitAplusGroup = typeof ltiData._aplus_group === "string" ? ltiData._aplus_group.trim() : "";
    const canAutoResolveGroup =
      collaborationMode === "group" &&
      explicitAplusGroup.length > 0 &&
      explicitAplusGroup !== "0"; // A+ sends "0" when no real subgroup is selected
    //canAutoResolveGroup = false;
    console.log("[LTI launch] auto group branch:", canAutoResolveGroup, explicitAplusGroup);
    const baseGroupName = userInfo.contextTitle || userInfo.contextId || `LTI Group ${Date.now()}`;
    const resolvedGroup = canAutoResolveGroup
      ? await resolveAplusAppGroup({
        sql,
        resourceLinkId: ltiData.resource_link_id || resolvedGameId,
        contextTitle: ltiData.context_title || null,
        aplusGroup: explicitAplusGroup,
        userId: user.id,
        role,
      })
      : null;
    console.log("[LTI launch] resolved group:", resolvedGroup?.groupId ?? null, resolvedGroup?.groupName ?? null);

    logDebug("lti_game_group", {
      groupId: resolvedGroup?.groupId ?? null,
      groupName: resolvedGroup?.groupName ?? baseGroupName,
      groupContextKey: null,
      groupScopeSource: resolvedGroup ? "_aplus_group" : "pending",
      groupScopeValue: resolvedGroup ? explicitAplusGroup : null,
      role,
    });
    console.log(
      "[LTI launch] group scope:",
      resolvedGroup ? "_aplus_group" : "pending",
      "value:",
      resolvedGroup ? explicitAplusGroup : null,
      "groupId:",
      resolvedGroup?.groupId ?? null
    );

    const outcomeService = extractLtiOutcomeService(ltiData, consumer_key, consumer_secret);
    const documentTarget = ltiData.launch_presentation_document_target || "window";
    const returnUrl = ltiData.launch_presentation_return_url;

    const ltiSession = {
      userId: user.id,
      userEmail: user.email,
      userName: user.name || userInfo.name || user.email,
      groupId: resolvedGroup?.groupId ?? null,
      groupName: resolvedGroup?.groupName ?? baseGroupName,
      groupResolution: resolvedGroup ? "resolved" : "pending",
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
      redirectGroupId: resolvedGroup?.groupId ?? null,
      collaborationMode,
    });

    const dest = resolvedGroup?.groupId
      ? `/game/${resolvedGameId}?mode=game&groupId=${encodeURIComponent(resolvedGroup.groupId)}`
      : `/game/${resolvedGameId}?mode=game`;

    // Redirect with a one-time code instead of the JWT in the URL (code is exchanged server-side for the token).
    const code = createOneTimeCode(ltiSignInToken, dest);
    // Use base path from app root URL so redirect stays under app root (e.g. /css-artist/auth/lti-login).
    const appRootParsed = new URL(appRootUrl);
    const basePath = (appRootParsed.pathname || "/").replace(/\/+$/, "") || "";
    const loginPath = `${basePath}/auth/lti-login`.replace(/\/+/g, "/") || "/auth/lti-login";
    const loginUrl = new URL(loginPath, appRootUrl);
    loginUrl.searchParams.set("code", code);
    loginUrl.searchParams.set("dest", dest);

    const response = NextResponse.redirect(loginUrl, { status: 303 });
    console.log("[LTI launch] redirect:", loginUrl.toString());

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
