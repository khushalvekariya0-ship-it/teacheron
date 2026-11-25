/**
 * Runs in <head> before first paint:
 * 1. marks JS as available, so GSAP-revealed content starts hidden instead of flashing;
 * 2. applies the theme. Dark (warm charcoal) is the default; "light" is the cream theme the visitor
 *    can switch to. The OS setting is not followed. The admin panel (/admin) is always white (`admin-ui`).
 */
export const HEAD_INIT_SCRIPT =
  "document.documentElement.classList.add('js');var t=null;try{t=localStorage.getItem('theme')}catch(e){}if(location.pathname.split('/')[1]==='admin')document.documentElement.classList.add('admin-ui');else if(t!=='light')document.documentElement.classList.add('dark');";
