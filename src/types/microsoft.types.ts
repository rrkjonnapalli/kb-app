/** Raw transcript record from Graph API */
export interface RawTranscript {
    id: string;
    meetingId: string;
    meetingOrganizerId: string;
    createdDateTime: string;
}

/** Raw meeting details from Graph API */
export interface RawMeetingDetails {
    id: string;
    subject: string;
    startDateTime: string;
    endDateTime: string;
    attendees: Array<{
        emailAddress: { name: string; address: string };
    }>;
}

/** Raw distribution list from Graph API */
export interface RawDLData {
    id: string;
    displayName: string;
    mail: string;
    description: string | null;
    members: RawDLMember[];
}

/** A member of a distribution list */
export interface RawDLMember {
    id: string;
    displayName: string;
    mail: string;
    jobTitle?: string;
}
