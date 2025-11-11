# CSS Architecture

This directory contains the modular CSS files for the Motif application.

## File Structure

```
src/styles/
├── main.css         # Main entry point - imports all modules
├── variables.css    # CSS custom properties (design system)
├── base.css         # Reset, typography, accessibility
├── layout.css       # Main layout, panels, grid structure
└── components.css   # Buttons, inputs, dialogs, etc.
```

## Import Order

The CSS files are imported in this specific order in `main.css`:

1. **variables.css** - CSS custom properties must be loaded first
2. **base.css** - Reset and base styles
3. **layout.css** - Layout structure
4. **components.css** - Component styles

## Design System

All design tokens are defined in `variables.css` as CSS custom properties:

- **Colors**: Primary, danger, text, background, borders
- **Spacing**: Base unit of 4px (--space-1 through --space-16)
- **Typography**: Font families, sizes, weights, line heights
- **Borders**: Widths and border-radius values
- **Shadows**: Elevation levels
- **Transitions**: Animation durations
- **Layout**: Panel widths and breakpoints

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

Changes are automatically picked up by Vite's dev server with hot module replacement.

## Best Practices

- Use CSS custom properties (variables) for all design tokens
- Follow the established naming conventions
- Add comments for complex selectors
- Group related styles together
- Maintain specificity as low as possible
- Prefer classes over element selectors (except for base styles)
