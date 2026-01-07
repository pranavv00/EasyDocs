/**
 * Session Manager
 * Manages user sessions for multi-step operations
 */

const userSessions = new Map();

// Session timeout: 30 minutes of inactivity
const SESSION_TIMEOUT = 30 * 60 * 1000;

/**
 * Get or create a user session
 * @param {string} userId - WhatsApp user ID
 * @returns {Object} User session object
 */
export function getSession(userId) {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, {
      userId,
      uploadedFiles: [],
      currentStep: 'idle',
      selectedOperation: null,
      metadata: {},
      lastActivity: Date.now(),
    });
  }
  
  const session = userSessions.get(userId);
  session.lastActivity = Date.now();
  return session;
}

/**
 * Clear a user session
 * @param {string} userId - WhatsApp user ID
 */
export function clearSession(userId) {
  userSessions.delete(userId);
}

/**
 * Update session state
 * @param {string} userId - WhatsApp user ID
 * @param {Object} updates - Updates to apply to session
 */
export function updateSession(userId, updates) {
  const session = getSession(userId);
  Object.assign(session, updates);
  session.lastActivity = Date.now();
}

/**
 * Add uploaded file to session
 * @param {string} userId - WhatsApp user ID
 * @param {Object} fileInfo - File information object
 */
export function addFileToSession(userId, fileInfo) {
  const session = getSession(userId);
  session.uploadedFiles.push(fileInfo);
  session.lastActivity = Date.now();
}

/**
 * Get uploaded files for a session
 * @param {string} userId - WhatsApp user ID
 * @returns {Array} Array of uploaded file objects
 */
export function getSessionFiles(userId) {
  const session = getSession(userId);
  return session.uploadedFiles || [];
}

/**
 * Clear uploaded files from session
 * @param {string} userId - WhatsApp user ID
 */
export function clearSessionFiles(userId) {
  const session = getSession(userId);
  session.uploadedFiles = [];
  session.lastActivity = Date.now();
}

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [userId, session] of userSessions.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      userSessions.delete(userId);
    }
  }
}

// Clean up expired sessions every 5 minutes
setInterval(cleanupExpiredSessions, 5 * 60 * 1000);

