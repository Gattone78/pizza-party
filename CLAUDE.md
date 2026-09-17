# Pizza Party

A 3D pizza-making toy for a three-year-old: sauce, toppings, bake, cut, plate, serve, repeat. Personal project, no store release. One codebase runs as a PWA on iPad, iPhone and Android tablets by touch, and later in the Quest 3 browser via WebXR.

**Source of truth:** `docs/requirements.md`. Read it fully at the start of every session. `build-plan.md` has the phase plan; one phase per session.

## Hard constraints (P1–P8)

The player cannot read and has toddler motor skills. Every decision must respect these:

- **P1 No fail states.** Every action produces a positive result. No errors shown to the child, ever (N6).
- **P2 No text** in the play UI. Guidance is visual and audio only.
- **P3 Forgiving input.** Hit targets at least 15 mm on screen, generous pick radius and snap zones, misses land somewhere sensible.
- **P4 One thing at a time.** Each stage shows only the objects it needs.
- **P5 Immediate feedback.** Every touch gets a response within 100 ms.
- **P6 No waiting** beyond about 5 seconds without something to watch or do.
- **P7 Child-led pacing.** No timers, no nagging.
- **P8 Short sessions.** The loop has a natural end point.

Also: no flashing or strobing effects on any platform (S4, S6, N7); no network calls during play, no analytics, no external links (N1–N3).

## Stack

| Piece | Choice |
| --- | --- |
| 3D engine | Babylon.js (`@babylonjs/core`, tree-shaken ES module imports) |
| Language | TypeScript, `strict` mode |
| Build | Vite |
| Offline | vite-plugin-pwa (added in phase 5, not before) |
| Tests | Vitest |

## Repo layout

```
CLAUDE.md
docs/requirements.md   source of truth
build-plan.md          phases and working rules
public/assets/         models (GLB), audio, textures (later phases)
src/
  main.ts              bootstrap and platform detection
  core/                StageMachine, Stage interface, events
  input/               GrabInput interface, TouchInput (XRInput comes later)
  interact/            Draggable, DropZone, snap and return-home tweens
  stages/              one folder per stage: sauce, toppings, bake, cut, plate, serve, celebrate
    shared/            BaseStage, Pizza (mask texture, toppings, slices), grey-box props, counter scene
    StageContext.ts    what every stage receives: scene, GrabInput, pizza, round props, config
  data/                toppings.json, family.json, game.json (later prompts.json)
tests/
```

## Architecture rules

- **Game code never reads raw input.** No pointer, touch, mouse or XR controller events outside `src/input/`. Stages and `src/interact/` consume only the `GrabInput` interface (grab, move, release, each carrying a world-space position). Touch and XR are two implementations behind it (X2). This is what keeps the Quest build cheap.
- **Stage state machine owns all game flow** (X1). Stages implement the `Stage` interface and are registered with `StageMachine`; adding a stage must not require changing existing ones.
- **Data-driven drag targets** (X3): each draggable lists its valid drop zones and a fallback home. Toppings, characters and prompts live in `src/data/` so new ones need no code (X5).
- **Stages extend `BaseStage`** and register everything they create through `own`, `listen` or `drag`, so exit leaves nothing behind (P4). Props that outlive a stage (plates, diners) live in `ctx.round` and are cleared by the Celebrate stage; the `Pizza` persists and is `reset()` for each round.
- **One `DragController` for every drag**: spawners (bowls), existing objects (slices, plates, the pizza) and tools (bottle, wheel, via `moved` events). Painting coverage (`CoverageGrid`) and cutting (`CutTracker`) are pure logic with tests.
- Grey-box materials come from `flatMaterial`, which caches by name for the session. Dispose meshes, never materials.
- **Debugging:** `?debug` shows FPS and exposes `window.pizzaParty.machine`, so `pizzaParty.machine.goTo('plate')` jumps to a stage.
- **No physics engine** (X4). Objects follow input kinematically and tween to snap points.
- **Keep logic Babylon-free where possible.** Drop-zone resolution, return-home decisions, tween maths and the StageMachine must not import Babylon, so they run under Vitest without a browser. Babylon-facing code is a thin view layer over that logic.
- Performance budget on touch: 60 fps, under 150 draw calls, under 200k triangles. Prefer instances and shared materials.

## Commands

```
npm install        install dependencies
npm run dev        dev server over HTTPS on the LAN (open the Network URL on the iPad; accept the self-signed cert)
npm run dev:http   plain-HTTP dev server on port 5174, for desktop tools that reject the self-signed cert
npm test           run Vitest once
npm run test:watch Vitest in watch mode
npm run typecheck  tsc --noEmit
npm run build      typecheck and production build to dist/
npm run preview    serve the production build over HTTPS on the LAN
```

Each phase ends with passing tests, a clean build and a commit.
