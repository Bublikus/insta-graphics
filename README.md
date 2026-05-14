# insta-graphics

Reusable graphics playground for Instagram Reels.

## What this project provides

- A centered **9:16 Reels stage** designed for screenshot publishing.
- Deep-linkable routing by graphic id: `/g/:graphicId`.
- An extensible animation lifecycle for both Canvas 2D and Three.js.
- Tree-based animation registry with support for grouped sub-animations.
- Per-scene folder organization for future graphics with helpers/assets.

## Commands

```bash
npm install
npm run dev
npm run lint
npm run format:check
npm run build
```

## Deep links

- Open a specific scene via URL pattern: `/g/<graphicId>`.
- Example: `/g/demo-gradient`.
- Use previous/next buttons or direct links from the sidebar.

## Project structure

```text
src/
  app/
    App.tsx
    router.tsx
    GraphicNavigator.tsx
  layout/
    ReelsStage.tsx
  graphics/
    base/
      AnimationLoop.ts
      BaseGraphicScene.ts
      BaseCanvas2DScene.ts
      BaseThreeScene.ts
    scenes/
      demo-gradient/
        DemoGradientScene.ts
        palette.ts
      hypnotic-family/
        hypnoticShared.ts
        HypnoticPulseVortexScene.ts
        PixelMoireTunnelScene.ts
    GraphicRuntime.tsx
    registry.ts
```

## Notes

- `BaseGraphicScene` enforces a controlled lifecycle: `setup`, `resize`, `update`, `render`, `destroy`.
- New graphics can be a single scene node or a group node with nested children.
- Group related scenes under a shared parent folder when they extend a common base idea.
- Register tree nodes in `src/graphics/registry.ts` to expose navigation and deep links.
