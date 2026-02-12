import type { KnowledgeDocument, RawDLData } from '@app-types/index';

/**
 * Parse a raw distribution list into a KnowledgeDocument.
 * Each DL becomes a single document (they're small enough).
 *
 * Content format:
 * "Distribution List: {name} ({email}). Description: {description}. Members: {member1} ({role}), ..."
 *
 * @param dl - The raw DL data from Graph API
 * @returns A single KnowledgeDocument representing the distribution list
 */
export function parseDistributionList(dl: RawDLData): KnowledgeDocument {
    const memberList = dl.members
        .map((m) => {
            const role = m.jobTitle ? ` (${m.jobTitle})` : '';
            return `${m.displayName}${role}`;
        })
        .join(', ');

    const description = dl.description || 'No description';

    const content = [
        `Distribution List: ${dl.displayName} (${dl.mail}).`,
        `Description: ${description}.`,
        `Members (${dl.members.length}): ${memberList || 'No members'}.`,
    ].join(' ');

    return {
        content,
        metadata: {
            source_type: 'distribution_list' as const,
            dl_name: dl.displayName,
            dl_email: dl.mail,
            dl_id: dl.id,
            member_count: dl.members.length,
        },
    };
}
