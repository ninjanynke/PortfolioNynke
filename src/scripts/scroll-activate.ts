// Where there is no hover (touch screens) or the window is narrow, the
// element crossing the middle of the screen becomes active instead: a
// zero-height line at 50% of the viewport, so elements light up one row at a
// time. They only light up while the visitor is scrolling: nothing is active
// on page load, and the active row goes back to rest after IDLE_MS without
// scrolling. Scrolling again (either way) lights up the middle row again.
// Style the active look with `.is-active`.
const IDLE_MS = 2000;
const scrollMode = window.matchMedia('(hover: none), (max-width: 767px)');

export function scrollActivate(selector: string) {
  const elements = document.querySelectorAll(selector);
  if (elements.length === 0) return;

  const inMiddle = new Set<Element>();
  let scrolling = false;
  let idleTimer: number | undefined;

  const update = () => {
    const on = scrollMode.matches && scrolling;
    elements.forEach((el) => el.classList.toggle('is-active', on && inMiddle.has(el)));
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) inMiddle.add(entry.target);
        else inMiddle.delete(entry.target);
      }
      update();
    },
    { rootMargin: '-50% 0px -50% 0px' },
  );
  elements.forEach((el) => observer.observe(el));

  window.addEventListener(
    'scroll',
    () => {
      if (!scrolling) {
        scrolling = true;
        update();
      }
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        scrolling = false;
        update();
      }, IDLE_MS);
    },
    { passive: true },
  );
  scrollMode.addEventListener('change', update);
}
