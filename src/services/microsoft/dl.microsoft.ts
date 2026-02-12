import { getGraphClient } from '@services/microsoft/graph.client';
import { logger } from '@utils/log.util';
import type { RawDLData, RawDLMember } from '@app-types/index';

/**
 * Fetch all mail-enabled distribution lists from Microsoft Graph.
 * Filters for groups where mailEnabled=true and securityEnabled=false.
 *
 * @returns Array of distribution list data with members populated
 */
export async function fetchDistributionLists(): Promise<RawDLData[]> {
    const client = getGraphClient();
    const dls: RawDLData[] = [];

    try {
        let response = await client
            .api('/groups')
            .filter('mailEnabled eq true and securityEnabled eq false')
            .select('id,displayName,mail,description')
            .get();

        while (response) {
            if (response.value) {
                for (const group of response.value) {
                    try {
                        const members = await fetchDLMembers(group.id);
                        dls.push({
                            id: group.id,
                            displayName: group.displayName || '',
                            mail: group.mail || '',
                            description: group.description || null,
                            members,
                        });
                    } catch (err) {
                        logger.warn(
                            { groupId: group.id, error: err },
                            'Failed to fetch members for distribution list',
                        );
                        dls.push({
                            id: group.id,
                            displayName: group.displayName || '',
                            mail: group.mail || '',
                            description: group.description || null,
                            members: [],
                        });
                    }
                }
            }

            // Handle pagination
            if (response['@odata.nextLink']) {
                response = await client.api(response['@odata.nextLink']).get();
            } else {
                break;
            }
        }

        logger.info(
            { count: dls.length },
            'Fetched distribution lists from Graph API',
        );
        return dls;
    } catch (error) {
        logger.error({ error }, 'Failed to fetch distribution lists');
        throw error;
    }
}

/**
 * Fetch transitive members of a distribution list.
 * Uses transitiveMembers to resolve nested group memberships.
 *
 * @param groupId - The group/DL ID
 * @returns Array of DL members
 */
export async function fetchDLMembers(
    groupId: string,
): Promise<RawDLMember[]> {
    const client = getGraphClient();
    const members: RawDLMember[] = [];

    try {
        let response = await client
            .api(`/groups/${groupId}/transitiveMembers`)
            .select('id,displayName,mail,jobTitle')
            .get();

        while (response) {
            if (response.value) {
                for (const member of response.value) {
                    // Only include user-type members
                    if (member['@odata.type'] === '#microsoft.graph.user') {
                        members.push({
                            id: member.id,
                            displayName: member.displayName || '',
                            mail: member.mail || '',
                            jobTitle: member.jobTitle || undefined,
                        });
                    }
                }
            }

            // Handle pagination
            if (response['@odata.nextLink']) {
                response = await client.api(response['@odata.nextLink']).get();
            } else {
                break;
            }
        }

        return members;
    } catch (error) {
        logger.error({ groupId, error }, 'Failed to fetch DL members');
        throw error;
    }
}

/**
 * Fetch detailed information about a specific distribution list.
 *
 * @param groupId - The group/DL ID
 * @returns The DL details including name, email, and description
 */
export async function fetchDLDetails(
    groupId: string,
): Promise<{ id: string; displayName: string; mail: string; description: string | null }> {
    const client = getGraphClient();

    try {
        const response = await client
            .api(`/groups/${groupId}`)
            .select('id,displayName,mail,description')
            .get();

        return {
            id: response.id,
            displayName: response.displayName || '',
            mail: response.mail || '',
            description: response.description || null,
        };
    } catch (error) {
        logger.error({ groupId, error }, 'Failed to fetch DL details');
        throw error;
    }
}
