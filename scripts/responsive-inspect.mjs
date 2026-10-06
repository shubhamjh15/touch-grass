/**
 * The in-page checks shared by the responsive sweeps (responsive-audit.mjs and responsive-states.mjs).
 * It is passed to `page.evaluate`, so it must stay self-contained: no imports, no outer variables.
 */
/** Runs inside the page. Returns the defects found in the current document. */
export function inspect(phone) {
  const vw = window.innerWidth;
  const TOLERANCE = 4;
  const issues = [];
  const push = (type, el, detail) => {
    if (issues.filter((i) => i.type === type).length >= 6) return;
    const parts = [];
    for (
      let node = el, depth = 0;
      node && node !== document.body && depth < 3;
      node = node.parentElement, depth += 1
    ) {
      const cls =
        typeof node.className === 'string'
          ? node.className.trim().split(/\s+/).slice(0, 2).join('.')
          : '';
      parts.unshift(node.tagName.toLowerCase() + (node.id ? `#${node.id}` : cls ? `.${cls}` : ''));
    }
    issues.push({
      type,
      where: parts.join(' > '),
      text: (el.getAttribute('aria-label') || el.textContent || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 50),
      detail,
    });
  };
  const visible = (el, rect, style) =>
    rect.width >= 2 &&
    rect.height >= 2 &&
    style.display !== 'none' &&
    style.visibility === 'visible' &&
    Number(style.opacity) > 0.05 &&
    !el.closest('[aria-hidden="true"], [inert], .sr-only');
  /** Touch area including a pseudo-element that enlarges it (the kit's "hit" helpers). */
  const hitBox = (el, rect) => {
    let width = rect.width;
    let height = rect.height;
    for (const pseudo of ['::before', '::after']) {
      const style = getComputedStyle(el, pseudo);
      if (style.content === 'none' || style.position !== 'absolute') continue;
      const n = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0);
      width = Math.max(width, rect.width - n(style.left) - n(style.right));
      height = Math.max(height, rect.height - n(style.top) - n(style.bottom));
    }
    return { width, height };
  };
  const ownText = (el) =>
    [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
  /** The nearest ancestor that clips or scrolls sideways; null when only the page itself does. */
  const clipper = (el) => {
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.position === 'fixed') return { node, fixed: true, scrolls: false };
      if (/(auto|scroll)/.test(style.overflowX)) return { node, fixed: false, scrolls: true };
      if (/(hidden|clip)/.test(style.overflowX)) return { node, fixed: false, scrolls: false };
    }
    return null;
  };

  const pageScrolls = document.documentElement.scrollWidth > vw + 1;
  if (pageScrolls)
    issues.push({
      type: 'overflow',
      where: 'html',
      text: '',
      detail: `page is ${document.documentElement.scrollWidth}px wide in a ${vw}px viewport`,
    });

  const interactive =
    'a[href], button, input, select, textarea, summary, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="menuitem"]';
  const sticking = [];
  for (const el of document.body.querySelectorAll('*')) {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    if (!visible(el, rect, style)) continue;
    const isContent =
      ownText(el) || el.matches(interactive) || /^(img|svg|canvas|video)$/i.test(el.tagName);
    const fixed = style.position === 'fixed';
    const clip = clipper(el);

    // Sticks out of the viewport without anything clipping it.
    if (!fixed && !clip && (rect.right > vw + TOLERANCE || rect.left < -TOLERANCE)) {
      const decorative = style.pointerEvents === 'none' && !ownText(el);
      if (pageScrolls || !decorative) sticking.push({ el, rect });
    }
    // Runs past a clipping container that cannot be scrolled.
    if (isContent && clip && !clip.scrolls && !clip.fixed) {
      const box = clip.node.getBoundingClientRect();
      const over = Math.max(rect.right - box.right, box.left - rect.left);
      if (over > 8 && style.pointerEvents !== 'none')
        push('cut-off', el, `${Math.round(over)}px past its container`);
    }
    if (ownText(el)) {
      const size = parseFloat(style.fontSize);
      if (size < 11) push('text-small', el, `${size}px`);
      const clipsX = /(hidden|clip)/.test(style.overflowX) && style.textOverflow !== 'ellipsis';
      if (clipsX && el.scrollWidth - el.clientWidth > 2)
        push('text-clipped', el, `${el.scrollWidth - el.clientWidth}px hidden sideways`);
      const clamps = style.webkitLineClamp && style.webkitLineClamp !== 'none';
      if (/(hidden|clip)/.test(style.overflowY) && !clamps && el.scrollHeight - el.clientHeight > 4)
        push('text-clipped', el, `${el.scrollHeight - el.clientHeight}px hidden below`);
    }
    if (phone && el.matches(interactive) && style.display !== 'inline') {
      const label = el.closest('label');
      const hit = label ? label.getBoundingClientRect() : hitBox(el, rect);
      if (Math.min(hit.width, hit.height) < 32)
        push('tap-small', el, `${Math.round(hit.width)}x${Math.round(hit.height)}px`);
    }
  }
  // Report the innermost elements that stick out: they name the real culprit.
  for (const { el, rect } of sticking) {
    if (sticking.some((other) => other.el !== el && el.contains(other.el))) continue;
    push(
      pageScrolls ? 'overflow' : 'cut-off',
      el,
      `spans ${Math.round(rect.left)}..${Math.round(rect.right)}px of ${vw}px`,
    );
  }
  return issues;
}
