import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

export default defineConfig({
    build: {
        lib: {
            entry: {
                index: "src/index.ts",
            },
            name: "riotplan-format",
            formats: ["es"],
        },
        rollupOptions: {
            external: [
                "better-sqlite3",
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
            plugins: [
                {
                    name: 'copy-schema',
                    writeBundle: () => {
                        // Copy schema.sql to dist/ (where bundled code expects it)
                        const srcPath = resolve('src/storage/schema.sql');
                        const destPath = resolve('dist/schema.sql');
                        copyFileSync(srcPath, destPath);
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
