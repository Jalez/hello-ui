export const getPixelData = (
  img = new Image(),
  targetWidth?: number,
  targetHeight?: number
) => {
  const canvas = document.createElement("canvas");
  const width = targetWidth || img.width;
  const height = targetHeight || img.height;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Keep comparisons stable when capture is downsampled to scenario size.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, width, height);
  }
  const imgData = ctx?.getImageData(0, 0, width, height);
  // Release GPU surface immediately (critical for Firefox)
  canvas.width = 0;
  canvas.height = 0;
  return imgData;
};

export function loadImage(base64Url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = base64Url;
  });
}

export const sendToParent = (
  dataURL: string,
  urlName: string,
  scenarioId: string,
  message?: string | "data"
) => {
  window.parent.postMessage({ dataURL, urlName, scenarioId, message }, "*");
};

export const setStyles = (css: string) => {
  const style = document.getElementById("user-styles") as HTMLStyleElement;
  if (style) {
    style.innerHTML = css || "";
  }
};
