const sizes = [16, 32, 48, 128];

const icons = Object.freeze({
  active: { path: Object.fromEntries(sizes.map(size => [size, `icons/icon${size}.png`])) },
  idle: { path: Object.fromEntries(sizes.map(size => [size, `icons/idle${size}.png`])) }
});

export function toolbarIcon(grayscale) {
  return grayscale ? icons.idle : icons.active;
}
