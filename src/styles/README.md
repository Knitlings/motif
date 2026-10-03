# CSS Architecture

This directory contains the modular CSS files for the Motif application.

## File Structure

```
src/styles/
├── main.css         # Main entry point - imports all modules
├── variables.css    # CSS custom properties (design system)
├── base.css         # Reset, typography, accessibility
├── layout.css       # Main layout, panels, grid structure
├── components.css   # Buttons, inputs, dialogs, etc.
└── responsive.css   # Mobile and tablet responsive styles
```

## Import Order

The CSS files are imported in this specific order in `main.css`:

1. **variables.css** - CSS custom properties must be loaded first
2. **base.css** - Reset and base styles
3. **layout.css** - Layout structure
4. **components.css** - Component styles
5. **responsive.css** - Responsive overrides for mobile and tablet

## Design System

Motif uses the Knitlings design system. Its tokens are defined in `variables.css` as CSS
custom properties:

- **Colour**: `--ink`, `--ink-secondary`, `--ink-muted`, `--surface`, `--ground`, `--rule`,
  `--accent` (links, focus, wordmark only), `--signal-error`
- **Spacing**: `--space-1` to `--space-8` (4px base)
- **Line**: `--line-hairline` to `--line-heavy`; corners are always square
- **Type**: Spectral only (self-hosted in `src/assets/fonts/`), as `font` shorthands
  `--text-display`, `--text-heading`, `--text-subhead`, `--text-body`, `--text-ui`,
  `--text-caption`, `--text-figure-caption`

No shadows or gradients: `box-shadow` only draws a ring. The older variable names
(`--color-*`, `--font-size-*`, ...) are transitional aliases and are being removed.

## Usage in HTML

The main stylesheet is imported in `index.html`:

```html
<link rel="stylesheet" href="/src/styles/main.css">
```

Vite automatically bundles and optimizes all @import statements during build.

## Modifying Styles

To change the app's appearance:

1. **Design tokens**: Edit `variables.css`
2. **Base styles**: Edit `base.css`
3. **Layout**: Edit `layout.css`
4. **Components**: Edit `components.css`
5. **Responsive behavior**: Edit `responsive.css`

Changes are automatically picked up by Vite's dev server with hot module replacement.

## Best Practices

- Use CSS custom properties (variables) for all design tokens
- Follow the established naming conventions
- Add comments for complex selectors
- Group related styles together
- Maintain specificity as low as possible
- Prefer classes over element selectors (except for base styles)
