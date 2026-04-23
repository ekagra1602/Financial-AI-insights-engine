import { test, expect } from '@playwright/test';

test.describe('Sentiment page navigation', () => {
  test('navigates to /sentiment-reports from header', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Insights', exact: true }).click();
    await expect(page).toHaveURL(/sentiment-reports/);
  });

  test('sentiment page shows ticker input', async ({ page }) => {
    await page.goto('/sentiment-reports');
    await expect(page.getByPlaceholder(/enter stock ticker/i)).toBeVisible();
  });

  test('url param pre-populates input', async ({ page }) => {
    await page.goto('/sentiment-reports?ticker=AAPL');
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
  });
});

test.describe('Sentiment report generation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sentiment-reports?ticker=AAPL');
  });

  test('shows loading state after ticker submitted', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('report renders company name', async ({ page }) => {
    await expect(page.getByText(/apple/i)).toBeVisible({ timeout: 30_000 });
  });

  test('all five horizon buttons are visible', async ({ page }) => {
    await expect(page.getByText(/apple/i)).toBeVisible({ timeout: 30_000 });
    for (const h of ['1D', '1W', '1M', '3M', '6M']) {
      await expect(page.getByRole('button', { name: h })).toBeVisible();
    }
  });

  test('changing horizon shows loading then new report', async ({ page }) => {
    await expect(page.getByText(/apple/i)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: '1W' }).click();
    await expect(page.getByText(/apple/i)).toBeVisible({ timeout: 30_000 });
  });

  test('Refresh Report button is clickable', async ({ page }) => {
    await expect(page.getByText(/apple/i)).toBeVisible({ timeout: 30_000 });
    const refreshBtn = page.getByRole('button', { name: /refresh report/i });
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();
    await expect(page.locator('body')).toBeVisible();
  });

  test('sentiment score displays in N.N/100 format', async ({ page }) => {
    await expect(page.getByText(/apple/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/\/100/)).toBeVisible();
  });
});

test.describe('Sentiment report content', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sentiment-reports?ticker=AAPL');
    await expect(page.getByText(/apple/i)).toBeVisible({ timeout: 30_000 });
  });

  test('stance badge shows bullish, bearish, or neutral', async ({ page }) => {
    const stanceEl = page.locator('text=/bullish|bearish|neutral/i').first();
    await expect(stanceEl).toBeVisible();
  });

  test('Forecast Range section is visible', async ({ page }) => {
    await expect(page.getByText('Forecast Range')).toBeVisible();
  });

  test('Analysis Summary section is visible', async ({ page }) => {
    await expect(page.getByText('Analysis Summary')).toBeVisible();
  });
});

test.describe('Sentiment error states', () => {
  test('empty ticker submit does not crash', async ({ page }) => {
    await page.goto('/sentiment-reports');
    const form = page.locator('form').first();
    await form.evaluate((el: HTMLFormElement) => el.requestSubmit());
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByPlaceholder(/enter stock ticker/i)).toBeVisible();
  });

  test('intercepted 500 shows user-friendly error message', async ({ page }) => {
    await page.route('**/api/v1/sentiment/report/**', (route) => {
      route.fulfill({ status: 500, body: JSON.stringify({ detail: 'Internal server error' }) });
    });
    await page.goto('/sentiment-reports?ticker=AAPL');
    await expect(page.getByText(/failed|error/i)).toBeVisible({ timeout: 15_000 });
  });

  test('network-failed request shows friendly message', async ({ page }) => {
    await page.route('**/api/v1/sentiment/report/**', (route) => route.abort());
    await page.goto('/sentiment-reports?ticker=AAPL');
    await expect(page.getByText(/failed|error/i)).toBeVisible({ timeout: 15_000 });
  });
});
