# Motif

![Motif Pattern Editor](.github/media/screenshot1.png)

Draw grid based patterns and see how they look when they repeat. Try Motif at [motif.works](https://motif.works).

## Features

- **Live tiled preview:** See customisable repeats as you draw
- **Flexible grid:** Create grids from 2×2 to 100×100 cells
- **Custom aspect ratios:** Square cells or custom dimensions for crafts like knitting
- **Multi-colour support:** Work with up to 20 colours per pattern
- **Export options:** Save your work as PNG, SVG, or JSON

## More information

See the [Help page](https://motif.works/help.html) and [About page](https://motif.works/about.html) to learn more about Motif.

<details>
<summary><strong>Screenshots & Demos</strong> (click to expand)</summary>

### Screenshots

![A large pattern is repeated two times vertically](.github/media/screenshot1.png)

![A border pattern is repeated three times horizontally](.github/media/screenshot2.png)

![Motif showcase](.github/media/motif_showcase.png)

### Videos

**Drawing a pattern**

https://github.com/user-attachments/assets/motif_basics.mp4

**Adding to a pattern**

https://github.com/user-attachments/assets/motif_adding.mp4

**Working with colour palettes**

https://github.com/user-attachments/assets/motif_colours.mp4

</details>

## Technical Overview

Built with vanilla JavaScript, HTML, and CSS using a modular ES6 architecture. The codebase is organized into focused modules for configuration, utilities, state management, canvas rendering, and core business logic.

**Build system:** Vite for fast development and optimized production builds

**Testing:** Vitest for unit tests, Playwright for end-to-end testing

**Project structure:**
```
src/
├── config.js          # Configuration constants and UI constants
├── utils.js           # Utility functions
├── managers/          # Storage, history, and canvas management
├── core/              # Grid operations and export/import
├── ui/                # UI modules (handlers, menus, palette, etc.)
├── utils/             # Specialized utilities (validation, error handling)
└── main.js            # Application initialization
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

