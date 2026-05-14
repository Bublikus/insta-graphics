# Agent Guide: Adding New Graphics

This guide defines the default workflow for future sessions that add or modify animations.

## 1) Create a scene folder

Create a dedicated folder under:

- `src/graphics/scenes/<scene-id>/`

Use kebab-case ids because ids are used in URLs (`/g/<scene-id>`).
For related ideas, create a shared parent folder and keep sibling sub-animations inside it.

## 2) Choose a base class

- Use `BaseCanvas2DScene` for 2D Canvas graphics.
- Use `BaseThreeScene` for Three.js scenes.
- Only use `BaseGraphicScene` directly when creating a custom renderer adapter.

Lifecycle methods:

- `setup(container)` is called once by runtime.
- `resize({ width, height, dpr })` is called on stage resize.
- `update(deltaMs, elapsedMs)` runs every frame.
- `render()` runs every frame after `update`.
- `destroy()` is called on route change/unmount.

## 3) Implement performance-safe behavior

- Avoid allocations inside `render()` when possible.
- Reuse gradients/materials/buffers if practical.
- Cap device pixel ratio when rendering heavy scenes (already capped in runtime).
- Clean up all resources in destroy hooks.

## 4) Register the scene

Edit `src/graphics/registry.ts`:

1. Import the scene class.
2. Register it as either:
   - a leaf node with `id`, `title`, `description`, `createScene`
   - or inside a group node with `children` for sub-animations.

Once registered, the scene automatically appears in navigation and supports deep links.

## 5) Verification checklist

- Open `/g/<scene-id>` directly.
- Confirm previous/next navigation changes URL and scene.
- Confirm resize behavior keeps correct composition in 9:16 stage.
- Confirm route switching does not leak old animation loops.
- Run:
  - `npm run lint`
  - `npm run build`

## 6) Naming conventions

- Scene class: PascalCase, e.g. `AuroraWavesScene`.
- Folder/route id: kebab-case, e.g. `aurora-waves`.
- Helper files should remain within the scene folder unless shared across multiple scenes.
