import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
    build: {
        lib: {
            entry: {
                index: "src/index.ts",
            },
            name: "riotplan-templates",
            formats: ["es"],
        },
        rollupOptions: {
            external: [
                "node:fs",
                "node:path",
                "node:fs/promises",
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
