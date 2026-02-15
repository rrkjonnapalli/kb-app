import type { RawMeetingDetails } from '@app-types/microsoft.types';
import type { TranscriptMetadata } from '@app-types/document.types';

/**
 * Map raw Graph API meeting details to our internal TranscriptMetadata shape.
 * Handles the camelCase → snake_case boundary.
 */
export const mapper$transcript = {
    /**
     * Transform raw meeting details into partial TranscriptMetadata.
     * Returns everything except source_type, speakers, timestamps (added by parser).
     */
    to_metadata(raw: RawMeetingDetails): Omit<TranscriptMetadata, 'source_type' | 'speakers' | 'timestamp_start' | 'timestamp_end'> {
        return {
            meeting_subject: raw.subject || 'Untitled Meeting',
            meeting_date: raw.startDateTime,
            meeting_id: raw.id,
            attendees: (raw.attendees || []).map((a) => a.emailAddress.name),
        };
    },

    /**
     * Transform raw Graph API response into RawMeetingDetails.
     * Normalizes optional/missing fields.
     */
    from_graph_response(response: Record<string, unknown>): RawMeetingDetails {
        return {
            id: response.id as string,
            subject: (response.subject as string) || 'Untitled Meeting',
            startDateTime: response.startDateTime as string,
            endDateTime: response.endDateTime as string,
            attendees: ((response.attendees || []) as Array<{
                emailAddress?: { name?: string; address?: string };
            }>).map((a) => ({
                emailAddress: {
                    name: a.emailAddress?.name || '',
                    address: a.emailAddress?.address || '',
                },
            })),
        };
    },
};
