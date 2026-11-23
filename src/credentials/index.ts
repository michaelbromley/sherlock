import { SherlockError } from '../errors';
import type { CredentialProvider, ResolveContext } from './types';
import type { CredentialRef } from '../config/types';
import { EnvProvider } from './providers/env';
import { LiteralProvider } from './providers/literal';
import { KeychainProvider } from './providers/keychain';

/**
 * Credential resolver that orchestrates multiple providers
 */
export class CredentialResolver {
    private providers: CredentialProvider[];

    constructor() {
        // Initialize built-in providers sorted by priority (highest first)
        this.providers = [
            new EnvProvider(),      // priority: 100
            new KeychainProvider(), // priority: 80
            new LiteralProvider(),  // priority: 0
        ].sort((a, b) => b.priority - a.priority);
    }

    /**
     * Add a custom credential provider
     */
    addProvider(provider: CredentialProvider): void {
        this.providers.push(provider);
        this.providers.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Resolve a credential reference to its actual value
     */
    async resolve(ref: CredentialRef, context?: ResolveContext): Promise<string> {
        for (const provider of this.providers) {
            if (provider.canResolve(ref)) {
                return provider.resolve(ref, context);
            }
        }

        throw new SherlockError('CONFIG_INVALID', `Not a credential reference: ${JSON.stringify(ref)}`, {
            fix: 'Give a string, { "$env": "VARIABLE" } or { "$keychain": "account" }.',
        });
    }

    /**
     * Resolve a value that might be a credential reference or a literal string
     */
    async resolveValue(value: string | CredentialRef | undefined, context?: ResolveContext): Promise<string | undefined> {
        if (value === undefined) {
            return undefined;
        }

        return this.resolve(value, context);
    }
}

// Singleton instance
let resolver: CredentialResolver | null = null;

export function getCredentialResolver(): CredentialResolver {
    if (!resolver) {
        resolver = new CredentialResolver();
    }
    return resolver;
}
