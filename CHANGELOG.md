  # Changelog

  All notable changes to Motif will be documented in this file.

  The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
  and this project adheres to [Semantic
  Versioning](https://semver.org/spec/v2.0.0.html).

  ## [Unreleased]

  ### Changed
  - A new look, shared with the other Knitlings tools: Spectral type, square corners and one top bar
  - The pattern's size and the preview's repeats are set in fields in the captions under the chart and above the preview, replacing the size headings and arrow buttons
  - Colours live in a key under the chart: numbered swatches, the background in its own cell, and the palette as a strip beneath. Click the selected swatch again to change or remove it
  - Charts fill their column; charts too large for the page scroll in a frame
  - Surrounding stitches for a download are chosen with grips on the preview and fields in its caption
  - Messages appear as notes in the top bar instead of pop-up dialogs, and busy buttons read "Preparing…" instead of a loading overlay
  - Help and about pages rewritten for the new layout
  - "Colour" throughout, and "pattern" rather than "canvas"

  ### Added
  - Stitch and row numbers beside the chart, counted from the right and the bottom
  - One repeat is outlined on the preview
  - A phone layout with 44px controls; tap a square to paint it, and drag to scroll

  ### Fixed
  - Keyboard and screen reader use: edge grips resize with the arrow keys, Import JSON works from the keyboard, each row of colours is one tab stop walked with the arrow keys, and focus returns to a sensible place after dialogs, removing a colour or dismissing a message

  ## [1.3.0] - 2026-03-17

  ### Added
  - Custom cell size option for PNG exports — set a specific pixel size per cell using a slider

  ### Changed
  - Pattern repeat outline in surroundings export changed from red to black, matching the downloaded image
  - Row count margin width reduced for a tighter layout
  - Export size preview label reserves minimum height to prevent layout stutter when adjusting cell size

  ## [1.2.0] - 2025-12-09

  ### Added
  - Pattern with surroundings download option - allows exporting patterns with configurable context stitches from neighboring repeats
  - Row count option in download modal for all export types
  - Download modal dialog replacing previous dropdown for better organization
  - Visual selection interface for adjusting pattern surroundings in downloads (for patterns with 3×3 preview)
  - Dynamic preview repeat limits based on pattern size to prevent performance issues
  - Automated update post creation workflow for Knitlings website

  ### Changed
  - Renamed "context" to "surroundings" in user-facing text for clarity
  - Improved download image styling with thicker red border (2px → 4px) on pattern repeat box for better visibility
  - Enhanced row count readability with white background, black separator border, extended grid lines, and monospace font

  ### Fixed
  - Grid resize operations are now properly undoable
  - Null values in grid cells are handled correctly
  - Content is preserved when shrinking grid from left/top edges
  - Export E2E tests updated to interact with visible elements

  ### Documentation
  - Added video demos with inline GIF display in README
  - Auto-cropped black borders from demo videos

  ### Dependencies
  - Updated @playwright/test from 1.56.1 to 1.57.0
  - Updated happy-dom from 20.0.10 to 20.0.11
  - Updated vite from 7.2.4 to 7.2.7
  - Updated vitest from 4.0.13 to 4.0.15

  ## [1.1.0] - 2025-11-22

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

  [1.2.0]: https://github.com/Knitlings/motif/releases/tag/v1.2.0
  [1.1.0]: https://github.com/Knitlings/motif/releases/tag/v1.1.0
  [1.0.0]: https://github.com/Knitlings/motif/releases/tag/v1.0.0

