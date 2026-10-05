// ============================================
// TOOLTIPS
// ============================================

/**
 * Tooltips for icon-only controls: a small framed note naming the control and its
 * shortcut, shown on hover and on keyboard focus, dismissed with Escape.
 *
 * Markup: `data-tooltip="Undo"` names the control (it repeats the aria-label);
 * `data-shortcut="Z"` adds the platform's modifier ("Undo · Ctrl+Z", "Undo · ⌘Z").
 */
export function setupTooltips(root = document) {
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.id = 'tooltip';
    tooltip.hidden = true;
    document.body.appendChild(tooltip);

    let current = null;

    function textFor(el) {
        const shortcut = el.dataset.shortcut;
        if (!shortcut) return el.dataset.tooltip;
        return `${el.dataset.tooltip} · ${isMac ? '⌘' : 'Ctrl+'}${shortcut}`;
    }

    function show(el) {
        current = el;
        tooltip.textContent = textFor(el);
        tooltip.hidden = false;
        if (el.dataset.shortcut) el.setAttribute('aria-describedby', tooltip.id);

        // Below the control, kept inside the window
        const rect = el.getBoundingClientRect();
        const tipRect = tooltip.getBoundingClientRect();
        const gap = 5;
        let left = rect.left + rect.width / 2 - tipRect.width / 2;
        left = Math.max(4, Math.min(left, window.innerWidth - tipRect.width - 4));
        let top = rect.bottom + gap;
        if (top + tipRect.height > window.innerHeight) top = rect.top - gap - tipRect.height;
        tooltip.style.left = `${left + window.scrollX}px`;
        tooltip.style.top = `${top + window.scrollY}px`;
    }

    function hide() {
        if (current) current.removeAttribute('aria-describedby');
        current = null;
        tooltip.hidden = true;
    }

    root.querySelectorAll('[data-tooltip]').forEach(el => {
        el.addEventListener('mouseenter', () => show(el));
        el.addEventListener('mouseleave', hide);
        el.addEventListener('focus', () => {
            if (el.matches(':focus-visible')) show(el);
        });
        el.addEventListener('blur', hide);
        el.addEventListener('pointerdown', hide);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && current) hide();
    });
}
