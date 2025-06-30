/**
 * Node.js file operations implementation
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { FileOperations } from './base-file-ops.js';

export class NodeFileOperations implements FileOperations {
	async checkFileExists(filePath: string): Promise<boolean> {
		try {
			return existsSync(filePath);
		} catch {
			return false;
		}
	}

	async checkDirExists(dirPath: string): Promise<boolean> {
		try {
			return existsSync(dirPath) && statSync(dirPath).isDirectory();
		} catch {
			return false;
		}
	}

	async ensureDir(dirPath: string): Promise<boolean> {
		try {
			if (!existsSync(dirPath)) {
				mkdirSync(dirPath, { recursive: true });
			}
			return true;
		} catch (error) {
			console.error(`Error creating directory ${dirPath}:`, error);
			return false;
		}
	}

	async readFile(filePath: string): Promise<string | null> {
		try {
			if (!(await this.checkFileExists(filePath))) {
				console.error(`Error: ${filePath} does not exist.`);
				return null;
			}
			return readFileSync(filePath, 'utf8');
		} catch (error) {
			console.error(`Error reading file ${filePath}:`, error);
			return null;
		}
	}

	async writeToFile(filePath: string, content: string): Promise<boolean> {
		try {
			const outputDir = dirname(filePath);
			await this.ensureDir(outputDir);
			writeFileSync(filePath, content);
			return true;
		} catch (error) {
			console.error(`Error writing to file ${filePath}:`, error);
			return false;
		}
	}

	async getSqlFilesInDirectory(dirPath: string, pattern: RegExp = /\.sql$/i): Promise<string[]> {
		try {
			if (!(await this.checkDirExists(dirPath))) {
				console.error(`Error: ${dirPath} is not a valid directory.`);
				return [];
			}

			return readdirSync(dirPath)
				.filter(file => pattern.test(file))
				.sort();
		} catch (error) {
			console.error(`Error reading directory ${dirPath}:`, error);
			return [];
		}
	}
}
