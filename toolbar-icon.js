const sizes = [16, 32, 48, 128];
const activeIcon = { path: Object.fromEntries(sizes.map(size => [size, `icons/icon${size}.png`])) };
let grayscaleIcon;

// Match the light gray of other inactive toolbar icons while keeping the leaf
// and highlights distinct. The tomato's original red is about 75 in luma.
// Cache the pixels for this worker's lifetime instead of redrawing on every tick.
export async function toolbarIcon(grayscale) {
  if (!grayscale) return activeIcon;
  if (!grayscaleIcon) {
    grayscaleIcon = Promise.all(sizes.map(async size => {
      const response = await fetch(chrome.runtime.getURL(`icons/icon${size}.png`));
      const bitmap = await createImageBitmap(await response.blob());
      const context = new OffscreenCanvas(size, size).getContext('2d');
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      const pixels = context.getImageData(0, 0, size, size);
      for (let i = 0; i < pixels.data.length; i += 4) {
        const red = pixels.data[i];
        const green = pixels.data[i + 1];
        const blue = pixels.data[i + 2];
        const luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
        const gray = Math.min(255, Math.round(194 + (luma - 75) * 0.3 - Math.max(0, green - red) * 0.7));
        pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = gray;
      }
      return [size, pixels];
    })).then(entries => ({ imageData: Object.fromEntries(entries) })).catch(error => {
      grayscaleIcon = undefined;
      throw error;
    });
  }
  return grayscaleIcon;
}
