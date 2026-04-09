---
name: app-publisher
description: Publish or preview a finished app from the workspace to the enterprise app marketplace. Use when the user wants to deploy, publish, preview, or share a built web application (HTML/JS/CSS, React, Vue, etc.) from a folder in the workspace so other org members can access it.
---

# App Publisher

Publish or preview a completed web application from the workspace.

## When to Use

- User says "publish this app", "deploy my app", "share this app with the team"
- User says "preview this app", "let me see the app", "test the app"
- User points to a folder containing a built web application
- User wants to make a workspace app available in the enterprise marketplace

## IMPORTANT — Execution Rules

- **Execute immediately.** Do NOT describe what you plan to do. Run the commands directly.
- **For preview mode:** Run the publish script with `--status preview` right away. The backend handles notifying the UI via SSE — you do NOT need to tell the user the preview URL or open anything. Just confirm the script succeeded.
- **For publish mode:** Run the publish script with `--status published`. Report the result to the user.

## CRITICAL — Sub-Path Deployment

Published apps are served under `/api/apps/<uuid>/static/`, NOT at the server root `/`.
The app MUST be built for sub-path deployment. Before building, apply these fixes:

### Vite projects

Set `base: './'` in `vite.config.ts` so all asset paths are relative:

```ts
export default defineConfig({
  base: './',
  // ...
})
```

### React Router apps

Use `<HashRouter>` instead of `<BrowserRouter>`:

```tsx
import { HashRouter } from 'react-router-dom';
<HashRouter><App /></HashRouter>
```

### Vue Router apps

Use `createWebHashHistory()` instead of `createWebHistory()`.

### General rules

- Never use absolute asset paths — use relative paths or set the framework's `base` config
- Never assume the app runs at `/`

## Workflow

### Step 1 — Validate and prepare the app folder

Given a folder path (relative to workspace root):

1. Check the folder exists and contains files
2. Look for an entry point: `dist/index.html`, `build/index.html`, or `index.html`
3. If a `package.json` exists and no built output (`dist/` or `build/`) is found, run the build step first
4. If no HTML entry point is found, tell the user what's missing and stop
5. Check for sub-path compatibility (see above). Fix and rebuild if needed.

### Step 2 — Gather metadata

**For preview mode:** Infer all metadata from `package.json` automatically. Do NOT prompt the user for name/description/icon/category — just use sensible defaults and proceed immediately.

**For publish mode:** Ask the user for (or infer from package.json / README):

| Field         | Required | Default        |
|---------------|----------|----------------|
| `name`        | yes      | folder name    |
| `description` | no       | from README    |
| `icon`        | no       | 🚀             |
| `category`    | no       | `tool`         |

Categories: tool, dashboard, utility, game, internal

### Step 3 — Execute the publish script

The workspace has `API_BASE_URL` and `AUTH_TOKEN` pre-configured. The session ID is available from the conversation context.

**Run this script immediately — do not describe the plan first:**

```bash
bash scripts/publish-app.sh \
  --session-id "$SESSION_ID" \
  --folder "<relative/path/to/app>" \
  --name "<app_name>" \
  --description "<description>" \
  --icon "<emoji>" \
  --category "<category>" \
  --status "<preview|published>"
```

Use `--status preview` when the user asks to preview. Use `--status published` when the user asks to publish.

The endpoint handles everything: validates the folder, finds the entry point, copies the bundle to storage, and registers the app. If the same app (same session + folder + status) was already published/previewed, it upgrades in-place instead of creating a duplicate.

### Step 4 — Confirm result

**For preview mode:** Just confirm the script ran successfully. Say something like "Preview is ready." The backend automatically emits an SSE event that opens the preview in the UI — you do NOT need to provide a URL or open anything.

**For publish mode:** Report the app name, version, and that it's now available in the marketplace.

## Error Handling

| API Error Code      | Meaning                                    | Action                                    |
|---------------------|--------------------------------------------|-------------------------------------------|
| `SESSION_NOT_FOUND` | Invalid session ID                         | Check session context                     |
| `NO_SCOPE`          | Session has no business scope              | Session must be scope-based               |
| `INVALID_PATH`      | Path traversal detected                    | Use a relative path within the workspace  |
| `FOLDER_NOT_FOUND`  | Folder doesn't exist at that path          | Verify the path and list workspace files  |
| `NOT_A_DIRECTORY`   | Path points to a file, not a folder        | Point to the app's root directory         |
| `NO_ENTRY_POINT`    | No index.html found                        | Build the app first or specify entry_point|

## Notes

- Only static web applications (HTML/CSS/JS) are supported. Server-side apps are not supported.
- Framework projects (React, Vue, Next.js static export) must be built before publishing.
- The `folder_path` must be relative to the workspace root (e.g., `my-app/dist`).
- Apps are served under a sub-path — always use relative asset paths (`base: './'`) and hash-based routing.
