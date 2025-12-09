#!/usr/bin/env node

/**
 * Extract a specific version's changelog from CHANGELOG.md
 *
 * Usage: node extract-changelog.js <version>
 * Example: node extract-changelog.js 1.1.0
 */

const fs = require('fs');
const path = require('path');

function extractChangelog(version) {
  const changelogPath = path.join(__dirname, '..', '..', 'CHANGELOG.md');

  if (!fs.existsSync(changelogPath)) {
    console.error('CHANGELOG.md not found');
    process.exit(1);
  }

  const changelog = fs.readFileSync(changelogPath, 'utf8');
  const lines = changelog.split('\n');

  // Find the version header (e.g., "## [1.1.0] - 2025-11-22")
  // Note: May have leading whitespace
  const versionRegex = new RegExp(`^\\s*## \\[${version}\\]`);

  let startIndex = -1;
  let endIndex = -1;

  // Find start of this version's section
  for (let i = 0; i < lines.length; i++) {
    if (versionRegex.test(lines[i])) {
      startIndex = i + 1; // Skip the version header itself
      break;
    }
  }

  if (startIndex === -1) {
    console.error(`Version ${version} not found in CHANGELOG.md`);
    process.exit(1);
  }

  // Find end of this version's section (next ## header or end of file)
  for (let i = startIndex; i < lines.length; i++) {
    if (lines[i].trim().startsWith('## ')) {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    endIndex = lines.length;
  }

  // Extract the section and clean up
  let section = lines.slice(startIndex, endIndex);

  // Remove trailing empty lines
  while (section.length > 0 && section[section.length - 1].trim() === '') {
    section.pop();
  }

  // Remove leading empty lines
  while (section.length > 0 && section[0].trim() === '') {
    section.shift();
  }

  // Remove the "---" separator and comparison links at the end if present
  while (section.length > 0 && (section[section.length - 1].trim() === '---' || section[section.length - 1].startsWith('['))) {
    section.pop();
  }

  // Remove trailing empty lines again after cleanup
  while (section.length > 0 && section[section.length - 1].trim() === '') {
    section.pop();
  }

  return section.join('\n');
}

// Get version from command line argument
const version = process.argv[2];

if (!version) {
  console.error('Usage: node extract-changelog.js <version>');
  console.error('Example: node extract-changelog.js 1.1.0');
  process.exit(1);
}

try {
  const content = extractChangelog(version);
  console.log(content);
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
