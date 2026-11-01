import { defineConfig, devices } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';

// WebKit (Safari's engine) runs when its browser build is installed; otherwise Chromium
// with iPad/iPhone device emulation (viewport, touch, DPR, user agent) is used.
const browsersDir = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '';
const hasWebKit = !!browsersDir && existsSync(browsersDir) && readdirSync(browsersDir).some((d) => d.startsWith('webkit'));
const engine = hasWebKit ? 'webkit' : 'chromium';

const ipad = devices['iPad (gen 7)'];
const ipadLandscape = devices['iPad (gen 7) landscape'];
const iphone = devices['iPhone 13'];

export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', acceptDownloads: true, trace: 'retain-on-failure' },
  webServer: { command: 'npm run preview', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 60_000 },
  projects: [
    { name: `ipad-portrait-${engine}`, use: { ...ipad, browserName: engine } },
    { name: `ipad-landscape-${engine}`, use: { ...ipadLandscape, browserName: engine } },
    { name: `iphone-${engine}`, use: { ...iphone, browserName: engine } },
  ],
});
