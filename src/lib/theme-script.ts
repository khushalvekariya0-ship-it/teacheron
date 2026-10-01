/**
 * Where the visitor's light/dark choice is remembered. Versioned: choices saved before the navy
 * redesign ("tl-theme") are ignored, so everyone starts on the new navy look.
 */
export const THEME_STORAGE_KEY = "tl-theme-v2";

/**
 * Runs in <head> before first paint: marks JS as available (so GSAP-revealed content starts hidden
 * instead of flashing) and applies the saved theme. The site is navy (`dark`) unless the visitor chose light.
 */
export const HEAD_INIT_SCRIPT =
  "document.documentElement.classList.add('js');" +
  "try{var t=localStorage.getItem('" + THEME_STORAGE_KEY + "');" +
  "document.documentElement.classList.toggle('dark',t!=='light')}catch(e){}";
