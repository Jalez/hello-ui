import { createHash } from "crypto";
import type { Lti10Data } from "./types";
import { getLtiRole } from "./types";

export interface LtiGroupContext {
  key: string;
  baseContextId: string;
  /** Raw value used for scoping (e.g. group ID from LMS) – useful for logging/debugging */
  scopeValue: string;
  scopeSource:
    | "custom_group_id"
    | "custom_group"
    | "custom_group_name"
    | "aplus_mygroups"
    | "role_isolated"
    | "resource_link_and_sourcedid"
    | "resource_link_id"
    | "context_id"
    | "fallback";
}

export function getExplicitLtiGroupScopeValue(ltiData: Lti10Data): string | null {
  return getLtiGroupIdValue(ltiData) ?? null;
}

interface AplusCourseApiResponse {
  my_groups?: string;
  myGroups?: string;
  mygroups?: string;
  [key: string]: unknown;
}

interface AplusMyGroupsResponse {
  results?: Array<{ id?: number | string }>;
  [key: string]: unknown;
}

/** LMS may send group ID under different param names. A+ uses _aplus_group. */
function getLtiGroupIdValue(ltiData: Lti10Data): string | undefined {
  const keys = [
    "custom_group_id",
    "groupID",
    "group_id",
    "custom_groupID",
    "custom_groupid",
    "custom_submission_group_id",
    "custom_aplus_group_id",
    "_aplus_group", // A+ LMS sends group id with this name
  ];

  const isUsableGroupValue = (key: string, value: string): boolean => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;

    // A+ may send "_aplus_group=0" even when no real subgroup was selected.
    // Treat that as "no explicit group" so it doesn't collapse the whole course
    // into one shared gameplay group.
    if (key === "_aplus_group" && normalized === "0") return false;

    if (normalized === "null" || normalized === "undefined" || normalized === "none") {
      return false;
    }

    return true;
  };

  for (const key of keys) {
    const v = ltiData[key]?.trim();
    if (v && isUsableGroupValue(key, v)) return v;
  }
  return undefined;
}

function pickScope(ltiData: Lti10Data): { source: LtiGroupContext["scopeSource"]; value: string } {
  const includeSourcedid = process.env.LTI_GROUP_SCOPE_USE_SOURCEDID === "true";

  const candidates: Array<{ source: LtiGroupContext["scopeSource"]; value?: string }> = [
    { source: "custom_group_id", value: getLtiGroupIdValue(ltiData) },
    { source: "custom_group", value: ltiData.custom_group },
    { source: "custom_group_name", value: ltiData.custom_group_name },
    {
      source: "resource_link_and_sourcedid",
      value:
        includeSourcedid && ltiData.resource_link_id && ltiData.lis_result_sourcedid
          ? `${ltiData.resource_link_id}::${ltiData.lis_result_sourcedid}`
          : undefined,
    },
    { source: "resource_link_id", value: ltiData.resource_link_id },
    { source: "context_id", value: ltiData.context_id },
  ];

  for (const candidate of candidates) {
    const value = candidate.value?.trim();
    if (value) {
      return { source: candidate.source, value };
    }
  }

  return {
    source: "fallback",
    value: `fallback-${Date.now()}`,
  };
}

function toGroupContext(
  ltiData: Lti10Data,
  scope: { source: LtiGroupContext["scopeSource"]; value: string }
): LtiGroupContext {
  const baseContextId = ltiData.context_id?.trim() || "lti-context";
  let effectiveScopeSource = scope.source;
  let effectiveScopeValue = scope.value;

  const hasExplicitGroupScope =
    scope.source === "custom_group_id" ||
    scope.source === "aplus_mygroups" ||
    scope.source === "custom_group" ||
    scope.source === "custom_group_name";

  if (getLtiRole(ltiData.roles) === "instructor" && !hasExplicitGroupScope) {
    const instructorId = ltiData.user_id?.trim() || "unknown-instructor";
    effectiveScopeSource = "role_isolated";
    effectiveScopeValue = `${scope.value}::instructor::${instructorId}`;
  }

  const scopeHash = createHash("sha256").update(effectiveScopeValue).digest("hex").slice(0, 16);

  return {
    key: `${baseContextId}::${scopeHash}`,
    baseContextId,
    scopeValue: effectiveScopeValue,
    scopeSource: effectiveScopeSource,
  };
}

function buildContextApiUrlCandidates(originalUrl: string): string[] {
  const candidates: string[] = [originalUrl];

  try {
    const parsed = new URL(originalUrl);

    const originOverride = process.env.LTI_CONTEXT_API_ORIGIN;
    if (originOverride) {
      const overrideOrigin = new URL(originOverride);
      candidates.push(new URL(parsed.pathname + parsed.search, overrideOrigin).toString());
    }

    const isPrivateIp =
      /^10\./.test(parsed.hostname) ||
      /^192\.168\./.test(parsed.hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(parsed.hostname) ||
      /^127\./.test(parsed.hostname);

    if (isPrivateIp) {
      const hostOverride = process.env.LTI_CONTEXT_API_HOST || "host.docker.internal";
      const fallback = new URL(originalUrl);
      fallback.hostname = hostOverride;
      candidates.push(fallback.toString());
    }

    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      const dockerFallbackHosts = (
        process.env.LTI_CONTEXT_API_DOCKER_HOSTS || "host.docker.internal,172.17.0.1"
      )
        .split(",")
        .map((host) => host.trim())
        .filter(Boolean);

      for (const host of dockerFallbackHosts) {
        const fallback = new URL(originalUrl);
        fallback.hostname = host;
        candidates.push(fallback.toString());
      }
    }
  } catch {
    // Keep only original URL when parsing fails.
  }

  return [...new Set(candidates)];
}

async function fetchJsonWithCandidates(
  url: string,
  token: string
): Promise<{ json: Record<string, unknown>; resolvedUrl: string } | null> {
  const headers = {
    Authorization: `Token ${token}`,
    Accept: "application/json",
  };

  for (const candidate of buildContextApiUrlCandidates(url)) {
    try {
      const response = await fetch(candidate, {
        headers,
        cache: "no-store",
      });
      if (!response.ok) continue;
      const json = (await response.json()) as Record<string, unknown>;
      return { json, resolvedUrl: candidate };
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

async function resolveAplusMyGroupScope(
  ltiData: Lti10Data
): Promise<{ source: LtiGroupContext["scopeSource"]; value: string } | null> {
  const contextApi = ltiData.custom_context_api?.trim();
  const userApiToken = ltiData.custom_user_api_token?.trim();

  if (!contextApi || !userApiToken) {
    return null;
  }

  const courseResponse = await fetchJsonWithCandidates(contextApi, userApiToken);
  const courseJson = courseResponse?.json as AplusCourseApiResponse | undefined;
  const myGroupsUrl =
    courseJson?.my_groups ||
    courseJson?.myGroups ||
    courseJson?.mygroups ||
    `${contextApi.replace(/\/+$/, "")}/mygroups/`;

  if (!myGroupsUrl) {
    return null;
  }

  const groupsResponse = await fetchJsonWithCandidates(myGroupsUrl, userApiToken);
  const groupsJson = groupsResponse?.json as AplusMyGroupsResponse | undefined;
  const groupResults = Array.isArray(groupsJson?.results) ? groupsJson.results : [];

  if (groupResults.length !== 1) {
    return null;
  }

  const groupId = String(groupResults[0]?.id ?? "").trim();
  if (!groupId) {
    return null;
  }

  return {
    source: "aplus_mygroups",
    value: `aplus-group:${groupId}`,
  };
}

export function deriveLtiGroupContext(ltiData: Lti10Data): LtiGroupContext {
  return toGroupContext(ltiData, pickScope(ltiData));
}

export async function resolveLtiGroupContext(ltiData: Lti10Data): Promise<LtiGroupContext> {
  const initialScope = pickScope(ltiData);
  if (initialScope.source === "custom_group_id") {
    return toGroupContext(ltiData, initialScope);
  }

  const aplusScope = await resolveAplusMyGroupScope(ltiData);
  if (aplusScope) {
    return toGroupContext(ltiData, aplusScope);
  }

  return toGroupContext(ltiData, initialScope);
}
