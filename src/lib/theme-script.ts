/** Where the visitor's light/dark choice is remembered. */
export const THEME_STORAGE_KEY = "tl-theme";

/**
 * Runs in <head> before first paint: marks JS as available (so GSAP-revealed content starts hidden
 * instead of flashing) and applies the saved theme. The site is navy (`dark`) unless the visitor chose light.
 */
export const HEAD_INIT_SCRIPT =
  "document.documentElement.classList.add('js');" +
  "try{var t=localStorage.getItem('" + THEME_STORAGE_KEY + "');" +
  "document.documentElement.classList.toggle('dark',t!=='light')}catch(e){}";
