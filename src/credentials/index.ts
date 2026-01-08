import type { CredentialProvider } from './types';
import type { CredentialRef } from '../config/types';
import { EnvProvider } from './providers/env';
import { LiteralProvider } from './providers/literal';

/**
 * Credential resolver that orchestrates multiple providers
 */
export class CredentialResolver {
    private providers: CredentialProvider[];

    constructor() {
        // Initialize built-in providers sorted by priority (highest first)
        this.providers = [
            new EnvProvider(),
            new LiteralProvider(),
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
    async resolve(ref: CredentialRef): Promise<string> {
        for (const provider of this.providers) {
            if (provider.canResolve(ref)) {
                return provider.resolve(ref);
            }
        }

        throw new Error(`No credential provider found for: ${JSON.stringify(ref)}`);
    }

    /**
     * Resolve a value that might be a credential reference or a literal string
     */
    async resolveValue(value: string | CredentialRef | undefined): Promise<string | undefined> {
        if (value === undefined) {
            return undefined;
        }

        return this.resolve(value);
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
