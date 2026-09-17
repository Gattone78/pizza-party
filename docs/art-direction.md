# Art direction notes

2026-09-17. Phil supplied a screenshot of a commercial toddler pizza app as the reference for **graphic level and ideas**. It is a style target, not a source of assets: nothing is copied from it (A2 still applies: CC0 / free-library assets, recoloured to one palette). The screenshot is at `docs/reference/pizza-app.jpg`.

Requirements still win where they differ (see "Where we differ").

## What the reference shows

- **Flat, bright, toy-like.** Saturated colours, soft drop shadows under everything, almost no texture detail. Matches A1 and the "chunky wooden-toy" look; cheap to render.
- **Bowls are heaped full.** Each bowl is a plain grey-white dish overflowing with many visible pieces of its topping, so the bowl reads as "lots of this" at a glance with no label (P2). The bowl itself is neutral; the topping supplies the colour.
- **Every topping has its own silhouette**, not just its own colour: tomato slices with seed pattern, spotted pepperoni, mushroom cross-sections, olive rings, pepper rings, pineapple chunks, shredded cheese strands (A1).
- **Bowls surround the pizza** on several sides rather than sitting in one row, so six or seven fit with large hit targets and short drag distances.
- **Pizza sits on a wooden board** on a checkered tablecloth, which frames the drop target and separates it from the background.
- **The carried piece is enlarged, outlined in white and trails sparkles**, so it is obvious what is in hand (P5).
- **Ghost-hand hint**: a cartoon glove with a translucent motion arc from bowl to pizza (A8, P7).
- **Set dressing**: stray toppings, basil leaves, flour dust, sauce splats, a rolling pin and salt shaker scattered around. Non-interactive, but it makes the counter feel like a real, messy kitchen.
- **Sauce comes from a squeeze bottle** that tilts and squirts a stream.
- **Navigation is big round glossy buttons with icons only**, in the corners.

## How it maps to the phases

| Idea | Phase | Notes |
| --- | --- | --- |
| Bowls arranged around the pizza, 5–6 of them | 2 | Replace the single near-side row. Layout stays data-driven (`toppings.json` positions); `computeLayout` play area grows to include side bowls. Keep bowls out from under the resting hand where possible. |
| Carried-piece feedback: bigger, outlined, sparkle trail | 3 | Extends the current pop-in. Sparkles must be soft and slow (N7, S4). |
| Ghost hand with motion arc | 3 | This is A8 exactly. |
| Heaped bowls, per-topping silhouettes, neutral bowl colour | 4 | Heap = a handful of static instances of the piece mesh baked/merged per bowl, to stay inside the draw-call budget. |
| Wooden board, checkered cloth, set dressing | 4 | One merged static mesh, one atlas. |
| Icon-only round buttons | 5 | Parent gate only; the child-facing "done" object stays an in-world object (G1.6). |

## Where we differ

- **Camera.** The reference is flat top-down 2D. We keep the fixed ~50 degree 3D view (T1) so the same scene works in the headset. The flat, shadowed look is achieved with materials and lighting, not by changing the camera.
- **Orientation.** The reference is portrait; we are landscape only (T2).
- **Corner buttons.** We have no back or home button in play (G6.1).

## Decisions (2026-09-17)

1. **Sauce tool: squeeze bottle**, replacing the ladle. G0.1 and G0.4 updated.
2. **Cheese stays painted** as a mask (G0.5, G0.8), not draggable pieces.
3. **Tomato is an MVP topping.** G1.1 example list updated.
4. Bowls go around the pizza in phase 2; carried-piece outline, sparkles and ghost hand in phase 3; heaped bowls, board, cloth and set dressing in phase 4.
5. **Art is built in code, not from asset packs** (supersedes A2's free-library plan). The reference's flat style suits code-built shapes, one palette is guaranteed, there are no licences to track, and nothing needs a Blender pass. Any single prop can still be swapped for a GLB later.
6. **Voice prompts are rendered with the Windows speech engine** to `public/assets/voice/*.mp3` via `npm run voice`. Replace the files with warmer recordings (or Phil's own voice) at any time; the names are the prompt ids.
7. **Music is a procedural pentatonic music-box loop**, so it needs no file and can never clash with itself.

## What was built (phase 4)

- Lavender checkered tablecloth with flour dust, sauce splats, basil and stray cheese painted into it.
- Pizza with a puffy rounded crust on a round wooden platter that travels into the oven with it; cheese browns in patches as it bakes.
- White dishes heaped with their topping; tomato slices with seed pockets, spotted pepperoni, mushroom cross-sections, olive rings, three-lobed pepper rings, pineapple wedges.
- Squeeze bottle with a label, brass bell, toy oven with a glass top, rounded pizza wheel, plates with coloured rims.
- Family as peg dolls with five hair styles, glasses, cheeks and smiles; they sway while waiting, hop when served and nod while eating.
- Soft blob shadows under everything, and a landing shadow under whatever is being carried.

