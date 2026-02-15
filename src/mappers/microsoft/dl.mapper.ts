import type { RawDLData, RawDLMember } from '@app-types/microsoft.types';

/**
 * Map raw Graph API distribution list data to our internal shapes.
 * Handles the camelCase → snake_case boundary.
 */
export const mapper$dl = {
    /**
     * Transform raw Graph API group response into RawDLData (without members).
     */
    from_graph_response(response: Record<string, unknown>): Omit<RawDLData, 'members'> {
        return {
            id: response.id as string,
            displayName: (response.displayName as string) || '',
            mail: (response.mail as string) || '',
            description: (response.description as string) || null,
        };
    },

    /**
     * Transform raw Graph API member response into RawDLMember.
     */
    member_from_graph_response(response: Record<string, unknown>): RawDLMember {
        return {
            id: response.id as string,
            displayName: (response.displayName as string) || '',
            mail: (response.mail as string) || '',
            jobTitle: (response.jobTitle as string) || undefined,
        };
    },
};
