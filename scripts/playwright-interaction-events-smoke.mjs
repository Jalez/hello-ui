import dotenv from "dotenv";
import path from "node:path";
import process from "node:process";
import { chromium, expect } from "@playwright/test";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const DEV_USERNAME = process.env.PLAYWRIGHT_DEV_USERNAME || "interaction-smoke";
const TIMEOUT_MS = Number(process.env.PLAYWRIGHT_INTERACTION_TIMEOUT_MS || 90000);

const SCENARIO_ID = "scenario-playwright-interaction";

const HTML_CODE = `<main class="demo-shell">
  <button id="toggle" type="button">Toggle details</button>
  <label for="name-input">Name</label>
  <input id="name-input" type="text" placeholder="Type a name" />
  <p id="status" data-open="false">Closed</p>
  <p id="mirror">Anonymous</p>
</main>`;

const CSS_CODE = `html, body {
  margin: 0;
  min-height: 100%;
  background: #eef2ff;
}

body {
  display: grid;
  place-items: center;
  font-family: Arial, sans-serif;
  transition: background 0.2s ease;
}

.demo-shell {
  width: 240px;
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 18px;
  background: white;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
}

#toggle {
  border: 0;
  border-radius: 999px;
  padding: 10px 14px;
  color: white;
  background: #2563eb;
  cursor: pointer;
}

#status[data-open="true"] {
  color: #166534;
  font-weight: 700;
}

#mirror {
  margin: 0;
  color: #7c2d12;
  font-weight: 600;
}`;

const JS_CODE = `const button = document.getElementById("toggle");
const status = document.getElementById("status");
const input = document.getElementById("name-input");
const mirror = document.getElementById("mirror");

button?.addEventListener("click", () => {
  if (!status) return;
  const nextOpen = status.dataset.open !== "true";
  status.dataset.open = nextOpen ? "true" : "false";
  status.textContent = nextOpen ? "Open" : "Closed";
  document.body.style.background = nextOpen ? "#fef3c7" : "#eef2ff";
});

input?.addEventListener("input", () => {
  if (!mirror || !input) return;
  mirror.textContent = input.value.trim() || "Anonymous";
});`;

function creatorStarterLevel() {
  return {
    name: "Playwright Interaction Template",
    scenarios: [
      {
        scenarioId: SCENARIO_ID,
        accuracy: 0,
        dimensions: { width: 320, height: 260 },
        js: "",
      },
    ],
    buildingBlocks: { pictures: [], colors: [] },
    code: { html: HTML_CODE, css: CSS_CODE, js: JS_CODE },
    solution: { html: "", css: "", js: "" },
    accuracy: 0,
    week: "playwright-interaction",
    percentageTreshold: 70,
    percentageFullPointsTreshold: 95,
    difficulty: "easy",
    instructions: [],
    question_and_answer: { question: "", answer: "" },
    help: { description: "Interaction smoke test", images: [], usefullCSSProperties: [] },
    timeData: { startTime: 0, pointAndTime: { 0: "0:0" } },
    eventSequence: { byScenarioId: {} },
    events: [],
    interactionArtifacts: { byScenarioId: {} },
    interactive: true,
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

async function signInDevUser(page, username) {
  await page.goto(`${BASE_URL}/auth/signin`, { waitUntil: "networkidle" });
  const signInResult = await page.evaluate(async (nextUsername) => {
    const csrfResponse = await fetch("/api/auth/csrf", { credentials: "include" });
    const csrfPayload = await csrfResponse.json();
    const params = new URLSearchParams({
      csrfToken: csrfPayload.csrfToken,
      username: nextUsername,
      callbackUrl: "/",
      json: "true",
    });
    const response = await fetch("/api/auth/callback/dev-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      credentials: "include",
    });
    return {
      ok: response.ok,
      status: response.status,
      text: await response.text(),
    };
  }, username.trim().toLowerCase());

  if (!signInResult.ok) {
    throw new Error(`Local dev sign-in failed: ${signInResult.status} ${signInResult.text}`);
  }

  await expect.poll(async () => {
    return page.evaluate(async () => {
      const response = await fetch("/api/auth/session", { credentials: "include" });
      const session = await response.json();
      return Boolean(session?.user?.email);
    });
  }, {
    timeout: TIMEOUT_MS,
    message: "Expected local dev sign-in session to become authenticated",
  }).toBe(true);
}

async function createGameWithLevel(request) {
  const gameResponse = await request.post(`${BASE_URL}/api/games`, {
    data: { title: `Playwright Interaction Smoke ${Date.now()}` },
  });
  if (!gameResponse.ok()) {
    throw new Error(`Failed to create game: ${gameResponse.status()} ${await gameResponse.text()}`);
  }
  const game = await gameResponse.json();

  const patchResponse = await request.patch(`${BASE_URL}/api/games/${game.id}`, {
    data: {
      collaborationMode: "individual",
      isPublic: true,
      drawboardCaptureMode: "browser",
      manualDrawboardCapture: false,
    },
  });
  if (!patchResponse.ok()) {
    throw new Error(`Failed to configure game: ${patchResponse.status()} ${await patchResponse.text()}`);
  }

  const levelResponse = await request.post(`${BASE_URL}/api/levels`, {
    data: creatorStarterLevel(),
  });
  if (!levelResponse.ok()) {
    throw new Error(`Failed to create level: ${levelResponse.status()} ${await levelResponse.text()}`);
  }
  const level = await levelResponse.json();

  const attachResponse = await request.post(`${BASE_URL}/api/maps/levels/${encodeURIComponent(game.mapName)}`, {
    data: { levels: [level.identifier] },
  });
  if (!attachResponse.ok()) {
    throw new Error(`Failed to attach level to map: ${attachResponse.status()} ${await attachResponse.text()}`);
  }

  return { game, level };
}

async function waitForEditor(page) {
  try {
    await page.locator(".cm-content[contenteditable='true']").first().waitFor({ timeout: TIMEOUT_MS });
  } catch (error) {
    const url = page.url();
    const bodyText = ((await page.locator("body").textContent().catch(() => "")) || "").slice(0, 800);
    throw new Error(`Editor did not become ready at ${url}. Body snapshot: ${JSON.stringify(bodyText)}`, {
      cause: error,
    });
  }
}

async function findVisibleDrawboardFrame(page) {
  const iframe = page.locator('iframe[src*="name=drawingUrl"]:not([aria-hidden="true"])').first();
  await iframe.waitFor({ state: "visible", timeout: TIMEOUT_MS });
  const handle = await iframe.elementHandle();
  const frame = await handle?.contentFrame();
  if (!frame) {
    throw new Error("Could not find visible drawing iframe");
  }
  return frame;
}

async function ensureCreatorInteractivePreview(page) {
  const toggle = page.locator('button[aria-label="Switch to interactive"]:visible').first();
  if (await toggle.count()) {
    await toggle.evaluate((element) => {
      element.click();
    });
  }
}

async function startSequenceRecording(page) {
  const startButton = page.locator('button:has-text("Start recording"):visible').first();
  await startButton.waitFor({ state: "visible", timeout: TIMEOUT_MS });
  await startButton.evaluate((element) => {
    element.click();
  });
  await expect(page.locator('button:has-text("Stop recording"):visible').first()).toBeVisible({ timeout: TIMEOUT_MS });
  await page.waitForTimeout(500);
}

async function stopSequenceRecording(page) {
  const stopButton = page.locator('button:has-text("Stop recording"):visible').first();
  await stopButton.waitFor({ state: "visible", timeout: TIMEOUT_MS });
  await stopButton.evaluate((element) => {
    element.click();
  });
  await expect(page.locator('button:has-text("Start recording"):visible').first()).toBeVisible({ timeout: TIMEOUT_MS });
  await page.waitForTimeout(300);
}

async function interactWithDrawboard(frame, nameValue) {
  const toggled = await frame.evaluate(() => {
    const button = document.getElementById("toggle");
    if (!(button instanceof HTMLButtonElement)) {
      return false;
    }
    button.click();
    return true;
  });
  if (!toggled) {
    throw new Error("Could not trigger toggle interaction inside drawboard");
  }
  try {
    await expect(frame.locator("#status")).toHaveText("Open", { timeout: TIMEOUT_MS });
  } catch (error) {
    const debugState = await frame.evaluate(() => {
      const status = document.getElementById("status");
      const overlay = document.querySelector('[role="alert"]');
      const userScript = document.querySelector('script[data-user="true"]');
      return {
        statusText: status?.textContent || null,
        statusDataOpen: status?.getAttribute("data-open") || null,
        hasErrorOverlay: Boolean(overlay),
        overlayText: overlay?.textContent || null,
        hasUserScript: Boolean(userScript),
        bodyText: document.body.innerText.slice(0, 600),
      };
    });
    throw new Error(`Toggle interaction did not update drawboard state: ${JSON.stringify(debugState)}`, {
      cause: error,
    });
  }
  await frame.waitForTimeout(500);

  const filled = await frame.evaluate((nextValue) => {
    const input = document.getElementById("name-input");
    if (!(input instanceof HTMLInputElement)) {
      return false;
    }
    input.focus();
    input.value = nextValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }, nameValue);
  if (!filled) {
    throw new Error("Could not trigger input interaction inside drawboard");
  }
  await expect(frame.locator("#mirror")).toHaveText(nameValue, { timeout: TIMEOUT_MS });
  await frame.waitForTimeout(500);
}

async function persistCreatorInteractions(page, request, levelIdentifier, expectedCount) {
  const inlineSave = page.getByRole("button", { name: /^Save$/ }).first();
  const hasInlineSave = await inlineSave.count();

  if (hasInlineSave) {
    const waitForSave = page.waitForResponse((response) => {
      return response.url().includes(`/api/levels/${levelIdentifier}`) && response.request().method() === "PUT";
    }, { timeout: 5000 }).then(() => true).catch(() => false);

    await inlineSave.click();

    const didSave = await waitForSave;
    if (didSave) {
      return;
    }
  }

  await expect.poll(async () => {
    const level = await fetchLevel(request, levelIdentifier);
    return level.eventSequence?.byScenarioId?.[SCENARIO_ID]?.length || 0;
  }, {
    timeout: TIMEOUT_MS,
    message: `Expected ${expectedCount} event sequence steps to persist after creator interactions`,
  }).toBe(expectedCount);
}

async function fetchLevel(request, levelIdentifier) {
  const response = await request.get(`${BASE_URL}/api/levels/${levelIdentifier}`);
  if (!response.ok()) {
    throw new Error(`Failed to fetch level ${levelIdentifier}: ${response.status()} ${await response.text()}`);
  }
  return response.json();
}

async function waitForVerifiedInteractions(request, levelIdentifier, expectedCount) {
  await expect.poll(async () => {
    const level = await fetchLevel(request, levelIdentifier);
    return level.eventSequence?.byScenarioId?.[SCENARIO_ID]?.length || 0;
  }, {
    timeout: TIMEOUT_MS,
    message: `Expected ${expectedCount} event sequence steps to persist`,
  }).toBe(expectedCount);
}

async function assertCreatorPersistence(request, levelIdentifier) {
  const level = await fetchLevel(request, levelIdentifier);
  const steps = level.eventSequence?.byScenarioId?.[SCENARIO_ID] || [];

  expect(steps).toHaveLength(2);
  expect(steps.map((entry) => entry.eventType)).toEqual(["click", "input"]);
  expect(steps.every((entry) => entry.snapshot?.snapshotHtml && entry.snapshot?.css !== undefined)).toBeTruthy();
  expect(steps.every((entry) => entry.instruction && entry.label)).toBeTruthy();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();

  try {
    await signInDevUser(page, DEV_USERNAME);
    console.log("signed in dev user");
    const { game, level } = await createGameWithLevel(context.request);
    console.log("created game and level", { gameId: game.id, levelIdentifier: level.identifier });

    await page.goto(`${BASE_URL}/creator/${game.id}`, { waitUntil: "domcontentloaded" });
    await waitForEditor(page);
    console.log("creator page ready");

    await ensureCreatorInteractivePreview(page);
    await startSequenceRecording(page);
    console.log("event sequence recording started");

    const creatorFrame = await findVisibleDrawboardFrame(page);
    await interactWithDrawboard(creatorFrame, "Creator event");
    await page.waitForTimeout(1400);
    await stopSequenceRecording(page);
    console.log("creator interactions executed");

    await persistCreatorInteractions(page, context.request, level.identifier, 2);
    console.log("creator interactions persisted");
    await waitForVerifiedInteractions(context.request, level.identifier, 2);
    console.log("verified interactions persisted");
    await assertCreatorPersistence(context.request, level.identifier);
    console.log("creator persistence asserted");

    const persistedBeforeGame = await fetchLevel(context.request, level.identifier);
    const persistedCountBeforeGame =
      persistedBeforeGame.eventSequence?.byScenarioId?.[SCENARIO_ID]?.length || 0;

    await page.goto(`${BASE_URL}/game/${game.id}?mode=game`, { waitUntil: "domcontentloaded" });
    await waitForEditor(page);
    console.log("game page ready");

    const gameFrame = await findVisibleDrawboardFrame(page);
    await interactWithDrawboard(gameFrame, "Player event");
    console.log("game interactions executed");

    const persistedAfterGame = await fetchLevel(context.request, level.identifier);
    const persistedCountAfterGame =
      persistedAfterGame.eventSequence?.byScenarioId?.[SCENARIO_ID]?.length || 0;
    expect(persistedCountAfterGame).toBe(persistedCountBeforeGame);

    console.log("Playwright interaction events smoke test passed.", {
      gameId: game.id,
      levelIdentifier: level.identifier,
      verifiedInteractions: persistedCountAfterGame,
    });
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("Playwright interaction events smoke test failed.", error);
  process.exitCode = 1;
});
