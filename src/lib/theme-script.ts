/**
 * Runs in <head> before first paint:
 * 1. marks JS as available, so GSAP-revealed content starts hidden instead of flashing;
 * 2. applies the theme. The clean white design is the default (since 2026-11-26); "dark" (warm charcoal) only
 *    for a visitor who switched to it. The OS setting is not followed. The admin panel (/admin) is always white.
 */
export const HEAD_INIT_SCRIPT =
  "document.documentElement.classList.add('js');var t=null;try{t=localStorage.getItem('theme')}catch(e){}if(location.pathname.split('/')[1]==='admin')document.documentElement.classList.add('admin-ui');else if(t==='dark')document.documentElement.classList.add('dark');";
