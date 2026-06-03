const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const pageUrl = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;

const viewports = [
  { name: 'desktop', width: 1280, height: 900, maxChartHeight: 360 },
  { name: 'mobile', width: 390, height: 844, maxChartHeight: 520 }
];

for (const viewport of viewports) {
  test.describe(`smartphone pricing chart ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('renders horizontally without overflowing or console errors', async ({ page }) => {
      const consoleErrors = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => consoleErrors.push(error.message));

      await page.goto(pageUrl);

      const chart = page.locator('.phone-pricing-chart');
      await expect(chart).toBeVisible();
      await expect(chart.locator('.horizontal-stack-chart')).toHaveAttribute('aria-label', /Horizontal stacked bar chart/);
      await expect(chart.locator('.vertical-stack-chart')).toHaveCount(0);

      const expectedLabels = [
        'Empty price-link field',
        'Brand/product page',
        '"See manual"',
        'Support page, no prices',
        'Temu/AliExpress',
        'Usable pricing path'
      ];
      for (const label of expectedLabels) {
        await expect(chart.locator('.stack-label', { hasText: label })).toHaveCount(1);
      }
      await expect(chart.locator('.stack-callout')).toHaveText('Other dead end');

      const expectedCounts = ['1,026', '248', '150', '126', '103', '17', '384'];
      for (const count of expectedCounts) {
        await expect(chart.locator('.stack-bar-row .stack-cell', { hasText: count })).toHaveCount(1);
      }

      const problemSegments = chart.locator('.stack-bar-row .stack-cell:not(.ok)');
      await expect(problemSegments).toHaveCount(6);
      for (const className of ['problem', 'problem-dark', 'problem-mid', 'problem-soft', 'problem-pale', 'problem-muted']) {
        await expect(chart.locator(`.stack-bar-row .stack-cell.${className}`)).toHaveCount(1);
      }
      await expect(chart.locator('.stack-bar-row .stack-cell.ok')).toHaveText('384');

      const chartBox = await chart.boundingBox();
      const stackBox = await chart.locator('.horizontal-stack-chart').boundingBox();
      const barBox = await chart.locator('.stack-bar-row').boundingBox();
      expect(chartBox).toBeTruthy();
      expect(stackBox).toBeTruthy();
      expect(barBox).toBeTruthy();
      expect(chartBox.height).toBeLessThanOrEqual(viewport.maxChartHeight);
      expect(chartBox.x).toBeGreaterThanOrEqual(0);
      expect(chartBox.x + chartBox.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(stackBox.x).toBeGreaterThanOrEqual(chartBox.x - 1);
      expect(stackBox.x + stackBox.width).toBeLessThanOrEqual(chartBox.x + chartBox.width + 1);
      expect(barBox.x).toBeGreaterThanOrEqual(chartBox.x - 1);
      expect(barBox.x + barBox.width).toBeLessThanOrEqual(chartBox.x + chartBox.width + 1);
      expect(consoleErrors).toEqual([]);
    });

    test('callout pointer targets the other-dead-end segment', async ({ page }) => {
      await page.goto(pageUrl);

      const chart = page.locator('.phone-pricing-chart');
      const callout = chart.locator('[data-callout-for="other-dead-end"]');
      const targetSegment = chart.locator('[data-segment="other-dead-end"]');
      const bar = chart.locator('.stack-bar-row');
      const labelPlaceholder = chart.locator('.stack-label-row .stack-label').nth(5);

      await expect(callout).toHaveText('Other dead end');
      await expect(targetSegment).toHaveText('17');
      await expect(labelPlaceholder).toHaveAttribute('aria-hidden', 'true');
      await expect(labelPlaceholder).toHaveText('');
      await expect(chart.locator('.stack-bar-row .stack-cell').nth(5)).toHaveAttribute('data-segment', 'other-dead-end');

      const geometry = await callout.evaluate((element) => {
        const calloutBox = element.getBoundingClientRect();
        const pointerStyle = window.getComputedStyle(element, '::after');
        const parsePixels = (value) => Number.parseFloat(value) || 0;
        return {
          callout: {
            x: calloutBox.x,
            y: calloutBox.y,
            width: calloutBox.width,
            height: calloutBox.height
          },
          pointer: {
            left: parsePixels(pointerStyle.left),
            top: parsePixels(pointerStyle.top),
            height: parsePixels(pointerStyle.height),
            writingMode: window.getComputedStyle(element).writingMode
          }
        };
      });
      const targetBox = await targetSegment.boundingBox();
      const barBox = await bar.boundingBox();
      const previousBox = await chart.locator('.stack-bar-row .stack-cell').nth(4).boundingBox();
      const nextBox = await chart.locator('.stack-bar-row .stack-cell').nth(6).boundingBox();

      expect(targetBox).toBeTruthy();
      expect(barBox).toBeTruthy();
      expect(previousBox).toBeTruthy();
      expect(nextBox).toBeTruthy();

      const pointerX = geometry.callout.x + geometry.pointer.left;
      const pointerStartY = geometry.callout.y + geometry.pointer.top;
      const pointerEndY = pointerStartY + geometry.pointer.height;
      const targetCenterX = targetBox.x + targetBox.width / 2;
      const tolerance = viewport.name === 'desktop' ? 2 : 4;

      expect(geometry.pointer.writingMode).not.toMatch(/vertical/i);
      expect(pointerX).toBeGreaterThanOrEqual(targetBox.x);
      expect(pointerX).toBeLessThanOrEqual(targetBox.x + targetBox.width);
      expect(Math.abs(pointerX - targetCenterX)).toBeLessThanOrEqual(tolerance);
      expect(pointerX).toBeGreaterThan(previousBox.x + previousBox.width);
      expect(pointerX).toBeLessThan(nextBox.x);
      expect(pointerStartY).toBeGreaterThanOrEqual(geometry.callout.y + geometry.callout.height);
      expect(pointerStartY).toBeLessThan(barBox.y);
      expect(pointerEndY).toBeGreaterThanOrEqual(barBox.y);
      expect(pointerEndY).toBeLessThanOrEqual(barBox.y + barBox.height);
    });
  });
}
