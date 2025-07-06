/**
 * Runtime Detection Utility
 * 
 * Detects whether we're running in Bun, Node.js, or Browser
 * and provides appropriate APIs for each environment
 */

export type RuntimeEnvironment = 'bun' | 'node' | 'browser';

/**
 * Detect the current runtime environment
 */
export function detectRuntime(): RuntimeEnvironment {
	// Check for Bun
	if (typeof Bun !== 'undefined') {
		return 'bun';
	}

	// Check for Node.js
	if (typeof process !== 'undefined' && process.versions?.node) {
		return 'node';
	}

	// Default to browser
	return 'browser';
}

/**
 * Get the appropriate file operations for the current runtime
 */
export function getFileOperations() {
	const runtime = detectRuntime();

	switch (runtime) {
		case 'bun':
			return import('./file-operations/bun-file-ops');
		case 'node':
			return import('./file-operations/node-file-ops');
		case 'browser':
			return import('./file-operations/browser-file-ops');
		default:
			throw new Error(`Unsupported runtime: ${runtime}`);
	}
}
