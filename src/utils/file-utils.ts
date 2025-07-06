/**
 * Universal File Utilities
 * 
 * Automatically detects runtime and uses appropriate file operations
 */

import { detectRuntime, getFileOperations } from './runtime-detector';
import { NodeFileOperations } from './file-operations/node-file-ops';
import { BunFileOperations } from './file-operations/bun-file-ops';
import { BrowserFileOperations } from './file-operations/browser-file-ops';
import type { FileOperations } from './file-operations/base-file-ops';

let fileOps: FileOperations;

// Initialize file operations based on runtime
function initFileOperations(): FileOperations {
	if (fileOps) return fileOps;

	const runtime = detectRuntime();

	switch (runtime) {
		case 'bun':
			fileOps = new BunFileOperations();
			break;
		case 'node':
			fileOps = new NodeFileOperations();
			break;
		case 'browser':
			fileOps = new BrowserFileOperations();
			break;
		default:
			throw new Error(`Unsupported runtime: ${runtime}`);
	}

	return fileOps;
}

// Export universal functions
export async function checkFileExists(filePath: string): Promise<boolean> {
	const ops = initFileOperations();
	return ops.checkFileExists(filePath);
}

export async function checkDirExists(dirPath: string): Promise<boolean> {
	const ops = initFileOperations();
	return ops.checkDirExists(dirPath);
}

export async function ensureDir(dirPath: string): Promise<boolean> {
	const ops = initFileOperations();
	return ops.ensureDir(dirPath);
}

export async function readFile(filePath: string): Promise<string | null> {
	const ops = initFileOperations();
	return ops.readFile(filePath);
}

export async function writeToFile(filePath: string, content: string): Promise<boolean> {
	const ops = initFileOperations();
	return ops.writeToFile(filePath, content);
}

export async function getSqlFilesInDirectory(
	dirPath: string,
	pattern: RegExp = /\.sql$/i
): Promise<string[]> {
	const ops = initFileOperations();
	return ops.getSqlFilesInDirectory(dirPath, pattern);
}
