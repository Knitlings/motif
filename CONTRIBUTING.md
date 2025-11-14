# Contributing to Motif

Thank you for your interest in contributing! This guide will help you understand the codebase and development workflow.

## Getting Started

### Prerequisites
- Node.js 16+ and npm

### Setup
```bash
npm install          # Install dependencies
npm run dev          # Start development server (localhost:8888)
npm run build        # Build for production
npm run preview      # Preview production build
```

### Testing
```bash
npm test                    # Run all tests
npm run test:unit           # Unit tests only
npm run test:unit:watch     # Unit tests in watch mode
npm run test:e2e            # End-to-end tests
npm run test:e2e:ui         # Interactive E2E testing
```

## Architecture Overview

### Project Structure

```
src/
├── main.js              # Application orchestrator and event handling
├── config.js            # Configuration constants and limits
├── utils.js             # Utility functions (math, DOM helpers)
├── assets/              # Static assets (SVGs, images) imported in JS
│   ├── delete.svg       # Delete icon
│   └── edit.svg         # Edit icon
├── managers/            # Singleton managers for stateful resources
│   ├── canvas.js        # Canvas rendering and cell size calculations
│   ├── history.js       # Undo/redo state management
│   └── storage.js       # localStorage persistence
├── core/                # Pure business logic
│   ├── grid.js          # Grid operations (resize, bounds, manipulation)
│   └── export.js        # Export/import functionality (SVG, PNG, JSON)
├── styles/              # Modular CSS files
│   ├── main.css         # Main stylesheet (imports all modules)
│   ├── variables.css    # Design tokens
│   ├── base.css         # Resets and base styles
│   ├── layout.css       # Layout and panels
│   ├── components.css   # UI components
│   └── responsive.css   # Mobile and tablet styles
└── utils/               # Specialized utilities
    ├── validation.js    # Input validation functions
    └── errorHandler.js  # Centralized error handling
```

### Key Concepts

**State Management**
- Global state lives in `main.js` (grid, colors, dimensions)
- Every state change triggers: `saveToHistory()` → `updateCanvas()` → `saveToLocalStorage()`
- Grid is a 2D array where `0` = background, `1-n` = pattern color indices (see `MAX_PATTERN_COLORS` in `config.js`)

**Application State Structure**
The main application state consists of these key variables (all in `main.js`):
```javascript
grid                  // number[][] - 2D array of cell values
gridWidth            // number - Grid columns (2-100)
gridHeight           // number - Grid rows (2-100)
backgroundColor      // string - Hex color for empty cells
patternColors        // string[] - Array of hex colors (max 20)
activeColorIndex     // number - Currently selected color (0-19)
aspectRatio          // number - Height/width ratio (stored inverted)
cellWidth            // number - Pixel width of cells
cellHeight           // number - Pixel height of cells
previewRepeatX       // number - Horizontal tile repeats (1-10)
previewRepeatY       // number - Vertical tile repeats (1-10)
```

**Grid Cell Encoding**
- `0` = Background (uses `backgroundColor`)
- `1-20` = Pattern color index + 1 (e.g., `grid[y][x] = 5` uses `patternColors[4]`)
- This offset allows `0` to have special meaning while keeping indices positive

**Canvas System**
- Two synchronized canvases: `editCanvas` (editing) and `previewCanvas` (tiled preview)
- Cell sizes calculated dynamically based on viewport and aspect ratio
- Updates batched via `requestAnimationFrame` for performance

**History Manager**
- Simple array-based undo/redo with index pointer
- Deep clones state using `JSON.stringify/parse`
- New actions truncate future history

**Module Pattern**
- Managers: Singleton objects managing resources (Canvas, Storage, History)
- Core: Pure functions for business logic (Grid, Export)
- Utils: Validation, error handling, helpers

## Development Guidelines

### Adding New Features

1. **Update configuration** in `src/config.js` if adding constants
2. **Add business logic** in appropriate module (`core/` or `managers/`)
3. **Wire up UI** in `main.js` event handlers
4. **Validate inputs** using `utils/validation.js`
5. **Handle errors** via `utils/errorHandler.js`
6. **Call `saveToHistory()`** for undo support
7. **Call `updateCanvas()`** to re-render
8. **Add tests** (unit tests for logic, E2E for user interactions)

### Code Style

- Use ES6 modules with explicit imports/exports
- Prefer `const` over `let`, avoid `var`
- Use descriptive variable names (no single letters except loop counters)
- Add JSDoc comments for complex functions
- Keep functions focused (single responsibility)
- Validate all user inputs before state changes

### Testing Strategy

**Unit Tests** (`tests/unit/`)
- Test managers and utilities in isolation
- Use Vitest with happy-dom for DOM simulation
- Mock external dependencies (localStorage, etc.)

**E2E Tests** (`tests/e2e/`)
- Test user interactions in real browsers
- Use Playwright for automation
- Test critical user flows (painting, exporting, undo/redo)
- Include visual regression tests with snapshots

**Updating Visual Snapshots**
When you intentionally change UI/canvas rendering:
```bash
npm run test:e2e -- --update-snapshots
```
Always review the updated snapshot images before committing to ensure they look correct.

## Build System

### Vite Configuration

The project uses Vite for development and production builds:

- **Development**: Fast HMR, instant server startup
- **Production**: Minification via esbuild, content hashing for cache busting
- **Output**: `dist/` directory with optimized assets

Configuration is in `vite.config.js`.

### Working with Static Assets (Images, SVGs, Fonts)

**For assets referenced in HTML or CSS:**
- Place them in the project root alongside `index.html`
- Reference with relative paths (e.g., `<img src="icon.svg">`)
- Vite will process and copy them to `dist/` automatically

**For assets used in JavaScript:**
- Place them in `src/assets/`
- Import as ES modules: `import iconSvg from './assets/icon.svg';`
- Use the imported value: `<img src="${iconSvg}">`
- Vite will inline small assets as data URLs or emit them with hashed filenames

**Why this matters:**
- Assets only referenced in dynamic JavaScript strings (e.g., `innerHTML = '<img src="icon.svg">'`) won't be detected by Vite's build process
- Always import assets as modules so Vite can process them correctly
- This ensures assets work in both development and production builds

### Adding Dependencies

Avoid adding runtime dependencies when possible. This project has **zero runtime dependencies** to keep bundle size minimal.

For development dependencies:
```bash
npm install --save-dev package-name
```

## Styling

### CSS Architecture

Modular CSS with clear separation:
- `variables.css` - Design tokens (colors, spacing, typography)
- `base.css` - Resets and base styles
- `layout.css` - Main layout and panels
- `components.css` - UI components (buttons, dialogs, etc.)

Import order matters - `main.css` imports all modules.

### Adding Styles

1. Add CSS variables to `variables.css` for reusability
2. Add component styles to `components.css`
3. Use existing design tokens when possible
4. Consider accessibility (focus states, contrast, reduced motion)

## Accessibility

All new features should maintain accessibility:
- Semantic HTML elements
- Keyboard navigation support
- ARIA attributes where needed
- Focus indicators on interactive elements
- Support for `prefers-reduced-motion` and `prefers-contrast`
- Color is not the only indicator of state

## Error Handling

All user-facing operations should:
1. Validate inputs via `validation.js`
2. Wrap in try/catch blocks
3. Use `ErrorHandler` for user-friendly messages
4. Log errors to console for debugging
5. Provide graceful fallbacks

## Release Process

For information about branching strategy, pull requests, and releases, see [RELEASING.md](RELEASING.md).

**Quick reference:**
- Create feature branches from `staging`
- PRs to `staging` for feature integration and testing
- PRs from `staging` to `main` for production releases
- Tag releases with semantic versioning after merging to `main`
- Use hotfix branches from `main` only for urgent production fixes

