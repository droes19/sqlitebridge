/**
 * Bun file operations implementation
 */
import type { FileOperations } from './base-file-ops.js';

export class BunFileOperations implements FileOperations {
	async checkFileExists(filePath: string): Promise<boolean> {
		try {
			const file = Bun.file(filePath);
			return await file.exists();
		} catch {
			return false;
		}
	}

	async checkDirExists(dirPath: string): Promise<boolean> {
		try {
			const stat = await Bun.file(dirPath).stat();
			return stat.isDirectory();
		} catch {
			return false;
		}
	}

	async ensureDir(dirPath: string): Promise<boolean> {
		try {
			await Bun.spawn(['mkdir', '-p', dirPath]).exited;
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

			const file = Bun.file(filePath);
			return await file.text();
		} catch (error) {
			console.error(`Error reading file ${filePath}:`, error);
			return null;
		}
	}

	async writeToFile(filePath: string, content: string): Promise<boolean> {
		try {
			const pathParts = filePath.split('/');
			const dirPath = pathParts.slice(0, -1).join('/');
			if (dirPath) {
				await this.ensureDir(dirPath);
			}

			await Bun.write(filePath, content);
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

			const glob = new Bun.Glob("*.sql");
			const files: string[] = [];

			for await (const file of glob.scan(dirPath)) {
				if (pattern.test(file)) {
					files.push(file);
				}
			}

			return files.sort();
		} catch (error) {
			console.error(`Error reading directory ${dirPath}:`, error);
			return [];
		}
	}
}
