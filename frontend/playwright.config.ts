import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 1,
  workers: 1,
  timeout: 60000,
  globalSetup: './e2e/setup-auth.ts',
  reporter: [['html', { outputFolder: 'playwright-report' }]],
  webServer: [
    {
      command: 'npm --prefix ../backend run dev',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 120000,
    },
  ],
  use: {
    baseURL: 'http://localhost:5173',
    storageState: 'test-results/.auth.json',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
      testIgnore: '**/report-audit.spec.ts',
    },
    {
      name: 'laptop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
      testIgnore: '**/report-audit.spec.ts',
    },
    {
      name: 'tablet',
      use: { ...devices['iPad Pro 11'] },
      testIgnore: '**/report-audit.spec.ts',
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 14'] },
      testIgnore: '**/report-audit.spec.ts',
    },
    {
      name: 'audit',
      testMatch: '**/report-audit.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
      },
    },
  ],
})
