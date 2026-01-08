import type { CredentialRef } from '../config/types';

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
    resolve(ref: CredentialRef): Promise<string>;
}
