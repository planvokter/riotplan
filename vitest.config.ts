import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ["tests/**/*.test.ts"],
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                lines: 78,
                functions: 78,
                branches: 77.5,
                statements: 78
            },
            exclude: [
                'node_modules/',
                'dist/**',
                'docs/**',
                'vitest.config.ts',
                'vite.config.ts',
                'eslint.config.mjs',
                'src/cli/commands/**',
                'src/cli/utils/**',
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
