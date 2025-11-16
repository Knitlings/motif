import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: './tests/setup.js',
    include: ['tests/unit/**/*.test.js'],
    exclude: ['tests/e2e/**/*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.js'],
      exclude: [
        'src/main.js', // Main app file - harder to unit test
        'tests/**',
        'dist/**',
        '**/*.config.js'
      ],
      all: true,
      lines: 60,
      functions: 60,
      branches: 60,
      statements: 60
    }
  },
});
