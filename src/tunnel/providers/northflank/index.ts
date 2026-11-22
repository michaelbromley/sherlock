/**
 * The Northflank tunnel provider: forwards an addon through Northflank's API,
 * logged in as a named context from the Northflank CLI's config.
 *
 *   "tunnel": {
 *     "provider": "northflank",
 *     "context": "my-team",
 *     "project": "my-project",
 *     "addon": "postgresql",
 *     "endpoint": "read"
 *   }
 */

import { DB_TYPES, type DbType } from '../../../db-types';
import type {
    DiagnosticCheck,
    OpenTunnel,
    TunnelProvider,
    TunnelSetup,
    TunnelSetupChoices,
} from '../types';
import {
    createNorthflankClient,
    NorthflankApiError,
    northflankLister,
    type NorthflankClientFactory,
    type NorthflankLister,
} from './client';
import {
    checkNorthflankHost,
    northflankCommandShorthand,
    recognizeNorthflankCommand,
} from './command';
import {
    describeNorthflankTarget,
    NORTHFLANK_PROVIDER_ID,
    resolveNorthflankConfig,
    type NorthflankTunnelConfig,
} from './config';
import {
    listNorthflankContextNames,
    loadNorthflankContext,
    northflankConfigDir,
    redactToken,
    type NorthflankContext,
} from './context';
import { selectEndpoint } from './endpoint';

/** What the provider reaches outside itself, replaceable in tests */
export interface NorthflankProviderDeps {
    createClient: NorthflankClientFactory;
    loadContext: (name: string, configDir?: string) => NorthflankContext;
    /** For the setup wizard's choices */
    listContexts?: (configDir?: string) => string[];
    lister?: NorthflankLister;
}

/** Addon types, as Northflank names them, that sherlock can query */
const ADDON_DB_TYPES: Record<string, DbType> = {
    postgresql: DB_TYPES.POSTGRES,
    postgres: DB_TYPES.POSTGRES,
    mysql: DB_TYPES.MYSQL,
    mariadb: DB_TYPES.MYSQL,
    redis: DB_TYPES.REDIS,
};

/** The team to address: the one configured, or the context's for an org token */
function teamFor(config: NorthflankTunnelConfig, context: NorthflankContext): string | undefined {
    return config.team ?? (context.tokenScope === 'org' ? context.team : undefined);
}

/** Turn an API failure into what the user should do about it */
function explainApiError(
    error: unknown,
    what: string,
    config: NorthflankTunnelConfig,
    context: NorthflankContext
): { detail: string; fix: string } {
    const message = redactToken(error instanceof Error ? error.message : String(error), context.token);

    if (error instanceof NorthflankApiError && error.status === 401) {
        return {
            detail: `Northflank rejected the token of context "${config.context}".`,
            fix: `Log in again: northflank login --name ${config.context}`,
        };
    }
    if (error instanceof NorthflankApiError && (error.status === 403 || error.status === 404)) {
        return {
            detail: `Context "${config.context}" cannot see ${what}.`,
            fix:
                `Check the id is right, and that "${config.context}" is the login for the team that ` +
                `owns it. A different team needs a different "context".`,
        };
    }
    return { detail: `Could not reach ${what}: ${message}`, fix: 'Check the network and try again.' };
}

/** Why a listing call failed, in a line fit for the wizard */
function listingFailure(error: unknown, what: string, contextName: string, token: string): string {
    if (error instanceof NorthflankApiError && error.status === 401) {
        return `Northflank rejected the login of context "${contextName}", so its ${what} cannot be listed. Log in again with: northflank login --name ${contextName}`;
    }
    const message = redactToken(error instanceof Error ? error.message : String(error), token);
    return `Could not list the ${what} of context "${contextName}": ${message}`;
}

/** The wizard's questions, which list contexts, projects and addons to pick from */
function northflankSetup(deps: Required<Pick<NorthflankProviderDeps, 'loadContext'>> & {
    listContexts: NonNullable<NorthflankProviderDeps['listContexts']>;
    lister: NorthflankLister;
}): TunnelSetup {
    const configDirOf = (answers: Readonly<Record<string, string>>) => answers.configDir || undefined;

    /** The login named in the answers, or a reason it cannot be used */
    const loginFor = (answers: Readonly<Record<string, string>>): NorthflankContext | string => {
        try {
            return deps.loadContext(answers.context, configDirOf(answers));
        } catch (error) {
            return error instanceof Error ? error.message : String(error);
        }
    };

    return {
        label: 'Northflank addon',
        hint: 'through the Northflank API, as a login from the Northflank CLI',
        intro:
            'Sherlock forwards the addon itself, logged in as a context from the Northflank CLI\n' +
            'config. It never changes which context the CLI uses, and needs no root.',
        fields: [
            {
                key: 'configDir',
                message: 'Northflank CLI config directory (leave empty for the default)',
                optional: true,
                placeholder: northflankConfigDir(undefined),
            },
            {
                key: 'context',
                message: 'Which Northflank login (context)?',
                async choices(answers): Promise<TunnelSetupChoices> {
                    try {
                        const names = deps.listContexts(configDirOf(answers));
                        return names.length > 0
                            ? { options: names.map((name) => ({ value: name, label: name })) }
                            : { unavailable: 'The Northflank CLI config has no contexts. Log in with "northflank login" first.' };
                    } catch (error) {
                        return { unavailable: error instanceof Error ? error.message : String(error) };
                    }
                },
            },
            {
                key: 'project',
                message: 'Which project?',
                async choices(answers): Promise<TunnelSetupChoices> {
                    const login = loginFor(answers);
                    if (typeof login === 'string') return { unavailable: login };
                    try {
                        const projects = await deps.lister.listProjects(login, login.tokenScope === 'org' ? login.team : undefined);
                        return projects.length > 0
                            ? { options: projects.map((project) => ({ value: project.id, label: project.id, hint: project.name !== project.id ? project.name : undefined })) }
                            : { unavailable: `Context "${login.name}" can see no projects. A different team needs a different context.` };
                    } catch (error) {
                        return { unavailable: listingFailure(error, 'projects', login.name, login.token) };
                    }
                },
            },
            {
                key: 'addon',
                message: 'Which addon?',
                async choices(answers): Promise<TunnelSetupChoices> {
                    const login = loginFor(answers);
                    if (typeof login === 'string') return { unavailable: login };
                    try {
                        const addons = (await deps.lister.listAddons(login, answers.project, login.tokenScope === 'org' ? login.team : undefined))
                            .filter((addon) => addon.type === undefined || addon.type.toLowerCase() in ADDON_DB_TYPES);
                        return addons.length > 0
                            ? {
                                options: addons.map((addon) => ({
                                    value: addon.id,
                                    label: addon.id,
                                    hint: [addon.type, addon.status].filter(Boolean).join(', ') || undefined,
                                })),
                            }
                            : { unavailable: `Project "${answers.project}" has no database addons that sherlock can query.` };
                    } catch (error) {
                        return { unavailable: listingFailure(error, `addons in project "${answers.project}"`, login.name, login.token) };
                    }
                },
            },
            {
                key: 'endpoint',
                message: 'Which endpoint?',
                optional: true,
                async choices(): Promise<TunnelSetupChoices> {
                    return {
                        options: [
                            { value: '', label: 'Automatic', hint: 'the read replica if the addon has one, else the primary' },
                            { value: 'read', label: 'Read replica', hint: 'fails if the addon has none' },
                            { value: 'primary', label: 'Primary' },
                        ],
                    };
                },
            },
        ],
    };
}

export function createNorthflankProvider(
    deps: NorthflankProviderDeps = {
        createClient: createNorthflankClient,
        loadContext: loadNorthflankContext,
    }
): TunnelProvider<NorthflankTunnelConfig> {
    const setup = northflankSetup({
        loadContext: deps.loadContext,
        listContexts: deps.listContexts ?? listNorthflankContextNames,
        lister: deps.lister ?? northflankLister,
    });

    return {
        setup,

        id: NORTHFLANK_PROVIDER_ID,

        resolve: resolveNorthflankConfig,

        inspect(config) {
            return {
                target: {
                    provider: NORTHFLANK_PROVIDER_ID,
                    summary: describeNorthflankTarget(config),
                    details: {
                        context: config.context,
                        project: config.project,
                        addon: config.addon,
                        endpoint: config.endpoint ?? 'read replica if the addon has one',
                    },
                },
                checkHost: (host) => checkNorthflankHost(host, config.project, config.addon),
            };
        },

        async open(config, tunnel): Promise<OpenTunnel> {
            const context = deps.loadContext(config.context, config.configDir);
            const target = `${config.project}/${config.addon}`;
            tunnel.log(`forwarding northflank addon ${target} as context "${config.context}"`);

            const client = await deps.createClient(context, {
                project: config.project,
                addon: config.addon,
                team: teamFor(config, context),
            });

            try {
                const forwards = await client.forwardAddon();
                const { forward, role } = selectEndpoint(forwards, config.endpoint, config.port);

                let exitReason: string | null = null;
                client.onForwardClosed((closed) => {
                    if (closed.address === forward.address && closed.port === forward.port) {
                        exitReason = 'Northflank closed the tunnel';
                    }
                });

                tunnel.log(
                    `using the ${role} endpoint (${forward.hostnames.join(', ') || 'unnamed'}, ` +
                    `port ${forward.portRemote ?? '?'}) on ${forward.address}:${forward.port}`
                );

                return {
                    endpoint: { host: forward.address, port: forward.port },
                    description: `northflank ${target} (${role}) as context "${config.context}"`,
                    exitReason: () => exitReason,
                    close: () => client.stop(),
                };
            } catch (error) {
                await client.stop().catch(() => undefined);
                if (error instanceof NorthflankApiError) {
                    const { detail, fix } = explainApiError(error, `addon ${target}`, config, context);
                    throw new Error(`${detail} ${fix}`);
                }
                const message = error instanceof Error ? error.message : String(error);
                throw new Error(redactToken(message, context.token));
            }
        },

        async diagnose(config, connection): Promise<DiagnosticCheck[]> {
            const checks: DiagnosticCheck[] = [];
            const target = `${config.project}/${config.addon}`;

            let context: NorthflankContext;
            try {
                context = deps.loadContext(config.context, config.configDir);
                checks.push({
                    name: 'northflank context',
                    status: 'pass',
                    detail: `context "${config.context}" found in ${northflankConfigDir(config.configDir)}`,
                });
            } catch (error) {
                checks.push({
                    name: 'northflank context',
                    status: 'fail',
                    detail: error instanceof Error ? error.message : String(error),
                    fix: 'Set "context" to a context that exists, or "configDir" to the right CLI config directory.',
                });
                return checks;
            }

            const client = await deps.createClient(context, {
                project: config.project,
                addon: config.addon,
                team: teamFor(config, context),
            });

            try {
                try {
                    const project = await client.getProject();
                    checks.push({
                        name: 'northflank project',
                        status: 'pass',
                        detail: `context "${config.context}" can see project ${project.id}`,
                    });
                } catch (error) {
                    checks.push({
                        name: 'northflank project',
                        status: 'fail',
                        ...explainApiError(error, `project ${config.project}`, config, context),
                    });
                    return checks;
                }

                try {
                    const addon = await client.getAddon();
                    const expected = ADDON_DB_TYPES[addon.type.toLowerCase()];
                    if (expected && expected !== connection.dbType) {
                        checks.push({
                            name: 'northflank addon',
                            status: 'fail',
                            detail:
                                `addon ${target} is ${addon.type}, but connection ` +
                                `"${connection.connectionName}" is configured as ${connection.dbType}`,
                            fix: `Point the tunnel at the ${connection.dbType} addon, or change the connection's "type".`,
                        });
                    } else if (addon.status !== 'running') {
                        checks.push({
                            name: 'northflank addon',
                            status: 'fail',
                            detail: `addon ${target} is ${addon.status}, not running`,
                            fix: 'Wait for the addon to be running, or resume it in Northflank.',
                        });
                    } else {
                        const replicas = addon.replicas !== undefined ? `, ${addon.replicas} replica(s)` : '';
                        checks.push({
                            name: 'northflank addon',
                            status: 'pass',
                            detail: `addon ${target} is a running ${addon.type}${replicas}`,
                        });
                    }
                } catch (error) {
                    checks.push({
                        name: 'northflank addon',
                        status: 'fail',
                        ...explainApiError(error, `addon ${target}`, config, context),
                    });
                }
                return checks;
            } finally {
                await client.stop().catch(() => undefined);
            }
        },

        recognizeCommand: recognizeNorthflankCommand,

        shorthands: { northflank: northflankCommandShorthand },
    };
}

export const northflankProvider = createNorthflankProvider();
