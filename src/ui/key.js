// ============================================
// KEY
// ============================================
//
// The framed legend under the chart, which is also the colour picker: numbered pattern
// colours, the background in its own cell, and the palette as a strip beneath.
// See the Knitlings design system's Key component.
//
// The key owns its rendering and its open panels; every change to the pattern goes
// through the actions passed in, so main.js keeps the state, history and saving.

import { CONFIG, UI_CONSTANTS } from '../config.js';

const PALETTE_IDS = ['motif', 'warm', 'cool', 'autumn', 'custom'];
const DRAG_THRESHOLD = 5;

const ICON_PLUS = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 1v10M1 6h10"/></svg>';
const ICON_CHEVRON = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M1.5 6.5L5 3l3.5 3.5"/></svg>';

/**
 * Create an element with attributes and children
 * @param {string} tag
 * @param {Object} [attrs] - Attributes; `class`, `text`, `html` and `on*` handlers are special
 * @param {Array<Node|string|null>} [children]
 */
function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) {
        if (value === null || value === undefined || value === false) continue;
        if (name === 'class') node.className = value;
        else if (name === 'text') node.textContent = value;
        else if (name === 'html') node.innerHTML = value;
        else if (name === 'style') Object.assign(node.style, value);
        else if (name.startsWith('on')) node.addEventListener(name.slice(2), value);
        else node.setAttribute(name, value === true ? '' : value);
    }
    for (const child of children) {
        if (child !== null && child !== undefined) node.append(child);
    }
    return node;
}

function paletteName(id) {
    return id === 'custom' ? 'Custom' : (CONFIG.BUILT_IN_PALETTES[id]?.name || id);
}

/** Swallow the click that follows a drag or a long press */
function suppressNextClick(node) {
    const swallow = (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
    };
    node.addEventListener('click', swallow, { capture: true, once: true });
    // If no click comes (pointer released elsewhere), stop waiting
    setTimeout(() => node.removeEventListener('click', swallow, { capture: true }), 400);
}

/**
 * @param {Object} deps
 * @param {Function} deps.getState - Returns { patternColors, activePatternIndex, backgroundColor,
 *   activePaletteId, customPalette, isBackgroundActive, isShiftKeyHeld }
 * @param {Object} deps.actions - selectColor(i), addColor(), changeColor(i, hex), removeColor(i),
 *   mergeColors(source, target), swapWithBackground(i), setBackground(hex), toggleBackgroundActive(),
 *   giveActiveColour(hex), switchPalette(id), loadPalette(), addCustomColour(),
 *   editCustomColour(i, hex), deleteCustomColour(i)
 * @param {Function} deps.isStacked - Whether the plate is stacked (fewer places in the row)
 * @param {Function} deps.isTouch - Whether instructions should speak of tapping
 */
export function createKey({ getState, actions, isStacked, isTouch }) {
    const root = document.getElementById('key');
    const hint = document.getElementById('keyHint');

    // Which panel is open: null | 'swatch' | 'more' | 'palette' | { chip: index }
    let open = null;

    function close(returnFocusTo) {
        if (open === null) return;
        open = null;
        render();
        if (returnFocusTo) focusById(returnFocusTo);
    }

    function focusById(id) {
        const target = root.querySelector(`[data-focus-id="${id}"]`);
        if (target) target.focus();
    }

    // ---------- Pointer gestures: drag to merge or swap, long press ----------

    /**
     * Drag a swatch (index) or the background ('background') onto another to merge or swap.
     * On touch, a long press on the background toggles painting with it.
     */
    function attachDrag(node, source) {
        node.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            const start = { x: e.clientX, y: e.clientY };
            let dragging = false;
            let target = null;
            let longPressTimer = null;

            if (source === 'background' && e.pointerType === 'touch') {
                longPressTimer = setTimeout(() => {
                    longPressTimer = null;
                    suppressNextClick(node);
                    if (navigator.vibrate) navigator.vibrate(UI_CONSTANTS.HAPTIC_FEEDBACK_DURATION);
                    actions.toggleBackgroundActive();
                    cleanup();
                }, UI_CONSTANTS.LONG_PRESS_DURATION);
            }

            const move = (ev) => {
                if (!dragging && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > DRAG_THRESHOLD) {
                    dragging = true;
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                    root.classList.add('is-dragging');
                    node.classList.add('is-drag-source');
                }
                if (!dragging) return;
                const next = dropTargetAt(ev.clientX, ev.clientY, source);
                if (next !== target) {
                    target?.classList.remove('is-drop-target');
                    target = next;
                    target?.classList.add('is-drop-target');
                }
            };

            const up = () => {
                const dropOn = target;
                cleanup();
                if (!dragging) return;
                suppressNextClick(node);
                if (!dropOn) return;
                const dest = dropOn.dataset.drop;
                if (source === 'background') {
                    actions.swapWithBackground(Number(dest));
                } else if (dest === 'background') {
                    actions.swapWithBackground(source);
                } else {
                    actions.mergeColors(source, Number(dest));
                }
            };

            function cleanup() {
                clearTimeout(longPressTimer);
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', up);
                window.removeEventListener('pointercancel', cleanup);
                target?.classList.remove('is-drop-target');
                node.classList.remove('is-drag-source');
                root.classList.remove('is-dragging');
            }

            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
            window.addEventListener('pointercancel', cleanup);
        });
    }

    function dropTargetAt(x, y, source) {
        const hit = document.elementFromPoint(x, y)?.closest('[data-drop]');
        if (!hit || !root.contains(hit)) return null;
        const dest = hit.dataset.drop;
        if (dest === String(source)) return null;
        if (source === 'background' && dest === 'background') return null;
        return hit;
    }

    /** Shift-click or long press: the palette colour becomes the background */
    function attachBackgroundShortcut(node, hex) {
        node.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch') return;
            const start = { x: e.clientX, y: e.clientY };
            const timer = setTimeout(() => {
                suppressNextClick(node);
                if (navigator.vibrate) navigator.vibrate(UI_CONSTANTS.HAPTIC_FEEDBACK_DURATION);
                actions.setBackground(hex);
                cleanup();
            }, UI_CONSTANTS.LONG_PRESS_DURATION);
            const move = (ev) => {
                if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > DRAG_THRESHOLD) cleanup();
            };
            function cleanup() {
                clearTimeout(timer);
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', cleanup);
                window.removeEventListener('pointercancel', cleanup);
            }
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', cleanup);
            window.addEventListener('pointercancel', cleanup);
        });
    }

    // ---------- Pieces ----------

    function shortcutFor(index) {
        return index < 10 ? String((index + 1) % 10) : `Shift+${(index - 9) % 10}`;
    }

    function swatch(state, index, { inMore = false } = {}) {
        const hex = state.patternColors[index];
        const backgroundPainting = state.isBackgroundActive || state.isShiftKeyHeld;
        const selected = index === state.activePatternIndex && !backgroundPainting;
        const menuOpen = selected && open === 'swatch' && !inMore;
        const number = index + 1;

        const button = el('button', {
            type: 'button',
            class: 'key-swatch',
            style: { backgroundColor: hex },
            'aria-label': `Colour ${number}, ${hex}`,
            'aria-pressed': selected ? 'true' : 'false',
            'aria-haspopup': selected && !inMore ? 'true' : null,
            'aria-expanded': selected && !inMore ? String(menuOpen) : null,
            title: selected ? `Change or remove colour ${number}` : `Colour ${number} · ${shortcutFor(index)}`,
            'data-drop': String(index),
            'data-focus-id': `swatch-${index}`,
            onclick: () => {
                if (inMore) {
                    open = null;
                    actions.selectColor(index);
                    focusById(`swatch-${index}`);
                } else if (selected) {
                    open = menuOpen ? null : 'swatch';
                    render();
                    focusById(menuOpen ? `swatch-${index}` : 'swatch-menu-first');
                } else {
                    open = null;
                    actions.selectColor(index);
                    focusById(`swatch-${index}`);
                }
            }
        });
        attachDrag(button, index);

        return el('div', { class: 'key-place' }, [
            button,
            el('span', { class: 'key-number', 'aria-hidden': 'true', text: String(number) }),
            menuOpen ? swatchMenu(state, index) : null
        ]);
    }

    function swatchMenu(state, index) {
        const number = index + 1;
        const changeInput = el('input', {
            type: 'color',
            class: 'key-well key-well-small',
            value: state.patternColors[index],
            'aria-label': `Change colour ${number}`,
            'data-focus-id': 'swatch-menu-first',
            onchange: (e) => {
                open = null;
                actions.changeColor(index, e.target.value);
                focusById(`swatch-${index}`);
            }
        });
        return el('div', { class: 'key-popover key-swatch-menu', role: 'group', 'aria-label': `Colour ${number}` }, [
            el('label', { class: 'key-menu-row' }, [el('span', { text: 'Change colour', 'aria-hidden': 'true' }), changeInput]),
            index === 0 ? null : el('button', {
                type: 'button',
                class: 'key-menu-row',
                text: 'Remove',
                onclick: () => {
                    open = null;
                    render();
                    actions.removeColor(index);
                }
            })
        ]);
    }

    function swatchRow(state, squeeze) {
        const count = state.patternColors.length;
        const canAdd = count < CONFIG.MAX_PATTERN_COLORS;
        // Places in the row: four colours, "+N" and add on the plate; one fewer stacked;
        // fewer again if the key is too narrow for those
        const places = Math.max(3, (isStacked() ? 5 : 6) - squeeze);
        let shown;
        if (count + (canAdd ? 1 : 0) <= places) {
            shown = [...Array(count).keys()];
        } else {
            const room = places - 1 - (canAdd ? 1 : 0);
            shown = [...Array(room).keys()];
            // The selected colour always takes the row's last place
            if (state.activePatternIndex >= room) shown[room - 1] = state.activePatternIndex;
        }
        const hidden = [...Array(count).keys()].filter(i => !shown.includes(i));
        const moreOpen = open === 'more' && hidden.length > 0;

        const group = el('div', { class: 'key-swatches', role: 'group', 'aria-labelledby': 'keyLabel' },
            shown.map(i => swatch(state, i)));

        if (hidden.length) {
            group.append(el('button', {
                type: 'button',
                class: 'key-more',
                text: `+${hidden.length}`,
                'aria-label': `${hidden.length} more colours`,
                'aria-expanded': String(moreOpen),
                'data-focus-id': 'more',
                onclick: () => {
                    open = moreOpen ? null : 'more';
                    render();
                    focusById(moreOpen ? 'more' : `swatch-${hidden[0]}`);
                }
            }));
        }

        if (canAdd) {
            group.append(el('button', {
                type: 'button',
                class: 'key-add',
                html: ICON_PLUS,
                'aria-label': 'Add colour',
                title: 'Add colour',
                'data-focus-id': 'add',
                onclick: () => {
                    open = null;
                    actions.addColor();
                    focusById('add');
                }
            }));
        }

        const morePanel = moreOpen
            ? el('div', { class: 'key-popover key-more-panel', role: 'group', 'aria-label': 'More colours' },
                hidden.map(i => swatch(state, i, { inMore: true })))
            : null;

        return { group, morePanel };
    }

    function backgroundCell(state) {
        const active = state.isBackgroundActive || state.isShiftKeyHeld;
        const input = el('input', {
            type: 'color',
            class: `key-well${active ? ' is-active' : ''}`,
            value: state.backgroundColor,
            'aria-label': `Background colour, ${state.backgroundColor}`,
            title: 'Background colour. Shift+click paints with it',
            'data-drop': 'background',
            'data-focus-id': 'background',
            onchange: (e) => actions.setBackground(e.target.value)
        });
        attachDrag(input, 'background');
        return el('label', { class: 'key-background' }, [
            input,
            el('span', { class: 'key-background-label', 'aria-hidden': 'true', text: 'Background' })
        ]);
    }

    function paletteRow(state) {
        const id = state.activePaletteId;
        const isCustom = id === 'custom';
        const colors = isCustom ? (state.customPalette || []) : CONFIG.BUILT_IN_PALETTES[id].colors;
        const listOpen = open === 'palette';
        const activeNumber = state.activePatternIndex + 1;

        const trigger = el('button', {
            type: 'button',
            class: 'key-palette-button',
            'aria-haspopup': 'listbox',
            'aria-expanded': String(listOpen),
            'aria-label': `Palette: ${paletteName(id)}`,
            'data-focus-id': 'palette',
            html: `${paletteName(id)} ${ICON_CHEVRON}`,
            onclick: () => {
                open = listOpen ? null : 'palette';
                render();
                focusById(listOpen ? 'palette' : `palette-option-${id}`);
            }
        });

        const strip = el('div', {
            class: 'key-strip',
            role: 'group',
            'aria-label': isCustom ? 'Custom palette' : `Give colour ${activeNumber} a colour from the ${paletteName(id)} palette`,
            style: { maxWidth: `${colors.length * 36 + 2}px` }
        }, colors.map((hex, i) => chip(state, hex, i, isCustom)));

        const add = isCustom && colors.length < CONFIG.MAX_PALETTE_COLORS
            ? el('button', {
                type: 'button',
                class: 'key-add key-add-small',
                html: ICON_PLUS,
                'aria-label': 'Add a colour to the custom palette',
                title: 'Add a colour to the custom palette',
                'data-focus-id': 'chip-add',
                onclick: () => {
                    open = null;
                    actions.addCustomColour();
                    focusById('chip-add');
                }
            })
            : null;

        return el('div', { class: 'key-palette-row' }, [trigger, strip, add]);
    }

    function chip(state, hex, index, isCustom) {
        const menuOpen = isCustom && open && open.chip === index;
        const activeNumber = state.activePatternIndex + 1;
        const button = el('button', {
            type: 'button',
            class: 'key-chip',
            style: { backgroundColor: hex },
            title: hex,
            'aria-label': isCustom ? `Custom palette colour ${index + 1}, ${hex}` : `Make colour ${activeNumber} ${hex}`,
            'aria-haspopup': isCustom ? 'true' : null,
            'aria-expanded': isCustom ? String(Boolean(menuOpen)) : null,
            'data-focus-id': `chip-${index}`,
            onclick: (e) => {
                if (e.shiftKey) {
                    actions.setBackground(hex);
                } else if (isCustom) {
                    open = menuOpen ? null : { chip: index };
                    render();
                    focusById(menuOpen ? `chip-${index}` : 'chip-menu-first');
                } else {
                    actions.giveActiveColour(hex);
                }
            }
        });
        attachBackgroundShortcut(button, hex);

        return el('span', { class: 'key-chip-place' }, [button, menuOpen ? chipMenu(state, hex, index) : null]);
    }

    function chipMenu(state, hex, index) {
        const activeNumber = state.activePatternIndex + 1;
        return el('div', { class: 'key-popover key-chip-menu', role: 'group', 'aria-label': `Custom palette colour ${index + 1}` }, [
            el('button', {
                type: 'button',
                class: 'key-menu-row',
                text: `Use for colour ${activeNumber}`,
                'data-focus-id': 'chip-menu-first',
                onclick: () => {
                    open = null;
                    actions.giveActiveColour(hex);
                    focusById(`chip-${index}`);
                }
            }),
            el('label', { class: 'key-menu-row' }, [
                el('span', { text: 'Edit', 'aria-hidden': 'true' }),
                el('input', {
                    type: 'color',
                    class: 'key-well key-well-small',
                    value: hex,
                    'aria-label': `Edit custom palette colour ${index + 1}`,
                    onchange: (e) => {
                        open = null;
                        actions.editCustomColour(index, e.target.value);
                        focusById(`chip-${index}`);
                    }
                })
            ]),
            (state.customPalette || []).length > CONFIG.MIN_PALETTE_COLORS
                ? el('button', {
                    type: 'button',
                    class: 'key-menu-row',
                    text: 'Delete',
                    onclick: () => {
                        open = null;
                        actions.deleteCustomColour(index);
                        focusById('palette');
                    }
                })
                : null
        ]);
    }

    function paletteList(state) {
        const options = PALETTE_IDS.map(id => {
            const selected = id === state.activePaletteId;
            const colors = id === 'custom' ? null : CONFIG.BUILT_IN_PALETTES[id].colors;
            return el('div', {
                class: 'key-option',
                role: 'option',
                tabindex: '-1',
                'aria-selected': String(selected),
                'data-palette': id,
                'data-focus-id': `palette-option-${id}`,
                onclick: () => {
                    open = null;
                    actions.switchPalette(id);
                    focusById('palette');
                }
            }, [
                el('span', { class: 'key-option-mark', 'aria-hidden': 'true' }),
                el('span', { class: 'key-option-name', text: paletteName(id) }),
                colors
                    ? el('span', { class: 'key-option-strip', 'aria-hidden': 'true' },
                        colors.map(hex => el('span', { style: { backgroundColor: hex } })))
                    : null
            ]);
        });

        const listbox = el('div', {
            class: 'key-listbox',
            role: 'listbox',
            'aria-label': 'Palette',
            onkeydown: (e) => {
                const items = [...listbox.querySelectorAll('[role="option"]')];
                const at = items.indexOf(document.activeElement);
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const next = (at + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
                    items[next].focus();
                } else if (e.key === 'Home' || e.key === 'End') {
                    e.preventDefault();
                    items[e.key === 'Home' ? 0 : items.length - 1].focus();
                } else if ((e.key === 'Enter' || e.key === ' ') && at >= 0) {
                    e.preventDefault();
                    items[at].click();
                }
            }
        }, options);

        return el('div', { class: 'key-popover key-palette-list' }, [
            listbox,
            el('button', {
                type: 'button',
                class: 'key-menu-row key-load',
                text: 'Load palette',
                onclick: () => {
                    open = null;
                    actions.loadPalette();
                    focusById('palette');
                }
            })
        ]);
    }

    // ---------- Render ----------

    function render(squeeze = 0) {
        const state = getState();
        const focusedId = root.contains(document.activeElement) ? document.activeElement.dataset.focusId : null;

        const { group, morePanel } = swatchRow(state, squeeze);
        root.replaceChildren(...[
            el('div', { class: 'key-row' }, [
                el('span', { class: 'key-label', id: 'keyLabel', text: 'Key' }),
                group,
                backgroundCell(state)
            ]),
            paletteRow(state),
            morePanel,
            open === 'palette' ? paletteList(state) : null
        ].filter(Boolean));

        // The row never wraps: if it overflows, give up a place and draw it again
        if (group.scrollWidth > group.clientWidth + 1 && squeeze < 3) {
            render(squeeze + 1);
            return;
        }

        if (focusedId) focusById(focusedId);
        renderHint(state);
    }

    /**
     * Move the selection marks without rebuilding the key (Shift held or released):
     * the background shows as what is being painted with
     */
    function refreshSelection() {
        const state = getState();
        const backgroundPainting = state.isBackgroundActive || state.isShiftKeyHeld;
        root.querySelectorAll('.key-swatch').forEach(button => {
            const index = Number(button.dataset.drop);
            button.setAttribute('aria-pressed', String(index === state.activePatternIndex && !backgroundPainting));
        });
        root.querySelector('.key-background .key-well')?.classList.toggle('is-active', backgroundPainting);
        renderHint(state);
    }

    function renderHint(state) {
        const painting = state.isBackgroundActive ? 'the background' : String(state.activePatternIndex + 1);
        hint.textContent = isTouch()
            ? `Painting with ${painting} · tap its swatch again to change or remove it · tap a painted square again to erase · drag an edge to resize`
            : `Painting with ${painting} · click its swatch again to change or remove it · Shift+click erases · drag an edge to resize`;
    }

    // ---------- Closing panels ----------

    // A click anywhere outside the key (including painting a square) closes what is open
    document.addEventListener('pointerdown', (e) => {
        if (open !== null && !root.contains(e.target)) close();
    });

    root.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || open === null) return;
        e.stopPropagation();
        const state = getState();
        const returnTo = open === 'swatch' ? `swatch-${state.activePatternIndex}`
            : open === 'more' ? 'more'
            : open === 'palette' ? 'palette'
            : `chip-${open.chip}`;
        close(returnTo);
    });

    return { render, refreshSelection, close };
}
