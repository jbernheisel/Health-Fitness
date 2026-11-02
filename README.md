# Momentum

A personal health and weight-loss check-in for a 90-day oral Wegovy program (Nov 2, 2026 – Jan 30, 2027). It's built for iPad Safari and takes under two minutes a day.

Everything stays on the device. There's no account, no server, and no health data leaves the browser.

## Using it on iPad

1. Open the site in **Safari**: `https://jbernheisel.github.io/Health-Fitness/` (once Pages is enabled, see below).
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open Momentum from the Home Screen icon each morning. After the first visit it works offline.

> Safari tabs and the Home Screen app keep **separate** storage. Pick one and stick with it, or move data between them with a JSON backup.

### Daily flow
- **Today**: tap *Take Oral Wegovy* (the 30-minute wait timer starts), tap quick-add drinks, then type steps, water, and weight.
- **Food**: one-tap Huel / Oikos / Chobani / jerky / Monster buttons. Add custom meals with your own calories and protein, and save any of them as a quick-add button.
- **Activity**: steps, weekly targets, strength sets, reps, and weights (carried over from your last session), plus walks and recovery days.
- **Health**: dose, time, wait timer, symptoms (0–3), blood pressure, heart rate, water, appetite, hours fasted, weight, and notes. The titration table is reference only, and the app never changes your dose.
- **Results**: weight, calories, protein, steps, workouts, medication, side effects, and BP over 7 / 30 / 60 / 90 days or all time. It also compares the three 30-day blocks side by side and has day-30 / day-60 / day-90 reviews. Missing days stay blank. They're never counted as zero.

### Your data
- Stored in this browser's IndexedDB. **Not synced** between devices or browsers. Clearing Safari website data erases it.
- **Settings → Save JSON backup** regularly (keep it in Files / iCloud Drive). The Today screen reminds you if it's been 7+ days.
- **Restore from backup** checks the file and asks for confirmation before overwriting anything.
- CSV exports cover daily data, the food log, and workouts.

## Development

```bash
npm install
npm run dev        # local dev server
npm run build      # production build in dist/
npm run preview    # serve dist/ on :4173
npm test           # Playwright suite (iPad portrait, iPad landscape, iPhone)
```

Stack: React 18, TypeScript, Vite, `idb` (IndexedDB), hand-built SVG charts, a small service worker for offline use (`public/sw.js`, HTTPS only).

The tests run in WebKit when a WebKit build is installed. Otherwise they run in Chromium with iPad/iPhone device emulation.

## Deploying

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`. One-time setup: **repo Settings → Pages → Build and deployment → Source: GitHub Actions**. Then re-run the workflow.

Any static HTTPS host works too (Netlify Drop, Cloudflare Pages, Vercel). Just upload `dist/`. The build uses relative paths, so it runs from any sub-folder.

## Medical note

Momentum is a personal log. It doesn't diagnose symptoms or recommend medication changes. Follow your prescriber's directions, and seek care for severe or persistent abdominal pain, repeated vomiting, dehydration, or fainting.
