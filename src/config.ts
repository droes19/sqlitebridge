/**
 * Configuration module for SQLiteBridge
 * 
 * This module handles loading and providing configuration settings for the SQLiteBridge tools.
 * It attempts to load a configuration file, and if none exists, provides sensible defaults.
 * 
 * @packageDocumentation
 */

import { join, resolve } from "node:path";
import { checkFileExists, readFile } from "./utils/file-utils";

/**
 * File configuration interface
 */
export interface FileConfig {
    /** Path to the configuration file directory */
    path: string;
    /** Name of the configuration file */
    name: string;
}

/**
 * Default configuration file settings
 */
export const fileConfig: FileConfig = {
    path: '',
    name: "sqlitebridge.config.json"
};

/**
 * Additional configuration options interface
 */
export interface OtherConfig {
    /** Regular expression pattern to match migration files */
    migrationPattern: RegExp;
}

/**
 * Additional configuration options
 */
export const otherConfig: OtherConfig = {
    migrationPattern: /^V\d+__.+\.sql$/
};

/**
 * Main configuration interface
 */
export interface Config {
    /** Path to the directory containing migration SQL files */
    migrationsPath: string;
    /** Path to the directory containing query SQL files */
    queriesPath: string;
    /** Paths for generated output files */
    generatedPath: {
        /** Path for generated migrations file */
        migrations: string;
        /** Path for generated model files */
        models: string;
        /** Path for generated Dexie schema file */
        dexie: string;
        /** Path for generated service files */
        services: string;
    };
    /** Whether to generate Dexie.js schema */
    withDexie: boolean;
}

/**
 * Default configuration values
 */
export const defaultConfig: Config = {
    migrationsPath: './migrations',
    queriesPath: './queries',
    generatedPath: {
        migrations: './src/app/core/database/migrations.ts',
        models: './src/app/core/database/models',
        dexie: './src/app/core/database/dexie-schema.ts',
        services: './src/app/core/database/services',
    },
    withDexie: false
};

/**
 * Loads configuration from file or uses defaults
 * 
 * @returns Config object with settings for SQLiteBridge
 */
export function loadConfig(): Config {
    const configFilePath = join(fileConfig.path, fileConfig.name);
    const absolutePath = resolve(configFilePath);
    
    // Try to load config file
    if (checkFileExists(absolutePath)) {
        try {
            const fileContent = readFile(absolutePath);
            if (fileContent) {
                // Parse the config file
                const fileConfig = JSON.parse(fileContent);
                
                // Merge with default config, keeping defaults for any missing properties
                return {
                    ...defaultConfig,
                    ...fileConfig,
                    generatedPath: {
                        ...defaultConfig.generatedPath,
                        ...fileConfig.generatedPath
                    }
                };
            }
        } catch (error) {
            console.error('Error parsing config file:', error);
            console.warn('Using default configuration instead.');
        }
    } else {
        console.warn(`Config file '${absolutePath}' not found, using default configuration.`);
        console.info(`Create a '${fileConfig.name}' file to customize settings.`);
    }
    
    return defaultConfig;
}

/**
 * Export the loaded configuration as the default export
 */
const config: Config = loadConfig();
export default config;