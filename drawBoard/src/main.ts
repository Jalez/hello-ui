import { createDrawboardSnapshot, setStyles } from "./utils";

type ErrorObj = {
  message: string;
  lineno?: number;
  colno?: number;
};

type DrawboardPayload = {
  name?: string;
  message?: string;
  html?: string;
  css?: string;
  js?: string;
  events?: string | string[];
  interactive?: boolean;
};

const params = new URLSearchParams(window.location.search);
const urlName = params.get("name") || "";
const scenarioId = params.get("scenarioId") || "";
const scenarioWidth = parseInt(params.get("width") || "0", 10);
const scenarioHeight = parseInt(params.get("height") || "0", 10);

document.documentElement.style.width = scenarioWidth ? `${scenarioWidth}px` : "100%";
document.documentElement.style.height = scenarioHeight ? `${scenarioHeight}px` : "100%";
document.body.style.position = "relative";

let errorOverlay: HTMLDivElement | null = null;
let dataReceived = false;
let stylesCorrect = false;
let jsCorrect = false;
let interactive = false;
let events: string[] = [];
let mountedIntervalId: number | null = null;
let renderReadyTimeoutId: number | null = null;
let captureListener: (() => void) | null = null;
let currentScript: HTMLScriptElement | null = null;
let currentScriptUrl: string | null = null;

function updateInteractiveFlag() {
  document.body.dataset.interactive = interactive ? "true" : "false";
}

function clearRenderReadyTimeout() {
  if (renderReadyTimeoutId !== null) {
    window.clearTimeout(renderReadyTimeoutId);
    renderReadyTimeoutId = null;
  }
}

function startMountedPing() {
  if (mountedIntervalId !== null) {
    return;
  }

  window.parent.postMessage("mounted", "*");
  mountedIntervalId = window.setInterval(() => {
    window.parent.postMessage("mounted", "*");
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

function syncEventListeners() {
  if (captureListener) {
    events.forEach((eventName) => {
      document.body.removeEventListener(eventName, captureListener!);
    });
  }

  captureListener = () => {
    try {
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
      console.error("Drawboard: Failed to create event snapshot", snapshotError);
    }
  };

  events.forEach((eventName) => {
    document.body.addEventListener(eventName, captureListener!);
  });
}

function scheduleRenderReady() {
  clearRenderReadyTimeout();
  if (!stylesCorrect || !jsCorrect || errorOverlay) {
    return;
  }

  renderReadyTimeoutId = window.setTimeout(() => {
    try {
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
    } catch (snapshotError) {
      console.error("Drawboard: Failed to create snapshot", snapshotError);
    }
  }, 50);
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
  clearUserScript();
  hideError();
  document.body.innerHTML = "";
  setStyles("");
  stylesCorrect = false;
  jsCorrect = false;
  interactive = false;
  events = [];
  dataReceived = false;
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

  dataReceived = true;
  stopMountedPing();
  hideError();

  const nextHtml = event.data?.html || "";
  const nextCss = event.data?.css || "";
  const nextJs = event.data?.js || "";
  interactive = Boolean(event.data?.interactive);
  events = parseEvents(event.data?.events);
  updateInteractiveFlag();
  syncEventListeners();

  applyHtml(nextHtml);
  applyCss(nextCss);
  applyJs(nextJs);
  scheduleRenderReady();
});

if (!dataReceived) {
  startMountedPing();
}
