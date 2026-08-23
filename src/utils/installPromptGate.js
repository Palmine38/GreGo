export const INSTALL_PROMPT_RESOLVED_EVENT = "grego:install-prompt-resolved";

let resolved = false;

export function isInstallPromptResolved() {
  return resolved;
}

export function notifyInstallPromptResolved() {
  if (resolved) return;
  resolved = true;
  window.dispatchEvent(new Event(INSTALL_PROMPT_RESOLVED_EVENT));
}
