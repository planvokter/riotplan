import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
    build: {
        lib: {
            entry: {
                index: "src/index.ts",
            },
            name: "riotplan-ai",
            formats: ["es"],
        },
        rollupOptions: {
            external: [
                "@kjerneverk/execution",
                "@kjerneverk/execution-anthropic",
                "@kjerneverk/execution-openai",
                "@kjerneverk/execution-gemini",
                "@kjerneverk/execution-sampling",
                "@kjerneverk/agentic",
                "@planvokter/riotplan-catalyst",
                "@planvokter/riotplan-format",
                "node:fs",
                "node:path",
                "node:fs/promises",
                "node:process",
                "node:crypto",
            ],
            output: {
                entryFileNames: "[name].js",
            },
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
