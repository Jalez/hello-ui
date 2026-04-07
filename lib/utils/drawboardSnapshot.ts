export interface DrawboardSnapshot {
  css: string;
  snapshotHtml: string;
}

function syncFormControlState(sourceRoot: HTMLElement, snapshotRoot: HTMLElement) {
  const sourceInputs = sourceRoot.querySelectorAll("input");
  const snapshotInputs = snapshotRoot.querySelectorAll("input");
  sourceInputs.forEach((sourceInput, index) => {
    const snapshotInput = snapshotInputs[index];
    if (!snapshotInput) {
      return;
    }

    const inputType = sourceInput.type;
    if (inputType === "checkbox" || inputType === "radio") {
      if (sourceInput.checked) {
        snapshotInput.setAttribute("checked", "");
      } else {
        snapshotInput.removeAttribute("checked");
      }
      return;
    }

    snapshotInput.setAttribute("value", sourceInput.value);
  });

  const sourceTextareas = sourceRoot.querySelectorAll("textarea");
  const snapshotTextareas = snapshotRoot.querySelectorAll("textarea");
  sourceTextareas.forEach((sourceTextarea, index) => {
    const snapshotTextarea = snapshotTextareas[index];
    if (!snapshotTextarea) {
      return;
    }
    snapshotTextarea.textContent = sourceTextarea.value;
  });

  const sourceSelects = sourceRoot.querySelectorAll("select");
  const snapshotSelects = snapshotRoot.querySelectorAll("select");
  sourceSelects.forEach((sourceSelect, index) => {
    const snapshotSelect = snapshotSelects[index];
    if (!snapshotSelect) {
      return;
    }

    const sourceOptions = sourceSelect.querySelectorAll("option");
    const snapshotOptions = snapshotSelect.querySelectorAll("option");
    sourceOptions.forEach((sourceOption, optionIndex) => {
      const snapshotOption = snapshotOptions[optionIndex];
      if (!snapshotOption) {
        return;
      }

      if (sourceOption.selected) {
        snapshotOption.setAttribute("selected", "");
      } else {
        snapshotOption.removeAttribute("selected");
      }
    });
  });

  const sourceDetails = sourceRoot.querySelectorAll("details");
  const snapshotDetails = snapshotRoot.querySelectorAll("details");
  sourceDetails.forEach((sourceDetailsElement, index) => {
    const snapshotDetailsElement = snapshotDetails[index];
    if (!snapshotDetailsElement) {
      return;
    }

    if (sourceDetailsElement.open) {
      snapshotDetailsElement.setAttribute("open", "");
    } else {
      snapshotDetailsElement.removeAttribute("open");
    }
  });
}

function replaceCanvasWithImages(sourceRoot: HTMLElement, snapshotRoot: HTMLElement) {
  const sourceCanvases = sourceRoot.querySelectorAll("canvas");
  const snapshotCanvases = snapshotRoot.querySelectorAll("canvas");
  sourceCanvases.forEach((sourceCanvas, index) => {
    const snapshotCanvas = snapshotCanvases[index];
    if (!snapshotCanvas) {
      return;
    }

    try {
      const dataUrl = sourceCanvas.toDataURL();
      const image = snapshotCanvas.ownerDocument.createElement("img");
      image.src = dataUrl;
      image.width = sourceCanvas.width;
      image.height = sourceCanvas.height;
      image.style.width = sourceCanvas.style.width || `${sourceCanvas.width}px`;
      image.style.height = sourceCanvas.style.height || `${sourceCanvas.height}px`;
      image.style.display = "block";
      snapshotCanvas.replaceWith(image);
    } catch {
      // Ignore tainted or otherwise unreadable canvases and keep the canvas node as-is.
    }
  });
}

export function snapshotDrawboardIframe(iframe: HTMLIFrameElement): DrawboardSnapshot {
  const doc = iframe.contentDocument;
  if (!doc) {
    throw new Error("Drawboard iframe document is unavailable");
  }

  const root = doc.getElementById("root");
  if (!(root instanceof HTMLElement)) {
    throw new Error("Drawboard iframe root element is unavailable");
  }

  const style = doc.getElementById("user-styles");
  const css =
    style instanceof HTMLStyleElement
      ? style.textContent || ""
      : Array.from(doc.querySelectorAll("style"))
          .map((styleTag) => styleTag.textContent || "")
          .join("\n");

  const snapshotRoot = root.cloneNode(true);
  if (!(snapshotRoot instanceof HTMLElement)) {
    throw new Error("Drawboard iframe root snapshot could not be created");
  }

  syncFormControlState(root, snapshotRoot);
  replaceCanvasWithImages(root, snapshotRoot);

  return {
    css,
    snapshotHtml: snapshotRoot.outerHTML,
  };
}

export function imageDataFromRawRgba(
  buffer: ArrayBuffer,
  width: number,
  height: number,
): ImageData {
  return new ImageData(new Uint8ClampedArray(buffer), width, height);
}

export function dataUrlFromRawRgba(
  buffer: ArrayBuffer | Uint8Array,
  width: number,
  height: number,
): string {
  const rgbaBuffer = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D context is unavailable");
  }

  const imageData = new ImageData(new Uint8ClampedArray(rgbaBuffer), width, height);
  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}
