import type { CredentialRef } from '../config/types';
import type { ProjectEnv } from '../config/env-file';

/** What a credential is resolved for */
export interface ResolveContext {
    /** The `.env` of the connection's project directory, read before the environment */
    projectEnv?: ProjectEnv;
}

/**
 * Credential provider interface
 */
export interface CredentialProvider {
    name: string;
    priority: number;

    /**
     * Check if this provider can resolve the given credential reference
     */
    canResolve(ref: CredentialRef): boolean;

    /**
     * Resolve the credential to its actual value
     */
    resolve(ref: CredentialRef, context?: ResolveContext): Promise<string>;
}
