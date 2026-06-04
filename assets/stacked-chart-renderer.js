(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined) continue;
      el.setAttribute(key, String(value));
    }
    return el;
  }

  function textLines(lines, opts = {}) {
    const text = svgEl('text', {
      class: opts.className || '',
      x: opts.x,
      y: opts.y,
      fill: opts.fill || 'currentColor',
      'font-size': opts.fontSize || 12,
      'font-weight': opts.fontWeight || 800,
      'text-anchor': opts.anchor || 'middle',
      'dominant-baseline': opts.baseline || 'hanging'
    });
    const lineGap = opts.lineGap ?? Math.round((opts.fontSize || 12) * 1.08);
    lines.forEach((line, index) => {
      const tspan = svgEl('tspan', {
        x: opts.x,
        dy: index === 0 ? 0 : lineGap
      });
      tspan.textContent = line;
      text.appendChild(tspan);
    });
    return text;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getHostWidth(host) {
    return Math.max(0, Math.floor(host.getBoundingClientRect().width));
  }

  function renderStackChart(host, config) {
    const width = getHostWidth(host);
    if (!width) return;

    const margins = config.margins || { top: 10, right: 8, bottom: 12, left: 8 };
    const labelRowHeight = config.labelRowHeight;
    const calloutRowHeight = config.calloutRowHeight;
    const barHeight = config.barHeight;
    const totalLabelHeight = config.totalLabelHeight || 22;
    const total = config.segments.reduce((sum, segment) => sum + segment.value, 0);
    const barWidth = width - margins.left - margins.right;
    const barY = margins.top + calloutRowHeight + labelRowHeight;
    const chartHeight = barY + barHeight + totalLabelHeight + margins.bottom;

    host.className = 'stack-chart-host';
    host.replaceChildren();

    const svg = svgEl('svg', {
      class: 'stack-chart-svg',
      viewBox: `0 0 ${width} ${chartHeight}`,
      'data-chart': config.chartId,
      role: 'img',
      'aria-label': config.ariaLabel,
      focusable: 'false'
    });
    const desc = svgEl('desc');
    desc.textContent = config.description;
    svg.appendChild(desc);

    const labelTop = margins.top + calloutRowHeight;
    const centers = [];
    let cursor = margins.left;

    config.segments.forEach((segment) => {
      const segWidth = (segment.value / total) * barWidth;
      const centerX = cursor + segWidth / 2;
      centers.push({ id: segment.id, x: centerX, width: segWidth, xStart: cursor });

      const rect = svgEl('rect', {
        class: `stack-segment ${segment.segmentClass || ''}`.trim(),
        x: cursor,
        y: barY,
        width: segWidth,
        height: barHeight,
        fill: segment.fill,
        'data-segment': segment.id
      });
      svg.appendChild(rect);

      if (segment.countText && segWidth >= (segment.countMinWidth || 28)) {
        const countText = textLines([segment.countText], {
          className: 'stack-count',
          x: centerX,
          y: barY + barHeight / 2 + 1,
          fill: segment.countFill || '#fff',
          fontSize: segment.countFontSize || 12,
          fontWeight: 900,
          baseline: 'middle'
        });
        countText.setAttribute('data-count-for', segment.id);
        if (segment.countTextClass) {
          countText.classList.add(segment.countTextClass);
        }
        svg.appendChild(countText);
      }

      if (segment.labelLines && segment.labelLines.length) {
        const labelText = textLines(segment.labelLines, {
          className: `stack-label${segment.labelClass ? ` ${segment.labelClass}` : ''}`.trim(),
          x: centerX,
          y: labelTop + (segment.labelY || 0),
          fill: segment.labelFill || '#11161a',
          fontSize: segment.labelFontSize || 12,
          fontWeight: 800,
          lineGap: segment.labelLineGap || Math.round((segment.labelFontSize || 12) * 1.05)
        });
        labelText.setAttribute('data-label-for', segment.id);
        svg.appendChild(labelText);
      }

      cursor += segWidth;
    });

    (config.callouts || []).forEach((callout, index) => {
      const center = centers.find((entry) => entry.id === callout.segmentId);
      if (!center) return;

      const lines = callout.lines;
      const fontSize = callout.fontSize || 12;
      const paddingX = callout.paddingX || 6;
      const paddingY = callout.paddingY || 5;
      const lineGap = callout.lineGap || 12;
      const boxWidth = callout.boxWidth || Math.max(66, Math.ceil(Math.max(...lines.map((line) => line.length)) * fontSize * 0.62) + paddingX * 2);
      const boxHeight = paddingY * 2 + (lines.length * fontSize) + ((lines.length - 1) * (lineGap - fontSize));
      const boxX = clamp(center.x - boxWidth / 2, margins.left, width - margins.right - boxWidth);
      const boxY = margins.top + (callout.y || 0);
      const stemTopY = boxY + boxHeight;
      const stemBottomY = barY;
      const stemY1 = stemTopY + 2;
      const stemY2 = stemBottomY;
      const stem = svgEl('line', {
        class: 'callout-stem',
        x1: center.x,
        x2: center.x,
        y1: stemY1,
        y2: stemY2,
        'data-callout-stem-for': callout.segmentId
      });
      svg.appendChild(stem);

      if (callout.showBox !== false) {
        const box = svgEl('rect', {
          class: 'callout-box',
          x: boxX,
          y: boxY,
          width: boxWidth,
          height: boxHeight,
          fill: callout.fill,
          'data-callout-box-for': callout.segmentId
        });
        svg.appendChild(box);
      }

      const text = textLines(lines, {
        className: `callout-text${callout.showBox === false ? ' no-box' : ''}`,
        x: center.x,
        y: boxY + paddingY,
        fill: callout.textFill || '#11161a',
        fontSize,
        fontWeight: 900,
        lineGap,
        anchor: 'middle',
        baseline: 'hanging'
      });
      text.setAttribute('data-callout-text-for', callout.segmentId);
      svg.appendChild(text);
    });

    if (config.totalLabel && config.showTotalInSvg !== false) {
      const totalText = textLines([config.totalLabel], {
        className: 'stacked-column-label',
        x: width / 2,
        y: barY + barHeight + 8,
        fill: '#6a7177',
        fontSize: config.totalLabelFontSize || 13,
        fontWeight: 800,
        lineGap: 14
      });
      totalText.setAttribute('data-total-label', config.chartId);
      svg.appendChild(totalText);
    }

    host.appendChild(svg);
  }

  const configs = [
      {
        hostSelector: '.phone-pricing-chart .horizontal-stack-chart',
        chartId: 'phone',
        ariaLabel: 'Horizontal stacked bar chart of 2,054 smartphone and tablet records by spare-parts pricing link status',
        description: 'Smartphone and tablet records with or without usable spare-parts pricing paths.',
        labelRowHeight: 52,
        calloutRowHeight: 42,
        barHeight: 46,
        totalLabelHeight: 0,
        showTotalInSvg: false,
        segments: [
          {
            id: 'empty-price-link-field',
            value: 1026,
            fill: '#8f1d22',
            countText: '1,026',
            countFill: '#fff',
            labelLines: ['Empty price-link field']
          },
          {
            id: 'brand-product-page',
            value: 248,
            fill: '#a5282e',
            countText: '248',
            countFill: '#fff',
            labelLines: ['Brand/product page']
          },
          {
            id: 'see-manual',
            value: 150,
            fill: '#b7333a',
            countText: '150',
            countFill: '#fff',
            labelLines: ['"See', 'manual"'],
            labelClass: 'tiny',
            labelY: 22
          },
          {
            id: 'support-page-no-prices',
            value: 126,
            fill: '#d75a61',
            countText: '126',
            countFill: '#11161a',
            labelLines: ['Support page,', 'no prices'],
            labelClass: 'tiny'
          },
          {
            id: 'temu-aliexpress',
            value: 103,
            fill: '#f0a0a5',
            countText: '103',
            countFill: '#11161a',
            labelLines: ['Temu/', 'AliExpress'],
            labelClass: 'tiny'
          },
          {
            id: 'other-dead-end',
            value: 17,
            fill: '#f3c2c5',
            countText: '17',
            countFill: '#11161a',
            labelLines: [],
            countMinWidth: 100
          },
          {
            id: 'usable-pricing-path',
            value: 384,
            fill: '#7aa95c',
            countText: '384',
            countFill: '#fff',
            labelLines: ['Usable pricing path']
          }
        ],
        callouts: [
          {
            segmentId: 'other-dead-end',
            lines: ['Other dead end', '17'],
            boxWidth: 88,
            y: 0,
            showBox: false,
            textFill: '#11161a',
            fontSize: 11,
            lineGap: 12,
            paddingX: 6,
            paddingY: 5
          }
        ],
        totalLabel: '2,054 active smartphone/tablet records'
      },
      {
        hostSelector: '.dryer-pricing-chart .horizontal-stack-chart',
        chartId: 'dryer',
        ariaLabel: 'Horizontal stacked bar chart of 5,159 dryer records by spare-parts pricing link status',
        description: 'Tumble dryer records with weak parts-price access paths.',
        labelRowHeight: 52,
        calloutRowHeight: 66,
        barHeight: 46,
        totalLabelHeight: 0,
        showTotalInSvg: false,
        segments: [
          {
            id: 'login-serial-contact-required',
            value: 1389,
            fill: '#c1464d',
            countText: '1,389',
            countFill: '#fff',
            labelLines: ['Login, serial, or', 'contact required'],
            labelFontSize: 12
          },
          {
            id: 'general-dead-end-support-page',
            value: 1317,
            fill: '#9f1f25',
            countText: '1,317',
            countFill: '#fff',
            labelLines: ['General/dead-end', 'support page'],
            labelFontSize: 12
          },
          {
            id: 'empty-broken-links',
            value: 96,
            fill: '#d15a61',
            countText: '96',
            countFill: '#11161a',
            labelLines: [],
            countMinWidth: 100
          },
          {
            id: 'other-weak-links',
            value: 30,
            fill: '#f0a0a5',
            countText: '30',
            countFill: '#11161a',
            labelLines: [],
            countMinWidth: 100
          },
          {
            id: 'usable-or-not-flagged',
            value: 2327,
            fill: '#7aa95c',
            countText: '2,327',
            countFill: '#fff',
            labelLines: ['Usable or not flagged'],
            labelFontSize: 12
          }
        ],
        callouts: [
          {
            segmentId: 'empty-broken-links',
            lines: ['Empty or broken', 'links', '96'],
            boxWidth: 118,
            y: 4,
            showBox: false,
            textFill: '#11161a',
            fontSize: 11,
            lineGap: 12,
            paddingX: 6,
            paddingY: 5
          },
          {
            segmentId: 'other-weak-links',
            lines: ['Other weak', 'links', '30'],
            boxWidth: 84,
            y: 44,
            showBox: false,
            textFill: '#11161a',
            fontSize: 11,
            lineGap: 12,
            paddingX: 6,
            paddingY: 5
          }
        ],
        totalLabel: '5,159 active dryer records'
      }
    ];

  const chartTargets = configs
    .map((config) => ({
      config,
      host: document.querySelector(config.hostSelector)
    }))
    .filter((entry) => entry.host);

  function renderCharts() {
    for (const entry of chartTargets) {
      renderStackChart(entry.host, entry.config);
    }
  }

  let resizeTimer = null;
  function scheduleRender() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(renderCharts, 40);
  }

  window.addEventListener('DOMContentLoaded', renderCharts, { once: true });
  window.addEventListener('resize', scheduleRender);
  if ('ResizeObserver' in window) {
    window.addEventListener('DOMContentLoaded', () => {
      const observed = [
        document.querySelector('.phone-pricing-chart'),
        document.querySelector('.dryer-pricing-chart')
      ].filter(Boolean);
      const observer = new ResizeObserver(scheduleRender);
      observed.forEach((el) => observer.observe(el));
    }, { once: true });
  }
})();
