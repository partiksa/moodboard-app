# Patkov Moodboard

A lightweight, Milanote-inspired shared moodboard app. React + Vite + plain CSS, deployed as a static
site on GitHub Pages. No backend server, no database, no auth provider — GitHub itself (via its REST
API) is the storage layer.

## How it works, in one paragraph

Every board is one JSON file in this repository (`boards/<id>/board.json`). The static app, running
entirely in visitors' browsers, reads and writes that file directly through the GitHub API using a
write token that's baked into the build. Anyone who has a board's permanent link can open it, type a
display name, and edit it — full read/write, no login. This is intentional and is meant for a small
trusted group, not the public internet. See **Security model** below before you use this for anything
sensitive.

## Trust model — read this before deploying

- **A board's share link is the only access control.** Anyone with the link can enter any display
  name and gets full read/write/delete access to that board. Display names are attribution labels for
  the activity log, not verified identities — they are not authentication.
- **The shared write token is embedded in the public JavaScript bundle.** Anyone who opens your
  deployed site can extract it from the browser's network tab or source. Scope it to the smallest
  possible permission (see below) and never put anything sensitive in a board.
- **The admin token is different and stays local.** It's a personal access token the repo owner pastes
  into their own browser; it's stored only in that browser's `localStorage` and is never built into the
  app or committed. It gates the `#/admin` dashboard as a *convenience check*, not a security boundary
  — anyone who knows the `#/admin` URL and has a valid token can get in, and a normal collaborator
  simply isn't shown a link to it.
- **Do not use this for private, regulated, or otherwise sensitive data.**

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your own GitHub owner/repo/token
npm run dev
```

Without `.env.local` configured, the app still runs, but any board URL will show a friendly
"not configured" message instead of loading real data — useful for UI work without touching GitHub.

## Build

```bash
npm run build
npm run preview
```

## Deploying to GitHub Pages

1. **Create (or use) a GitHub repository** for this project and push this code to its `main` branch.
2. **Create a write token for the app.** In GitHub, go to Settings → Developer settings → Fine-grained
   personal access tokens → Generate new token. Scope it to **this repository only**, with
   **Contents: Read and write** permission and nothing else. Copy the token.
3. **Add it as a repository secret**: repo Settings → Secrets and variables → Actions → New repository
   secret, name it `VITE_GITHUB_TOKEN`, paste the token.
4. **Enable GitHub Pages via Actions**: repo Settings → Pages → Build and deployment → Source →
   **GitHub Actions**.
5. **Check Actions permissions**: repo Settings → Actions → General → Workflow permissions → ensure
   Actions can run (read access is enough; the workflow itself doesn't need to push commits — the app
   writes board data at runtime using the token from step 2/3, not the workflow's own `GITHUB_TOKEN`).
6. **Push to `main`.** The included workflow (`.github/workflows/deploy.yml`) builds the app and
   deploys it to Pages automatically. It derives the correct base path, owner, and repo name from the
   repository itself — you don't need to hardcode those.
7. Your site will be live at `https://<owner>.github.io/<repo>/`.

No `boards/` folder needs to exist ahead of time — the admin dashboard creates the first one.

## Configuration reference

Set as GitHub Actions secrets/variables (production) or in `.env.local` (local dev). See
`.env.example` for the full list:

| Variable | Meaning |
|---|---|
| `VITE_GITHUB_OWNER` | Repo owner (auto-filled by the workflow) |
| `VITE_GITHUB_REPO` | Repo name (auto-filled by the workflow) |
| `VITE_GITHUB_BRANCH` | Branch board data is read/written from (auto-filled: the branch that was pushed) |
| `VITE_GITHUB_TOKEN` | The shared write token from step 2 above (**secret**, not a variable) |

## Sharing a board

1. Open the deployed site as the repo owner, go to `#/admin` (append `/#/admin` to the site URL — it's
   not linked from the normal UI), sign in with your own personal GitHub token (Contents: Read/write
   on this repo is enough), and click **New board**.
2. Click **Copy link** on the board row. That URL (`.../#/b/<id>`) is the board's permanent share link.
3. Send it to your trusted collaborators. The first time each of them opens it, they're asked for a
   display name, which is then remembered in their browser and shown on everything they change.

## Collaboration behavior

- **Saving is manual.** Nothing is pushed to GitHub until you click **Save** in the toolbar (or press
  Ctrl/Cmd+S). The toolbar shows *Saved*, *Unsaved changes*, *Saving…*, or *Sync failed*. Edits are
  still mirrored to IndexedDB in the background as you work (no network call), so closing the tab with
  unsaved changes doesn't lose them — the browser also warns you before you navigate away with unsaved
  changes.
- **Offline editing** keeps working; click Save again once the connection is back, or it retries
  automatically the moment the browser reports it's back online.
- **Conflicts**: if the board changed on GitHub since it was last loaded here (someone else saved in
  the meantime), you're shown a dialog with two choices — *Reload remote version* or *Overwrite with my
  version*. Nothing is silently overwritten, and no real-time merge is attempted.
- **Activity panel** (toolbar → Activity) lists who did what and when: added/edited/moved/resized/
  deleted/restored items, to-do checks, board renames and settings changes. Private-note edits are
  logged as "edited a private note" without exposing their contents.

## Admin dashboard

`#/admin` lists every board in the repo with its share link, item count, last activity, and the set of
collaborator names seen in its history. From there the owner can create, rename, duplicate, delete, and
open any board, view its full activity log, or import an old `.moodboard.json` backup as a new board.
This is a convenience surface for the repo owner, not a secured admin panel — see **Trust model**.

## What's included (board editor)

- **Bento grid layout**: every item lives in a fixed grid (columns, row height, and gutter are
  configurable in Settings). Drag an item to reorder it into a new slot; resize by changing its
  column/row span (selection toolbar), not by dragging free-form handles. Images scale to fill
  their cell (cropping as needed) so mismatched aspect ratios don't matter.
- **Backgrounds**: dotted white, dotted black, solid color, or an uploaded image.
- **Undo/redo** (Ctrl/Cmd+Z / Shift+Ctrl/Cmd+Z, 60-step history), **search**, multi-select,
  duplicate (Ctrl/Cmd+D), delete (Backspace/Delete), lock, group/ungroup.
- **Item types**: freeform rich text (select text, then use the floating toolbar to make it a Heading,
  Subheading, or plain Text block, plus bold/italic/lists/links/color/alignment), images (upload,
  drag-drop, paste, incl. SVG), inline video, generic file attachments, URL cards with best-effort
  metadata previews, color swatches (hex/RGB/CMYK), to-do lists, and section-header tiles.
- **Private notes**: any item can carry a private note; excluded from exports unless opted in, and
  logged in activity without exposing the note text.
- **Appearance**: light/dark/system theme, Inter by default, custom font upload.
- **Export**: PNG/JPG/PDF at 1x-3x, with/without background, with/without private notes; PDF
  fit-to-page or tiled.

## Known limitations

- **GitHub API rate limits and file size.** The Contents API used to read/write `board.json` has a
  practical size ceiling around 1 MB per file. Media (images/videos/fonts) is stored as embedded data
  URLs inside the board JSON for simplicity, so boards with many/large images can hit that ceiling —
  keep images reasonably sized. Authenticated requests are also rate-limited by GitHub (typically
  5,000/hour per token), which is generous for a small group but not for heavy automated polling.
- **No real-time collaboration.** There's no live cursor/presence and no operational-transform merge;
  simultaneous edits are caught by the conflict dialog, not merged.
- **URL metadata previews** depend on the target site allowing cross-origin fetches; many will fall
  back to a basic link card.
- **The admin gate and the board share-link model are both convenience mechanisms, not strong
  security** — see **Trust model** above.
