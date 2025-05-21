#!/usr/bin/env node

import { Command } from "commander";
import config, { otherConfig } from "../config";
import { generateSqliteMigrationsFromDir, processModelFile, processModelDirectory, processServiceDirectory, processServiceFile, generateDexieMigrationFromDir } from "../generators";

const { migrationsPath, generatedPath, queriesPath, withDexie } = config
const { models, migrations, services, dexie } = generatedPath

const program = new Command();
program.command('version').action(() => {
    // todo read package.json
    console.log("version")
})

program.command('all')
    .option('--dexie', 'description', false)
    .action(async (options) => {
        console.log(options.dexie)
        let optDexie = options.dexie ? options.dexie : withDexie

        //only available for directory
        await processModelDirectory(migrationsPath, models, otherConfig.migrationPattern)
        await generateSqliteMigrationsFromDir(migrationsPath, migrations, otherConfig.migrationPattern);
        await processServiceDirectory(queriesPath, migrationsPath, services, optDexie, otherConfig.migrationPattern)
        if (optDexie) {
            await generateDexieMigrationFromDir(migrationsPath, dexie, otherConfig.migrationPattern)
        }
    });

program.command('model')
    .option('-f, --file <filepath>', 'description')
    .option('--output-dir <output-dir>', 'description')
    .action((options) => {
        let outputDir = options.outputDir ? options.outputDir : models
        if (options.file) {
            processModelFile(options.file, outputDir)
        } else {
            processModelDirectory(migrationsPath, outputDir, otherConfig.migrationPattern)
        }
    });

program.command('migration')
    //.options('-f, --file <filepath>', 'description')
    .option('--output-file <output-file>', 'description')
    .action((options) => {
        let outputFile = options.outputFile ? options.outputFile : migrations
        // i think generate from file is neccessary
        // cause it'll only generate one or specific version in ALL_MIGRATION
        // so will be commented for now
        //if (options.file) {
        //    let outputFile = options.outputFile ? options.outputFile : config.generatedPath.migrations
        //    generateSqliteMigrationsFromFile(options.file, outputFile)
        //} else {
        generateSqliteMigrationsFromDir(migrationsPath, outputFile, otherConfig.migrationPattern)
        //}
    });

program.command('service')
    .option('-f, --file <filepath>', 'description')
    .option('--output-dir <output-dir>', 'description')
    .action((options) => {
        let outputDir = options.outputDir ? options.outputDir : services
        if (options.file) {
            processServiceFile(options.file, migrationsPath, outputDir, withDexie, otherConfig.migrationPattern)
        } else {
            processServiceDirectory(queriesPath, migrationsPath, outputDir, withDexie, otherConfig.migrationPattern)
        }
    });

program.command('dexie')
    .option('--output-file <output-file>', 'description')
    .action((options) => {
        let outputFile = options.outputFile ? options.outputFile : dexie
        generateDexieMigrationFromDir(migrationsPath, outputFile, otherConfig.migrationPattern)
    });

program.parse();
