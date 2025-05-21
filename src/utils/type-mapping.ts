/**
 * SQLite to TypeScript type mapping
 * @param sqlType The SQLite data type
 * @returns The corresponding TypeScript type
 */
export function sqliteToTypeScriptType(sqlType: string): string {
    // Convert to lowercase for case-insensitive matching
    const type = sqlType.toLowerCase().trim();

    // Handle common SQLite types
    if (type.includes('int') || type.includes('numeric') || type.includes('real') ||
        type.includes('decimal') || type.includes('double') || type.includes('float')) {
        return 'number';
    } else if (type.includes('char') || type.includes('text') || type.includes('clob') ||
        type.includes('varchar')) {
        return 'string';
    } else if (type.includes('blob')) {
        return 'Buffer';
    } else if (type.includes('boolean') || type.includes('bool')) {
        return 'boolean';
    } else if (type.includes('date') || type.includes('time')) {
        return 'string'; // Changed from Date to string as SQLite dates are actually strings
    } else {
        // Default to any for unknown types
        return 'any';
    }
};
