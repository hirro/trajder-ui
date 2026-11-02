/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// Only the tests use Vite here; each app's own Vite build compiles the source it imports.
export default defineConfig({
  plugins: [svelte()],
  // Mount components with Svelte's browser build (the default node condition resolves the SSR one).
  resolve: { conditions: ["browser"] },
  test: { environment: "jsdom", setupFiles: ["./vitest-setup.ts"] },
});
