/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    environment: 'node',
    // 入力欄のテスト (.tsx) だけ先頭の docblock で jsdom に切り替える
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
