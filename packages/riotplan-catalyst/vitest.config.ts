import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ["tests/**/*.test.ts"],
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                lines: 70,
                functions: 0,
                branches: 0,
                statements: 70
            },
            exclude: [
                'node_modules/',
                'dist/**',
                'docs/**',
                'vitest.config.ts',
                'vite.config.ts',
                'eslint.config.mjs',
                'src/loader/**',
                'src/merger/**',
            ]
        }
    },
    resolve: {
        alias: {
            '@': new URL('./src', import.meta.url).pathname
        }
    }
});
