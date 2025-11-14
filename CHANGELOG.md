  # Changelog

  All notable changes to Motif will be documented in this file.

  The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
  and this project adheres to [Semantic
  Versioning](https://semver.org/spec/v2.0.0.html).

  ## [Unreleased]

  ### Added
  - Mobile and tablet responsive design for all screen sizes
  - Touch support for grid resize handles with larger touch targets (20px)
  - Visual feedback when resizing grid on touch devices
  - Full-screen overlay panels on mobile with close buttons
  - Optimized canvas sizing for mobile portrait and landscape modes
  - Larger touch targets throughout mobile UI (44px minimum)
  - Comprehensive JSDoc type annotations across entire codebase for better IDE support and AI assistance
  - History size limit (50 states max) to prevent unbounded memory growth
  - Browser feature detection with user-friendly error messages (Canvas API, localStorage, FileReader)
  - Content Security Policy on all HTML pages to improve security posture
  - Self-hosted fonts for offline capability and privacy (Google Fonts downloaded locally)
  - Comprehensive unit test suite (140 tests across storage, grid, export, validation, feature detection, history)
  - Code coverage reporting configuration
  - Dependabot configuration for automated dependency updates
  - Inline documentation for complex algorithms and edge cases
  - Application state structure documentation in CONTRIBUTING.md

  ### Changed
  - Canvas headings hidden in landscape mode to save vertical space
  - Navbar layout optimized for mobile with reduced spacing
  - Side panels now overlay content on mobile instead of pushing it
  - Improved canvas space utilization on all mobile devices
  - Refactored main.js into focused UI modules (palette.js, panels.js, keyboard.js, interactions.js)
  - Extracted magic numbers to CONFIG constants with documentation
  - All configuration constants now documented in config.js
  - Browser no longer loads external Google Fonts (CSP updated accordingly)

  ### Fixed
  - Canvas size now remains stable when browser address bar appears/disappears on mobile
  - Grid resize handles now work properly with touch input

  ## [1.0.0] - 2025-11-11

  Initial public release of Motif - a web-based grid pattern editor for designing repeating patterns. Built specifically for colourwork knitting patterns, but useful for any grid-based design work.

  ### Features

  #### Grid-based Pattern Editor
  - Flexible grid dimensions from 2×2 to 100×100 cells
  - Custom aspect ratios - square cells or custom dimensions for gauge
  - Click and drag to paint cells with selected colour
  - Visual tiling preview with customisable repeats (1-10 tiles)
  - Live preview updates as you draw

  #### Colour Management
  - Support for up to 20 colours per pattern
  - Colour picker for custom colours
  - Colour merging when deleting colours to preserve painted cells

  #### History & Workflow
  - Full undo/redo functionality
  - Uses localStorage: clearing browser data deletes your work
  - Import/export patterns as JSON
  - Clear canvas with confirmation
  - Keyboard shortcuts for common actions

  #### Export Options
  - Export as PNG or SVG 
  - Export as JSON for sharing or backup

  #### User Experience
  - Runs entirely in your browser
  - Collapsible side panels for focused editing
  - Comprehensive help documentation

  ### Technical

  - Built with vanilla JavaScript (ES6 modules)
  - Canvas API for high-performance rendering
  - Zero external dependencies for runtime
  - Bundled with Vite for fast development and optimised builds
  - Comprehensive test coverage with Vitest (unit) and Playwright (E2E)
  - MIT licensed and open source

  ### Documentation

  - README with features and technical overview 
  - Contributing guidelines for developers
  - Comprehensive help page for users

  ---

  [1.0.0]: https://github.com/Knitlings/motif/releases/tag/v1.0.0

