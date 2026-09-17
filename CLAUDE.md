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
| Art | Built in code from one palette (`src/art/`), no model files |
| Audio | Web Audio: synthesised effects and music, voice prompts as mp3 rendered by `npm run voice` |
| Language | TypeScript, `strict` mode |
| Build | Vite |
| Offline | vite-plugin-pwa (added in phase 5, not before) |
| Tests | Vitest |

## Repo layout

```
CLAUDE.md
docs/requirements.md   source of truth
build-plan.md          phases and working rules
public/assets/voice/   spoken prompts, one mp3 per id in prompts.json
scripts/               render-voice.ps1 (Windows speech + ffmpeg)
src/
  main.ts              bootstrap and platform detection
  core/                StageMachine, Stage interface, events
  input/               GrabInput interface, TouchInput (XRInput comes later)
  art/                 palette, build helpers, toppings, props, avatars, environment (all code-built)
  audio/               GameAudio interface, SynthAudio (effects, music, voice files), drag sound wiring
  interact/            Draggable, DropZone, snap and return-home tweens
  stages/              one folder per stage: sauce, toppings, bake, cut, plate, serve, celebrate
    shared/            BaseStage, Pizza (mask texture, toppings, slices), HintLayer, CarryEffects
    StageContext.ts    what every stage receives: scene, GrabInput, pizza, round props, config
  data/                toppings.json, family.json, game.json, prompts.json
tests/
```

## Architecture rules

- **Game code never reads raw input.** No pointer, touch, mouse or XR controller events outside `src/input/`. Stages and `src/interact/` consume only the `GrabInput` interface (grab, move, release, each carrying a world-space position). Touch and XR are two implementations behind it (X2). This is what keeps the Quest build cheap.
- **Stage state machine owns all game flow** (X1). Stages implement the `Stage` interface and are registered with `StageMachine`; adding a stage must not require changing existing ones.
- **Data-driven drag targets** (X3): each draggable lists its valid drop zones and a fallback home. Toppings, characters and prompts live in `src/data/` so new ones need no code (X5).
- **Stages extend `BaseStage`** and register everything they create through `own`, `listen` or `drag`, so exit leaves nothing behind (P4). Props that outlive a stage (plates, diners) live in `ctx.round` and are cleared by the Celebrate stage; the `Pizza` persists and is `reset()` for each round.
- **One `DragController` for every drag**: spawners (bowls), existing objects (slices, plates, the pizza) and tools (bottle, wheel, via `moved` events). Painting coverage (`CoverageGrid`) and cutting (`CutTracker`) are pure logic with tests.
- **Audio goes through `ctx.audio` (`GameAudio`)**: `play(soundId)`, `say(promptId)`, `buzz()`. Stages never touch Web Audio. `SynthAudio` synthesises the effects and the music loop, and plays voice prompts from `public/assets/voice/<promptId>.mp3` (falling back to browser speech if a file is missing). After editing `prompts.json` run `npm run voice` (Windows, needs ffmpeg), or drop in your own recordings with the same names. Audio unlocks on the first touch via `TouchInput`'s gesture callback. Every new interaction needs a sound (P5, A6).
- **Art is code-built** (decided 2026-09-17, see `docs/art-direction.md`): shapes from `src/art/build.ts` (`puck`, `ball`, `block`, `ring`, `lathe`), coloured per vertex from `PALETTE`, merged into one mesh per prop and drawn with the single shared `toyMaterial`. Never hard-code a colour outside `palette.ts`. Use instances for anything repeated and `blobShadow` instead of real shadows. A new topping is a JSON entry if an existing `shape` fits, otherwise one builder in `src/art/toppings.ts`. A new family member is a JSON entry in `family.json`.
- **Hints (P7, A8)**: a stage overrides `hint()` to return the motion to show for the current state, or null when the child has nothing to do. `BaseStage` runs the 10-second idle timer, the ghost hand, the target ring and the repeated prompt. `announce(promptId)` speaks a prompt and makes it the idle prompt.
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
npm run voice      re-render the spoken prompts from prompts.json (Windows + ffmpeg)
```

Each phase ends with passing tests, a clean build and a commit.
