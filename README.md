# Skyline — one floor at a time

A self-contained blueprint tower game built with React, TypeScript and Vite. Start a run, time a swinging floor, and drop it onto the house. Overhangs are cut away; a complete miss ends the run. Near-perfect alignment (within four game units) keeps the entire floor. The tower scrolls upward as it grows.

Best height is saved after each successful drop. The leaderboard keeps the five best completed runs on this browser, ranked by height, then perfect drops, then newest run. It is explicitly local: no accounts, invented competitors or remote leaderboard. Storage-denied frames remain playable with session-only records. Clearing browser data clears saved records.

## Install, build and preview

Use Node.js 22.18+ or Node.js 24 and npm.

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run preview
```

Open the local URL printed by Vite. `npm run build` regenerates the complete `dist/` export. The production build is already included in this submission alongside the source and lockfile. Preview over HTTP; directly opening HTML through `file://` is not supported by browser module loading.

During this assignment dependencies were installed in `/tmp/skyline-build`, source/configuration were copied there, and checks ran with `npm --prefix /tmp/skyline-build run …`. The final export was copied back. No repository `node_modules`, dependency archives, cache, submodule or ignore-file change is required.

## Play and embed

- Select **Start building**, then tap the blue playfield or **Drop floor**.
- Use Enter or Space on the focused button. Space also starts/drops when focus is outside another control. Repeated keydown shortcuts are ignored.
- Use the pause button, P or Escape to pause/resume. Leaving the tab pauses the run.
- Select **Build again** after a miss. The leaderboard updates automatically.

Publish the entire contents of `dist/` on any static HTTP host, preserving its `assets/` directory and license file. The Vite base is `./`; scripts, styles and the favicon use relative URLs. A nested URL such as `/games/skyline/` works without rewrites or a backend. Serve JavaScript and CSS with their normal MIME types. No secrets, wallet services, environment file or build server are needed at runtime.

Example iframe for a module published at `/games/skyline/`:

```html
<iframe
  src="/games/skyline/"
  title="Skyline tower game"
  width="100%"
  height="900"
  style="border: 0"
  sandbox="allow-scripts allow-same-origin"
></iframe>
```

The frame scrolls internally at narrow sizes. Use your actual published path. Storage depends on the host browser’s iframe policy. An opaque sandbox with only `allow-scripts` requires the static host to permit cross-origin module loads (for example, `Access-Control-Allow-Origin: *` for these public assets), and records remain session-only. The ordinary embed above was also validated.

There are no external runtime requests, trackers, third-party scripts, wallet connections, signing actions or secret inputs. React is bundled locally; drawings and icons are inline SVG and CSS, and fonts are system fonts. The export’s content security policy disallows network connections. The optional `npm run dev` command starts Vite for editing; its live-reload socket is intentionally blocked by the export’s strict CSP, so use manual reloads during development.

## Browser validation

```sh
npx playwright install chromium
npm run test:browser
```

Run this after the production build. The check starts an ephemeral local server, serves `dist/` under `/preview/`, uses Chromium, writes screenshots and JSON results under `artifacts/`, then closes the browser and server. All test helpers are excluded from the runtime export. Browser installation and dependency downloads are development-time operations only.

Actual worker results and review limitations are in [artifacts/validation.md](artifacts/validation.md), with machine-readable observations in [artifacts/browser-results.json](artifacts/browser-results.json). [DESIGN.md](DESIGN.md) describes the implemented design system.

Final checks passed: production build, strict typecheck, all 8 game/storage tests and all 20 reported Chromium browser checks. Those covered 320–1200px reflow, keyboard and touch gameplay, pause/resume, misses, replay, persistence, reduced effects, ordinary and storage-denied iframes, and local resource loading. The two automated accessibility scans reported no violations in their tested states. The six-domain design review found and corrected blueprint-label contrast and a mobile counter overlap. Native zoom, screen-reader use and non-Chromium browsers remain untested.

## Source map

| Path | Purpose |
| --- | --- |
| `src/engine.ts` | Swing, overlap, cuts, scoring, pause and drop timing |
| `src/storage.ts` | Validated local record parsing and ranking |
| `src/App.tsx` | SVG playfield, controls, records and instructions |
| `src/styles.css` | Tokens, components, responsive layout and focus/motion rules |
| `tests/engine.test.ts` | Game and storage regression tests |
| `tests/browser.mjs` | Production browser, iframe and interaction checks |
| `dist/` | Ready-to-publish static site |

## Attribution

Design review applied the pinned Better Interface guidance by Jakub Krehel, MIT, commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`. The documentation method is adapted from Paul Bakaus’s Impeccable, Apache-2.0, commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`, [document reference](https://github.com/pbakaus/impeccable/blob/9d715cc4f5564a990ca8345abfdd5df6dc9b41c8/skill/reference/document.md). The combined upstream license texts are retained in `licenses/design-guidance.txt`; these works retain their separate licenses. The design system and implementation are specific to this assignment. React, React DOM and Scheduler notices ship in `dist/THIRD_PARTY_LICENSES.txt`.
