/**
 * Singleton utility for prompting the user for an admin password when the
 * backend rejects a request with code "ADMIN_PASSWORD_REQUIRED" (used to
 * unlock edits on rentals older than 3 weeks).
 *
 * Mirrors the session-expiry singleton pattern so apiRequest can trigger
 * the prompt without needing direct access to React context.
 */

export type AdminPasswordPromptOptions = {
  reason?: string;
  errorMessage?: string;
};

type AdminPasswordPromptHandler = (
  opts: AdminPasswordPromptOptions,
) => Promise<string | null>;

let promptHandler: AdminPasswordPromptHandler | null = null;

export function registerAdminPasswordPromptHandler(
  handler: AdminPasswordPromptHandler,
) {
  promptHandler = handler;
}

export function unregisterAdminPasswordPromptHandler() {
  promptHandler = null;
}

/**
 * Request the admin password from the user. Resolves with the entered
 * password, or null if the user cancelled / no handler is mounted.
 */
export async function promptForAdminPassword(
  opts: AdminPasswordPromptOptions = {},
): Promise<string | null> {
  if (!promptHandler) {
    console.warn(
      "[admin-password] Admin password required but no prompt UI is mounted.",
    );
    return null;
  }
  return promptHandler(opts);
}
