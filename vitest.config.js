import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: './tests/setup.js',
    include: ['tests/unit/**/*.test.js'],
    exclude: ['tests/e2e/**/*'],
  },
});
