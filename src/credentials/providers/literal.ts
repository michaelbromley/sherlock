import type { CredentialProvider } from '../types';
import type { CredentialRef } from '../../config/types';

/**
 * Literal credential provider
 * Handles plain text values
 */
export class LiteralProvider implements CredentialProvider {
    name = 'literal';
    priority = 0; // Lowest priority - only used as fallback

    canResolve(ref: CredentialRef): boolean {
        return typeof ref === 'string';
    }

    async resolve(ref: CredentialRef): Promise<string> {
        if (typeof ref !== 'string') {
            throw new Error('LiteralProvider can only resolve string values');
        }
        // No warning here - we'll warn specifically for password fields in the config loader
        return ref;
    }
}
