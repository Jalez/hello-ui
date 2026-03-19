export const getPixelData = (
  img = new Image(),
  width: number,
  height: number
) => {
  const canvas = document.createElement("canvas");
  // Set the width and height of the canvas to the width and height that are passed in
  canvas.width = width;
  canvas.height = height;
  // Get the 2D context of the canvas
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Keep pixel comparisons deterministic when source and target sizes differ.
    ctx.imageSmoothingEnabled = false;
    // Draw and scale to the exact scenario dimensions.
    ctx.drawImage(img, 0, 0, width, height);
  }
  // Get the image data from the canvas
  const imgData = ctx?.getImageData(0, 0, width, height) as ImageData;
  canvas.width = 0;
  canvas.height = 0;
  // Resolve the promise with the image data
  return imgData;
};
