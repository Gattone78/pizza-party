import { defineConfig } from 'vitest/config';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ mode }) => ({
  // Self-signed HTTPS so the iPad (and later the Quest) gets a secure context on the LAN.
  // `npm run dev:http` skips it for desktop tools that refuse self-signed certificates.
  plugins: mode === 'http' ? [] : [basicSsl()],
  server: { host: true },
  preview: { host: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}));
