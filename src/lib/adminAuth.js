const KEY = 'moodboard-admin-token';

export function getAdminToken() {
  return localStorage.getItem(KEY) || '';
}

export function setAdminToken(token) {
  localStorage.setItem(KEY, token.trim());
}

export function clearAdminToken() {
  localStorage.removeItem(KEY);
}
