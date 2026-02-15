import type { KnowledgeDocument } from '@app-types/document.types';
import type { RawDLData } from '@app-types/microsoft.types';
import type { Parser } from '@parsers/parser.interface';

/**
 * Distribution list parser — converts raw DL data into a single KnowledgeDocument.
 * Each DL becomes one document (they're small enough).
 */
export class DLParser implements Parser<RawDLData> {
    /** Parse a raw DL into a knowledge document */
    parse(dl: RawDLData): KnowledgeDocument[] {
        return [parse_distribution_list(dl)];
    }
}

/**
 * Parse a raw distribution list into a KnowledgeDocument.
 * Each DL becomes a single document.
 *
 * @param dl - The raw DL data from Graph API
 * @returns A single KnowledgeDocument representing the distribution list
 */
export function parse_distribution_list(dl: RawDLData): KnowledgeDocument {
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
