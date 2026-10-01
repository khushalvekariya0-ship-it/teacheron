/**
 * Runs in <head> before first paint: marks JS as available, so GSAP-revealed content starts hidden
 * instead of flashing. The site has a single light theme.
 */
export const HEAD_INIT_SCRIPT = "document.documentElement.classList.add('js');";
