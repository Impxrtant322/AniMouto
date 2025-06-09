import path from "path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import webExtension from "@samrum/vite-plugin-web-extension";
import zip from "./scripts/zipVitePlugin";
import { ManifestV2, ManifestV3 } from "./src/manifest";
import pkg from "./package.json";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const configEnv = loadEnv(mode, process.cwd(), "");

  const manifest = configEnv.MANIFEST_VERSION === "3" ? ManifestV3 : ManifestV2;
  
  switch (mode) {
    case "chromium": {
      if (configEnv.EXTENSION_KEY)
        // @ts-ignore
        manifest.key = configEnv.EXTENSION_KEY;
      break;
    }
    case "firefox": {
      if (configEnv.EXTENSION_KEY)
        // @ts-ignore
        manifest.browser_specific_settings = { gecko: { id: configEnv.EXTENSION_KEY, update_url: configEnv.UPDATE_URL } };
      break;
    }
  }

  return {
    build: {
      outDir: `dist/${mode}`,
      chunkSizeWarningLimit: undefined,
    },
    optimizeDeps: {
      exclude: [ "@urql/svelte", "svelte-navigator" ]
    },
    plugins: [
      svelte(),
      webExtension({
        // @ts-ignore Error caused by both v2 and v3 support
        manifest: {
          author: pkg.author,
          description: pkg.description,
          name: pkg.displayName ?? pkg.name,
          version: pkg.version,
          ...manifest,
        },
      }),
      {
        // @ts-ignore idk why the .default is necessary :shrug:
        ...zip({
          dir: `dist/${mode}`,
          outputName: `../${pkg.name}-${pkg.version}-${mode}`
        }),
        apply: () => configEnv.zip !== undefined
      } as Plugin,
    ],
    resolve: {
      alias: {
        "@anilist/graphql": path.resolve(__dirname, "./node_modules/@anilist/graphql"),
        "$lib": path.resolve(__dirname, "./src/lib"),
        "$assets": path.resolve(__dirname, "./src/assets"),
        "~": path.resolve(__dirname, "./src"),
      },
    },
  };
});
