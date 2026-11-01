// Renders public/icons/icon.svg to PNG icons using the preinstalled Playwright Chromium.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
for (const [name, size, full] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['apple-touch-icon.png', 180, true]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  // Apple applies its own rounded mask, so the touch icon is a full-bleed square.
  const art = full ? svg.replace('rx="112"', 'rx="0"') : svg;
  await page.setContent(`<html><body style="margin:0;background:transparent">${art.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: new URL(`../public/icons/${name}`, import.meta.url).pathname, omitBackground: true });
  await page.close();
}
await browser.close();
console.log('icons written');
