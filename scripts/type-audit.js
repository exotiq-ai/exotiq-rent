/*
 * Type audit: paste into a browser console (or run through the browser tool) on any page, ideally at a phone width
 * (375x812). It walks every visible text node and reports, by share of characters:
 *   - how much text is 11px or smaller, 12px or smaller, and 16px or larger, plus the median size
 *   - how many text runs fall under 4.5:1 and under 7:1 against their effective background
 * The legibility pass's targets (docs/drive-exotiq/legibility-plan.md): no text under 11px, nothing under 7:1.
 * Measured against the effective background (opacity and alpha backgrounds composited). Run it mid-animation and
 * the step-entry fade will read low: wait for the page to settle first.
 */
(() => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return [0, 0, 0, 0]; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const over = (f, b) => [f[0] * f[3] + b[0] * (1 - f[3]), f[1] * f[3] + b[1] * (1 - f[3]), f[2] * f[3] + b[2] * (1 - f[3]), 1];
  const bgOf = (el) => { const stack = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c[3] > 0) stack.push(c); if (c[3] >= 0.99) break; } let base = [6, 7, 10, 1]; for (let i = stack.length - 1; i >= 0; i--) base = stack[i][3] >= 0.99 ? stack[i] : over(stack[i], base); return base; };
  const runs = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode, text = node.textContent.trim();
    if (!text) continue;
    const el = node.parentElement;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    let opacity = 1; for (let e = el; e; e = e.parentElement) opacity *= parseFloat(getComputedStyle(e).opacity);
    const bg = bgOf(el); const fg = parse(cs.color); fg[3] *= opacity;
    const a = lum(over(fg, bg)), b = lum(bg);
    runs.push({ text: text.slice(0, 40), size: parseFloat(cs.fontSize), n: text.length, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) });
  }
  const total = runs.reduce((s, x) => s + x.n, 0);
  const share = (f) => Math.round(runs.filter(f).reduce((s, x) => s + x.n, 0) / total * 100);
  const sorted = [...runs].sort((x, y) => x.size - y.size); let cum = 0, median = 0;
  for (const x of sorted) { cum += x.n; if (cum >= total / 2) { median = x.size; break; } }
  const report = { page: location.pathname, characters: total, medianPx: median, pctUnder11: share((x) => x.size < 11), pctAtMost11: share((x) => x.size <= 11), pctAtMost12: share((x) => x.size <= 12), pctAtLeast16: share((x) => x.size >= 16), runsUnder4_5: runs.filter((x) => x.ratio < 4.5).length, runsUnder7: runs.filter((x) => x.ratio < 7).length, weakest: runs.filter((x) => x.ratio < 7).sort((x, y) => x.ratio - y.ratio).slice(0, 8).map((x) => `${x.size}px ${x.ratio.toFixed(1)}:1 "${x.text}"`) };
  console.log(JSON.stringify(report, null, 2));
  return report;
})();
