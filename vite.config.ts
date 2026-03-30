import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import path from 'node:path';
import { copyFile } from 'node:fs/promises';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: "src/index.ts",
      },
      name: "riotplan",
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        "js-yaml",
        "@planvokter/riotplan-ai",
        "@planvokter/riotplan-cloud",
        "@planvokter/riotplan-core",
        "@planvokter/riotplan-core/artifacts",
        "@planvokter/riotplan-catalyst",
        "@planvokter/riotplan-format",
        "@planvokter/riotplan-templates",
        "@planvokter/riotplan-verify",
        "@kjerneverk/riotprompt",
        "@redaksjon/context",
        "@fjell/logging",
        "@utilarium/cardigantime",
        "@utilarium/overcontext",
        "zod",
        "yaml",
        "better-sqlite3",
        "bindings",
        "file-uri-to-path",
        "node:fs",
        "node:path",
        "node:fs/promises",
        "node:os",
        "node:http",
        "node:url",
        "node:process",
        "node:util",
        "node:crypto",
        "node:child_process",
      ],
      output: {
        entryFileNames: "[name].js",
      },
      plugins: [
        {
          name: 'copy-schema',
          writeBundle: async () => {
            const schemaSource = path.resolve('../riotplan-format/dist/schema.sql');
            const schemaDest = path.resolve('dist/schema.sql');
            try {
              await copyFile(schemaSource, schemaDest);
            } catch (error) {
              console.warn('Warning: Could not copy schema.sql from riotplan-format:', error);
            }
          }
        }
      ]
    },
    sourcemap: true,
    minify: false,
  },
  plugins: [
    dts({
      rollupTypes: true,
    }),
  ],
});
