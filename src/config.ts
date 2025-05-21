import * as utils from "./utils"

export interface FileConfig {
    path: string,
    name: string,
}

const fileConfig: FileConfig = {
    path: '',
    name: "sqlitebridge.config.json"
}

export interface OtherConfig {
    migrationPattern: RegExp
}

const otherConfig: OtherConfig = {
    migrationPattern: /^V\d+__.+\.sql$/
}

export { fileConfig, otherConfig }

export interface Config {
    migrationsPath: string,
    queriesPath: string,
    generatedPath: {
        migrations: string,
        models: string,
        dexie: string,
        services: string,
    },
    withDexie: boolean
}

const config: Config = utils.loadConfig()
export default config;
