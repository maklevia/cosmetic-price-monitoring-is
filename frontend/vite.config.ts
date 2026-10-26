import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` from the root directory (`../`).
  const env = loadEnv(mode, '../', '');

  // Docker builds pass these values as build arguments. Local development
  // falls back to the values from the root .env file.
  const apiOrigin = process.env.API_ORIGIN ?? env.API_ORIGIN;
  const authOrigin = process.env.AUTH_ORIGIN ?? env.AUTH_ORIGIN;

  if (!apiOrigin || !authOrigin) {
    throw new Error("API_ORIGIN and AUTH_ORIGIN must be set before building");
  }

  return {
    plugins: [react()],
    resolve: {
      tsconfigPaths: true,
    },
    define: {
      // Expose service origins explicitly to the client code
      'import.meta.env.API_ORIGIN': JSON.stringify(apiOrigin),
      'import.meta.env.AUTH_ORIGIN': JSON.stringify(authOrigin),
    }
  };
})
