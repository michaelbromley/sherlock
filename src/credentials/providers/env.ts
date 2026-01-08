import type { CredentialProvider } from '../types';
import type { CredentialRef } from '../../config/types';

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

    async resolve(ref: CredentialRef): Promise<string> {
        if (typeof ref !== 'object' || !('$env' in ref)) {
            throw new Error('EnvProvider can only resolve $env references');
        }

        const envVar = ref.$env;
        const value = process.env[envVar];

        if (value === undefined) {
            throw new Error(`Environment variable not set: ${envVar}`);
        }

        return value;
    }
}

/**
 * Auto-detect environment variables for a connection
 * Convention: SHERLOCK_<CONNECTION>_<FIELD>
 */
export function getEnvVarForConnection(connectionName: string, field: string): string | undefined {
    const envVarName = `SHERLOCK_${connectionName.toUpperCase().replace(/-/g, '_')}_${field.toUpperCase()}`;
    return process.env[envVarName];
}
