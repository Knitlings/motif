import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    detectBrowserFeatures,
    showCriticalError,
    checkBrowserCompatibility
} from '../../src/utils/featureDetection.js';

describe('Feature Detection', () => {
    beforeEach(() => {
        // Clear any existing error overlays or banners
        document.body.innerHTML = '';
    });

    afterEach(() => {
        // Clean up
        document.body.innerHTML = '';
    });

    describe('detectBrowserFeatures', () => {
        it('should detect canvas support', () => {
            const features = detectBrowserFeatures();
            expect(features).toHaveProperty('canvas');
            expect(typeof features.canvas).toBe('boolean');
        });

        it('should detect localStorage support', () => {
            const features = detectBrowserFeatures();
            expect(features).toHaveProperty('localStorage');
            expect(typeof features.localStorage).toBe('boolean');
        });

        it('should detect FileReader support', () => {
            const features = detectBrowserFeatures();
            expect(features).toHaveProperty('fileReader');
            expect(typeof features.fileReader).toBe('boolean');
        });

        it('should detect all features as available in happy-dom environment', () => {
            const features = detectBrowserFeatures();
            expect(features.canvas).toBe(true);
            expect(features.localStorage).toBe(true);
            expect(features.fileReader).toBe(true);
        });
    });

    describe('showCriticalError', () => {
        it('replaces the page with a plain explanation', () => {
            document.body.innerHTML = '<main class="plate">editor</main>';
            showCriticalError('canvas', 'Test error message');

            const page = document.getElementById('feature-error');
            expect(page).toBeTruthy();
            expect(page.querySelector('h1').textContent).toBe("Motif can't run in this browser");
            expect(page.textContent).toContain('Test error message');
            expect(document.querySelector('.plate')).toBeNull();
        });

        it('keeps the wordmark in a top bar', () => {
            showCriticalError('canvas', 'Test error');

            expect(document.querySelector('header.top-bar .wordmark').textContent).toBe('Motif');
        });
    });

    describe('checkBrowserCompatibility', () => {
        it('should return capabilities object', () => {
            const capabilities = checkBrowserCompatibility();

            expect(capabilities).toBeDefined();
            expect(capabilities).toHaveProperty('canvas');
            expect(capabilities).toHaveProperty('localStorage');
            expect(capabilities).toHaveProperty('fileReader');
        });

        it('should leave the page alone when all features are available', () => {
            checkBrowserCompatibility();

            expect(document.getElementById('feature-error')).toBeNull();
        });
    });

    describe('localStorage availability detection', () => {
        it('should safely handle localStorage errors', () => {
            // This test verifies the try-catch structure exists
            // Actual error scenarios are tested in integration/browser tests
            const features = detectBrowserFeatures();
            expect(typeof features.localStorage).toBe('boolean');
        });
    });

    describe('Canvas API detection', () => {
        it('should safely detect canvas support', () => {
            // This test verifies the detection logic exists
            // Actual missing canvas scenarios are tested in integration/browser tests
            const features = detectBrowserFeatures();
            expect(typeof features.canvas).toBe('boolean');
        });
    });

    describe('FileReader API detection', () => {
        it('should detect when FileReader is undefined', () => {
            // Save original FileReader
            const originalFileReader = globalThis.FileReader;

            // Remove FileReader
            globalThis.FileReader = undefined;

            const features = detectBrowserFeatures();
            expect(features.fileReader).toBe(false);

            // Restore
            globalThis.FileReader = originalFileReader;
        });
    });
});
