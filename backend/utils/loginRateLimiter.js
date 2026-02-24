const attemptsByKey = new Map();

const MAX_FAILED_ATTEMPTS = Number(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS || 5);
const WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const BLOCK_MS = Number(process.env.LOGIN_RATE_LIMIT_BLOCK_MS || 15 * 60 * 1000);

const now = () => Date.now();

const getKey = ({ identifier, role, ip }) => {
  return `${String(role || "").toLowerCase()}::${String(identifier || "").toLowerCase()}::${ip || ""}`;
};

const getState = (key) => {
  const state = attemptsByKey.get(key);
  if (!state) {
    return { failedAttempts: 0, firstFailedAt: null, blockedUntil: null };
  }
  return state;
};

const setState = (key, state) => {
  attemptsByKey.set(key, state);
};

const clearState = (key) => {
  attemptsByKey.delete(key);
};

const checkLoginAllowed = (key) => {
  const state = getState(key);
  if (state.blockedUntil && state.blockedUntil > now()) {
    return { allowed: false, retryAfterMs: state.blockedUntil - now() };
  }

  if (state.blockedUntil && state.blockedUntil <= now()) {
    clearState(key);
  }

  return { allowed: true, retryAfterMs: 0 };
};

const recordFailedAttempt = (key) => {
  const current = now();
  const state = getState(key);

  if (!state.firstFailedAt || current - state.firstFailedAt > WINDOW_MS) {
    const next = {
      failedAttempts: 1,
      firstFailedAt: current,
      blockedUntil: null,
    };
    setState(key, next);
    return next;
  }

  state.failedAttempts += 1;
  if (state.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    state.blockedUntil = current + BLOCK_MS;
  }
  setState(key, state);
  return state;
};

const recordSuccessfulLogin = (key) => {
  clearState(key);
};

module.exports = {
  getKey,
  checkLoginAllowed,
  recordFailedAttempt,
  recordSuccessfulLogin,
};
