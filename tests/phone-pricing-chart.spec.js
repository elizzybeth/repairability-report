const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const pageUrl = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;

const viewports = [
  { name: 'desktop', width: 1280, height: 900, maxChartHeight: 360 },
  { name: 'mobile', width: 390, height: 844, maxChartHeight: 520 },
  { name: 'compact mobile', width: 360, height: 740, maxChartHeight: 560 }
];

async function getBox(locator) {
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  return box;
}

async function getLineGeometry(locator) {
  return locator.evaluate((element) => ({
    x1: Number(element.getAttribute('x1')),
    y1: Number(element.getAttribute('y1')),
    x2: Number(element.getAttribute('x2')),
    y2: Number(element.getAttribute('y2'))
  }));
}

function centerX(box) {
  return box.x + box.width / 2;
}

function bottomY(box) {
  return box.y + box.height;
}

function boxesOverlap(a, b, tolerance = 0) {
  return !(
    a.x + a.width <= b.x + tolerance ||
    b.x + b.width <= a.x + tolerance ||
    a.y + a.height <= b.y + tolerance ||
    b.y + b.height <= a.y + tolerance
  );
}

for (const viewport of viewports) {
  test.describe(`smartphone pricing chart ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('renders as SVG and keeps the tiny callout aligned', async ({ page }) => {
      const consoleErrors = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => consoleErrors.push(error.message));

      await page.goto(pageUrl);

      const chart = page.locator('.phone-pricing-chart');
      const svg = chart.locator('svg[data-chart="phone"]');
      await expect(svg).toBeVisible();
      await expect(chart.locator('.horizontal-stack-chart')).toHaveCount(0);

      const segmentRects = svg.locator('rect[data-segment]');
      await expect(segmentRects).toHaveCount(7);

      const labelChecks = [
        ['empty-price-link-field', 'Empty price-link field'],
        ['brand-product-page', 'Brand/product page'],
        ['see-manual', '"See manual"'],
        ['support-page-no-prices', /Support page,\s*no prices/],
        ['temu-aliexpress', /Temu\/\s*AliExpress/],
        ['usable-pricing-path', 'Usable pricing path']
      ];
      for (const [id, expected] of labelChecks) {
        const label = svg.locator(`text[data-label-for="${id}"]`);
        await expect(label).toHaveCount(1);
        await expect(label).toHaveText(expected);
      }

      for (const [id, count] of [
        ['empty-price-link-field', '1,026'],
        ['brand-product-page', '248'],
        ['see-manual', '150'],
        ['support-page-no-prices', '126'],
        ['temu-aliexpress', '103'],
        ['usable-pricing-path', '384']
      ]) {
        await expect(svg.locator(`text[data-count-for="${id}"]`)).toHaveText(count);
      }
      await expect(svg.locator('text[data-callout-text-for="other-dead-end"]')).toHaveText(/Other dead end\s*17/);
      await expect(svg.locator('text[data-total-label="phone"]')).toHaveText('2,054 active smartphone/tablet records');

      const chartBox = await chart.boundingBox();
      const svgBox = await svg.boundingBox();
      const scrollMetrics = await chart.locator('.chart-scroll').evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth
      }));
      const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(chartBox).toBeTruthy();
      expect(svgBox).toBeTruthy();
      expect(chartBox.height).toBeLessThanOrEqual(viewport.maxChartHeight);
      expect(chartBox.x).toBeGreaterThanOrEqual(0);
      expect(chartBox.x + chartBox.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(svgBox.x).toBeGreaterThanOrEqual(chartBox.x - 1);
      expect(svgBox.x + svgBox.width).toBeLessThanOrEqual(chartBox.x + chartBox.width + 1);
      expect(scrollMetrics.scrollWidth).toBeLessThanOrEqual(scrollMetrics.clientWidth + 1);
      expect(pageOverflow).toBeLessThanOrEqual(1);
      await expect(chart.locator('.scroll-hint')).toBeHidden();

      const targetBox = await getBox(svg.locator('rect[data-segment="other-dead-end"]'));
      const calloutBox = await getBox(svg.locator('rect[data-callout-box-for="other-dead-end"]'));
      const calloutTextBox = await getBox(svg.locator('text[data-callout-text-for="other-dead-end"]'));
      const stem = await getLineGeometry(svg.locator('line[data-callout-stem-for="other-dead-end"]'));

      expect(calloutBox.width).toBeGreaterThan(70);
      expect(calloutBox.height).toBeGreaterThan(20);
      expect(calloutTextBox.width).toBeLessThanOrEqual(calloutBox.width + 1);
      expect(calloutTextBox.height).toBeLessThanOrEqual(calloutBox.height + 1);
      expect(boxesOverlap(calloutBox, targetBox, 0)).toBe(false);
      expect(Math.abs(stem.x1 - centerX(targetBox))).toBeLessThanOrEqual(viewport.name === 'desktop' ? 2 : 4);
      expect(Math.abs(stem.x2 - centerX(targetBox))).toBeLessThanOrEqual(viewport.name === 'desktop' ? 2 : 4);
      expect(stem.y1).toBeGreaterThan(bottomY(calloutBox) - 1);
      expect(stem.y2).toBeGreaterThanOrEqual(targetBox.y - 1);
      expect(stem.y2).toBeLessThanOrEqual(targetBox.y + 1);
      expect(bottomY(calloutBox)).toBeLessThanOrEqual(targetBox.y - 2);

      if (viewport.name === 'desktop') {
        await expect(chart.locator('.phone-chart-legend')).toBeHidden();
      } else {
        await expect(chart.locator('.phone-chart-legend')).toBeVisible();
      }

      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe(`dryer pricing chart ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('renders as SVG and keeps both tiny callouts separated', async ({ page }) => {
      await page.goto(pageUrl);

      const chart = page.locator('.dryer-pricing-chart');
      const svg = chart.locator('svg[data-chart="dryer"]');
      await expect(svg).toBeVisible();
      await expect(chart.locator('.horizontal-stack-chart')).toHaveCount(0);

      const segmentRects = svg.locator('rect[data-segment]');
      await expect(segmentRects).toHaveCount(5);

      const labelChecks = [
        ['login-serial-contact-required', /Login, serial, or\s*contact required/],
        ['general-dead-end-support-page', /General\/dead-end\s*support page/],
        ['usable-or-not-flagged', 'Usable or not flagged']
      ];
      for (const [id, expected] of labelChecks) {
        const label = svg.locator(`text[data-label-for="${id}"]`);
        await expect(label).toHaveCount(1);
        await expect(label).toHaveText(expected);
      }

      for (const [id, count] of [
        ['login-serial-contact-required', '1,389'],
        ['general-dead-end-support-page', '1,317'],
        ['usable-or-not-flagged', '2,327']
      ]) {
        await expect(svg.locator(`text[data-count-for="${id}"]`)).toHaveText(count);
      }
      await expect(svg.locator('text[data-callout-text-for="empty-broken-links"]')).toHaveText(/Empty or broken\s*links\s*96/);
      await expect(svg.locator('text[data-callout-text-for="other-weak-links"]')).toHaveText(/Other weak\s*links\s*30/);
      await expect(svg.locator('text[data-total-label="dryer"]')).toHaveText('5,159 active dryer records');

      const chartBox = await chart.boundingBox();
      const svgBox = await svg.boundingBox();
      const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(chartBox).toBeTruthy();
      expect(svgBox).toBeTruthy();
      expect(chartBox.height).toBeLessThanOrEqual(340);
      expect(chartBox.x).toBeGreaterThanOrEqual(0);
      expect(chartBox.x + chartBox.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(svgBox.x).toBeGreaterThanOrEqual(chartBox.x - 1);
      expect(svgBox.x + svgBox.width).toBeLessThanOrEqual(chartBox.x + chartBox.width + 1);
      expect(pageOverflow).toBeLessThanOrEqual(1);

      const emptyBox = await getBox(svg.locator('rect[data-callout-box-for="empty-broken-links"]'));
      const otherBox = await getBox(svg.locator('rect[data-callout-box-for="other-weak-links"]'));
      const emptyTextBox = await getBox(svg.locator('text[data-callout-text-for="empty-broken-links"]'));
      const otherTextBox = await getBox(svg.locator('text[data-callout-text-for="other-weak-links"]'));
      const emptyStem = await getLineGeometry(svg.locator('line[data-callout-stem-for="empty-broken-links"]'));
      const otherStem = await getLineGeometry(svg.locator('line[data-callout-stem-for="other-weak-links"]'));
      const emptyTarget = await getBox(svg.locator('rect[data-segment="empty-broken-links"]'));
      const otherTarget = await getBox(svg.locator('rect[data-segment="other-weak-links"]'));
      const emptyFill = await svg.locator('rect[data-callout-box-for="empty-broken-links"]').getAttribute('fill');
      const otherFill = await svg.locator('rect[data-callout-box-for="other-weak-links"]').getAttribute('fill');

      expect(emptyBox.width).toBeGreaterThan(100);
      expect(emptyBox.height).toBeGreaterThan(20);
      expect(otherBox.width).toBeGreaterThan(70);
      expect(otherBox.height).toBeGreaterThan(30);
      expect(emptyTextBox.width).toBeLessThanOrEqual(emptyBox.width + 1);
      expect(otherTextBox.width).toBeLessThanOrEqual(otherBox.width + 1);
      expect(boxesOverlap(emptyBox, otherBox, 1)).toBe(false);
      expect(emptyBox.y + emptyBox.height).toBeLessThanOrEqual(emptyTarget.y - 2);
      expect(otherBox.y + otherBox.height).toBeLessThanOrEqual(otherTarget.y - 2);
      expect(Math.abs(emptyStem.x1 - centerX(emptyTarget))).toBeLessThanOrEqual(viewport.name === 'desktop' ? 2 : 4);
      expect(Math.abs(otherStem.x1 - centerX(otherTarget))).toBeLessThanOrEqual(viewport.name === 'desktop' ? 2 : 4);
      expect(Math.abs(emptyStem.x2 - centerX(emptyTarget))).toBeLessThanOrEqual(viewport.name === 'desktop' ? 2 : 4);
      expect(Math.abs(otherStem.x2 - centerX(otherTarget))).toBeLessThanOrEqual(viewport.name === 'desktop' ? 2 : 4);
      expect(emptyStem.y2).toBeGreaterThanOrEqual(emptyTarget.y - 1);
      expect(emptyStem.y2).toBeLessThanOrEqual(emptyTarget.y + 1);
      expect(otherStem.y2).toBeGreaterThanOrEqual(otherTarget.y - 1);
      expect(otherStem.y2).toBeLessThanOrEqual(otherTarget.y + 1);
      expect(emptyStem.y1).toBeGreaterThan(bottomY(emptyBox) - 1);
      expect(otherStem.y1).toBeGreaterThan(bottomY(otherBox) - 1);
      expect(emptyFill).toBe('#d15a61');
      expect(otherFill).toBe('#f0a0a5');

      if (viewport.name === 'desktop') {
        await expect(chart.locator('.dryer-chart-legend')).toBeHidden();
      } else {
        await expect(chart.locator('.dryer-chart-legend')).toBeVisible();
      }
    });
  });
}

test.describe('mobile navigation and chart layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('uses a compact sticky section menu on mobile', async ({ page }) => {
    await page.goto(pageUrl);

    const desktopNav = page.locator('.desktop-nav');
    const mobileNav = page.locator('.mobile-nav');
    const summary = mobileNav.locator('summary');

    await expect(desktopNav).toBeHidden();
    await expect(mobileNav).toBeVisible();
    await expect(summary).toHaveText('Sections');
    await expect(mobileNav.locator('a')).toHaveCount(7);
    await expect(mobileNav.locator('a', { hasText: 'Parts Prices' })).toHaveAttribute('href', '#temu');
    await summary.click();
    await expect(mobileNav).toHaveAttribute('open', '');
    await expect(mobileNav.locator('a', { hasText: 'Enforcement' })).toBeVisible();
  });

  test('keeps the SVG charts visible and contained on mobile', async ({ page }) => {
    await page.goto(pageUrl);

    const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(pageOverflow).toBeLessThanOrEqual(1);

    await expect(page.locator('.phone-pricing-chart svg[data-chart="phone"]')).toBeVisible();
    await expect(page.locator('.dryer-pricing-chart svg[data-chart="dryer"]')).toBeVisible();
    await expect(page.locator('.phone-pricing-chart .phone-chart-legend')).toBeVisible();
    await expect(page.locator('.dryer-pricing-chart .dryer-chart-legend')).toBeVisible();
    await expect(page.locator('.phone-pricing-chart .scroll-hint')).toBeHidden();

    const phoneBox = await page.locator('.phone-pricing-chart').boundingBox();
    const dryerBox = await page.locator('.dryer-pricing-chart').boundingBox();
    expect(phoneBox).toBeTruthy();
    expect(dryerBox).toBeTruthy();
    expect(phoneBox.height).toBeLessThanOrEqual(520);
    expect(dryerBox.height).toBeLessThanOrEqual(520);
  });
});

test.describe('desktop navigation', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('keeps the full section link row on desktop', async ({ page }) => {
    await page.goto(pageUrl);

    await expect(page.locator('.desktop-nav')).toBeVisible();
    await expect(page.locator('.mobile-nav')).toBeHidden();
    await expect(page.locator('.desktop-nav a')).toHaveCount(7);
  });
});
