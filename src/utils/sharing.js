/**
 * Pattern Sharing Utilities
 * Handles URL-based pattern sharing with client-side compression
 * Future-proof design for backend short URL integration
 */

import LZString from 'lz-string';
import { exportJson } from '../core/export.js';

// URL format constants
const SHARE_URL_PREFIX = '#p=';
const MAX_URL_LENGTH = 2048; // Conservative browser limit for warnings

// Future: Backend endpoint for short URLs
// const BACKEND_API_URL = '/api/share';

/**
 * Generate shareable URL from application state
 * @param {Object} state - Current application state
 * @returns {Promise<Object>} - { success: boolean, url?: string, error?: string, warning?: string }
 */
export async function generateShareUrl(state) {
	try {
		// Use existing exportJson format for consistency
		const jsonBlob = exportJson(state);

		// Convert blob to text
		const jsonString = await jsonBlob.text();

		// Compress using lz-string URL-safe method
		const compressed = LZString.compressToEncodedURIComponent(jsonString);

		// Generate full URL
		const baseUrl = window.location.origin + window.location.pathname;
		const shareUrl = `${baseUrl}${SHARE_URL_PREFIX}${compressed}`;

		// Check URL length
		if (shareUrl.length > MAX_URL_LENGTH) {
			return {
				success: true,
				url: shareUrl,
				warning: 'This URL is quite long and may not work in all contexts. Consider reducing your pattern size or using fewer colors.'
			};
		}

		return {
			success: true,
			url: shareUrl
		};
	} catch (error) {
		console.error('Failed to generate share URL:', error);
		return {
			success: false,
			error: 'Failed to generate share URL. The pattern may be too complex.'
		};
	}
}

/**
 * Parse shared pattern from URL hash
 * @returns {Object|null} - Parsed pattern data or null if no valid share data
 */
export function parseShareUrl() {
	try {
		const hash = window.location.hash;

		// Check for share URL format
		if (!hash.startsWith(SHARE_URL_PREFIX)) {
			return null;
		}

		const shareData = hash.substring(SHARE_URL_PREFIX.length);

		// Future: Check if this is a backend short ID (alphanumeric, 6-10 chars)
		// if (isShortId(shareData)) {
		//     return await fetchPatternFromBackend(shareData);
		// }

		// Decompress client-side data
		const decompressed = LZString.decompressFromEncodedURIComponent(shareData);

		if (!decompressed) {
			throw new Error('Failed to decompress share data');
		}

		// Parse JSON
		const patternData = JSON.parse(decompressed);

		return patternData;
	} catch (error) {
		console.error('Failed to parse share URL:', error);
		return null;
	}
}

/**
 * Copy text to clipboard with fallback
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} - Success status
 */
export async function copyToClipboard(text) {
	try {
		// Modern clipboard API
		if (navigator.clipboard && navigator.clipboard.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}

		// Fallback for older browsers
		const textArea = document.createElement('textarea');
		textArea.value = text;
		textArea.style.position = 'fixed';
		textArea.style.left = '-999999px';
		document.body.appendChild(textArea);
		textArea.select();

		const success = document.execCommand('copy');
		document.body.removeChild(textArea);

		return success;
	} catch (error) {
		console.error('Failed to copy to clipboard:', error);
		return false;
	}
}

/**
 * Validate share URL data against schema
 * @param {Object} data - Parsed share data
 * @returns {boolean} - Whether data is valid
 */
export function validateShareData(data) {
	if (!data || typeof data !== 'object') return false;
	if (!data.version || data.version !== 1) return false;
	if (!data.grid || !data.colors) return false;
	return true;
}

// Future: Backend integration functions
// /**
//  * Check if a string matches the short ID format
//  * @param {string} str - String to check
//  * @returns {boolean} - Whether string is a short ID
//  */
// function isShortId(str) {
//     return /^[a-zA-Z0-9]{6,10}$/.test(str);
// }
//
// /**
//  * Upload pattern to backend and get short URL
//  * @param {Object} state - Application state
//  * @returns {Promise<Object>} - { success: boolean, shortId?: string, url?: string, error?: string }
//  */
// export async function uploadToBackend(state) {
//     try {
//         const jsonBlob = exportJson(state);
//         const jsonString = await jsonBlob.text();
//
//         const response = await fetch(BACKEND_API_URL, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: jsonString
//         });
//
//         if (!response.ok) {
//             throw new Error(`HTTP error! status: ${response.status}`);
//         }
//
//         const result = await response.json();
//         const baseUrl = window.location.origin + window.location.pathname;
//
//         return {
//             success: true,
//             shortId: result.id,
//             url: `${baseUrl}${SHARE_URL_PREFIX}${result.id}`
//         };
//     } catch (error) {
//         console.error('Failed to upload to backend:', error);
//         return {
//             success: false,
//             error: 'Failed to create short URL. Please try again.'
//         };
//     }
// }
//
// /**
//  * Fetch pattern from backend by short ID
//  * @param {string} shortId - Short ID from URL
//  * @returns {Promise<Object|null>} - Pattern data or null on error
//  */
// async function fetchPatternFromBackend(shortId) {
//     try {
//         const response = await fetch(`${BACKEND_API_URL}/${shortId}`);
//
//         if (!response.ok) {
//             throw new Error(`HTTP error! status: ${response.status}`);
//         }
//
//         return await response.json();
//     } catch (error) {
//         console.error('Failed to fetch from backend:', error);
//         return null;
//     }
// }
