/**
 * Version Utilities Module
 * 
 * This module provides utilities for handling versioning in SQLite migrations,
 * including parsing version information from filenames and organizing tables by version.
 * 
 * @packageDocumentation
 */

import { VersionInfo } from "../types";

/**
 * Extract version information from a migration filename.
 * 
 * This function parses filenames that follow the format `Vx__description.sql` 
 * where `x` is the version number and `description` is a human-readable description.
 * It returns both the numeric version and a formatted description.
 * 
 * @param fileName - Name of the migration file
 * @returns Object with version number and description, or null if no match
 * 
 * @example
 * ```typescript
 * // Returns { version: 1, description: 'Initial Schema' }
 * const versionInfo = extractVersionInfo('V1__initial_schema.sql');
 * ```
 */
export const extractVersionInfo = (fileName: string): VersionInfo | null => {
    // Pattern to match Vx__description.sql format
    const versionMatch = fileName.match(/^V(\d+)__(.+)\.sql$/);

    if (versionMatch && versionMatch.length >= 3) {
        const version = parseInt(versionMatch[1], 10);

        // Convert the filename to a readable description
        let description = formatDescription(versionMatch[2]);

        return { version, description };
    }

    return null;
};

/**
 * Formats a raw description string from a filename into a readable description.
 * 
 * @param rawDescription - Raw description string from filename
 * @returns Formatted description
 * 
 * @internal
 */
function formatDescription(rawDescription: string): string {
    return rawDescription
        .replace(/-/g, ' ')          // Replace hyphens with spaces
        .replace(/_/g, ' ')          // Replace underscores with spaces
        .replace(/([a-z])([A-Z])/g, '$1 $2')  // Convert camelCase to spaces
        .toLowerCase()
        // Capitalize first letter of each word
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Extract just the version number from a migration filename.
 * 
 * @param fileName - Name of the migration file
 * @returns Version number or null if no match
 * 
 * @example
 * ```typescript
 * // Returns 1
 * const version = extractVersionFromFileName('V1__initial_schema.sql');
 * ```
 */
export const extractVersionFromFileName = (fileName: string): number | null => {
    const versionInfo = extractVersionInfo(fileName);
    return versionInfo ? versionInfo.version : null;
};

/**
 * Validates that a filename follows the migration naming convention.
 * 
 * @param fileName - Name of the file to validate
 * @returns True if the filename is valid, false otherwise
 * 
 * @example
 * ```typescript
 * // Returns true
 * const isValid = isValidMigrationFileName('V1__initial_schema.sql');
 * 
 * // Returns false
 * const isValid = isValidMigrationFileName('migration1.sql');
 * ```
 */
export const isValidMigrationFileName = (fileName: string): boolean => {
    return fileName.match(/^V\d+__.+\.sql$/) !== null;
};

/**
 * Gets the next version number based on existing migration files.
 * 
 * @param existingVersions - Array of existing version numbers
 * @returns Next version number
 * 
 * @example
 * ```typescript
 * // Returns 3
 * const nextVersion = getNextVersionNumber([1, 2]);
 * ```
 */
export const getNextVersionNumber = (existingVersions: number[]): number => {
    if (existingVersions.length === 0) {
        return 1;
    }
    
    const maxVersion = Math.max(...existingVersions);
    return maxVersion + 1;
};

/**
 * Formats a version number and description into a valid migration filename.
 * 
 * @param version - Version number
 * @param description - Human-readable description
 * @returns Formatted migration filename
 * 
 * @example
 * ```typescript
 * // Returns 'V3__add_user_table.sql'
 * const fileName = formatMigrationFileName(3, 'Add User Table');
 * ```
 */
export const formatMigrationFileName = (version: number, description: string): string => {
    const formattedDescription = description
        .toLowerCase()
        .replace(/\s+/g, '_')    // Replace spaces with underscores
        .replace(/[^a-z0-9_]/g, ''); // Remove special characters
        
    return `V${version}__${formattedDescription}.sql`;
};

/**
 * Compares two version numbers for sorting.
 * 
 * @param a - First version number
 * @param b - Second version number
 * @returns Comparison result (-1, 0, or 1)
 * 
 * @example
 * ```typescript
 * // Sort an array of version numbers
 * const sortedVersions = versions.sort(compareVersions);
 * ```
 */
export const compareVersions = (a: number, b: number): number => {
    return a - b;
};

/**
 * Validates that version numbers are sequential without gaps.
 * 
 * @param versions - Array of version numbers
 * @returns Object with validity status and error message if invalid
 * 
 * @example
 * ```typescript
 * // Returns { valid: true }
 * const result = validateSequentialVersions([1, 2, 3]);
 * 
 * // Returns { valid: false, error: 'Missing version 2' }
 * const result = validateSequentialVersions([1, 3]);
 * ```
 */
export const validateSequentialVersions = (versions: number[]): { valid: boolean; error?: string } => {
    // Sort versions
    const sortedVersions = [...versions].sort(compareVersions);
    
    // Check for sequential versions starting from 1
    for (let i = 0; i < sortedVersions.length; i++) {
        const expectedVersion = i + 1;
        if (sortedVersions[i] !== expectedVersion) {
            return {
                valid: false,
                error: `Missing version ${expectedVersion}`
            };
        }
    }
    
    return { valid: true };
};