# CSS Architecture

This directory contains the modular CSS files for the Motif application.

## File Structure

```
src/styles/
├── main.css       # Main entry point - imports all modules
├── variables.css  # Knitlings design tokens as CSS custom properties
├── base.css       # Reset, typography, focus, accessibility
├── controls.css   # Button, Field, Choice, Slider, Menu, Dialog, Note
├── pages.css      # Top bar, help and about pages
├── plate.css      # The editor: plate layout, captions, icon buttons, edge grips
└── key.css        # The key under the chart
```

Files are imported in this order in `main.css`; later files may refine earlier ones.

## Design System

Motif uses the Knitlings design system. Its tokens are defined in `variables.css` as CSS
custom properties:

- **Colour**: `--ink`, `--ink-secondary`, `--ink-muted`, `--surface`, `--ground`, `--rule`,
  `--accent` (links, focus, wordmark mark only), `--signal-error`
- **Spacing**: `--space-1` to `--space-8` (4px base)
- **Line**: `--line-hairline` to `--line-heavy`; corners are always square
- **Type**: Spectral only (self-hosted in `src/assets/fonts/`), as `font` shorthands
  `--text-display`, `--text-heading`, `--text-subhead`, `--text-body`, `--text-ui`,
  `--text-caption`, `--text-figure-caption`

No shadows or gradients: `box-shadow` only draws a ring.

## Best Practices

- Use CSS custom properties (variables) for all design tokens
- Follow the established naming conventions
- Add comments for complex selectors
- Group related styles together
- Maintain specificity as low as possible
- Prefer classes over element selectors (except for base styles)
