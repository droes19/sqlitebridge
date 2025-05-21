import * as fs from 'fs';
import * as path from 'path';

/**
 * Package information interface
 */
export interface PackageInfo {
    name: string;
    version: string;
    description: string;
    author?: string;
    license?: string;
    [key: string]: any;
}

/**
 * Reads and parses the package.json file from the project root
 * 
 * @returns Package information object with name, version, and description
 * 
 * @throws Error if package.json cannot be found or parsed
 * 
 * @example
 * ```typescript
 * const packageInfo = readPackageJson();
 * console.log(`Version: ${packageInfo.version}`);
 * ```
 */
export function readPackageJson(): PackageInfo {
    try {
        // Try to find package.json in the current directory or parent directories
        let currentDir = __dirname;
        let packagePath = '';
        
        // Try to find package.json by traversing up the directory tree
        while (currentDir !== path.parse(currentDir).root) {
            packagePath = path.join(currentDir, 'package.json');
            
            if (fs.existsSync(packagePath)) {
                break;
            }
            
            // Move up one directory
            currentDir = path.dirname(currentDir);
        }
        
        // If we couldn't find package.json in parent directories,
        // try the project root relative to the current file
        if (!fs.existsSync(packagePath)) {
            // Go up from __dirname to find project root (src/utils -> src -> root)
            packagePath = path.resolve(__dirname, '../../package.json');
        }
        
        // If we still can't find it, throw an error
        if (!fs.existsSync(packagePath)) {
            throw new Error('Could not find package.json in project directory');
        }
        
        // Read and parse package.json
        const packageData = fs.readFileSync(packagePath, 'utf8');
        const packageInfo: PackageInfo = JSON.parse(packageData);
        
        return {
            ...packageInfo,
            name: packageInfo.name || 'unknown',
            version: packageInfo.version || '0.0.0',
            description: packageInfo.description || ''
        };
    } catch (error) {
        console.error('Error reading package.json:', error);
        // Return a default object with fallback values
        return {
            name: 'sqlitebridge',
            version: '0.0.0',
            description: 'SQLiteBridge - SQLite database tools for Ionic/Capacitor'
        };
    }
}