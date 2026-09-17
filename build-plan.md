# Claude Code build plan

## Build plan

Build touch first in seven phases, one Claude Code session per phase, each ending in something your child can test. The Requirements tab is the source of truth; commit it to the repo as `docs/requirements.md` so Claude Code can read it.

### Stack

| Piece | Choice | Why |
| --- | --- | --- |
| 3D engine | Babylon.js | Built-in WebXR support including hand tracking, near interaction and passthrough; TypeScript-first |
| Language | TypeScript, strict mode | Catches errors early across a long-lived codebase |
| Build | Vite | Fast dev loop, simple static output |
| Offline | vite-plugin-pwa | Service worker and manifest; installable on iPad, iPhone and Android |
| Tests | Vitest | Unit tests for the state machine and drop-zone logic, no browser needed |
| XR testing | Meta Immersive Web Emulator browser extension | Test XR input on desktop before putting on the headset |
| Hosting | Static files on the home lab over HTTPS | WebXR needs a secure context; Quest Browser will not start a session over plain HTTP |

### Repo layout

```
pizza-party/
  CLAUDE.md              project rules for Claude Code
  docs/requirements.md   exported from the Requirements tab
  public/assets/         models (GLB), audio, textures
  src/
    main.ts              bootstrap, platform detection
    core/                StageMachine, Stage interface, events
    input/               GrabInput interface, TouchInput, XRInput
    interact/            Draggable, DropZone, snap and return-home tweens
    stages/              sauce, toppings, bake, cut, plate, serve, celebrate
    data/                toppings.json, family.json, prompts.json
    audio/               sound and voice-prompt playback
    settings/            parent gate and settings
  tests/
```

### Phases

| Phase | Goal | Done when |
| --- | --- | --- |
| 1. Skeleton and drag-drop | Project scaffold, fixed camera, counter, pizza disc, 3 grey-box topping bowls, touch drag with snap and return-home | A finger can drag toppings onto the pizza on an iPad at 60 fps; G1.1–G1.4 pass |
| 2. State machine and full loop | All stages in grey-box, including sauce and cheese mask painting, bake timer, cut guides, plating, serving | A full loop plays start to finish on touch with placeholder shapes |
| 3. Hints and audio hooks | Idle hints, glow outlines, ghost hand, sound and voice-prompt triggers with placeholder audio | Every action makes a sound; idle for 10 seconds triggers a hint |
| 4. Art and audio | Free-library GLB assets on one palette, family avatars, TTS prompt files, baked-pizza shader blend | Looks and sounds final on touch |
| 5. PWA and parent settings | Offline caching, install to home screen, parent gate, settings | Works in airplane mode on iPad, iPhone and Android tablet |
| 6. Quest build | XRInput with hand tracking and controller fallback, passthrough and virtual kitchen modes, counter height setting | Full loop playable in Quest Browser at 72 fps or better in both modes |
| 7. Polish and performance | Topping soft cap, atlas merge, draw-call budget, photosensitivity check of all effects | Meets the performance budgets on the oldest target device |

### Working rules for every session

- Start each session by having Claude Code read `CLAUDE.md` and `docs/requirements.md`.
- One phase per session. Ask for a plan first, approve it, then let it build.
- Game code never reads raw input; it only uses the `GrabInput` interface (X2). This is what makes phase 6 cheap.
- Each phase ends with passing tests, a clean build and a commit.

## First prompt

Paste this into Claude Code in an empty `pizza-party` folder that already contains `docs/requirements.md`. It covers phase 1 only and asks for a plan before any code.

```
You are helping me build "Pizza Party", a 3D pizza-making toy for my
three-year-old. It is a personal project: a Babylon.js + TypeScript PWA
that runs on iPad, iPhone and Android tablets by touch, and later in the
Quest 3 browser via WebXR. The full requirements are in
docs/requirements.md. Read that file completely before doing anything.

The player cannot read and has toddler motor skills. There are no fail
states, no text in the play UI, large forgiving hit targets, and
feedback within 100 ms of every touch. Treat principles P1-P8 in the
requirements as hard constraints on every decision.

THIS SESSION: phase 1 only, "Skeleton and drag-drop".

First, write CLAUDE.md capturing: the project summary, the stack
(Babylon.js, TypeScript strict, Vite, vite-plugin-pwa, Vitest), the
repo layout below, the rule that game code never reads raw input and
only uses the GrabInput interface, and the commands to run, test and
build. Then show me your implementation plan for phase 1 and wait for
my approval before writing any other code.

Repo layout:
  src/main.ts        bootstrap and platform detection
  src/core/          StageMachine, Stage interface, events
  src/input/         GrabInput interface, TouchInput (XRInput comes later)
  src/interact/      Draggable, DropZone, snap and return-home tweens
  src/stages/        one folder per stage (only toppings this phase)
  src/data/          toppings.json
  tests/

Phase 1 scope:
1. Scaffold the Vite + TypeScript + Babylon.js project with Vitest.
   Landscape, full-screen canvas, no scrolling, no pinch zoom, no
   text selection or long-press menus.
2. A fixed camera looking down at a counter at about 50 degrees. No
   camera controls.
3. Grey-box scene: a counter, a flat pizza disc, and three topping
   bowls in different colours. Primitive shapes only, no assets yet.
4. A GrabInput interface with grab, move and release events carrying a
   world-space position. Implement TouchInput using pointer events and
   ray picking onto the counter plane. Ignore extra touches and resting
   palms rather than erroring.
5. Draggable and DropZone, data-driven: each draggable lists valid
   drop zones and a home position. Dragging from a bowl spawns a new
   topping piece; bowls never run out.
6. A piece released over the pizza lands on its surface with a small
   bounce tween. A piece released anywhere else tweens back to its
   bowl and is removed. Kinematic movement and tweens only, no physics
   engine.
7. Hit targets at least 15 mm on screen on a phone. Generous pick
   radius so a near miss still grabs.
8. A minimal StageMachine with a single Toppings stage, shaped so
   that more stages slot in next phase.
9. Vitest unit tests for drop-zone resolution, return-home behaviour
   and the StageMachine. Keep this logic free of Babylon imports so it
   tests without a browser.

Out of scope this session: other stages, audio, art assets, PWA
setup, WebXR, parent settings.

Done when: npm run dev serves over HTTPS on my LAN so I can open it on
an iPad, I can drag toppings from all three bowls onto the pizza,
misses return to the bowl, it holds 60 fps, tests pass, and the work
is committed. Requirements G1.1 to G1.4 should pass.

Ask me questions if anything in the requirements is ambiguous rather
than guessing.
```

For later phases, reuse the same shape: name the phase, list scope from the phases table, state what is out of scope, and give the done-when line.
