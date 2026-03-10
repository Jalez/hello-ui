import { chromium } from "@playwright/test";
import { Client } from "pg";
import { readFileSync } from "fs";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const scenario = process.env.PLAYWRIGHT_SCENARIO || "baseline";
const routeKind = process.env.PLAYWRIGHT_ROUTE_KIND || (scenario === "prototype_yjs" ? "prototype-yjs" : "game");
const requestedGameId = process.env.PLAYWRIGHT_GAME_ID || null;
const headed = process.env.PLAYWRIGHT_HEADED === "true";
const keepOpen = process.env.PLAYWRIGHT_KEEP_OPEN === "true";
const createWaitMs = Number.parseInt(process.env.PLAYWRIGHT_WAIT_MS || "1200", 10);
const dbUrl = process.env.PLAYWRIGHT_DATABASE_URL || process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/ui_designer_dev";
let activeGameId = requestedGameId;

function generateUsernames(count) {
  return Array.from({ length: count }, (_, index) => `user${String(index + 1).padStart(2, "0")}`);
}

function deriveUsernames() {
  const provided = (process.env.PLAYWRIGHT_USERNAMES || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (provided.length > 0) {
    return provided;
  }

  const defaultByScenario = {
    baseline: 5,
    lti_lobby: 6,
    lti_aplus_group: 4,
    classroom_churn: 12,
    prototype_yjs: 12,
    game_yjs: 12,
    submit_after_churn: 12,
    latency: 8,
  };
  const userCount = Number.parseInt(process.env.PLAYWRIGHT_USER_COUNT || `${defaultByScenario[scenario] || 5}`, 10);
  return generateUsernames(userCount);
}

const usernames = deriveUsernames();

function defaultGroupSizeForScenario() {
  if (scenario === "baseline") return 3;
  if (scenario === "lti_aplus_group") return 2;
  if (scenario === "latency") return 4;
  return 3;
}

function partitionIndexes(totalUsers, groupSize) {
  const layouts = [];
  for (let index = 0; index < totalUsers; index += groupSize) {
    layouts.push(Array.from({ length: Math.min(groupSize, totalUsers - index) }, (_, offset) => index + offset));
  }
  return layouts.filter((layout) => layout.length > 0);
}

function buildGroupLayouts() {
  const raw = process.env.PLAYWRIGHT_GROUP_LAYOUT;
  if (raw) {
    const groups = raw
      .split(";")
      .map((group) => group.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean))
      .filter((group) => group.length > 0);
    const usernameToIndex = new Map(usernames.map((username, index) => [username, index]));
    return groups.map((group) => group.map((username) => {
      const index = usernameToIndex.get(username);
      if (index === undefined) {
        throw new Error(`Unknown username in PLAYWRIGHT_GROUP_LAYOUT: ${username}`);
      }
      return index;
    }));
  }

  const groupSize = Number.parseInt(process.env.PLAYWRIGHT_GROUP_SIZE || `${defaultGroupSizeForScenario()}`, 10);
  const layout = partitionIndexes(usernames.length, Math.max(groupSize, 2));
  const requestedGroupCount = Number.parseInt(process.env.PLAYWRIGHT_GROUP_COUNT || `${layout.length}`, 10);
  return layout.slice(0, requestedGroupCount);
}

const groupLayouts = buildGroupLayouts();

function scenarioFlags() {
  const defaults = {
    delayedJoinMs: 0,
    stressRounds: 1,
    refreshDuringLobby: false,
    refreshDuringWaiting: false,
    refreshDuringEditing: false,
    openExtraTabCount: 0,
    closeReopenCount: 0,
    lateOpenCount: 0,
    submitAfterStress: false,
    useLtiLobby: false,
    httpDelayMs: 0,
    httpJitterMs: 0,
  };

  if (scenario === "baseline") {
    return {
      ...defaults,
      submitAfterStress: true,
    };
  }

  if (scenario === "lti_lobby") {
    return {
      ...defaults,
      delayedJoinMs: 1000,
      refreshDuringLobby: true,
      submitAfterStress: true,
      useLtiLobby: true,
    };
  }

  if (scenario === "lti_aplus_group") {
    return {
      ...defaults,
      submitAfterStress: false,
    };
  }

  if (scenario === "latency") {
    return {
      ...defaults,
      delayedJoinMs: 1200,
      stressRounds: 2,
      refreshDuringWaiting: true,
      refreshDuringEditing: true,
      openExtraTabCount: 1,
      lateOpenCount: 1,
      submitAfterStress: true,
      httpDelayMs: 200,
      httpJitterMs: 400,
    };
  }

  if (scenario === "prototype_yjs") {
    return {
      ...defaults,
      delayedJoinMs: 1500,
      stressRounds: 3,
      refreshDuringEditing: true,
      openExtraTabCount: 2,
      closeReopenCount: 2,
      lateOpenCount: 1,
      submitAfterStress: false,
    };
  }

  if (scenario === "game_yjs") {
    return {
      ...defaults,
      delayedJoinMs: 1500,
      stressRounds: 3,
      refreshDuringEditing: true,
      openExtraTabCount: 2,
      closeReopenCount: 2,
      lateOpenCount: 1,
      submitAfterStress: false,
    };
  }

  return {
    ...defaults,
    delayedJoinMs: 1500,
    stressRounds: 3,
    refreshDuringWaiting: true,
    refreshDuringEditing: true,
    openExtraTabCount: 2,
    closeReopenCount: 2,
    lateOpenCount: 1,
    submitAfterStress: true,
  };
}

const flags = {
  ...scenarioFlags(),
  delayedJoinMs: Number.parseInt(process.env.PLAYWRIGHT_DELAYED_JOIN_MS || `${scenarioFlags().delayedJoinMs}`, 10),
  stressRounds: Number.parseInt(process.env.PLAYWRIGHT_STRESS_ROUNDS || `${scenarioFlags().stressRounds}`, 10),
  refreshDuringEditing: process.env.PLAYWRIGHT_RELOAD_DURING_EDIT === "true" ? true : scenarioFlags().refreshDuringEditing,
  submitAfterStress: process.env.PLAYWRIGHT_SUBMIT_AFTER_STRESS === "true" ? true : scenarioFlags().submitAfterStress,
};

function gameUrl(gameId, groupId) {
  if (routeKind === "prototype-yjs") {
    const url = new URL(`/prototype/yjs/${gameId}`, baseUrl);
    if (groupId) {
      url.searchParams.set("groupId", groupId);
    }
    return url.toString();
  }
  const url = new URL(`/game/${gameId}`, baseUrl);
  url.searchParams.set("mode", "game");
  if (groupId) {
    url.searchParams.set("groupId", groupId);
  }
  return url.toString();
}

function normalizeName(value) {
  const normalized = String(value || "").trim().toLowerCase();
  const localEmailMatch = normalized.match(/^dev\+([a-z0-9_-]+)@local\.test$/);
  if (localEmailMatch) {
    return localEmailMatch[1];
  }
  const localDisplayMatch = normalized.match(/^user(\d+)$/);
  if (localDisplayMatch) {
    return `user${localDisplayMatch[1].padStart(2, "0")}`;
  }
  return normalized;
}

function expectedLtiDisplayName(username, index) {
  const numericId = index + 1;
  const given = username.replace(/^user/i, "User ");
  const family = `Lti${String(numericId).padStart(2, "0")}`;
  return `${given} ${family}`;
}

function createStarterLevel() {
  return {
    name: "template",
    scenarios: [],
    buildingBlocks: { pictures: [], colors: [] },
    code: {
      html: "<main>\n  <h1>Playwright Group Test</h1>\n  <p>Edit this text from any user.</p>\n</main>",
      css: "main { font-family: sans-serif; padding: 24px; }\nh1 { color: #14532d; }",
      js: "",
    },
    solution: { html: "", css: "", js: "" },
    accuracy: 0,
    week: "playwright-local",
    percentageTreshold: 70,
    percentageFullPointsTreshold: 95,
    difficulty: "easy",
    instructions: [],
    question_and_answer: { question: "", answer: "" },
    help: { description: "Start coding!", images: [], usefullCSSProperties: [] },
    timeData: { startTime: 0, pointAndTime: { 0: "0:0", 1: "0:0", 2: "0:0", 3: "0:0", 4: "0:0", 5: "0:0" } },
    events: [],
    interactive: false,
    showScenarioModel: true,
    showHotkeys: false,
    showModelPicture: true,
    lockCSS: false,
    lockHTML: false,
    lockJS: false,
    completed: "",
    points: 0,
    maxPoints: 100,
    confettiSprinkled: false,
  };
}

function createLtiSession(username, gameId) {
  return {
    userId: `dev-${username}`,
    userEmail: `dev+${username}@local.test`,
    userName: username,
    groupId: null,
    groupName: "Playwright Course",
    groupResolution: "pending",
    role: "member",
    documentTarget: "iframe",
    returnUrl: `${baseUrl}/courses/playwright`,
    ltiData: {
      context_id: `playwright-course-${gameId}`,
      context_title: "Playwright Course",
      resource_link_id: gameId,
      user_id: username,
      roles: "Learner",
    },
  };
}

function summarizeSet(values) {
  return [...new Set(values.filter(Boolean).map(normalizeName))].sort();
}

async function signInDevUser(page, username) {
  await page.goto(new URL("/auth/signin", baseUrl).toString(), { waitUntil: "networkidle" });
  await page.getByPlaceholder("alice").fill(username);
  await page.getByRole("button", { name: "Use Local User" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/auth/signin"), { timeout: 15000 });
}

async function enableHttpLatency(context) {
  if (flags.httpDelayMs <= 0 && flags.httpJitterMs <= 0) {
    return;
  }

  await context.route("**/*", async (route) => {
    const url = route.request().url();
    const isTarget =
      url.includes("/api/") ||
      url.includes(`/game/`) ||
      url.includes("/auth/signin");
    if (isTarget) {
      const jitter = flags.httpJitterMs > 0 ? Math.floor(Math.random() * flags.httpJitterMs) : 0;
      await new Promise((resolve) => setTimeout(resolve, flags.httpDelayMs + jitter));
    }
    await route.continue();
  });
}

async function createGroup(request, creatorUsername, gameId, suffix = "group") {
  const groupName = `pw-${creatorUsername}-${suffix}-${Date.now().toString(36)}`;
  const createResponse = await request.post(`${baseUrl}/api/groups`, {
    data: {
      name: groupName,
      resourceLinkId: gameId,
    },
  });
  if (!createResponse.ok()) {
    throw new Error(`Failed to create group: ${createResponse.status()} ${await createResponse.text()}`);
  }
  const createPayload = await createResponse.json();
  const groupId = createPayload.group?.id;
  if (!groupId) {
    throw new Error("Group create response did not include a group id.");
  }
  const detailsResponse = await request.get(`${baseUrl}/api/groups/${groupId}`);
  if (!detailsResponse.ok()) {
    throw new Error(`Failed to fetch created group ${groupId}: ${detailsResponse.status()} ${await detailsResponse.text()}`);
  }
  const detailsPayload = await detailsResponse.json();
  const joinKey = detailsPayload.group?.joinKey;
  if (!joinKey) {
    throw new Error(`Group ${groupId} did not expose a join key.`);
  }
  return { groupId, groupName, joinKey };
}

async function joinGroup(request, groupId, joinKey, username) {
  const response = await request.post(`${baseUrl}/api/groups/${groupId}/members`, {
    data: { joinKey },
  });
  if (!response.ok()) {
    throw new Error(`Failed to join group for ${username}: ${response.status()} ${await response.text()}`);
  }
}

async function fetchGroupSnapshot(request, group) {
  const response = await request.get(`${baseUrl}/api/groups/${group.groupId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch group snapshot for ${group.groupName}: ${response.status()} ${await response.text()}`);
  }
  const payload = await response.json();
  return {
    groupId: group.groupId,
    name: payload.group?.name ?? group.groupName,
    joinKey: payload.group?.joinKey ?? group.joinKey,
    memberNames: Array.isArray(payload.members)
      ? payload.members.map((member) => member.userName || member.userEmail || member.userId || "unknown")
      : [],
    memberCount: Array.isArray(payload.members) ? payload.members.length : 0,
  };
}

async function fetchGameGroupsSnapshot(request) {
  const response = await request.get(`${baseUrl}/api/games/${activeGameId}/groups`);
  if (!response.ok) {
    throw new Error(`Failed to fetch game groups snapshot: ${response.status()} ${await response.text()}`);
  }
  const payload = await response.json();
  return Array.isArray(payload.groups) ? payload.groups : [];
}

async function resolveSharedInstance(request, username, groupId) {
  const response = await request.get(
    `${baseUrl}/api/games/${activeGameId}/instance?accessContext=game&groupId=${encodeURIComponent(groupId)}`,
  );
  if (!response.ok()) {
    throw new Error(`Failed to resolve group instance for ${username}: ${response.status()} ${await response.text()}`);
  }
  const payload = await response.json();
  return payload.instance?.id ?? null;
}

async function seedGroupInstance(request, gameId, groupId, label) {
  const seedResponse = await request.patch(
    `${baseUrl}/api/games/${gameId}/instance?accessContext=game&groupId=${encodeURIComponent(groupId)}`,
    {
      data: {
        progressData: {
          levels: [createStarterLevel()],
          testGroupLabel: label,
        },
      },
    },
  );
  if (!seedResponse.ok()) {
    throw new Error(`Failed to seed starter level for group ${groupId}: ${seedResponse.status()} ${await seedResponse.text()}`);
  }
}

async function createTemplateLevel(request, label) {
  const starterLevel = createStarterLevel();
  const response = await request.post(`${baseUrl}/api/levels`, {
    data: {
      ...starterLevel,
      name: `Playwright Template ${label}`,
    },
  });
  if (!response.ok()) {
    throw new Error(`Failed to create template level: ${response.status()} ${await response.text()}`);
  }
  const payload = await response.json();
  if (!payload.identifier) {
    throw new Error("Template level create response did not include an identifier.");
  }
  return payload.identifier;
}

async function attachLevelToMap(request, mapName, levelIdentifier) {
  const response = await request.post(`${baseUrl}/api/maps/levels/${encodeURIComponent(mapName)}`, {
    data: {
      levels: [levelIdentifier],
    },
  });
  if (!response.ok()) {
    throw new Error(`Failed to attach level ${levelIdentifier} to map ${mapName}: ${response.status()} ${await response.text()}`);
  }
}

async function createPlayableGroupGame(request, creatorUsername) {
  const { gameId, mapName, title } = await createGroupModeGame(request, creatorUsername);
  const group = await createGroup(request, creatorUsername, gameId, "group-a");
  await seedGroupInstance(request, gameId, group.groupId, "group-a");

  return { gameId, mapName, title, ...group };
}

async function createGroupModeGame(request, creatorUsername) {
  const title = `Playwright ${scenario} ${new Date().toISOString()}`;
  const createResponse = await request.post(`${baseUrl}/api/games`, {
    data: {
      title,
      progressData: {},
    },
  });
  if (!createResponse.ok()) {
    throw new Error(`Failed to create game: ${createResponse.status()} ${await createResponse.text()}`);
  }
  const createdGame = await createResponse.json();
  const gameId = createdGame.id;
  const mapName = createdGame.mapName;
  if (!gameId || !mapName) {
    throw new Error("Game create response did not include id/mapName.");
  }

  const updateResponse = await request.patch(`${baseUrl}/api/games/${gameId}`, {
    data: {
      collaborationMode: "group",
      isPublic: true,
      title,
    },
  });
  if (!updateResponse.ok()) {
    throw new Error(`Failed to prepare created game ${gameId}: ${updateResponse.status()} ${await updateResponse.text()}`);
  }

  const templateLevelIdentifier = await createTemplateLevel(request, creatorUsername);
  await attachLevelToMap(request, mapName, templateLevelIdentifier);
  return { gameId, mapName, title };
}

async function waitForEditorOnPages(pages) {
  for (const page of pages) {
    await page.locator(".cm-content[contenteditable='true']").first().waitFor({ timeout: 20000 });
  }
}

async function startGroupGame(pages) {
  if (routeKind === "prototype-yjs") {
    return;
  }
  for (const page of pages.slice(0, 2)) {
    const waitingRoom = page.getByText("Group Waiting Room");
    if ((await waitingRoom.count()) > 0) {
      const startButton = page.getByRole("button", { name: "Start Game" });
      await startButton.waitFor({ timeout: 10000 });
      if (await startButton.isEnabled()) {
        await startButton.click();
      }
    }
  }
}

async function getEditableContent(page) {
  return (await page.locator(".cm-content[contenteditable='true']").first().textContent()) || "";
}

async function logPageEditorState(page, label) {
  const url = page.url();
  const editableCount = await page.locator(".cm-content[contenteditable='true']").count().catch(() => 0);
  const readOnlyCount = await page.locator(".cm-content[contenteditable='false']").count().catch(() => 0);
  const waitingRoomCount = await page.getByText("Group Waiting Room").count().catch(() => 0);
  const loadingCount = await page.getByText("Loading", { exact: false }).count().catch(() => 0);
  const bodyText = await page.locator("body").textContent().catch(() => "");
  console.warn(
    `[page-state:${label}] url=${url} editable=${editableCount} readOnly=${readOnlyCount} waitingRoom=${waitingRoomCount} loading=${loadingCount} body=${JSON.stringify((bodyText || "").slice(0, 200))}`
  );
}

async function triggerLevelReset(page) {
  const titledResetButtons = page.getByTitle("Reset Level");
  const namedResetButtons = page.getByRole("button", { name: "Reset" });
  const gameMenuTrigger = page.getByRole("button", { name: "Game", exact: true });

  if ((await titledResetButtons.count()) > 0 && await titledResetButtons.first().isVisible().catch(() => false)) {
    await titledResetButtons.first().click();
  } else if ((await namedResetButtons.count()) > 0 && await namedResetButtons.first().isVisible().catch(() => false)) {
    await namedResetButtons.first().click();
  } else if ((await gameMenuTrigger.count()) > 0 && await gameMenuTrigger.first().isVisible().catch(() => false)) {
    await gameMenuTrigger.first().click();
    await page.getByRole("menuitem", { name: "Reset Level" }).waitFor({ timeout: 10000 });
    await page.getByRole("menuitem", { name: "Reset Level" }).click();
  } else {
    throw new Error("Reset controls were not visible on the page.");
  }

  await page.getByRole("dialog").waitFor({ timeout: 10000 });
  await page.getByRole("heading", { name: "Reset Level" }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "Yes" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 10000 });
}

async function verifyLevelReset(group, contexts) {
  if (routeKind === "prototype-yjs") {
    return true;
  }
  const memberPages = group.memberIndexes.map((memberIndex) => contexts[memberIndex].page);
  const templateHtml = createStarterLevel().code.html.replace(/\n/g, "");
  const resetMarker = `pw-reset-${Date.now().toString(36)}`;
  const sourceEditor = memberPages[0].locator(".cm-content[contenteditable='true']").first();
  await sourceEditor.click();
  await sourceEditor.press("End");
  await memberPages[0].keyboard.type(`\n<!-- ${resetMarker} -->`);
  await memberPages[0].waitForTimeout(Math.max(createWaitMs * 2, 2000));
  await triggerLevelReset(memberPages[0]);
  // Yjs reset requires doc replacement + editor remount, give it extra time
  const maxAttempts = 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await memberPages[0].waitForTimeout(attempt === 1 ? Math.max(createWaitMs * 3, 4000) : 1500);
    const contents = await Promise.all(memberPages.map((page) => getEditableContent(page)));
    const normalized = contents.map((content) => content.replace(/\n/g, ""));
    const ok = normalized.every((content) => content.includes(templateHtml) && !content.includes(resetMarker));
    if (ok) {
      return true;
    }
    if (attempt === maxAttempts) {
      console.warn(`[verifyLevelReset:fail] templateHtml=${JSON.stringify(templateHtml.slice(0, 80))}`);
      normalized.forEach((content, index) => {
        console.warn(`[verifyLevelReset:fail] page[${index}] content=${JSON.stringify(content.slice(0, 200))} hasTemplate=${content.includes(templateHtml)} hasMarker=${content.includes(resetMarker)}`);
      });
    }
  }
  return false;
}

async function trySharedEdit(pages, marker) {
  if (pages.length < 2) return false;
  const editor = pages[0].locator(".cm-content[contenteditable='true']").first();
  await editor.click();
  await editor.press("End");
  await pages[0].keyboard.type(`\n<!-- ${marker} -->`);
  await pages[0].waitForTimeout(createWaitMs);
  const target = pages[pages.length - 1].locator(".cm-content[contenteditable='true']").first();
  await target.waitFor({ timeout: 10000 });
  const observed = (await target.textContent()) || "";
  return observed.includes(marker);
}

async function tryConcurrentSharedEdit(pages, groupName) {
  if (pages.length < 2) return false;
  const markerA = `pw-concurrent-a-${Date.now().toString(36)}`;
  const markerB = `pw-concurrent-b-${Date.now().toString(36)}`;
  const editorA = pages[0].locator(".cm-content[contenteditable='true']").first();
  const editorB = pages[1].locator(".cm-content[contenteditable='true']").first();
  await Promise.all([
    (async () => {
      await editorA.click();
      await editorA.press("End");
      await pages[0].keyboard.type(`\n<!-- ${markerA} -->`);
    })(),
    (async () => {
      await editorB.click();
      await editorB.press("End");
      await pages[1].keyboard.type(`\n<!-- ${markerB} -->`);
    })(),
  ]);
  await pages[0].waitForTimeout(Math.max(createWaitMs * 2, 2500));
  const pageContents = await Promise.all(
    pages.map(async (page, index) => {
      try {
        return ((await page.locator(".cm-content[contenteditable='true']").first().textContent({ timeout: 30000 })) || "");
      } catch (error) {
        await logPageEditorState(page, `${groupName}:${index}`);
        throw error;
      }
    }),
  );
  const merged = pageContents.every((content) => content.includes(markerA) && content.includes(markerB));
  if (!merged) {
    console.warn(`concurrent markers failed in ${groupName}`);
  }
  return merged;
}

async function dbClient() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  return client;
}

async function fetchLtiConsumerKey() {
  if (process.env.PLAYWRIGHT_LTI_CONSUMER_KEY) {
    return process.env.PLAYWRIGHT_LTI_CONSUMER_KEY;
  }

  const client = await dbClient();
  try {
    const result = await client.query(`SELECT consumer_key FROM lti_credentials ORDER BY consumer_key ASC LIMIT 1`);
    if (result.rows[0]?.consumer_key) {
      return result.rows[0].consumer_key;
    }
  } finally {
    await client.end();
  }

  try {
    const devLog = readFileSync(".next/dev/logs/next-development.log", "utf8");
    const matches = [...devLog.matchAll(/oauth_consumer_key[^0-9a-f-]*([0-9a-f-]{36})/gi)];
    return matches.at(-1)?.[1] || null;
  } catch {
    return null;
  }
}

async function ensureLtiCredential(consumerKey, ownerEmail) {
  const client = await dbClient();
  try {
    const ownerResult = await client.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [ownerEmail]);
    const ownerId = ownerResult.rows[0]?.id;
    if (!ownerId) {
      throw new Error(`Could not find user id for ${ownerEmail}`);
    }
    await client.query(
      `INSERT INTO lti_credentials (user_id, consumer_key, consumer_secret)
       VALUES ($1, $2, $3)
       ON CONFLICT (consumer_key) DO NOTHING`,
      [ownerId, consumerKey, "playwright-secret"],
    );
  } finally {
    await client.end();
  }
}

async function fetchAttemptParticipants(attemptId) {
  const client = await dbClient();
  try {
    const result = await client.query(
      `SELECT COALESCE(NULLIF(TRIM(display_name), ''), user_id::text, 'unknown') AS display_name
       FROM game_attempt_participants
       WHERE attempt_id = $1
       ORDER BY display_name ASC`,
      [attemptId],
    );
    return result.rows.map((row) => String(row.display_name));
  } finally {
    await client.end();
  }
}

async function fetchInstanceState(gameId, groupId) {
  const client = await dbClient();
  try {
    const result = await client.query(
      `SELECT id, progress_data
       FROM game_instances
       WHERE game_id = $1 AND group_id = $2
       LIMIT 1`,
      [gameId, groupId],
    );
    return result.rows[0] || null;
  } finally {
    await client.end();
  }
}

async function submitGroupAttempt(group, contexts) {
  const owner = contexts[group.ownerIndex];
  const finishPayload = {
    points: 20,
    maxPoints: 20,
    pointsByLevel: {
      template: {
        points: 20,
        maxPoints: 20,
        accuracy: 100,
        bestTime: "0:10",
        scenarios: [],
      },
    },
    progressData: {
      submittedBy: owner.username,
      submittedAt: new Date().toISOString(),
      levels: [createStarterLevel()],
    },
  };
  const response = await owner.context.request.post(
    `${baseUrl}/api/games/${activeGameId}/finish?accessContext=game&groupId=${encodeURIComponent(group.groupId)}`,
    {
      data: finishPayload,
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) {
    throw new Error(`Failed to submit group ${group.groupName}: ${response.status()} ${JSON.stringify(payload)}`);
  }

  const attemptId = payload?.statistics?.attemptId ?? null;
  const participants = attemptId ? await fetchAttemptParticipants(attemptId) : [];
  const expectedNames = summarizeSet(group.memberIndexes.map((memberIndex) => contexts[memberIndex].username));
  const actualNames = summarizeSet(participants);
  const submitOk = expectedNames.length === actualNames.length && expectedNames.every((value) => actualNames.includes(value));
  console.log(
    `stress:submit ${group.groupName} attemptId=${attemptId || "none"} expected=${expectedNames.join("|")} actual=${actualNames.join("|")} ok=${submitOk}`,
  );
  return {
    attemptId,
    expectedNames,
    actualNames,
    submitOk,
    finishPayload,
    statistics: payload.statistics ?? null,
  };
}

async function configureConsoleLogging(page, label) {
  page.on("console", (message) => {
    const text = message.text();
    if (
      text.includes("[DEBUG-CLIENT]") ||
      text.includes("[yjs-") ||
      text.includes("shared_reset_") ||
      text.includes("ws_reset_room_") ||
      text.includes("group_join_") ||
      text.includes("finish_click") ||
      text.includes("room_resolution")
    ) {
      console.log(`[browser:${label}] ${text}`);
    }
  });
  page.on("pageerror", (error) => {
    console.warn(`[browser:${label}:pageerror] ${error?.message || error}`);
  });
  page.on("crash", () => {
    console.warn(`[browser:${label}:crash] page crashed`);
  });
  page.on("close", () => {
    console.warn(`[browser:${label}:close] page closed`);
  });
}

async function applyLtiCookie(context, username, gameId) {
  const session = createLtiSession(username, gameId);
  await context.addCookies([
    {
      name: "lti_session",
      value: JSON.stringify(session),
      url: baseUrl,
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);
}

function buildLtiLaunchPayload({ gameId, username, index, aplusGroup, consumerKey }) {
  const numericId = index + 1;
  const given = username.replace(/^user/i, "User ");
  const family = `Lti${String(numericId).padStart(2, "0")}`;
  return {
    custom_student_id: `PW-${String(numericId).padStart(3, "0")}`,
    lti_version: "LTI-1p0",
    lti_message_type: "basic-lti-launch-request",
    resource_link_id: `playwright-${gameId}`,
    resource_link_title: "UI-Designer",
    user_id: `pw-lti-${username}`,
    roles: "Learner,Student",
    lis_person_name_full: `${given} ${family}`,
    lis_person_name_given: given,
    lis_person_name_family: family,
    lis_person_contact_email_primary: `${username}@lti.local`,
    context_id: "playwright/def/current/",
    context_title: "Playwright Def. Course",
    context_label: "PWLTI",
    launch_presentation_locale: "en",
    launch_presentation_document_target: "iframe",
    launch_presentation_return_url: `${baseUrl}/playwright/return`,
    tool_consumer_instance_guid: "playwright/aplus",
    tool_consumer_instance_name: "A+",
    tool_consumer_instance_description: "Playwright A+",
    tool_consumer_instance_url: baseUrl,
    custom_context_api: `${baseUrl}/api/playwright/context`,
    custom_context_api_id: "1",
    custom_user_api_token: "playwright-token",
    lis_result_sourcedid: `${gameId}-${username}`,
    lis_outcome_service_url: `${baseUrl}/api/playwright/lti-outcomes`,
    oauth_nonce: `${Date.now()}-${username}`,
    oauth_timestamp: `${Math.floor(Date.now() / 1000)}`,
    oauth_version: "1.0",
    oauth_signature_method: "HMAC-SHA1",
    oauth_consumer_key: consumerKey,
    oauth_signature: "playwright-signature",
    _aplus_group: aplusGroup,
  };
}

async function launchThroughLtiPost(page, gameId, payload) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    async ({ action, payload: formPayload }) => {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = action;
      for (const [key, value] of Object.entries(formPayload)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    },
    {
      action: `${baseUrl}/api/lti/game/${gameId}`,
      payload,
    },
  );
  await page.waitForURL((url) => url.pathname === `/game/${gameId}` && Boolean(url.searchParams.get("groupId")), {
    timeout: 30000,
  });
}

async function fetchPageGroupId(page) {
  const current = new URL(page.url());
  return current.searchParams.get("groupId");
}

async function captureWaitingRoomIdentity(page, expectedLabels) {
  await page.getByText("Group Waiting Room").waitFor({ timeout: 20000 });
  await page.waitForFunction((labels) => {
    const bodyText = document.body.innerText || "";
    const titles = Array.from(document.querySelectorAll("[title]"))
      .map((element) => element.getAttribute("title") || "")
      .filter(Boolean)
      .map((title) => title.replace(/\s+•\s+Ready$/, ""));
    return labels.every((label) => bodyText.includes(label) && titles.includes(label));
  }, expectedLabels, { timeout: 10000 });
  const snapshot = await page.evaluate((labels) => {
    const bodyText = document.body.innerText || "";
    const titles = Array.from(document.querySelectorAll("[title]"))
      .map((element) => element.getAttribute("title") || "")
      .filter(Boolean);
    const normalizedTitles = titles.map((title) => title.replace(/\s+•\s+Ready$/, ""));
    return {
      visibleLabels: labels.filter((label) => bodyText.includes(label)),
      avatarLabels: labels.filter((label) => normalizedTitles.includes(label)),
      rawTitles: titles,
    };
  }, expectedLabels);

  return {
    visibleLabels: summarizeSet(snapshot.visibleLabels),
    avatarLabels: summarizeSet(snapshot.avatarLabels),
    rawTitles: snapshot.rawTitles,
  };
}

async function runLtiAplusGroupScenario(browser) {
  const creatorContext = await browser.newContext({ baseURL: baseUrl });
  await enableHttpLatency(creatorContext);
  const creatorPage = await creatorContext.newPage();
  if (requestedGameId) {
    activeGameId = requestedGameId;
    console.log(`using existing game ${activeGameId}`);
  } else {
    await signInDevUser(creatorPage, "creator");
    const createdGame = await createGroupModeGame(creatorContext.request, "creator");
    activeGameId = createdGame.gameId;
    console.log(`created game ${activeGameId} (${createdGame.title})`);
  }

  const consumerKey = await fetchLtiConsumerKey();
  if (!consumerKey) {
    throw new Error("No LTI consumer key found in local database.");
  }
  await ensureLtiCredential(consumerKey, "dev+creator@local.test");

  const contexts = [];
  const summary = [];

  try {
    for (const [index, username] of usernames.entries()) {
      const context = await browser.newContext({ baseURL: baseUrl });
      await enableHttpLatency(context);
      const page = await context.newPage();
      await configureConsoleLogging(page, username);
      const layoutIndex = groupLayouts.findIndex((layout) => layout.includes(index));
      const aplusGroup = String(Math.max(layoutIndex, 0));
      contexts.push({
        username,
        context,
        page,
        aplusGroup,
        expectedDisplayName: expectedLtiDisplayName(username, index),
      });
      const payload = buildLtiLaunchPayload({ gameId: activeGameId, username, index, aplusGroup, consumerKey });
      await launchThroughLtiPost(page, activeGameId, payload);
      const pageGroupId = await fetchPageGroupId(page);
      console.log(`lti:launch ${username} aplusGroup=${aplusGroup} appGroupId=${pageGroupId}`);
    }

    const groups = [];
    for (const [layoutIndex, memberIndexes] of groupLayouts.entries()) {
      const ownerIndex = memberIndexes[0];
      const owner = contexts[ownerIndex];
      const groupId = await fetchPageGroupId(owner.page);
      if (!groupId) {
        throw new Error(`No groupId in redirected URL for ${owner.username}`);
      }
      groups.push({
        aplusGroup: String(layoutIndex),
        groupId,
        groupName: `A+ Group ${layoutIndex}`,
        memberIndexes,
        ownerIndex,
      });
    }

    for (const group of groups) {
      const pageGroupIds = await Promise.all(
        group.memberIndexes.map((memberIndex) => fetchPageGroupId(contexts[memberIndex].page)),
      );
      const uniqueGroupIds = [...new Set(pageGroupIds.filter(Boolean))];
      if (uniqueGroupIds.length !== 1 || uniqueGroupIds[0] !== group.groupId) {
        throw new Error(`Expected one redirected app group for A+ group ${group.aplusGroup}, got ${uniqueGroupIds.join(", ")}`);
      }
      group.joinSnapshot = await fetchGroupSnapshot(contexts[group.ownerIndex].context.request, group);
      console.log(
        `lti:join-snapshot aplusGroup=${group.aplusGroup} groupId=${group.groupId} members=${group.joinSnapshot.memberNames.join("|")}`,
      );
      const expectedLabels = group.memberIndexes.map(
        (memberIndex) => contexts[memberIndex].expectedDisplayName,
      );
      const waitingSnapshots = [];
      for (const memberIndex of group.memberIndexes) {
        const participant = contexts[memberIndex];
        const waitingSnapshot = await captureWaitingRoomIdentity(participant.page, expectedLabels);
        waitingSnapshots.push(waitingSnapshot);
        console.log(
          `lti:identity ${participant.username} aplusGroup=${group.aplusGroup} visible=${waitingSnapshot.visibleLabels.join("|")} avatars=${waitingSnapshot.avatarLabels.join("|")}`,
        );
      }
      const expectedNormalized = summarizeSet(expectedLabels);
      const namesPreserved = waitingSnapshots.every((snapshot) => {
        const visible = summarizeSet(snapshot.visibleLabels);
        const avatars = summarizeSet(snapshot.avatarLabels);
        return visible.length === expectedNormalized.length &&
          avatars.length === expectedNormalized.length &&
          expectedNormalized.every((label) => visible.includes(label) && avatars.includes(label));
      });
      summary.push({
        name: `aplus-${group.aplusGroup}`,
        members: group.joinSnapshot.memberCount,
        groupId: group.groupId,
        namesPreserved,
        expectedMembers: expectedNormalized,
        observedJoinMembers: summarizeSet(group.joinSnapshot.memberNames),
        observedVisibleNames: summarizeSet(waitingSnapshots.flatMap((snapshot) => snapshot.visibleLabels)),
        observedAvatarNames: summarizeSet(waitingSnapshots.flatMap((snapshot) => snapshot.avatarLabels)),
      });
    }

    console.log("");
    console.log(`Playwright scenario: ${scenario}`);
    console.log(`Game: ${activeGameId}`);
    console.log("Summary");
    console.log("group | members | groupId | names");
    for (const row of summary) {
      console.log(
        `${row.name} | ${row.members} | ${row.groupId || "none"} | ${row.namesPreserved ? "PASS" : "FAIL"}`,
      );
      console.log(
        `summary:${row.name} expected=${row.expectedMembers.join("|")} join=${row.observedJoinMembers.join("|")} visible=${row.observedVisibleNames.join("|")} avatars=${row.observedAvatarNames.join("|")}`,
      );
    }
  } finally {
    await Promise.all(contexts.map(async ({ context }) => context.close().catch(() => {})));
    await creatorContext.close().catch(() => {});
  }
}

async function openLtiLobby(page, gameId, username) {
  await page.goto(gameUrl(gameId, null), { waitUntil: "networkidle" });
  await page.getByText("Public Group Lobby").waitFor({ timeout: 20000 });
  const data = await page.evaluate(async () => {
    const res = await fetch("/api/games/lti-session");
    return res.json();
  });
  const roomId = `lobby:${encodeURIComponent(data.contextId || data.courseName || "unresolved-lti-group")}:game:${gameId}`;
  console.log(`lti:lobby ${username} gameId=${gameId} roomId=${roomId}`);
  return { roomId, ltiInfo: data };
}

async function closeAndReopenMember(group, contexts, memberIndex) {
  const participant = contexts[memberIndex];
  await participant.page.close().catch(() => {});
  participant.page = await participant.context.newPage();
  await configureConsoleLogging(participant.page, participant.username);
  await participant.page.goto(gameUrl(activeGameId, group.groupId), { waitUntil: "networkidle" });
  await participant.page.locator(".cm-content[contenteditable='true']").first().waitFor({ timeout: 20000 });
  console.log(`stress:rejoin ${group.groupName} user=${participant.username}`);
}

async function main() {
  const browser = await chromium.launch({ headless: !headed, slowMo: headed ? 120 : 0 });

  if (scenario === "lti_aplus_group") {
    try {
      await runLtiAplusGroupScenario(browser);
    } finally {
      await browser.close().catch(() => {});
    }
    return;
  }

  const contexts = [];
  const summary = [];

  try {
    for (const username of usernames) {
      const context = await browser.newContext({ baseURL: baseUrl });
      await enableHttpLatency(context);
      const page = await context.newPage();
      await configureConsoleLogging(page, username);
      contexts.push({ username, context, page, extraPages: [] });
      await signInDevUser(page, username);
      console.log(`signed in ${username}`);
    }

    const creator = contexts[0];
    let provisionedTitle = null;
    let primaryGroup;

    if (requestedGameId) {
      const createdGroup = await createGroup(creator.context.request, creator.username, requestedGameId, "group-a");
      activeGameId = requestedGameId;
      primaryGroup = createdGroup;
    } else {
      const createdGame = await createPlayableGroupGame(creator.context.request, creator.username);
      activeGameId = createdGame.gameId;
      provisionedTitle = createdGame.title;
      primaryGroup = createdGame;
    }

    if (flags.useLtiLobby) {
      for (const participant of contexts) {
        await applyLtiCookie(participant.context, participant.username, activeGameId);
        const lobby = await openLtiLobby(participant.page, activeGameId, participant.username);
        participant.ltiLobby = lobby;
      }
      const uniqueLobbyRooms = [...new Set(contexts.map((participant) => participant.ltiLobby?.roomId || ""))];
      if (uniqueLobbyRooms.length !== 1) {
        throw new Error(`Expected one shared LTI lobby room, got ${uniqueLobbyRooms.join(", ")}`);
      }
      if (flags.refreshDuringLobby) {
        await contexts[0].page.reload({ waitUntil: "networkidle" });
        await contexts[0].page.getByText("Public Group Lobby").waitFor({ timeout: 20000 });
        console.log(`stress:lobby-reload user=${contexts[0].username}`);
      }
    }

    console.log(`created group ${primaryGroup.groupName} (${primaryGroup.groupId}) with join key ${primaryGroup.joinKey}`);
    if (provisionedTitle) {
      console.log(`created game ${activeGameId} (${provisionedTitle})`);
    }

    const groups = [
      {
        groupId: primaryGroup.groupId,
        groupName: primaryGroup.groupName,
        joinKey: primaryGroup.joinKey,
        memberIndexes: groupLayouts[0],
        ownerIndex: groupLayouts[0][0],
      },
    ];

    for (let groupIndex = 1; groupIndex < groupLayouts.length; groupIndex += 1) {
      const ownerIndex = groupLayouts[groupIndex][0];
      const owner = contexts[ownerIndex];
      const suffix = `group-${String.fromCharCode(97 + groupIndex)}`;
      const createdGroup = await createGroup(owner.context.request, owner.username, activeGameId, suffix);
      await seedGroupInstance(owner.context.request, activeGameId, createdGroup.groupId, suffix);
      groups.push({
        groupId: createdGroup.groupId,
        groupName: createdGroup.groupName,
        joinKey: createdGroup.joinKey,
        memberIndexes: groupLayouts[groupIndex],
        ownerIndex,
      });
      console.log(`created group ${createdGroup.groupName} (${createdGroup.groupId}) with join key ${createdGroup.joinKey}`);
    }

    for (const group of groups) {
      for (const memberIndex of group.memberIndexes.slice(1)) {
        const participant = contexts[memberIndex];
        if (flags.delayedJoinMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, flags.delayedJoinMs));
        }
        await joinGroup(participant.context.request, group.groupId, group.joinKey, participant.username);
        console.log(`joined ${participant.username} -> ${group.groupId}`);
      }
      group.joinSnapshot = await fetchGroupSnapshot(contexts[group.ownerIndex].context.request, group);
      console.log(`stress:join-snapshot ${group.groupName} memberCount=${group.joinSnapshot.memberCount} members=${group.joinSnapshot.memberNames.join("|")}`);
    }

    const initialGameGroups = await fetchGameGroupsSnapshot(creator.context.request);
    console.log(`stress:game-groups initialCount=${initialGameGroups.length}`);

    for (const group of groups) {
      const instanceIds = [];
      for (const memberIndex of group.memberIndexes) {
        const participant = contexts[memberIndex];
        const instanceId = await resolveSharedInstance(participant.context.request, participant.username, group.groupId);
        instanceIds.push(instanceId);
        console.log(`instance ${participant.username} in ${group.groupName}: ${instanceId}`);
      }
      const unique = [...new Set(instanceIds.filter(Boolean))];
      if (unique.length !== 1) {
        throw new Error(`Expected one shared instance for ${group.groupName}, got ${unique.join(", ") || "none"}`);
      }
      group.instanceId = unique[0];
    }

    for (const group of groups) {
      const lateOpenIndexes = flags.lateOpenCount > 0 && group.memberIndexes.length > 2
        ? group.memberIndexes.slice(-flags.lateOpenCount)
        : [];
      group.lateOpenIndexes = lateOpenIndexes;
      for (const memberIndex of group.memberIndexes) {
        if (lateOpenIndexes.includes(memberIndex)) {
          continue;
        }
        const participant = contexts[memberIndex];
        await participant.page.goto(gameUrl(activeGameId, group.groupId), { waitUntil: "networkidle" });
        console.log(`opened group route for ${participant.username} -> ${group.groupName}`);
      }
    }

    if (flags.refreshDuringWaiting && routeKind !== "prototype-yjs") {
      for (const group of groups) {
        const reloadIndex = group.memberIndexes.find((index) => !group.lateOpenIndexes.includes(index));
        if (reloadIndex != null) {
          await contexts[reloadIndex].page.reload({ waitUntil: "networkidle" });
          console.log(`stress:waiting-reload ${group.groupName} user=${contexts[reloadIndex].username}`);
        }
      }
    }

    for (const group of groups) {
      const activePages = group.memberIndexes
        .filter((memberIndex) => !group.lateOpenIndexes.includes(memberIndex))
        .map((memberIndex) => contexts[memberIndex].page);
      await startGroupGame(activePages);
      for (const lateIndex of group.lateOpenIndexes) {
        const participant = contexts[lateIndex];
        await participant.page.goto(gameUrl(activeGameId, group.groupId), { waitUntil: "networkidle" });
        console.log(`stress:late-open ${group.groupName} user=${participant.username}`);
      }
      await waitForEditorOnPages(group.memberIndexes.map((memberIndex) => contexts[memberIndex].page));
      group.startSnapshot = await fetchGroupSnapshot(contexts[group.ownerIndex].context.request, group);
      console.log(`stress:start-snapshot ${group.groupName} memberCount=${group.startSnapshot.memberCount} members=${group.startSnapshot.memberNames.join("|")}`);
    }

    for (let index = 0; index < Math.min(flags.openExtraTabCount, groups.length); index += 1) {
      const group = groups[index];
      const participant = contexts[group.ownerIndex];
      const extraPage = await participant.context.newPage();
      await configureConsoleLogging(extraPage, `${participant.username}-tab2`);
      await extraPage.goto(gameUrl(activeGameId, group.groupId), { waitUntil: "networkidle" });
      await extraPage.locator(".cm-content[contenteditable='true']").first().waitFor({ timeout: 20000 });
      participant.extraPages.push(extraPage);
      console.log(`stress:extra-tab ${group.groupName} user=${participant.username}`);
    }

    for (const group of groups) {
      const pages = group.memberIndexes.map((memberIndex) => contexts[memberIndex].page);
      const marker = `pw-${group.groupName}-${Date.now().toString(36)}`;
      const replicated = await trySharedEdit(pages, marker);
      if (replicated) {
        console.log(`shared edit marker replicated in ${group.groupName}: ${marker}`);
      } else {
        console.warn(`shared edit marker was not observed remotely in ${group.groupName}: ${marker}`);
      }

      const concurrentReplicated = await tryConcurrentSharedEdit(pages, group.groupName);
      if (concurrentReplicated) {
        console.log(`concurrent edit markers merged in ${group.groupName}`);
      } else {
        console.warn(`concurrent edit markers did not merge cleanly in ${group.groupName}`);
      }

      const stressResults = [];
      const memberPages = group.memberIndexes.map((memberIndex) => contexts[memberIndex].page);
      const memberNames = group.memberIndexes.map((memberIndex) => contexts[memberIndex].username);
      console.log(`stress:start ${group.groupName} members=${memberNames.join(",")}`);

      for (let round = 1; round <= flags.stressRounds; round += 1) {
        const concurrentOk = await tryConcurrentSharedEdit(memberPages, `${group.groupName}-round-${round}`);
        stressResults.push(concurrentOk);
        console.log(`stress:round ${group.groupName} round=${round} concurrentOk=${concurrentOk}`);

        if (flags.refreshDuringEditing && memberPages.length >= 3 && round === 1) {
          const reloaderPage = memberPages[memberPages.length - 1];
          await reloaderPage.reload({ waitUntil: "networkidle" });
          await reloaderPage.locator(".cm-content[contenteditable='true']").first().waitFor({ timeout: 20000 });
          console.log(`stress:reload ${group.groupName} user=${memberNames[memberNames.length - 1]}`);
        }
      }

      if (flags.closeReopenCount > 0 && group.memberIndexes.length > 1) {
        const memberIndex = group.memberIndexes[group.memberIndexes.length - 1];
        await closeAndReopenMember(group, contexts, memberIndex);
      }

      const finishSnapshot = await fetchGroupSnapshot(contexts[group.ownerIndex].context.request, group);
      console.log(`stress:finish-snapshot ${group.groupName} memberCount=${finishSnapshot.memberCount} members=${finishSnapshot.memberNames.join("|")}`);

      const resetOk = await verifyLevelReset(group, contexts);
      console.log(`stress:reset ${group.groupName} ok=${resetOk}`);

      let submitResult = null;
      if (flags.submitAfterStress) {
        submitResult = await submitGroupAttempt(group, contexts);
      }

      const instanceState = await fetchInstanceState(activeGameId, group.groupId);
      summary.push({
        name: group.groupName,
        members: finishSnapshot.memberCount,
        expectedMembers: summarizeSet(group.memberIndexes.map((memberIndex) => contexts[memberIndex].username)),
        observedJoinMembers: summarizeSet(group.joinSnapshot.memberNames),
        observedStartMembers: summarizeSet(group.startSnapshot.memberNames),
        observedFinishMembers: summarizeSet(finishSnapshot.memberNames),
        instanceId: group.instanceId || (instanceState?.id ?? null),
        singleEdit: replicated,
        concurrent: concurrentReplicated,
        stressPasses: stressResults.filter(Boolean).length,
        stressTotal: stressResults.length,
        resetOk,
        submitOk: submitResult?.submitOk ?? null,
        actualSubmitParticipants: submitResult?.actualNames ?? [],
      });
    }

    const finalGameGroups = await fetchGameGroupsSnapshot(creator.context.request);
    console.log(`stress:game-groups finalCount=${finalGameGroups.length}`);

    console.log("");
    console.log(`Playwright scenario: ${scenario}`);
    console.log(`Game: ${activeGameId}`);
    console.log("Summary");
    console.log("group | members | instance | single | concurrent | stress | reset | submit");
    for (const row of summary) {
      console.log(
        `${row.name} | ${row.members} | ${row.instanceId || "none"} | ${row.singleEdit ? "PASS" : "FAIL"} | ${row.concurrent ? "PASS" : "FAIL"} | ${row.stressPasses}/${row.stressTotal} | ${row.resetOk ? "PASS" : "FAIL"} | ${row.submitOk == null ? "n/a" : row.submitOk ? "PASS" : "FAIL"}`,
      );
      console.log(
        `summary:${row.name} expected=${row.expectedMembers.join("|")} join=${row.observedJoinMembers.join("|")} start=${row.observedStartMembers.join("|")} finish=${row.observedFinishMembers.join("|")} submit=${row.actualSubmitParticipants.join("|")}`,
      );
    }

    if (keepOpen) {
      console.log("Leave the browser open and press Ctrl+C to exit.");
      await new Promise(() => {});
    }
  } finally {
    await Promise.all(contexts.flatMap(({ extraPages = [] }) => extraPages).map(async (page) => page.close().catch(() => {})));
    await Promise.all(contexts.map(async ({ context }) => context.close().catch(() => {})));
    await browser.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
