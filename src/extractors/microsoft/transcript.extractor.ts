import { get_graph_client } from '@connection/microsoft/graph.client';
import { mapper$transcript } from '@mappers/microsoft/transcript.mapper';
import { logger } from '@utils/log.util';
import type { Extractor, ExtractOptions } from '@extractors/extractor.interface';
import type { RawTranscript, RawMeetingDetails } from '@app-types/microsoft.types';

/** Raw transcript with its VTT content and meeting details bundled */
export interface TranscriptExtractResult {
    transcript: RawTranscript;
    vttContent: string;
    meeting: RawMeetingDetails;
}

/**
 * Microsoft Graph transcript extractor.
 * Fetches call records, their transcripts (VTT), and meeting metadata.
 */
export class TranscriptExtractor implements Extractor<TranscriptExtractResult> {
    /**
     * Extract transcripts since a given date.
     * Returns raw VTT content + meeting details for each transcript found.
     */
    async extract(options?: ExtractOptions): Promise<TranscriptExtractResult[]> {
        const results: TranscriptExtractResult[] = [];
        const since = options?.since;

        try {
            const transcripts = await this.fetch_transcripts(since);
            logger.info({ count: transcripts.length }, 'Found transcripts to process');

            for (const transcript of transcripts) {
                try {
                    const vttContent = await this.fetch_content(
                        transcript.meetingOrganizerId,
                        transcript.meetingId,
                        transcript.id,
                    );

                    const meeting = await this.fetch_meeting_details(
                        transcript.meetingOrganizerId,
                        transcript.meetingId,
                    );

                    results.push({ transcript, vttContent, meeting });
                } catch (err) {
                    logger.warn(
                        { transcriptId: transcript.id, error: err },
                        'Failed to fetch transcript content/details',
                    );
                }
            }

            return results;
        } catch (error) {
            logger.error({ error }, 'Failed to extract transcripts');
            throw error;
        }
    }

    /** Fetch raw transcript records from Graph API */
    private async fetch_transcripts(since?: Date): Promise<RawTranscript[]> {
        const client = get_graph_client();
        const transcripts: RawTranscript[] = [];

        let url = '/communications/callRecords';
        if (since) {
            const filter = `startDateTime ge ${since.toISOString()}`;
            url += `?$filter=${encodeURIComponent(filter)}&$orderby=startDateTime desc`;
        }

        let response = await client.api(url).get();

        while (response) {
            if (response.value) {
                for (const record of response.value) {
                    try {
                        const transcriptResponse = await client
                            .api(`/communications/callRecords/${record.id}/transcripts_v2`)
                            .get();

                        if (transcriptResponse.value) {
                            for (const item of transcriptResponse.value) {
                                transcripts.push({
                                    id: item.id,
                                    meetingId: record.id,
                                    meetingOrganizerId: record.organizer?.user?.id || '',
                                    createdDateTime: item.createdDateTime,
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

            if (response['@odata.nextLink']) {
                response = await client.api(response['@odata.nextLink']).get();
            } else {
                break;
            }
        }

        return transcripts;
    }

    /** Fetch VTT content for a specific transcript */
    private async fetch_content(
        userId: string,
        meetingId: string,
        transcriptId: string,
    ): Promise<string> {
        const client = get_graph_client();
        const response = await client
            .api(`/users/${userId}/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content`)
            .header('Accept', 'text/vtt')
            .get();

        return typeof response === 'string' ? response : response.toString();
    }

    /** Fetch meeting details and map via transcriptMapper */
    private async fetch_meeting_details(
        userId: string,
        meetingId: string,
    ): Promise<RawMeetingDetails> {
        const client = get_graph_client();
        const response = await client
            .api(`/users/${userId}/onlineMeetings/${meetingId}`)
            .select('id,subject,startDateTime,endDateTime,attendees')
            .get();

        return mapper$transcript.from_graph_response(response);
    }
}
