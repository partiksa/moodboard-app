const KEY = 'moodboard-display-name';

export function getDisplayName() {
  return localStorage.getItem(KEY) || '';
}

export function setDisplayName(name) {
  localStorage.setItem(KEY, name.trim());
}
