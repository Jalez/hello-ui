import { domToPng } from "modern-screenshot";
import { createDrawboardSnapshot, getPixelData, loadImage, setStyles } from "./utils";

type ErrorObj = {
  message: string;
  lineno?: number;
  colno?: number;
};

type DrawboardPayload = {
  name?: string;
  message?: string;
  scenarioId?: string;
  html?: string;
  css?: string;
  js?: string;
  events?: string | string[];
  interactive?: boolean;
  isCreator?: boolean;
};

const params = new URLSearchParams(window.location.search);
const urlName = params.get("name") || "";
const scenarioId = params.get("scenarioId") || "";
const scenarioWidth = parseInt(params.get("width") || "0", 10);
const scenarioHeight = parseInt(params.get("height") || "0", 10);
const captureMode = params.get("captureMode") || "playwright";
const isBrowserCapture = captureMode === "browser";
const manualRaw = (params.get("manualCapture") || "").trim().toLowerCase();
/** When true, `scheduleRenderReady` does not capture; parent sends `request-capture`. Level `events` still trigger capture. */
const isManualCapture = manualRaw === "true" || manualRaw === "1";

/** Playwright iframe waits before posting `render-ready` so DOM/fonts can settle. */
const PLAYWRIGHT_RENDER_READY_DELAY_MS = 80;
/** Second pass: fonts/layout often match server screenshot only after a short delay. */
const PLAYWRIGHT_LAYOUT_FOLLOW_UP_MS = 400;

/** Scenario box on both roots — mirrors Playwright `buildRenderHtml` (drawboard-base-shell covers margin/padding/overflow/bg/position). */
function applyScenarioDocumentBox() {
  const w = scenarioWidth ? `${scenarioWidth}px` : "100%";
  const h = scenarioHeight ? `${scenarioHeight}px` : "100%";
  document.documentElement.style.width = w;
  document.documentElement.style.height = h;
  document.body.style.width = w;
  document.body.style.height = h;
}

applyScenarioDocumentBox();

let errorOverlay: HTMLDivElement | null = null;
let dataReceived = false;
let stylesCorrect = false;
let jsCorrect = false;
let interactive = false;
let events: string[] = [];
let mountedIntervalId: number | null = null;
let renderReadyTimeoutId: number | null = null;
/** Playwright: second `render-ready` after layout/fonts settle (dedup window allows it through). */
let playwrightLayoutFollowUpId: number | null = null;
let captureListener: (() => void) | null = null;
let currentScript: HTMLScriptElement | null = null;
let currentScriptUrl: string | null = null;
let isCreatorFromParent = false;
/**
 * Manual capture: one automatic capture when this iframe document first becomes ready.
 * Parent `reload` calls resetState() on every editor change — we must NOT reset this flag there,
 * or every keystroke would re-trigger auto capture.
 */
let manualModeBootstrapCapturePending = true;

function updateInteractiveFlag() {
  document.body.dataset.interactive = interactive ? "true" : "false";
}

function clearRenderReadyTimeout() {
  if (renderReadyTimeoutId !== null) {
    window.clearTimeout(renderReadyTimeoutId);
    renderReadyTimeoutId = null;
  }
}

function clearPlaywrightLayoutFollowUp() {
  if (playwrightLayoutFollowUpId !== null) {
    window.clearTimeout(playwrightLayoutFollowUpId);
    playwrightLayoutFollowUpId = null;
  }
}

function postMountedPing() {
  window.parent.postMessage(
    { message: "mounted", name: urlName, scenarioId },
    "*",
  );
}

function startMountedPing() {
  if (mountedIntervalId !== null) {
    return;
  }

  postMountedPing();
  mountedIntervalId = window.setInterval(() => {
    postMountedPing();
  }, 200);
}

function stopMountedPing() {
  if (mountedIntervalId !== null) {
    window.clearInterval(mountedIntervalId);
    mountedIntervalId = null;
  }
}

function clearUserScript() {
  if (currentScript) {
    currentScript.remove();
    currentScript = null;
  }
  if (currentScriptUrl) {
    URL.revokeObjectURL(currentScriptUrl);
    currentScriptUrl = null;
  }
}

function hideError() {
  if (errorOverlay) {
    errorOverlay.remove();
    errorOverlay = null;
  }
}

function showError(error: ErrorObj) {
  if (!errorOverlay) {
    errorOverlay = document.createElement("div");
    errorOverlay.setAttribute("role", "alert");
    errorOverlay.dataset.drawboardUi = "true";
    Object.assign(errorOverlay.style, {
      position: "absolute",
      top: "0",
      left: "0",
      right: "0",
      bottom: "0",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column",
      backgroundColor: "rgba(255, 0, 0, 0.5)",
      color: "white",
      zIndex: "9999",
    });
    document.body.appendChild(errorOverlay);
  }

  errorOverlay.innerHTML = "";

  const title = document.createElement("h2");
  title.textContent = "Oops! Something went wrong :(";
  Object.assign(title.style, {
    color: "white",
    fontSize: "1.5rem",
    fontWeight: "bold",
    marginBottom: "1rem",
  });

  const message = document.createElement("pre");
  message.textContent = error.message;
  Object.assign(message.style, {
    color: "white",
    fontSize: "1rem",
    whiteSpace: "pre-wrap",
    textAlign: "center",
    fontWeight: "bold",
  });

  errorOverlay.appendChild(title);
  errorOverlay.appendChild(message);

  if (error.lineno && error.colno) {
    const location = document.createElement("pre");
    location.textContent = `Line number: ${error.lineno}, column number: ${error.colno}`;
    errorOverlay.appendChild(location);
  }
}

function runCaptureNow() {
  void (async () => {
    try {
      if (isBrowserCapture) {
        void captureBrowser();
        return;
      }
      await waitForPaintAfterCss();
      const snapshot = createDrawboardSnapshot();
      window.parent.postMessage(
        {
          ...snapshot,
          message: "capture-request",
          name: urlName,
          scenarioId,
        },
        "*",
      );
    } catch (snapshotError) {
      console.error("Drawboard: Failed to create snapshot", snapshotError);
    }
  })();
}

function syncEventListeners() {
  if (captureListener) {
    events.forEach((eventName) => {
      document.body.removeEventListener(eventName, captureListener!);
    });
  }

  captureListener = () => {
    runCaptureNow();
  };

  events.forEach((eventName) => {
    document.body.addEventListener(eventName, captureListener!);
  });
}

/**
 * Browser: cap font wait (domToPng path should stay snappy).
 * Playwright: full `document.fonts.ready` + extra rAF so cloned HTML/CSS matches final layout;
 * otherwise solution vs drawing iframes often finish on different font epochs until “interactive”.
 */
async function waitForPaintAfterCss() {
  const settleFonts = async () => {
    if (!document.fonts?.ready) {
      return;
    }
    try {
      if (isBrowserCapture) {
        await Promise.race([
          document.fonts.ready,
          new Promise<void>((r) => setTimeout(r, 32)),
        ]);
      } else {
        await document.fonts.ready;
      }
    } catch {
      /* ignore */
    }
  };

  await settleFonts();
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  if (!isBrowserCapture) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await settleFonts();
    await new Promise<void>((r) => setTimeout(r, 56));
  }
}

async function captureBrowser() {
  if (!stylesCorrect || !jsCorrect || errorOverlay) {
    return;
  }
  const w = scenarioWidth || 300;
  const h = scenarioHeight || 300;
  try {
    await waitForPaintAfterCss();
    // Capture `<html>` so author rules on `html` (background, full-height, etc.)
    // are included; `document.body` alone often misses that painting layer.
    const dataUrl = await domToPng(document.documentElement, {
      width: w,
      height: h,
      scale: 2,
      maximumCanvasSize: 8192,
    });
    const img = await loadImage(dataUrl);
    const imageData = getPixelData(img, w, h);
    if (!imageData) {
      return;
    }
    const bytes = new Uint8Array(imageData.data.length);
    bytes.set(imageData.data);
    window.parent.postMessage(
      {
        message: "pixels",
        dataURL: bytes.buffer,
        urlName,
        scenarioId,
        width: w,
        height: h,
      },
      "*",
      [bytes.buffer],
    );
    // Match Playwright: always send PNG for both boards so Redux `drawingUrl` / `solutionUrl`
    // update in game mode (domToPng path used to omit drawing for non-creator only).
    const includeDataUrl = urlName === "solutionUrl" || urlName === "drawingUrl";
    if (includeDataUrl) {
      window.parent.postMessage({ dataURL: dataUrl, urlName, scenarioId, message: "data" }, "*");
    }
  } catch (error) {
    console.error("Drawboard: browser capture failed", error);
  }
}

function scheduleRenderReady() {
  clearRenderReadyTimeout();
  clearPlaywrightLayoutFollowUp();
  if (!stylesCorrect || !jsCorrect || errorOverlay) {
    return;
  }

  /**
   * Browser: `setTimeout(0)` — like the old React `useEffect` after commit (no fixed 50ms sleep).
   * Playwright: delay so the DOM settles before we clone HTML/CSS for the parent API.
   */
  const delayMs = isBrowserCapture ? 0 : PLAYWRIGHT_RENDER_READY_DELAY_MS;

  renderReadyTimeoutId = window.setTimeout(() => {
    void (async () => {
      if (isManualCapture && !manualModeBootstrapCapturePending) {
        return;
      }
      if (isBrowserCapture) {
        try {
          await captureBrowser();
          if (isManualCapture) {
            manualModeBootstrapCapturePending = false;
          }
        } catch (browserCaptureError) {
          console.error("Drawboard: Browser capture failed", browserCaptureError);
        }
        return;
      }
      try {
        await waitForPaintAfterCss();
        const snapshot = createDrawboardSnapshot();
        window.parent.postMessage(
          {
            ...snapshot,
            message: "render-ready",
            name: urlName,
            scenarioId,
          },
          "*",
        );
        if (isManualCapture) {
          manualModeBootstrapCapturePending = false;
        }
      } catch (playwrightSnapshotError) {
        console.error("Drawboard: Failed to create snapshot", playwrightSnapshotError);
      }

      if (!isManualCapture) {
        clearPlaywrightLayoutFollowUp();
        playwrightLayoutFollowUpId = window.setTimeout(() => {
          playwrightLayoutFollowUpId = null;
          if (!stylesCorrect || !jsCorrect || errorOverlay) {
            return;
          }
          void (async () => {
            try {
              await waitForPaintAfterCss();
              const followSnapshot = createDrawboardSnapshot();
              window.parent.postMessage(
                {
                  ...followSnapshot,
                  message: "render-ready",
                  name: urlName,
                  scenarioId,
                },
                "*",
              );
            } catch (snapshotError) {
              console.error("Drawboard: Failed layout follow-up snapshot", snapshotError);
            }
          })();
        }, PLAYWRIGHT_LAYOUT_FOLLOW_UP_MS);
      }
    })();
  }, delayMs);
}

function applyHtml(html: string) {
  document.body.innerHTML = html;
}

function applyCss(css: string) {
  try {
    setStyles(css);
    stylesCorrect = true;
  } catch {
    stylesCorrect = false;
  }
}

function applyJs(js: string) {
  clearUserScript();

  if (!js.trim()) {
    jsCorrect = true;
    scheduleRenderReady();
    return;
  }

  jsCorrect = false;
  const blob = new Blob([`{ ${js} \n }`], { type: "text/javascript" });
  const scriptUrl = URL.createObjectURL(blob);
  const script = document.createElement("script");
  script.dataset.user = "true";
  script.src = scriptUrl;
  script.onload = () => {
    jsCorrect = true;
    scheduleRenderReady();
  };
  script.onerror = () => {
    showError({ message: "Failed to execute scenario JavaScript" });
  };

  currentScript = script;
  currentScriptUrl = scriptUrl;
  document.body.appendChild(script);
}

function resetState() {
  clearRenderReadyTimeout();
  clearPlaywrightLayoutFollowUp();
  clearUserScript();
  hideError();
  document.body.innerHTML = "";
  setStyles("");
  applyScenarioDocumentBox();
  stylesCorrect = false;
  jsCorrect = false;
  interactive = false;
  events = [];
  dataReceived = false;
  isCreatorFromParent = false;
  updateInteractiveFlag();
  syncEventListeners();
  startMountedPing();
}

function parseEvents(rawEvents: string | string[] | undefined): string[] {
  if (!rawEvents) {
    return [];
  }
  if (Array.isArray(rawEvents)) {
    return rawEvents;
  }
  try {
    const parsed = JSON.parse(rawEvents);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

window.onerror = (message, _source, lineno, colno) => {
  showError({
    message: message.toString(),
    lineno: lineno || 0,
    colno: colno || 0,
  });
  return true;
};

window.addEventListener("message", (event: MessageEvent<DrawboardPayload>) => {
  if (urlName !== event.data?.name) {
    return;
  }

  if (event.data?.message === "reload") {
    resetState();
    return;
  }

  if (event.data?.message === "options-patch") {
    if (event.data.name !== urlName) {
      return;
    }
    if (event.data.scenarioId !== undefined && event.data.scenarioId !== scenarioId) {
      return;
    }
    interactive = Boolean(event.data.interactive);
    isCreatorFromParent = Boolean(event.data.isCreator);
    updateInteractiveFlag();
    syncEventListeners();
    if (stylesCorrect && jsCorrect && !errorOverlay) {
      scheduleRenderReady();
    }
    return;
  }

  if (event.data?.message === "request-capture") {
    if (event.data.scenarioId !== undefined && event.data.scenarioId !== scenarioId) {
      return;
    }
    runCaptureNow();
    return;
  }

  dataReceived = true;
  stopMountedPing();
  hideError();

  const nextHtml = event.data?.html || "";
  const nextCss = event.data?.css || "";
  const nextJs = event.data?.js || "";
  interactive = Boolean(event.data?.interactive);
  isCreatorFromParent = Boolean(event.data?.isCreator);
  events = parseEvents(event.data?.events);
  updateInteractiveFlag();
  syncEventListeners();

  applyHtml(nextHtml);
  applyCss(nextCss);
  applyJs(nextJs);
});

if (!dataReceived) {
  startMountedPing();
}
