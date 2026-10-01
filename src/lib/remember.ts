/*
 * "Remember me" for sign-in. Remembered sessions survive closing the browser; otherwise the session
 * ends with the browser session. (Preview build: the session lives in the persisted store, so this
 * marks unremembered sessions and ends them on the next fresh browser session.)
 */
const REMEMBER_KEY = "tl-remember";
const ALIVE_KEY = "tl-session-alive";

export function setRememberMe(remember: boolean) {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
    sessionStorage.setItem(ALIVE_KEY, "1");
  } catch {
    /* storage unavailable: default to the remembered behaviour */
  }
}

/** True when the last sign-in wasn't remembered and this is a new browser session. */
export function sessionShouldEnd(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) === "0" && !sessionStorage.getItem(ALIVE_KEY);
  } catch {
    return false;
  }
}

export function clearRememberMe() {
  try {
    localStorage.removeItem(REMEMBER_KEY);
  } catch {}
}
