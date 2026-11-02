import type { Preview } from "@storybook/svelte-vite";
import { themes } from "storybook/theming";
import "./preview.css";
import { LADDER_DOCS } from "../src/lib/sleeveFormat";

// The apps set the ladder card's docs link at startup; the catalogue points it at the README.
Object.assign(LADDER_DOCS, { href: "https://github.com/hirro/trajder-ui#use", label: "Docs →" });

const preview: Preview = {
  tags: ["autodocs"],
  parameters: { docs: { theme: themes.dark } },
};
export default preview;
