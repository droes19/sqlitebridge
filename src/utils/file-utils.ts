import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Check if a file exists and is readable
 * @param filePath Path to the file to check
 * @returns True if file exists and is readable
 */
export function checkFileExists(filePath: string): boolean {
    try {
        return existsSync(filePath);
    } catch (error) {
        return false;
    }
}

/**
 * Check if a directory exists and is a directory
 * @param dirPath Path to the directory to check
 * @returns True if directory exists
 */
export function checkDirExists(dirPath: string): boolean {
    try {
        return existsSync(dirPath) && statSync(dirPath).isDirectory();
    } catch (error) {
        return false;
    }
}

/**
 * Create directory if it doesn't exist
 * @param dirPath Path to create
 * @returns True if successful
 */
export function ensureDir(dirPath: string): boolean {
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

/**
 * Read file content
 * @param filePath Path to the file
 * @returns File content or null if error
 */
export function readFile(filePath: string): string | null {
    try {
        if (!checkFileExists(filePath)) {
            console.error(`Error: ${filePath} does not exist.`);
            return null;
        }
        return readFileSync(filePath, 'utf8') as string;
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        return null;
    }
}

/**
 * Write content to file, creating directories if needed
 * @param filePath Path to write to
 * @param content Content to write
 * @returns True if successful
 */
export function writeToFile(filePath: string, content: string): boolean {
    try {
        // Create output directory if it doesn't exist
        const outputDir = dirname(filePath);
        ensureDir(outputDir);

        // Write output file
        writeFileSync(filePath, content);
        return true;
    } catch (error) {
        console.error(`Error writing to file ${filePath}:`, error);
        return false;
    }
}

/**
 * Get all SQL files in a directory matching a pattern
 * @param dirPath Directory to search
 * @param pattern Regular expression pattern to match
 * @returns Array of matching file names
 */
export function getSqlFilesInDirectory(dirPath: string, pattern: RegExp = /\.sql$/i): string[] {
    try {
        if (!checkDirExists(dirPath)) {
            console.error(`Error: ${dirPath} is not a valid directory.`);
            return [];
        }

        return readdirSync(dirPath)
            .filter(file => pattern.test(file))
            .sort(); // Sort alphabetically
    } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error);
        return [];
    }
}
