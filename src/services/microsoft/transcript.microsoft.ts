import { getGraphClient } from '@services/microsoft/graph.client';
import { logger } from '@utils/log.util';
import type { RawTranscript, RawMeetingDetails } from '@app-types/index';

/**
 * Fetch recent meeting transcripts from Microsoft Graph API.
 * Uses the /communications/callRecords endpoint with optional date filter.
 *
 * @param since - Optional date to filter transcripts created after this time
 * @returns Array of raw transcript records
 */
export async function fetchRecentTranscripts(
    since?: Date,
): Promise<RawTranscript[]> {
    const client = getGraphClient();
    const transcripts: RawTranscript[] = [];

    try {
        let url = '/communications/callRecords';
        if (since) {
            const filter = `startDateTime ge ${since.toISOString()}`;
            url += `?$filter=${encodeURIComponent(filter)}&$orderby=startDateTime desc`;
        }

        let response = await client.api(url).get();

        while (response) {
            if (response.value) {
                for (const record of response.value) {
                    // Fetch transcripts for each call record
                    try {
                        const transcriptResponse = await client
                            .api(`/communications/callRecords/${record.id}/transcripts_v2`)
                            .get();

                        if (transcriptResponse.value) {
                            for (const transcript of transcriptResponse.value) {
                                transcripts.push({
                                    id: transcript.id,
                                    meetingId: record.id,
                                    meetingOrganizerId: record.organizer?.user?.id || '',
                                    createdDateTime: transcript.createdDateTime,
                                });
                            }
                        }
                    } catch (err) {
                        logger.warn(
                            { callRecordId: record.id, error: err },
                            'Failed to fetch transcripts for call record',
                        );
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
            { count: transcripts.length },
            'Fetched transcripts from Graph API',
        );
        return transcripts;
    } catch (error) {
        logger.error({ error }, 'Failed to fetch recent transcripts');
        throw error;
    }
}

/**
 * Fetch the VTT content of a specific transcript.
 *
 * @param userId - The organizer's user ID
 * @param meetingId - The meeting/call record ID
 * @param transcriptId - The transcript ID
 * @returns The VTT content as a string
 */
export async function fetchTranscriptContent(
    userId: string,
    meetingId: string,
    transcriptId: string,
): Promise<string> {
    const client = getGraphClient();

    try {
        const response = await client
            .api(
                `/users/${userId}/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content`,
            )
            .header('Accept', 'text/vtt')
            .get();

        return typeof response === 'string' ? response : response.toString();
    } catch (error) {
        logger.error(
            { userId, meetingId, transcriptId, error },
            'Failed to fetch transcript content',
        );
        throw error;
    }
}

/**
 * Fetch meeting details for a specific meeting.
 *
 * @param userId - The organizer's user ID
 * @param meetingId - The meeting ID
 * @returns The meeting details including subject, time, and attendees
 */
export async function fetchMeetingDetails(
    userId: string,
    meetingId: string,
): Promise<RawMeetingDetails> {
    const client = getGraphClient();

    try {
        const response = await client
            .api(`/users/${userId}/onlineMeetings/${meetingId}`)
            .select('id,subject,startDateTime,endDateTime,attendees')
            .get();

        return {
            id: response.id,
            subject: response.subject || 'Untitled Meeting',
            startDateTime: response.startDateTime,
            endDateTime: response.endDateTime,
            attendees: (response.attendees || []).map(
                (a: { emailAddress?: { name?: string; address?: string } }) => ({
                    emailAddress: {
                        name: a.emailAddress?.name || '',
                        address: a.emailAddress?.address || '',
                    },
                }),
            ),
        };
    } catch (error) {
        logger.error(
            { userId, meetingId, error },
            'Failed to fetch meeting details',
        );
        throw error;
    }
}
