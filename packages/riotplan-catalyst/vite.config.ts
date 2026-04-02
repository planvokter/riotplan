import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
    build: {
        lib: {
            entry: "./src/riotplan-catalyst.ts",
            name: "riotplan-catalyst",
            formats: ["es"],
        },
        rollupOptions: {
            external: [
                "zod",
                "yaml",
                /^node:/,
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
    resolve: {
        alias: {
            '@': new URL('./src', import.meta.url).pathname
        }
    }
});
