import type { CredentialProvider, ResolveContext } from '../types';
import { lookupEnv } from '../../config/env-file';
import type { CredentialRef } from '../../config/types';
import { SherlockError } from '../../errors';

/**
 * Environment variable credential provider
 * Resolves credentials from environment variables
 */
export class EnvProvider implements CredentialProvider {
    name = 'env';
    priority = 100;

    canResolve(ref: CredentialRef): boolean {
        return typeof ref === 'object' && '$env' in ref;
    }

    async resolve(ref: CredentialRef, context?: ResolveContext): Promise<string> {
        if (typeof ref !== 'object' || !('$env' in ref)) {
            throw new Error('EnvProvider can only resolve $env references');
        }

        const envVar = ref.$env;
        const found = lookupEnv(envVar, context?.projectEnv);

        if (found === undefined) {
            const project = context?.projectEnv?.file;
            throw new SherlockError(
                'CREDENTIAL_MISSING',
                project
                    ? `${envVar} is not set in ${project} or in the environment.`
                    : `Environment variable not set: ${envVar}`,
                {
                    fix: project
                        ? `Add ${envVar} to ${project}, or set it in the environment.`
                        : `Set ${envVar} in the environment, or in the .env file next to the config.`,
                    details: { source: 'env' },
                }
            );
        }

        return found.value;
    }
}

/**
 * The environment variable sherlock reads a connection's setting from when the
 * config leaves it out: SHERLOCK_<CONNECTION>_<FIELD>, with hyphens in the
 * connection name as underscores. Every message that names one uses this, so
 * it names the variable sherlock actually reads.
 */
export function connectionEnvVarName(connectionName: string, field: string): string {
    return `SHERLOCK_${connectionName.toUpperCase().replace(/-/g, '_')}_${field.toUpperCase()}`;
}

/**
 * Auto-detect environment variables for a connection
 * Convention: SHERLOCK_<CONNECTION>_<FIELD>
 */
export function getEnvVarForConnection(
    connectionName: string,
    field: string,
    env: Record<string, string | undefined> = process.env
): string | undefined {
    return env[connectionEnvVarName(connectionName, field)];
}
