/**
 * File Utilities Module
 * 
 * This module provides utility functions for file system operations,
 * including checking file/directory existence, reading/writing files,
 * and retrieving SQL files from directories.
 * 
 * @packageDocumentation
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Checks if a file exists and is readable.
 * 
 * This function safely verifies that a file exists at the specified path
 * and can be accessed by the current process.
 * 
 * @param filePath - Path to the file to check
 * @returns True if the file exists and is readable, false otherwise
 * 
 * @example
 * ```typescript
 * if (checkFileExists('./config.json')) {
 *   // File exists, safe to read
 *   const config = readFile('./config.json');
 * }
 * ```
 */
export function checkFileExists(filePath: string): boolean {
    try {
        return existsSync(filePath);
    } catch (error) {
        return false;
    }
}

/**
 * Checks if a directory exists and is actually a directory (not a file).
 * 
 * This function safely verifies that a directory exists at the specified path
 * and that it is a directory and not a file.
 * 
 * @param dirPath - Path to the directory to check
 * @returns True if the directory exists, false otherwise
 * 
 * @example
 * ```typescript
 * if (checkDirExists('./migrations')) {
 *   // Directory exists, safe to read files from it
 *   const sqlFiles = getSqlFilesInDirectory('./migrations');
 * }
 * ```
 */
export function checkDirExists(dirPath: string): boolean {
    try {
        return existsSync(dirPath) && statSync(dirPath).isDirectory();
    } catch (error) {
        return false;
    }
}

/**
 * Creates a directory if it doesn't exist.
 * 
 * This function ensures that a directory exists at the specified path,
 * creating it and any necessary parent directories if they don't exist.
 * 
 * @param dirPath - Path to create
 * @returns True if the directory exists or was successfully created, false on error
 * 
 * @example
 * ```typescript
 * if (ensureDir('./output/generated')) {
 *   // Directory exists or was created, safe to write files to it
 *   writeToFile('./output/generated/model.ts', content);
 * }
 * ```
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
 * Reads the content of a file.
 * 
 * This function reads the entire content of a file at the specified path
 * as a UTF-8 encoded string.
 * 
 * @param filePath - Path to the file
 * @returns File content as a string, or null if the file doesn't exist or can't be read
 * 
 * @example
 * ```typescript
 * const sqlContent = readFile('./migrations/V1__initial_schema.sql');
 * if (sqlContent) {
 *   // Process the SQL file content
 *   const queries = extractQueriesFromContent(sqlContent);
 * }
 * ```
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
 * Writes content to a file, creating directories if needed.
 * 
 * This function writes the specified content to a file at the specified path,
 * creating any necessary parent directories if they don't exist.
 * 
 * @param filePath - Path to write to
 * @param content - Content to write
 * @returns True if the file was successfully written, false on error
 * 
 * @example
 * ```typescript
 * const modelContent = generateTypeScriptModel(tableDefinition);
 * if (writeToFile('./generated/models/user.ts', modelContent)) {
 *   console.log('Successfully wrote model file');
 * }
 * ```
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
 * Gets all SQL files in a directory matching a pattern.
 * 
 * This function returns an array of file names (not full paths) for all files
 * in the specified directory that match the given regular expression pattern.
 * The files are sorted alphabetically.
 * 
 * @param dirPath - Directory to search
 * @param pattern - Regular expression pattern to match (default: /\.sql$/i)
 * @returns Array of matching file names (not full paths)
 * 
 * @example
 * ```typescript
 * // Get all .sql files
 * const allSqlFiles = getSqlFilesInDirectory('./migrations');
 * 
 * // Get only migration files that follow the version pattern
 * const migrationFiles = getSqlFilesInDirectory('./migrations', /^V\d+__.+\.sql$/);
 * ```
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