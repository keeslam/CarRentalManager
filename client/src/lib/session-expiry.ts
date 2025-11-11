/**
 * Singleton utility for handling session expiration
 * Allows queryClient to trigger logout without direct access to Auth context
 */

type SessionExpiredHandler = () => void | Promise<void>;

let sessionExpiredHandler: SessionExpiredHandler | null = null;
let isHandlingExpiry = false; // Prevent double calls

/**
 * Register a handler to be called when session expires
 * Should be called from AuthProvider on mount
 */
export function registerSessionExpiredHandler(handler: SessionExpiredHandler) {
  sessionExpiredHandler = handler;
}

/**
 * Unregister the session expired handler
 * Should be called from AuthProvider on unmount
 */
export function unregisterSessionExpiredHandler() {
  sessionExpiredHandler = null;
  isHandlingExpiry = false;
}

/**
 * Invoke the session expired handler
 * Called by queryClient when 401 response is received
 */
export async function invokeSessionExpired() {
  // Prevent double calls
  if (isHandlingExpiry) {
    return;
  }
  
  if (!sessionExpiredHandler) {
    console.warn('Session expired but no handler registered');
    return;
  }
  
  isHandlingExpiry = true;
  
  try {
    await sessionExpiredHandler();
  } catch (error) {
    console.error('Error handling session expiration:', error);
  } finally {
    // Reset after a delay to allow for any async operations
    setTimeout(() => {
      isHandlingExpiry = false;
    }, 1000);
  }
}
