/** Where the visitor's light/dark choice is remembered. */
export const THEME_STORAGE_KEY = "tl-theme";

/**
 * Runs in <head> before first paint: marks JS as available (so GSAP-revealed content starts hidden
 * instead of flashing) and applies the saved theme, else the OS preference — no wrong-theme flash.
 */
export const HEAD_INIT_SCRIPT =
  "document.documentElement.classList.add('js');" +
  "try{var t=localStorage.getItem('" + THEME_STORAGE_KEY + "');" +
  "if(t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}";
