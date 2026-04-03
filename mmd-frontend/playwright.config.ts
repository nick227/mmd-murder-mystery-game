import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  use: {
    baseURL: 'http://localhost:5180',
    ...devices['iPhone 13'],
  },
  webServer: [
    {
      command: 'npm run dev',
      cwd: '../mmd-api',
      env: { ...process.env, E2E: 'true' } as Record<string, string>,
      url: 'http://localhost:3000/api/v1/stories',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npx vite --port 5180 --strictPort',
      env: { ...process.env, VITE_E2E: 'true' } as Record<string, string>,
      url: 'http://localhost:5180',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
})
