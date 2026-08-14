import { defineConfig, devices } from '@playwright/test';

// E2E tests run against a real local Supabase stack (see supabase/), not a
// mock — `npx supabase start` must be running first. This config just
// starts the Vite dev server for you; it doesn't touch Supabase.
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
