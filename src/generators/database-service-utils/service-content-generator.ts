/**
 * Service Content Generator
 * 
 * Main orchestrator for generating database service content based on framework
 */

import { FrameworkType } from '../../config';
import { generateHeader, generateImports } from './common-generators';
import { generateTypes } from './types-generator';
import { generateAngularService } from './angular-service-generator';
import { generateReactService } from './react-service-generator';

/**
 * Generates the complete database service content based on framework.
 * 
 * @param framework - Target framework
 * @param withDexie - Whether to include Dexie.js support
 * @returns Generated service content as string
 */
export function generateDatabaseServiceContent(framework: FrameworkType, withDexie: boolean): string {
	let output = generateHeader(framework);
	output += generateImports(framework, withDexie);
	output += generateTypes(framework);

	if (framework === 'react') {
		output += generateReactService(withDexie);
	} else {
		output += generateAngularService(withDexie);
	}

	return output;
}
