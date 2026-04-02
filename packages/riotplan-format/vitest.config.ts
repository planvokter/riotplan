import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ["tests/**/*.test.ts"],
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            thresholds: {
                lines: 75,
                functions: 75,
                branches: 45,
                statements: 75
            },
            exclude: [
                'node_modules/',
                'dist/**',
                'vitest.config.ts',
                'vite.config.ts',
                'eslint.config.mjs',
            ]
        }
    },
    resolve: {
        alias: {
            '@': new URL('./src', import.meta.url).pathname
        }
    }
});
