import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import { env } from '@config/env';
import { logger } from '@utils/log.util';

let graph_client: Client | null = null;

/**
 * Get or create the shared Microsoft Graph client singleton.
 * Authenticates using client credentials (app-only) via Azure Identity.
 * @returns The authenticated Microsoft Graph Client instance
 */
export function get_graph_client(): Client {
    if (!graph_client) {
        const credential = new ClientSecretCredential(
            env.AZURE_TENANT_ID,
            env.AZURE_CLIENT_ID,
            env.AZURE_CLIENT_SECRET,
        );

        const authProvider = new TokenCredentialAuthenticationProvider(credential, {
            scopes: ['https://graph.microsoft.com/.default'],
        });

        graph_client = Client.initWithMiddleware({
            authProvider,
        });

        logger.info('Microsoft Graph client initialized');
    }

    return graph_client;
}
