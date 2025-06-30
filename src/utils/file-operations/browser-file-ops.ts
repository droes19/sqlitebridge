/**
 * Browser file operations implementation (for web version)
 */
import type { FileOperations } from './base-file-ops.js';

export class BrowserFileOperations implements FileOperations {
	// Browser implementation would use File API
	// This is a placeholder for browser compatibility
	async checkFileExists(filePath: string): Promise<boolean> {
		throw new Error('File operations not available in browser environment');
	}

	async checkDirExists(dirPath: string): Promise<boolean> {
		throw new Error('File operations not available in browser environment');
	}

	async ensureDir(dirPath: string): Promise<boolean> {
		throw new Error('File operations not available in browser environment');
	}

	async readFile(filePath: string): Promise<string | null> {
		throw new Error('File operations not available in browser environment');
	}

	async writeToFile(filePath: string, content: string): Promise<boolean> {
		throw new Error('File operations not available in browser environment');
	}

	async getSqlFilesInDirectory(dirPath: string, pattern?: RegExp): Promise<string[]> {
		throw new Error('File operations not available in browser environment');
	}
}
