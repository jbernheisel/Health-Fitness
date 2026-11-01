import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// 7:00 am Pacific on Monday, Nov 2 2026 — program day 1, a strength day.
const DAY1 = new Date('2026-11-02T15:00:00Z');

async function open(page: Page, at: Date = DAY1, hash = '') {
  await page.clock.setFixedTime(at);
  await page.goto('/' + hash);
  await expect(page.getByTestId('current-date').or(page.getByRole('heading', { name: 'Settings' }))).toBeVisible();
}
const nav = (page: Page, tab: string) => page.getByTestId(`nav-${tab}`).click();

test('Oikos shake adds 30g protein and 170 cal, survives refresh, and removes cleanly', async ({ page }) => {
  await open(page);
  await nav(page, 'food');
  await expect(page.getByTestId('food-protein-total')).toHaveText('0g');
  await expect(page.getByTestId('food-calories-total')).toHaveText('0');

  await page.getByTestId('quick-oikos-vanilla').click();
  await expect(page.getByTestId('food-protein-total')).toHaveText('30g');
  await expect(page.getByTestId('food-calories-total')).toHaveText('170');
  await expect(page.getByTestId('food-row')).toHaveCount(1);

  await page.reload();
  await nav(page, 'food');
  await expect(page.getByTestId('food-protein-total')).toHaveText('30g');
  await expect(page.getByTestId('food-calories-total')).toHaveText('170');

  await nav(page, 'today');
  await expect(page.getByTestId('today-protein-value')).toHaveText('30g');
  await expect(page.getByTestId('today-calories-value')).toHaveText('170');

  await nav(page, 'food');
  await page.getByTestId('food-delete').click();
  await expect(page.getByTestId('food-row')).toHaveCount(0);
  await expect(page.getByTestId('food-protein-total')).toHaveText('0g');
  await expect(page.getByTestId('food-calories-total')).toHaveText('0');
  await page.reload();
  await nav(page, 'food');
  await expect(page.getByTestId('food-protein-total')).toHaveText('0g');
  await expect(page.getByTestId('food-row')).toHaveCount(0);
});

test('navigation reaches every section and survives refresh', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('program-day')).toHaveText(/Day 1 of 60/);
  for (const [tab, eyebrow] of [['food', 'Food & Protein'], ['activity', 'Activity & Strength'], ['health', 'Wegovy & Health'], ['results', 'Results & Trends'], ['today', "Today's Check-in"]] as const) {
    await nav(page, tab);
    await expect(page.locator('.eyebrow')).toHaveText(eyebrow);
  }
  await nav(page, 'settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await nav(page, 'health');
  await page.reload();
  await expect(page.locator('.eyebrow')).toHaveText('Wegovy & Health');
});

test('quick-add totals combine multiple products; unverified items do not add fake numbers', async ({ page }) => {
  await open(page);
  await nav(page, 'food');
  await page.getByTestId('quick-huel-black-choc').click();
  await page.getByTestId('quick-chobani-berry').click();
  await page.getByTestId('quick-tillamook-jerky').click();
  await page.getByTestId('quick-monster-ultra').click();
  await expect(page.getByTestId('food-protein-total')).toHaveText('68g'); // 35 + 20 + 13
  await expect(page.getByTestId('food-calories-total')).toHaveText('560'); // 390 + 170; jerky & Monster unset
  await expect(page.getByTestId('food-protein-left')).toHaveText('52g');
  await expect(page.getByText('calories not entered')).toHaveCount(2);
});

test('custom meal entry, editing, and checklist auto-fill', async ({ page }) => {
  await open(page);
  await nav(page, 'food');
  await page.getByTestId('custom-name').fill('Chicken wrap');
  await page.getByTestId('custom-calories').fill('520');
  await page.getByTestId('custom-protein').fill('38');
  await page.getByTestId('custom-add').click();
  await expect(page.getByTestId('food-calories-total')).toHaveText('520');

  await page.getByRole('button', { name: 'Edit Chicken wrap' }).click();
  await page.getByTestId('edit-calories').fill('560');
  await page.getByTestId('edit-save').click();
  await expect(page.getByTestId('food-calories-total')).toHaveText('560');
  await expect(page.getByTestId('food-protein-total')).toHaveText('38g');

  await nav(page, 'today');
  await expect(page.getByTestId('check-calories')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('check-protein')).toHaveAttribute('aria-pressed', 'false');

  await page.reload();
  await nav(page, 'food');
  await expect(page.getByText('Chicken wrap').first()).toBeVisible();
  await expect(page.getByTestId('food-calories-total')).toHaveText('560');
});

test('checklist tiles toggle, persist, and medication starts the wait timer', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('checklist-count')).toHaveText('0 of 8');
  await page.getByTestId('check-water').click();
  await expect(page.getByTestId('check-water')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('check-symptoms').click();
  await page.getByTestId('med-quick').click();
  await expect(page.getByTestId('wait-timer')).toBeVisible();
  await expect(page.getByTestId('checklist-count')).toHaveText('3 of 8');

  await page.reload();
  await expect(page.getByTestId('checklist-count')).toHaveText('3 of 8');
  await expect(page.getByTestId('check-med')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('check-water').click();
  await expect(page.getByTestId('check-water')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('check-water')).toContainText('Not logged yet');

  await nav(page, 'health');
  await expect(page.getByTestId('med-taken')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('med-time')).toHaveValue('07:00');
  await page.getByTestId('med-dose').fill('1.5');
  await page.reload();
  await nav(page, 'health');
  await expect(page.getByTestId('med-dose')).toHaveValue('1.5');
});

test('dose is never auto-increased: next day pre-fills the last recorded dose', async ({ page }) => {
  await open(page);
  await nav(page, 'health');
  await page.getByTestId('med-taken').click();
  await page.getByTestId('med-dose').fill('1.5');
  // Day 31 is the reference 4 mg step; the app must still carry 1.5 mg forward.
  await page.getByTestId('date-input').fill('2026-12-02');
  await page.getByTestId('med-taken').click();
  await expect(page.getByTestId('med-dose')).toHaveValue('1.5');
});

test('strength workout logging persists and completes the workout item', async ({ page }) => {
  await open(page);
  await nav(page, 'activity');
  await page.getByTestId('start-workout').click();
  await expect(page.getByTestId('exercise')).toHaveCount(5);
  await page.getByTestId('reps-0-0').fill('10');
  await page.getByTestId('weight-0-0').fill('25');
  await page.getByTestId('set-done-0-0').click();
  await page.getByTestId('workout-duration').fill('25');
  await page.getByTestId('add-set').first().click();
  await expect(page.getByTestId('exercise').first().locator('.set-row')).toHaveCount(3);

  await page.reload();
  await nav(page, 'activity');
  await expect(page.getByTestId('reps-0-0')).toHaveValue('10');
  await expect(page.getByTestId('weight-0-0')).toHaveValue('25');
  await expect(page.getByTestId('set-done-0-0')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('workout-duration')).toHaveValue('25');

  await nav(page, 'today');
  await expect(page.getByTestId('check-workout')).toHaveAttribute('aria-pressed', 'true');

  // Tuesday is a walking day; it can be switched to recovery.
  await nav(page, 'activity');
  await page.getByTestId('next-day').click();
  await expect(page.getByTestId('plan-select').getByRole('radio', { name: 'Walk' })).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('plan-select').getByRole('radio', { name: 'Recovery' }).click();
  await page.reload();
  await nav(page, 'activity');
  await page.getByTestId('next-day').click();
  await expect(page.getByTestId('plan-select').getByRole('radio', { name: 'Recovery' })).toHaveAttribute('aria-checked', 'true');
});

test('date navigation keeps days separate and the app follows the clock past midnight', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('current-date')).toHaveText('Monday, November 2');
  await page.getByTestId('today-steps-input').fill('4200');
  await page.getByTestId('next-day').click();
  await expect(page.getByTestId('program-day')).toContainText('Day 2 of 60');
  await expect(page.getByTestId('today-steps-input')).toHaveValue('');
  await page.getByTestId('go-today').click();
  await expect(page.getByTestId('today-steps-input')).toHaveValue('4200');

  // 11:59 pm Pacific is still Nov 2 even though it is Nov 3 in UTC.
  await page.clock.setFixedTime(new Date('2026-11-03T07:59:00Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByTestId('current-date')).toHaveText('Monday, November 2');

  await page.clock.setFixedTime(new Date('2026-11-03T08:01:00Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByTestId('current-date')).toHaveText('Tuesday, November 3');
  await expect(page.getByTestId('program-day')).toContainText('Day 2 of 60');
  await expect(page.getByTestId('today-steps-input')).toHaveValue('');
});

test('before the program starts, the header counts down', async ({ page }) => {
  await open(page, new Date('2026-11-01T18:00:00Z'));
  await expect(page.getByTestId('program-day')).toHaveText(/Program starts tomorrow/);
});

test('charts show "Not enough data" until readings exist, and never treat gaps as zero', async ({ page }) => {
  await open(page, new Date('2026-11-08T16:00:00Z')); // day 7
  await nav(page, 'results');
  await expect(page.getByTestId('weight-chart')).toHaveAttribute('data-state', 'empty');
  await expect(page.getByTestId('weight-chart')).toContainText('Not enough data');
  await expect(page.getByTestId('latest-weight')).toHaveText('Not measured yet');
  await expect(page.getByTestId('avg7-steps')).toContainText('Not enough data');

  // Two weigh-ins and a single steps entry across the week.
  await nav(page, 'health');
  await page.getByTestId('date-input').fill('2026-11-02');
  await page.getByTestId('weight-input').fill('194.6');
  await page.getByTestId('date-input').fill('2026-11-06');
  await page.getByTestId('weight-input').fill('192.4');
  await nav(page, 'activity');
  await page.getByTestId('steps-input').fill('5000');

  await page.getByTestId('go-today').click();
  await nav(page, 'results');
  await expect(page.getByTestId('weight-chart')).toHaveAttribute('data-state', 'chart');
  await expect(page.getByTestId('weight-chart').locator('circle')).toHaveCount(2);
  await expect(page.getByTestId('latest-weight')).toHaveText('192.4 lb');
  await expect(page.getByTestId('total-lost')).toHaveText('2.6 lb');
  // One day of 5,000 steps in the last 7 → average is 5,000, not 714.
  await expect(page.getByTestId('avg7-steps')).toContainText('5,000');
  await expect(page.getByTestId('avg7-steps')).toContainText('1 of 7 days logged');
  await expect(page.getByTestId('bp-chart')).toContainText('No blood-pressure readings yet');

  // Range buttons re-scope the charts.
  await page.getByRole('tab', { name: '7 days' }).click();
  await expect(page.getByRole('tab', { name: '7 days' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('weight-chart')).toHaveAttribute('data-state', 'chart');
  await page.getByRole('tab', { name: 'All time' }).click();
  await expect(page.getByTestId('weight-chart')).toHaveAttribute('data-state', 'chart');
});

test('CSV export contains recorded rows only', async ({ page }) => {
  await open(page);
  await page.getByTestId('today-steps-input').fill('3800');
  await page.getByTestId('quick-oikos-vanilla').click();
  await nav(page, 'settings');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-csv').click()]);
  expect(dl.suggestedFilename()).toBe('momentum-daily-2026-11-02.csv');
  const csv = readFileSync((await dl.path())!, 'utf8').trim().split(/\r\n/);
  expect(csv[0]).toContain('date,program_day,weight_lb,calories,protein_g,steps');
  expect(csv).toHaveLength(2);
  expect(csv[1]).toMatch(/^2026-11-02,1,,170,30,3800,/);

  const [fd] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-food-csv').click()]);
  const food = readFileSync((await fd.path())!, 'utf8');
  expect(food).toContain('Oikos Vanilla Shake,drink,170,30,5');
});

test('JSON backup round-trips with validation and confirmation', async ({ page }) => {
  await open(page);
  await page.getByTestId('quick-huel-black-choc').click();
  await page.getByTestId('today-weight-input').fill('194');
  await nav(page, 'settings');
  await expect(page.getByTestId('last-backup')).toHaveText('never');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-json').click()]);
  const path = (await dl.path())!;
  const backup = JSON.parse(readFileSync(path, 'utf8'));
  expect(backup.app).toBe('momentum');
  expect(backup.foods).toHaveLength(1);
  await expect(page.getByTestId('last-backup')).not.toHaveText('never');

  // Invalid file is rejected without touching data.
  await page.getByTestId('import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(page.getByTestId('import-error')).toBeVisible();

  // Erase, then restore.
  await page.getByTestId('reset-all').click();
  await page.getByTestId('confirm-yes').click();
  await nav(page, 'food');
  await expect(page.getByTestId('food-protein-total')).toHaveText('0g');

  await nav(page, 'settings');
  await page.getByTestId('import-file').setInputFiles(path);
  await expect(page.getByTestId('import-summary')).toContainText('1 food entries');
  await page.getByTestId('confirm-yes').click();
  await nav(page, 'food');
  await expect(page.getByTestId('food-protein-total')).toHaveText('35g');
  await page.reload();
  await nav(page, 'today');
  await expect(page.getByTestId('today-weight-input')).toHaveValue('194');
  await expect(page.getByTestId('today-protein-value')).toHaveText('35g');
});

test('settings edits apply immediately and persist', async ({ page }) => {
  await open(page);
  await nav(page, 'settings');
  await page.getByTestId('set-protein').fill('130');
  await page.getByTestId('schedule-2').getByRole('radio', { name: 'Strength' }).click(); // Tuesday
  await page.reload();
  await nav(page, 'today');
  await expect(page.getByTestId('today-protein')).toContainText('of 130g');
  await nav(page, 'activity');
  await page.getByTestId('next-day').click();
  await expect(page.getByTestId('plan-select').getByRole('radio', { name: 'Strength' })).toHaveAttribute('aria-checked', 'true');
});

test('backup reminder appears once data exists and links to Settings', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('backup-reminder')).toHaveCount(0);
  await page.getByTestId('water-plus-8').click();
  await expect(page.getByTestId('water-value')).toHaveText('8 oz');
  await expect(page.getByTestId('backup-reminder')).toBeVisible();
  await page.getByTestId('backup-reminder').click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});

test('symptoms: one-tap "no symptoms" and severity ratings persist', async ({ page }) => {
  await open(page);
  await nav(page, 'health');
  await page.getByTestId('no-symptoms').click();
  await page.getByTestId('sym-nausea').getByRole('radio', { name: 'Mild' }).click();
  await page.getByTestId('appetite').getByRole('radio', { name: '4' }).click();
  await page.getByTestId('bp-sys').fill('128');
  await page.getByTestId('bp-dia').fill('82');
  await page.reload();
  await nav(page, 'health');
  await expect(page.getByTestId('sym-nausea').getByRole('radio', { name: 'Mild' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('sym-fatigue').getByRole('radio', { name: 'None' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('symptoms-checked')).toBeChecked();
  await nav(page, 'today');
  await expect(page.getByTestId('check-symptoms')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('check-bp')).toHaveAttribute('aria-pressed', 'true');
});

test('layout has no horizontal overflow on every screen', async ({ page }) => {
  await open(page);
  for (const tab of ['today', 'food', 'activity', 'health', 'results', 'settings']) {
    await nav(page, tab);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `overflow on ${tab}`).toBeLessThanOrEqual(1);
  }
});
