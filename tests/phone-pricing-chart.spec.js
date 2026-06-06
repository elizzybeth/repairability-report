const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const pageUrl = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const asusPageUrl = pathToFileURL(path.join(__dirname, '..', 'asus-flow-z13.html')).href;
const frenchPageUrl = pathToFileURL(path.join(__dirname, '..', 'french-repairability-data.html')).href;

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

test.describe('ASUS page split', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('moves Flow Z13 content to its own page and removes it from the report', async ({ page }) => {
    await page.goto(pageUrl);

    const reportBody = page.locator('body');
    await expect(reportBody).not.toContainText(/ASUS|Flow Z13|ROG Flow|GZ302EA/i);
    await expect(page.locator('#asus')).toHaveCount(0);
    await expect(page.locator('a[href="#asus"]')).toHaveCount(0);
    await expect(page.locator('img[src*="asus"]')).toHaveCount(0);

    await page.goto(asusPageUrl);

    const asusBody = page.locator('body');
    await expect(page.locator('h1')).toContainText('ASUS gave the Flow Z13 a 10/10');
    await expect(asusBody).toContainText('ROG Flow Z13 GZ302EA');
    await expect(asusBody).toContainText('Separate iFixit assessment: 7.4/10');
    await expect(page.locator('img[src="assets/asus-rog-flow-z13-keyboard.png"]')).toBeVisible();
    await expect(page.locator('img[src="assets/asus-image-01.png"]')).toBeVisible();

    for (const href of [
      'https://www.indicereparabiliteasus.com/page-produit/?model=GZ302EA',
      'https://rog.asus.com/laptops/rog-flow/rog-flow-z13-2025/helpdesk_service_guide/',
      'https://www.ifixit.com/News/80361/ifixit-vs-french-repairability-score',
      'https://www.ifixit.com/News/75533/how-ifixit-scores-repairability',
      'https://www.indicereparabiliteasus.com/',
      'french-repairability-data.html'
    ]) {
      await expect(page.locator(`a[href="${href}"]`).first()).toHaveCount(1);
    }
  });
});

test.describe('EPREL score data framing', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('focuses the EU report on suspicious EPREL score claims', async ({ page }) => {
    await page.goto(pageUrl);

    const dataSection = page.locator('#data');
    const anomalyChart = dataSection.locator('.score-anomaly-chart');

    await expect(dataSection.locator('h2')).toContainText('Suspicious EPREL score claims need public evidence');
    await expect(dataSection).toContainText('S24 Ultra');
    await expect(dataSection).toContainText('S25 Ultra');
    await expect(dataSection).toContainText('Three devices claim perfect 5.0/5.0');
    await expect(dataSection).toContainText('All 11 ARCHOS tablets score exactly 1.0');
    await expect(dataSection).toContainText('Some score elements cannot be audited from a teardown alone');
    await expect(dataSection).toContainText("EPREL's public score data still needs stronger context");
    await expect(anomalyChart.locator('h3')).toContainText('EPREL outliers worth checking first');
    await expect(anomalyChart.locator('.score-stat')).toHaveCount(3);
    await expect(anomalyChart.locator('.bar-row')).toHaveCount(0);
    await expect(anomalyChart).toContainText('Actual Samsung phones');
    await expect(anomalyChart).toContainText('49 Samsung records');
    await expect(anomalyChart).toContainText('3.05');
    await expect(anomalyChart).toContainText('S24/S25-named white-label records');
    await expect(anomalyChart).toContainText('4.10');
    await expect(anomalyChart).toContainText('Perfect-score records');
    await expect(anomalyChart.locator('.score-stat.urgent strong')).toContainText(/3\s*perfect 5\.0\s*records/);
    await expect(anomalyChart.locator('.score-stat-perfect .score-stat-context')).toHaveCount(0);
    await expect(anomalyChart).toContainText('5.0/5.0');
    await expect(anomalyChart.locator('img.s24-photo')).toHaveCount(0);
    await expect(anomalyChart).not.toContainText('Samsung-like names outscore Samsung records');
    await expect(dataSection).not.toContainText('EPREL smartphone and tablet scores have spread');
    await expect(dataSection).not.toContainText('mean score is 3.26');
    await expect(dataSection).not.toContainText('median is 3.37');
    await expect(dataSection).not.toContainText('meaningful bell-shaped distribution');
    await expect(dataSection).not.toContainText('France-specific score distribution analysis');
    await expect(dataSection).not.toContainText('data.gouv.fr repairability entries average 9.22');
    await expect(dataSection).not.toContainText('Boulanger-listed products at 7.96');
    await expect(dataSection).not.toContainText('97% of products score 8/10 or higher');
    await expect(dataSection).not.toContainText('Mean scores are higher in voluntary government uploads');
    await expect(dataSection).not.toContainText('48 repairability products and 18 durability products');

    await page.goto(frenchPageUrl);

    const frenchBody = page.locator('body');
    await expect(page.locator('h1')).toContainText('French repairability score data is clustered near the top');
    await expect(frenchBody).toContainText('data.gouv.fr');
    await expect(frenchBody).toContainText('Boulanger');
    await expect(frenchBody).toContainText('9.22');
    await expect(frenchBody).toContainText('7.96');
    await expect(frenchBody).toContainText('97% of products score 8/10 or higher');
    await expect(frenchBody).toContainText('only 8 of 2,173 score below 6.0');
    await expect(frenchBody).toContainText('48 repairability products and 18 durability products');
    await expect(page.locator('a[href="index.html#data"]').first()).toHaveCount(1);
  });
});

test.describe('overview section', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('does not repeat the parts-price and retail findings as cards', async ({ page }) => {
    await page.goto(pageUrl);

    const overview = page.locator('#overview');
    await expect(overview.locator('.cards')).toHaveCount(0);
    await expect(overview.locator('h3', { hasText: 'Broken links' })).toHaveCount(0);
    await expect(overview.locator('h3', { hasText: 'Missing at retail' })).toHaveCount(0);
    await expect(page.locator('#temu')).toHaveCount(1);
    await expect(page.locator('#retail')).toHaveCount(1);

    const leadBox = await getBox(overview.locator('.lead'));
    const summaryBox = await getBox(overview.locator('p', { hasText: 'Taken together, these findings' }));
    expect(Math.abs(summaryBox.x - leadBox.x)).toBeLessThanOrEqual(1);
  });
});

test.describe('European regulator framing', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('puts European implementation first and avoids US-led framing', async ({ page }) => {
    await page.goto(pageUrl);

    const body = page.locator('body');
    const overviewLead = page.locator('#overview .lead');
    const evidenceLead = page.locator('#evidence .lead');

    await expect(overviewLead).toContainText('European regulators');
    await expect(overviewLead).toContainText('European repair rules meet real life');
    await expect(evidenceLead).toContainText('Europe has moved repair policy');
    await expect(body).not.toContainText('The US has real state-level');
    await expect(body).not.toContainText('from US state laws');
    await expect(body).not.toContainText('In the US, lawmakers');
    await expect(body).not.toContainText('repair-score ideas have also appeared in state-level proposals in Washington, Maine, New York, and Colorado');
    await expect(body).not.toContainText('Repairability scoring is one of the reforms');
    await expect(body).not.toContainText('France moved first');
    await expect(body).not.toContainText('January 1, 2021');
    await expect(body).not.toContainText('The EU followed');
    await expect(body).not.toContainText('June 20, 2025');
    await expect(body).not.toContainText("Some findings are about France's national score");
    await expect(body).toContainText('This report stress-tests implementation across EU repair reforms');
    await expect(body).toContainText('New York has gone further');
    await expect(body).toContainText('passed the Assembly on March 18, 2026');
    await expect(body).toContainText('passed the Senate on June 4, 2026');
  });
});

for (const viewport of viewports) {
  test.describe(`data section text layout ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('places the outlier panel beside the first EPREL paragraph', async ({ page }) => {
      await page.goto(pageUrl);

      const section = page.locator('#data');
      const wrap = section.locator('.wrap').first();
      const outlierFeature = section.locator('.data-outlier-feature');
      const outlierIntro = outlierFeature.locator('.data-outlier-copy');
      const sourceChart = outlierFeature.locator('.source-comparison');
      const paragraphGroup = outlierFeature.locator('.data-outlier-copy');

      await expect(outlierFeature).toHaveCount(1);
      await expect(outlierIntro.locator('p').first()).toContainText('In EPREL, some white-label devices');
      await expect(paragraphGroup).toContainText('Some score elements cannot be audited');
      await expect(paragraphGroup).toContainText('The score comparison should be treated as a triage signal');
      await expect(section.locator('.evidence-copy.closing-evidence')).toHaveCount(0);
      await expect(section.locator('.evidence-copy.media-followup')).toHaveCount(0);

      const wrapBox = await getBox(wrap);
      const featureBox = await getBox(outlierFeature);
      const introBox = await getBox(outlierIntro);
      const sourceChartBox = await getBox(sourceChart);
      const paragraphGroupBox = await getBox(paragraphGroup);

      if (viewport.width > 860) {
        expect(sourceChartBox.x).toBeGreaterThan(introBox.x);
        expect(Math.abs(sourceChartBox.y - introBox.y)).toBeLessThanOrEqual(12);
        expect(Math.abs(paragraphGroupBox.y - introBox.y)).toBeLessThanOrEqual(12);
        expect(paragraphGroupBox.x + paragraphGroupBox.width).toBeLessThan(sourceChartBox.x + 1);
      } else {
        expect(sourceChartBox.y).toBeGreaterThan(introBox.y);
        expect(paragraphGroupBox.width).toBeGreaterThanOrEqual(wrapBox.width - 2);
      }
      expect(paragraphGroupBox.x).toBeGreaterThanOrEqual(wrapBox.x - 1);
      expect(paragraphGroupBox.x + paragraphGroupBox.width).toBeLessThanOrEqual(wrapBox.x + wrapBox.width + 1);
    });
  });

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
        ['see-manual', /"See\s*manual"/],
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
      await expect(svg.locator('rect[data-callout-box-for="other-dead-end"]')).toHaveCount(0);
      await expect(svg.locator('text[data-total-label="phone"]')).toHaveCount(0);
      const totalLabel = chart.locator('.stacked-column-label');
      await expect(totalLabel).toHaveText('2,054 active smartphone/tablet records');

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
      const calloutTextBox = await getBox(svg.locator('text[data-callout-text-for="other-dead-end"]'));
      const stem = await getLineGeometry(svg.locator('line[data-callout-stem-for="other-dead-end"]'));
      const totalLabelBox = await getBox(totalLabel);

      expect(calloutTextBox.width).toBeGreaterThan(70);
      expect(boxesOverlap(calloutTextBox, targetBox, 0)).toBe(false);
      expect(Math.abs(stem.x1 - centerX(targetBox))).toBeLessThanOrEqual(viewport.name === 'desktop' ? 2 : 4);
      expect(Math.abs(stem.x2 - centerX(targetBox))).toBeLessThanOrEqual(viewport.name === 'desktop' ? 2 : 4);
      expect(stem.y1).toBeGreaterThan(bottomY(calloutTextBox) - 1);
      expect(stem.y2).toBeGreaterThanOrEqual(targetBox.y - 1);
      expect(stem.y2).toBeLessThanOrEqual(targetBox.y + 1);
      expect(bottomY(calloutTextBox)).toBeLessThanOrEqual(targetBox.y - 2);
      expect(totalLabelBox.y).toBeGreaterThanOrEqual(bottomY(svgBox) - 1);

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
      await expect(svg.locator('rect[data-callout-box-for="empty-broken-links"]')).toHaveCount(0);
      await expect(svg.locator('rect[data-callout-box-for="other-weak-links"]')).toHaveCount(0);
      await expect(svg.locator('text[data-total-label="dryer"]')).toHaveCount(0);
      const totalLabel = chart.locator('.stacked-column-label');
      const chartNote = chart.locator('.chart-note');
      await expect(totalLabel).toHaveText('5,159 active dryer records');
      await expect(chartNote).toHaveText('Counts from our analysis of active EPREL dryer records.');

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

      const emptyTextBox = await getBox(svg.locator('text[data-callout-text-for="empty-broken-links"]'));
      const otherTextBox = await getBox(svg.locator('text[data-callout-text-for="other-weak-links"]'));
      const emptyStem = await getLineGeometry(svg.locator('line[data-callout-stem-for="empty-broken-links"]'));
      const otherStem = await getLineGeometry(svg.locator('line[data-callout-stem-for="other-weak-links"]'));
      const emptyTarget = await getBox(svg.locator('rect[data-segment="empty-broken-links"]'));
      const otherTarget = await getBox(svg.locator('rect[data-segment="other-weak-links"]'));
      const totalLabelBox = await getBox(totalLabel);
      const chartNoteBox = await getBox(chartNote);

      expect(emptyTextBox.width).toBeGreaterThan(80);
      expect(otherTextBox.width).toBeGreaterThan(60);
      expect(boxesOverlap(emptyTextBox, otherTextBox, 1)).toBe(false);
      expect(emptyTextBox.y + emptyTextBox.height).toBeLessThanOrEqual(emptyTarget.y - 2);
      expect(otherTextBox.y + otherTextBox.height).toBeLessThanOrEqual(otherTarget.y - 2);
      expect(Math.abs(emptyStem.x1 - centerX(emptyTarget))).toBeLessThanOrEqual(viewport.name === 'desktop' ? 2 : 4);
      expect(Math.abs(otherStem.x1 - centerX(otherTarget))).toBeLessThanOrEqual(viewport.name === 'desktop' ? 2 : 4);
      expect(Math.abs(emptyStem.x2 - centerX(emptyTarget))).toBeLessThanOrEqual(viewport.name === 'desktop' ? 2 : 4);
      expect(Math.abs(otherStem.x2 - centerX(otherTarget))).toBeLessThanOrEqual(viewport.name === 'desktop' ? 2 : 4);
      expect(emptyStem.y1).toBeGreaterThan(bottomY(emptyTextBox) - 1);
      expect(otherStem.y1).toBeGreaterThan(bottomY(otherTextBox) - 1);
      expect(emptyStem.y2).toBeGreaterThanOrEqual(emptyTarget.y - 1);
      expect(emptyStem.y2).toBeLessThanOrEqual(emptyTarget.y + 1);
      expect(otherStem.y2).toBeGreaterThanOrEqual(otherTarget.y - 1);
      expect(otherStem.y2).toBeLessThanOrEqual(otherTarget.y + 1);
      expect(totalLabelBox.y).toBeGreaterThanOrEqual(bottomY(svgBox) - 1);
      expect(chartNoteBox.y).toBeGreaterThanOrEqual(bottomY(totalLabelBox) - 1);

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
    await expect(mobileNav.locator('a')).toHaveCount(6);
    await expect(mobileNav.locator('a', { hasText: 'Perfect Score' })).toHaveCount(0);
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
    await expect(page.locator('.desktop-nav a')).toHaveCount(6);
    await expect(page.locator('.desktop-nav a', { hasText: 'Perfect Score' })).toHaveCount(0);
  });
});
