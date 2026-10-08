// ============================================
// NOTES
// ============================================
//
// Status, warning and error notes (see the design system's Note component).
// One slot, in the top bar (on a phone, in the hint's place under the key): a newer note
// takes it, and a lasting warning that hasn't been dismissed returns when the newer note
// leaves. An error raised while a dialog is open shows in that dialog instead.

const STATUS_DURATION = 4000;

const WARNING_MARK = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M7 1L13 12H1z"/><path d="M7 5v3.5M7 10v.5"/></svg>';

/**
 * Build a note element
 * @param {'status'|'warning'|'error'} kind
 * @param {string} text
 * @param {Function} [onDismiss] - Warnings and errors carry a Dismiss cell
 */
function buildNote(kind, text, onDismiss) {
    const note = document.createElement('div');
    note.className = `note note-${kind}`;
    note.setAttribute('role', kind === 'error' ? 'alert' : 'status');

    const body = document.createElement('span');
    body.className = 'note-text';
    if (kind !== 'status') body.innerHTML = WARNING_MARK;
    const words = document.createElement('span');
    words.textContent = text;
    body.append(words);
    note.append(body);

    if (onDismiss) {
        const dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.className = 'note-dismiss';
        dismiss.textContent = 'Dismiss';
        // Dismissing removes the button, so focus goes back to where it came from:
        // else the dialog's first control, or the chart
        let cameFrom = null;
        dismiss.addEventListener('focus', (e) => { cameFrom = e.relatedTarget; });
        dismiss.addEventListener('click', () => {
            const hadFocus = document.activeElement === dismiss;
            const dialog = note.closest('dialog');
            onDismiss();
            if (!hadFocus) return;
            const back = cameFrom?.isConnected ? cameFrom
                : dialog ? dialog.querySelector('input, button, select, textarea')
                : document.getElementById('chartSection');
            back?.focus();
        });
        note.append(dismiss);
    }
    return note;
}

/**
 * @param {Object} deps
 * @param {HTMLElement} deps.slot - Where notes sit in the top bar
 * @param {HTMLElement} [deps.phoneSlot] - Where they sit on a phone
 * @param {MediaQueryList} [deps.phone] - Whether the phone layout is showing
 * @param {Function} deps.announce - Screen reader announcement for status and warning notes
 */
export function createNotes({ slot, phoneSlot, phone, announce }) {
    let current = null; // { kind, text }
    let lasting = null; // a warning, until dismissed
    let timer = null;

    function render() {
        const shown = current || lasting;
        const target = phoneSlot && phone?.matches ? phoneSlot : slot;
        slot.replaceChildren();
        phoneSlot?.replaceChildren();
        if (!shown) return;
        const dismiss = shown.kind === 'status' ? null : () => {
            if (shown === current) current = null;
            if (shown === lasting) lasting = null;
            render();
        };
        target.append(buildNote(shown.kind, shown.text, dismiss));
    }

    // Moving between the phone and the wider layouts moves the note with them
    phone?.addEventListener('change', render);

    function show(kind, text) {
        clearTimeout(timer);
        current = { kind, text };
        if (kind === 'status') {
            timer = setTimeout(() => {
                current = null;
                render();
            }, STATUS_DURATION);
        }
        if (kind !== 'error') announce(text);
        render();
    }

    return {
        /** A result that can't be seen on the page ("Link copied.") */
        status(text) {
            show('status', text);
        },

        /** A lasting condition that can't be fixed on the page */
        warning(text) {
            lasting = { kind: 'warning', text };
            if (!current) {
                announce(text);
                render();
            }
        },

        /** Something went wrong: shown in the open dialog if there is one */
        error(text) {
            const dialog = document.querySelector('dialog[open]');
            const inDialog = dialog?.querySelector('.dialog-note');
            if (inDialog) {
                inDialog.replaceChildren(buildNote('error', text, () => inDialog.replaceChildren()));
                return;
            }
            show('error', text);
        }
    };
}

/**
 * Show a note inside a dialog's own note slot (a warning about the dialog's content)
 * @param {HTMLElement} target - The dialog's `.dialog-note`
 * @param {'status'|'warning'|'error'} kind
 * @param {string|null} text - Clears the slot when empty
 */
export function showDialogNote(target, kind, text) {
    target.replaceChildren();
    if (text) target.append(buildNote(kind, text, kind === 'status' ? null : () => target.replaceChildren()));
}
