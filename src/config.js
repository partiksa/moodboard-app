// Shared-board configuration, baked in at build time from environment variables.
// See README.md "Configuration" section for how these are set via GitHub Actions secrets/vars.
export const GITHUB_OWNER = import.meta.env.VITE_GITHUB_OWNER || '';
export const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO || '';
export const GITHUB_BRANCH = import.meta.env.VITE_GITHUB_BRANCH || 'main';
export const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN || '';
// Secret in the admin invite link (#/admin?key=...). Anyone who opens that link is an admin.
export const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || '';

export const GITHUB_CONFIGURED = Boolean(GITHUB_OWNER && GITHUB_REPO && GITHUB_TOKEN);
