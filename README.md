# trajder-ui

Svelte 5 components and helpers shared by Trajder and trajder-ai: the promotion ladder badge, sleeve scorecard formatting and sorting, weekly result bars, the calibration chart and the sparklines.

## Use

```sh
npm install github:hirro/trajder-ui#v0.1.0
```

```ts
import { LadderBadge, fmtPct, sortSleeves } from "trajder-ui";
```

The package ships its Svelte and TypeScript source, and the app's Vite build compiles it. The app sets up two things:

- Tailwind skips `node_modules`, so point it at the components in the app's CSS, after `@import "tailwindcss";`:

  ```css
  @source "../node_modules/trajder-ui/src";
  ```

- The ladder card's docs link (hidden until set) and the rung texts belong to the app. Set them once before mounting:

  ```ts
  import { LADDER_DOCS } from "trajder-ui";
  Object.assign(LADDER_DOCS, { href: "#/doc/sleeves/LIFECYCLE.md", label: "Lifecycle docs →" });
  ```

## Develop

```sh
npm install
npm run check
npm test
```

To release, tag `vX.Y.Z`, push the tag, then bump `#vX.Y.Z` in each app's `package.json` and run `npm install`.
