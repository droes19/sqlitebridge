import { join, resolve } from "node:path";
import { Config, fileConfig } from "../config";
import { checkFileExists, readFile } from "./file-utils";

const defaultConfig: Config = {
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

export function loadConfig(): Config {
    const configFilePath = join(fileConfig.path, fileConfig.name)
    const absolutePath = resolve(configFilePath);
    if (checkFileExists(absolutePath)) {
        const fileContent = readFile(absolutePath)
        if (fileContent) {
            const fileConfig = JSON.parse(fileContent);
            return {
                ...defaultConfig,
                ...fileConfig,
                generatedPath: {
                    ...defaultConfig.generatedPath,
                    ...fileConfig.generatedPath
                }
            };
        }
    }
    console.warn('Could not load config file, using default config.');
    return defaultConfig;
}
