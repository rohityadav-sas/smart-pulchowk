export interface registerStudentForEventInput {
    authStudentId: string,
    eventId: number
}

export interface CreateEventInput {
    title: string;
    description?: string;
    eventType: string;
    venue?: string;
    maxParticipants?: number;
    registrationDeadline: Date;
    eventStartTime: Date;
    eventEndTime: Date;
    bannerUrl?: string;

}

export interface createClubInput {
    name: string;
    description?: string;
    email: string;
    logoUrl?: string;
}

export interface CreateClubProfileInput {
    aboutClub?: string;
    mission?: string;
    vision?: string;
    achievements?: string;
    benefits?: string;
    contactPhone?: string;
    websiteUrl?: string;
    socialLinks?: {
        facebook?: string;
        instagram?: string;
        twitter?: string;
        linkedin?: string;
        youtube?: string;
        discord?: string;
        github?: string;
        tiktok?: string;
    };
    establishedYear?: number;
}

export interface CreateEventDetailsInput {
    fullDescription?: string;
    objectives?: string;
    targetAudience?: string;
    prerequisites?: string;
    rules?: string;
    judgingCriteria?: string;
}

export interface CreateEventCategoryInput {
    name: string;
    description?: string;
    objectives?: string;
    targetAudience?: string;
    prerequisites?: string;
    rules?: string;
    judgingCriteria?: string;
    bannerUrl?: string;
}