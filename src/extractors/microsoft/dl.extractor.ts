import { get_graph_client } from '@connection/microsoft/graph.client';
import { mapper$dl } from '@mappers/microsoft/dl.mapper';
import { logger } from '@utils/log.util';
import type { Extractor } from '@extractors/extractor.interface';
import type { RawDLData, RawDLMember } from '@app-types/microsoft.types';

/**
 * Microsoft Graph distribution list extractor.
 * Fetches mail-enabled groups and their transitive members.
 */
export class DLExtractor implements Extractor<RawDLData> {
    /** Extract all distribution lists with their members */
    async extract(): Promise<RawDLData[]> {
        const client = get_graph_client();
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
                        const _dl = mapper$dl.from_graph_response(group);
                        let members: RawDLMember[] = [];

                        try {
                            members = await this.fetch_members(group.id);
                        } catch (err) {
                            logger.warn(
                                { groupId: group.id, error: err },
                                'Failed to fetch members for distribution list',
                            );
                        }

                        dls.push({ ..._dl, members });
                    }
                }

                if (response['@odata.nextLink']) {
                    response = await client.api(response['@odata.nextLink']).get();
                } else {
                    break;
                }
            }

            logger.info({ count: dls.length }, 'Fetched distribution lists from Graph API');
            return dls;
        } catch (error) {
            logger.error({ error }, 'Failed to extract distribution lists');
            throw error;
        }
    }

    /** Fetch transitive members of a group */
    private async fetch_members(groupId: string): Promise<RawDLMember[]> {
        const client = get_graph_client();
        const members: RawDLMember[] = [];

        let response = await client
            .api(`/groups/${groupId}/transitiveMembers`)
            .select('id,displayName,mail,jobTitle')
            .get();

        while (response) {
            if (response.value) {
                for (const member of response.value) {
                    if (member['@odata.type'] === '#microsoft.graph.user') {
                        members.push(mapper$dl.member_from_graph_response(member));
                    }
                }
            }

            if (response['@odata.nextLink']) {
                response = await client.api(response['@odata.nextLink']).get();
            } else {
                break;
            }
        }

        return members;
    }
}
