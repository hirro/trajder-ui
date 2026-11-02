import type { StorybookConfig } from "@storybook/svelte-vite";
import tailwindcss from "@tailwindcss/vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.svelte"],
  addons: ["@storybook/addon-svelte-csf", "@storybook/addon-docs"],
  framework: "@storybook/svelte-vite",
  // Tailwind is only for the catalogue; each app runs its own over the components.
  viteFinal: (config) => ({ ...config, plugins: [tailwindcss(), ...(config.plugins ?? [])] }),
};
export default config;
