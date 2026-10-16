// A classic script in each page's <head>, so the theme is set before the first paint
// and a dark page never flashes white. The choice is per device: localStorage is shared
// by every page of this extension, and its storage event keeps open tabs in step.
(() => {
  const media = matchMedia('(prefers-color-scheme: dark)');
  const read = () => {
    try {
      const value = localStorage.getItem('theme');
      return value === 'light' || value === 'dark' ? value : 'system';
    } catch { return 'system'; }
  };
  let choice = read();
  const apply = () => {
    document.documentElement.dataset.theme = choice === 'system' ? (media.matches ? 'dark' : 'light') : choice;
  };
  window.theme = {
    get: () => choice,
    set(value) {
      choice = value === 'light' || value === 'dark' ? value : 'system';
      // If storage is blocked the choice still holds for this page.
      try {
        if (choice === 'system') localStorage.removeItem('theme');
        else localStorage.setItem('theme', choice);
      } catch {}
      apply();
    }
  };
  media.addEventListener('change', apply);
  addEventListener('storage', event => {
    if (event.key !== 'theme' && event.key !== null) return;
    choice = read();
    apply();
  });
  apply();
})();
