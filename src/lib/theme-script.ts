/**
 * Runs in <head> before first paint:
 * 1. marks JS as available, so GSAP-revealed content starts hidden instead of flashing;
 * 2. restores the dark theme if the visitor chose it (light is the default — the OS setting is not followed).
 */
export const HEAD_INIT_SCRIPT =
  "document.documentElement.classList.add('js');try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}";
