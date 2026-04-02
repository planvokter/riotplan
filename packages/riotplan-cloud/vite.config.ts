import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
    build: {
        lib: {
            entry: {
                index: "src/index.ts",
            },
            name: "riotplan-cloud",
            formats: ["es"],
        },
        rollupOptions: {
            external: [
                "@google-cloud/storage",
                "node:fs",
                "node:path",
                "node:fs/promises",
                "node:os",
                "node:url",
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
