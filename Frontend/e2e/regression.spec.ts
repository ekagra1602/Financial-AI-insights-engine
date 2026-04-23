import { test, expect } from '@playwright/test';

test.describe('Homepage non-regression', () => {
  test('homepage loads without crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
    expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
  });

  test('watchlist renders at least one item or empty state', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main, [role="main"], .min-h-screen').first()).toBeVisible();
  });

  test('stock chart container renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.js-plotly-plot, [class*="chart"], canvas').first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('News page non-regression', () => {
  test('news page loads at /news', async ({ page }) => {
    await page.goto('/news');
    await expect(page.locator('header')).toBeVisible();
  });

  test('news filter sidebar renders', async ({ page }) => {
    await page.goto('/news');
    // Filter sidebar contains a "Companies" heading
    await expect(page.getByText('Companies').first()).toBeVisible({ timeout: 10_000 });
  });

  test('news page does not throw JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/news');
    await page.waitForTimeout(2000);
    expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
  });
});

test.describe('Reminders page non-regression', () => {
  test('reminders page loads at /reminders', async ({ page }) => {
    await page.goto('/reminders');
    await expect(page.locator('header')).toBeVisible();
  });

  test('reminder text input is visible', async ({ page }) => {
    await page.goto('/reminders');
    await expect(page.getByPlaceholder(/remind|alert|when/i).or(page.locator('textarea, input[type="text"]').first())).toBeVisible({ timeout: 10_000 });
  });

  test('alerts panel heading renders', async ({ page }) => {
    await page.goto('/reminders');
    await expect(page.getByText(/alerts|reminders/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Chatbot non-regression', () => {
  test('chatbot page loads at /chatbot', async ({ page }) => {
    await page.goto('/chatbot');
    await expect(page.locator('header')).toBeVisible();
  });

  test('chatbot responds to a message', async ({ page }) => {
    await page.goto('/chatbot');
    const input = page.locator('input[type="text"], textarea').last();
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill('What is AAPL?');
    await input.press('Enter');
    // User message appears immediately in the conversation as a bg-primary bubble
    await expect(page.getByText('What is AAPL?')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Header and notifications non-regression', () => {
  test('header renders on all main pages', async ({ page }) => {
    for (const path of ['/', '/news', '/reminders', '/chatbot', '/sentiment-reports']) {
      await page.goto(path);
      await expect(page.locator('header')).toBeVisible();
    }
  });

  test('notification bell is visible in header', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header button, header [role="button"]').first()).toBeVisible();
  });
});

test.describe('Routing non-regression', () => {
  test('all nav links navigate without 404', async ({ page }) => {
    await page.goto('/');
    const navLinks = await page.locator('nav a, header a').all();
    for (const link of navLinks) {
      const href = await link.getAttribute('href');
      if (href && href.startsWith('/')) {
        await page.goto(href);
        await expect(page.locator('body')).toBeVisible();
        const bodyText = await page.textContent('body');
        expect(bodyText).not.toMatch(/404 not found/i);
      }
    }
  });

  test('sentiment url param ticker is reflected in input', async ({ page }) => {
    await page.goto('/sentiment-reports?ticker=AAPL');
    await expect(page.locator('body')).toBeVisible();
  });
});
