import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run in Node environment (no browser DOM needed for pure-function tests)
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
