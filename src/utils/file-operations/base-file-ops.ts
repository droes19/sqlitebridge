/**
 * Base interface for file operations across all runtimes
 */
export interface FileOperations {
	checkFileExists(filePath: string): Promise<boolean>;
	checkDirExists(dirPath: string): Promise<boolean>;
	ensureDir(dirPath: string): Promise<boolean>;
	readFile(filePath: string): Promise<string | null>;
	writeToFile(filePath: string, content: string): Promise<boolean>;
	getSqlFilesInDirectory(dirPath: string, pattern?: RegExp): Promise<string[]>;
}
