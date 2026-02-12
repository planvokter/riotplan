import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ["tests/**/*.test.ts"],
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                lines: 73,
                functions: 76,
                branches: 63,
                statements: 73
            },
            exclude: [
                'node_modules/',
                'dist/**',
                'docs/**',
                'vitest.config.ts',
                'vite.config.ts',
                'eslint.config.mjs',
                'src/cli/**',
                'src/ai/**',
            ]
        }
    },
    resolve: {
        alias: {
            '@': new URL('./src', import.meta.url).pathname
        }
    }
});
