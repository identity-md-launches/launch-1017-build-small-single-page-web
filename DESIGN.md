# Skyline design system

## Overview

Skyline is a small timing game for a browser or embedded frame. Its blueprint playfield is the visual center: blue graph paper, drawn windows, construction lines, dimensions, and a hanging floor. A warm paper surround makes the instructions and local records feel like notes beside a drawing.

The game precedes records and instructions in both DOM and reading order. Reuse the restrained hierarchy, aligned edges, generous space between sections, and single prominent action. The two-column arrangement is specific to this game, not a universal page template.

## Colors

The source of truth is `src/styles.css`, beginning at `:root`. Semantic tokens refer to hex primitives; components use semantic tokens.

| Token | Value | Role |
| --- | --- | --- |
| `--color-page` | `#f3f1e9` | Paper page |
| `--color-surface` | `#faf9f5` | Leaderboard and result card |
| `--color-subtle` | `#e9e7de` | Local badge and neutral hover |
| `--color-border` | `#d4d6cc` | Rules and neutral control borders |
| `--color-text` | `#262f2b` | Main text |
| `--color-muted` | `#60665f` | Supporting text |
| `--color-accent` | `#1749a4` | Playfield, primary action, selected numerical emphasis |
| `--color-accent-hover` | `#123b87` | Primary hover |
| `--color-on-accent` | `#faf9f5` | Primary action label |
| `--color-blueprint-text` | `#faf9f5` | Primary blueprint labels and floor outlines |
| `--color-blueprint-muted` | `#dce9ff` | Secondary blueprint labels and construction strokes |
| `--color-blueprint-line` | `#6899e5` | Decorative skyline and annotation lines |
| `--color-success-bg` | `#e0ebba` | Field guide tip |
| `--color-success` | `#496329` | Tip text and status dot |
| `--color-focus` | `#1749a4` | Focus on paper; playfield focus uses `--color-on-accent` |

The grid uses 1px white lines at alpha `09` and `0c` in 20px and 100px squares. Contrast verification includes their brightest crossings, not just the solid blue. Alpha fills and subdued background architecture are decorative; floor shapes, text and status also communicate meaning without relying on color. This is one intentional light theme with a blue playfield. There is no theme switch.

## Typography

`--font-body` is `"Helvetica Neue", Helvetica, Arial, sans-serif`; `--font-mono` is `"SFMono-Regular", Consolas, "Liberation Mono", monospace`. Fonts come from the operating system; no font download is required. Weights are 400, 500 and 700, with `font-synthesis: none`. The exact available system face varies by platform.

The type tokens are small 0.75rem, caption 0.8125rem, body 0.875rem and heading 1.0625rem. Main copy and headings use the sans stack; technical labels, height, ranking and keyboard hints use the mono stack. The main heading scales with `clamp(2rem, 4vw, 2.75rem)`, with 1.1 line height and -1.6px tracking. At the narrow breakpoint it is 31px and wraps into two short lines. Section headings descend to 17px and 14px; instructional headings are 13px. Supporting copy has 1.5–1.6 line height.

The score is 58px, then 48px and 44px at narrower breakpoints. Scores use tabular numerals to prevent movement between digits. Technical annotations are deliberately compact (8–11px), while primary actions are 14px and at least 48px tall. Headings balance wrapping, body paragraphs use `text-wrap: pretty`, and mobile introductory copy is capped at 25ch.

## Layout

The shell is centered at a maximum 1200px width. Desktop inline padding is 48px. `.workspace` uses a flexible game column, a 302px sidebar and a 28px gap. The header, introduction, game and footer share the shell edges. Local card padding is 20px; related elements generally use 8–12px gaps, and sections 22–33px.

| Breakpoint | Implemented change |
| --- | --- |
| Above 63rem | Full header, 302px sidebar, 493px scene control |
| At 63rem / 1008px | Shell padding 30px; sidebar 270px; gap 22px; optional header badge and keyboard hint hidden; scene 480px |
| At 47rem / 752px | Shell padding 24px; game spans the width; records and guide share a two-column row; scene 470px |
| At 35rem / 560px | Shell padding 18px; all sections stack; compact header and personal best; scene 425px; primary button fills available space |

The SVG has a 400 × 430 view box and scales uniformly. The scene camera follows the tower after two floors, keeping the active block and its measurement away from the height counter. Older floors leave the visible drawing; score and records retain the full height. Controls stay in document flow below the drawing. Long pages scroll normally inside an iframe; there are no sticky panels. Tested widths and rendered evidence are recorded in `artifacts/validation.md`.

## Elevation & Depth

Most surfaces are flat. One-pixel borders establish the leaderboard and drawing structure. The in-place paused/completed result uses an opaque paper card, a `#123b8770` scrim, and a `0 8px 32px #08255830` shadow. The keyboard hint has a 2px lower shadow. No backdrop blur or decorative floating layers are used.

## Shapes

The blueprint and leaderboard have 5px corners. Buttons and the result card use 4px; small tags and the tip use 3px. Only the empty-state icon surround and tiny status dots are circular. The illustration uses fine rectangular outlines and square windows. SVG dimensions are physical geometry; content layout uses logical spacing where applicable.

## Components

- **`Icon` in `src/App.tsx`:** six original inline stroke icons selected by `name`, with optional `size`. They inherit `currentColor` and are hidden from accessibility APIs when accompanying text or an accessible button name.
- **`BlueprintFloor` and `Scene`:** drawn building blocks, foundation, hoist, cutoff fragment and camera. Scene is decorative inside a native named playfield button; the visible height and persistent polite status provide text equivalents for game events. `src/engine.ts` owns scoring and timing.
- **Primary action:** `.primary-button` is the sole filled action outside the playfield. It changes from Start building to Drop floor, Resume building or Build again. During a drop it remains focusable with `aria-disabled`; the state machine ignores duplicate inputs.
- **Pause control:** named icon button; unavailable until a run starts. P or Escape toggles pause. A hidden document automatically pauses. Paused and completed states are inline result panels, not modal dialogs; the main action remains reachable in normal keyboard order.
- **Leaderboard pattern:** an ordered list of up to five completed runs, sorted by height, perfect drops and recency. Empty copy explains how to fill it. Records are local to this browser and storage partition. A denied storage operation produces a persistent session-only notice. It never invents other players or scores.
- **Field guide pattern:** numbered instructions with an action heading, short explanation and a separate green tip.
- **Focus and motion:** focus uses a 3px outline with a 4px gap, or an inset white outline on the playfield. The first focusable link skips to the game. Hover styles are limited to hover-capable devices. Button transitions are 150ms; press scale is 0.96. Reduced motion removes these transitions and falling fragments, and shortens the drop to 50ms. The user-started timing swing remains essential gameplay and can be paused.

## Do's and Don'ts

- Reuse semantic colors and the two existing font stacks; keep artwork local.
- Give the main action one clear verb and keep support actions outlined.
- Keep controls outside the clipped drawing and preserve at least 44px targets.
- Preserve the explicit local scope of records and the session-only storage fallback.
- For a related page, start with `.app-shell`, the header, heading scale and shared control styles. Give new content a normal-flow layout and test the existing breakpoints; do not assume the game’s fixed scene height suits ordinary text.
- Do not add remote fonts, network rankings, audio autoplay, global motion, or focusable SVG fragments without reconsidering the module’s browser-only contract.
