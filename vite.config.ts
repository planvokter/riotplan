import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { chmod } from 'node:fs/promises';
import path from 'node:path';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: "src/index.ts",
        cli: "src/cli/cli.ts",
        bin: "src/cli/bin.ts",
      },
      name: "riotplan",
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        "commander",
        "chalk",
        "js-yaml",
        "marked",
        "inquirer",
        "riotprompt",
        "agentic",
        "execution",
        "@kjerneverk/execution",
        "@kjerneverk/execution-anthropic",
        "@kjerneverk/execution-openai",
        "@kjerneverk/execution-gemini",
        "@kjerneverk/riotprompt",
        "@kjerneverk/agentic",
        "@utilarium/cardigantime",
        "@modelcontextprotocol/sdk",
        "@modelcontextprotocol/sdk/server/mcp.js",
        "@modelcontextprotocol/sdk/server/stdio.js",
        "zod",
        "node:fs",
        "node:path",
        "node:fs/promises",
        "node:os",
        "node:http",
        "node:url",
        "node:process",
        "node:readline",
        "node:async_hooks",
        "node:util",
        "node:crypto",
        "node:child_process",
      ],
      output: {
        entryFileNames: "[name].js",
      },
      plugins: [
        {
          name: 'chmod-bin',
          writeBundle: async () => {
            // Make bin executable after build
            const binPath = path.resolve('dist/bin.js');
            await chmod(binPath, 0o755);
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
