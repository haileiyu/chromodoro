const sizes = [16, 32, 48, 128];
const activeIcon = { path: Object.fromEntries(sizes.map(size => [size, `icons/icon${size}.png`])) };
let grayscaleIcon;

// Render the existing artwork in gray, preserving its shape and transparency.
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
        const gray = Math.round(0.2126 * pixels.data[i] + 0.7152 * pixels.data[i + 1] + 0.0722 * pixels.data[i + 2]);
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
