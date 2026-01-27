const API_EVENTS = '/api/events';
const API_CLUBS = '/api/clubs';
const API_BOOKS = '/api/books';

export interface Club {
    id: number;
    authClubId: string;
    name: string;
    description: string | null;
    logoUrl: string | null;
    email?: string;
    isActive?: boolean;
    createdAt?: string;
    upcomingEvents?: number;
    completedEvents?: number;
    totalParticipants?: number;
}

export interface ClubEvent {
    id: number;
    clubId: number;
    title: string;
    description: string | null;
    eventType: string;
    status: string;
    venue: string | null;
    maxParticipants: number | null;
    currentParticipants: number;
    registrationDeadline: string | null;
    eventStartTime: string;
    eventEndTime: string;
    bannerUrl: string | null;
    isRegistrationOpen: boolean;
    createdAt: string;
    club?: Club;
}

export interface ClubProfile {
    id: number;
    clubId: number;
    aboutClub: string | null;
    mission: string | null;
    vision: string | null;
    achievements: string | null;
    benefits: string | null;
    contactPhone: string | null;
    websiteUrl: string | null;
    socialLinks: Record<string, string> | null;
    establishedYear: number | null;
    totalEventHosted: number;
    updatedAt: string | null;
}

export interface ExtraEventDetail {
    id: number;
    eventId: number;
    fullDescription: string | null;
    objectives: string | null;
    targetAudience: string | null;
    prerequisites: string | null;
    rules: string | null;
    judgingCriteria: string | null;
    updatedAt: string | null;
}

export interface Registration {
    id: number;
    studentId: number;
    eventId: number;
    status: string;
    registeredAt: string;
    event?: ClubEvent & { club?: Club };
}

export interface EventCategory {
    id: number;
    clubId: number;
    name: string;
    description: string | null;
    objectives: string | null;
    targetAudience: string | null;
    prerequisites: string | null;
    rules: string | null;
    judgingCriteria: string | null;
    bannerUrl: string | null;
    createdAt: string;
    updatedAt: string;
    club?: {
        id: number;
        name: string;
        logoUrl: string | null;
    };
}

export async function getClubs(): Promise<{ success: boolean; existingClub?: Club[]; message?: string }> {
    const res = await fetch(`${API_EVENTS}/clubs`, {
        credentials: 'include',
    });
    const clone = res.clone();
    try {
        const json = await res.json();
        return json.data;
    } catch (e) {
        console.error("Failed to parse getClubs response", await clone.text());
        return { success: false, message: "Invalid server response" };
    }
}


export async function getClub(clubId: number): Promise<{ success: boolean; clubData?: Club; message?: string }> {
    const res = await fetch(`${API_EVENTS}/clubs/${clubId}`, {
        credentials: 'include',
    });
    const clone = res.clone();
    try {
        const json = await res.json();
        return json.data;
    } catch (e) {
        console.error("Failed to parse getClub response", await clone.text());
        return { success: false, message: "Invalid server response" };
    }
}


export async function getClubEvents(clubId: number): Promise<{ success: boolean; clubEvents?: ClubEvent[]; message?: string }> {
    const res = await fetch(`${API_EVENTS}/events/${clubId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
    });
    const clone = res.clone();
    try {
        const json = await res.json();
        return json.data;
    } catch (e) {
        console.error("Failed to parse getClubEvents response", await clone.text());
        return { success: false, message: "Invalid server response" };
    }
}


export async function getUpcomingEvents(): Promise<{ success: boolean; upcomingEvents?: ClubEvent[]; message?: string }> {
    try {
        const res = await fetch(`${API_EVENTS}/get-upcoming-events`, {
            credentials: 'include',
        });
        const json = await res.json();
        return json.data;
    } catch (error: any) {
        console.error("Error", error.message);
        return { success: false, message: "Invalid server response" };
    }
}


export async function getAllEvents(): Promise<{ success: boolean; allEvents?: ClubEvent[]; message?: string }> {
    try {
        const res = await fetch(`${API_EVENTS}/all-events`, {
            credentials: 'include',
        });
        const json = await res.json();
        return json.data;
    } catch (error: any) {
        console.error(error.message);
        return { success: false, message: "Invalid server response" };
    }
}


export async function createEvent(authId: string, clubId: number, eventData: {
    title: string;
    description: string;
    eventType: string;
    venue: string;
    maxParticipants: number;
    registrationDeadline: string;
    eventStartTime: string;
    eventEndTime: string;
    bannerUrl?: string;
}): Promise<{ success: boolean; event?: ClubEvent; message?: string }> {


    try {
        const payload = { authId, clubId, ...eventData };

        const bodyString = JSON.stringify(payload);

        const res = await fetch(`${API_EVENTS}/create-event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: bodyString,
        });

        console.log('Response status:', res.status);
        const json = await res.json();
        console.log('Response json:', json);

        return json.data;
    } catch (error: any) {
        console.error('Error:', error.message);
        throw error;
    }
}


export async function getClubAdmins(clubId: number): Promise<{ success: boolean; admins?: any[]; message?: string }> {
    try {
        const res = await fetch(`${API_EVENTS}/club/admins/${clubId}`, {
            credentials: 'include'
        });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function addClubAdmin(clubId: number, email: string, ownerId: string): Promise<{ success: boolean; message?: string }> {
    try {
        const res = await fetch(`${API_EVENTS}/club/add-admin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ clubId, email, ownerId })
        });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function removeClubAdmin(clubId: number, userId: string, ownerId: string): Promise<{ success: boolean; message?: string }> {
    try {
        const res = await fetch(`${API_EVENTS}/club/remove-admin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ clubId, userId, ownerId })
        });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}


export async function createClub(clubData: {
    name: string;
    description?: string;
    email: string;
    logoUrl?: string;
}): Promise<{ success: boolean; club?: Club; message?: string }> {
    try {
        const res = await fetch(`${API_EVENTS}/create-club`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(clubData),
        });
        const json = await res.json();
        return json;
    } catch (error) {
        console.error(error);
        return { success: false, message: "Internal server response" }
    }
}

export async function registerForEvent(authStudentId: string, eventId: number): Promise<{ success: boolean; message?: string }> {
    try {
        const res = await fetch(`${API_EVENTS}/register-event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ authStudentId, eventId }),
        });
        const json = await res.json();
        return json.data;
    } catch (error) {
        console.error(error);
        return { success: false, message: "Internal server response" };
    }
}


export async function cancelRegistration(authStudentId: string, eventId: number): Promise<{ success: boolean; message?: string }> {
    try {
        const res = await fetch(`${API_EVENTS}/cancel-registration`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ authStudentId, eventId }),
        });
        const json = await res.json();
        return json.data;
    } catch (error) {
        console.error(error);
        return { success: false, message: "Internal server response" };
    }
}


export async function getEnrollments(authStudentId: string): Promise<{ success: boolean; registrations?: any[]; message?: string }> {
    const res = await fetch(`${API_EVENTS}/enrollment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ authStudentId }),
    });
    const clone = res.clone();
    try {
        const json = await res.json();
        return json.data;
    } catch (e) {
        console.error("Failed to parse getEnrollments response", await clone.text());
        return { success: false, message: "Invalid server response" };
    }
}


export async function getRegisteredStudents(eventId: number): Promise<any> {
    try {
        const res = await fetch(`${API_EVENTS}/registered-student`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ eventId }),
        });
        const json = await res.json();
        return json.data;
    } catch (error) {
        return { success: false, message: "Invalid server response" };
    }
}

export async function createClubProfile(clubId: number, profileData: Partial<ClubProfile>): Promise<{ success: boolean; profile?: ClubProfile; message?: string }> {
    try {
        const res = await fetch(`${API_CLUBS}/club-profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ clubId, ...profileData }),
        });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function getClubProfile(clubId: number): Promise<{ success: boolean; profile: ClubProfile | null; message?: string }> {
    try {
        const res = await fetch(`${API_CLUBS}/club-profile/${clubId}`, {
            credentials: 'include',
        });
        const json = await res.json();
        return json;
    } catch (error: any) {
        return { success: false, profile: null, message: error.message };
    }
}

export async function updateClubProfile(clubId: number, profileData: Partial<ClubProfile>): Promise<{ success: boolean; profile?: ClubProfile; message?: string }> {
    try {
        const res = await fetch(`${API_CLUBS}/club-profile/${clubId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(profileData),
        });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function updateClubInfo(clubId: number, clubData: Partial<Club>): Promise<{ success: boolean; message?: string }> {
    try {
        const res = await fetch(`${API_EVENTS}/clubs/${clubId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(clubData),
        });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function uploadClubLogo(clubId: number, logo: File | string): Promise<{ success: boolean; data?: { url: string; publicId: string | null; source: string }; message?: string }> {
    try {
        let body: FormData | string;
        let headers: Record<string, string> = {};

        if (logo instanceof File) {
            const formData = new FormData();
            formData.append('logo', logo);
            body = formData;
        } else {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify({ imageUrl: logo });
        }

        const res = await fetch(`${API_CLUBS}/${clubId}/upload-logo`, {
            method: 'POST',
            headers,
            credentials: 'include',
            body
        });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function deleteClubLogo(clubId: number): Promise<{ success: boolean; message?: string }> {
    try {
        const res = await fetch(`${API_CLUBS}/${clubId}/upload-logo`, {
            method: 'DELETE',
            credentials: 'include'
        });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function createExtraEventDetails(eventId: number, detailsData: Partial<ExtraEventDetail>): Promise<{ success: boolean; details?: ExtraEventDetail; message?: string }> {
    try {
        const res = await fetch(`${API_CLUBS}/event-details/create-event-details`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ eventId, ...detailsData }),
        });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function getExtraEventDetails(eventId: number): Promise<{ success: boolean; details: ExtraEventDetail | null; message?: string }> {
    try {
        const res = await fetch(`${API_CLUBS}/event-details/${eventId}`, {
            credentials: 'include',
        });
        const json = await res.json();
        return json;
    } catch (error: any) {
        return { success: false, details: null, message: error.message };
    }
}

export async function updateExtraEventDetails(eventId: number, detailsData: Partial<ExtraEventDetail>): Promise<{ success: boolean; details?: ExtraEventDetail; message?: string }> {
    try {
        const res = await fetch(`${API_CLUBS}/event-details/update-eventdetail`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ eventId, ...detailsData }),
        });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function createEventCategory(clubId: number, data: Partial<EventCategory>): Promise<{ success: boolean; category?: EventCategory; message?: string }> {
    try {
        const res = await fetch(`${API_CLUBS}/event-categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ clubId, ...data }),
        });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function getEventCategories(clubId: number): Promise<{ success: boolean; categories: EventCategory[]; message?: string }> {
    try {
        const res = await fetch(`${API_CLUBS}/event-categories/${clubId}`, {
            credentials: 'include',
        });
        return await res.json();
    } catch (error: any) {
        return { success: false, categories: [], message: error.message };
    }
}

export async function getEventCategory(categoryId: number): Promise<{ success: boolean; category: EventCategory | null; message?: string }> {
    try {
        const res = await fetch(`${API_CLUBS}/event-category/${categoryId}`, {
            credentials: 'include',
        });
        return await res.json();
    } catch (error: any) {
        return { success: false, category: null, message: error.message };
    }
}

export async function updateEventCategory(categoryId: number, data: Partial<EventCategory>): Promise<{ success: boolean; category?: EventCategory; message?: string }> {
    try {
        const res = await fetch(`${API_CLUBS}/event-category/${categoryId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data),
        });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function deleteEventCategory(categoryId: number): Promise<{ success: boolean; message?: string }> {
    try {
        const res = await fetch(`${API_CLUBS}/event-category/${categoryId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function chatBot(query: string) {
    try {
        const res = await fetch(`/api/chatbot/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ query }),
        });
        const data = await res.json();

        console.log(data);
        return { success: true, ...data };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}


export interface BookListing {
    id: number;
    sellerId: string;
    title: string;
    author: string;
    isbn: string | null;
    edition: string | null;
    publisher: string | null;
    publicationYear: number | null;
    condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
    description: string | null;
    price: string;
    status: 'available' | 'pending' | 'sold' | 'removed';
    courseCode: string | null;
    categoryId: number | null;
    viewCount: number;
    createdAt: string;
    updatedAt: string;
    soldAt: string | null;
    seller?: {
        id: string;
        name: string;
        email?: string;
        image: string | null;
    };
    images?: BookImage[];
    category?: BookCategory;
    isSaved?: boolean;
    isOwner?: boolean;
}

export interface BookImage {
    id: number;
    listingId: number;
    imageUrl: string;
    imagePublicId: string | null;
    createdAt: string;
}

export interface BookCategory {
    id: number;
    name: string;
    description: string | null;
    parentCategoryId: number | null;
    createdAt: string;
    updatedAt: string;
    parentCategory?: BookCategory;
    subcategories?: BookCategory[];
}

export interface SavedBook {
    id: number;
    userId: string;
    listingId: number;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    listing?: BookListing;
}

export interface BookListingsResponse {
    success: boolean;
    data?: {
        listings: BookListing[];
        pagination: {
            page: number;
            limit: number;
            totalCount: number;
            totalPages: number;
        };
    };
    message?: string;
}

export interface BookFilters {
    search?: string;
    author?: string;
    isbn?: string;
    categoryId?: number;
    condition?: string;
    minPrice?: number;
    maxPrice?: number;
    status?: string;
    sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'oldest';
    page?: number;
    limit?: number;
}

export async function getBookListings(filters: BookFilters = {}): Promise<BookListingsResponse> {
    try {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== '') {
                params.append(key, String(value));
            }
        });
        const queryString = params.toString();
        const url = queryString ? `${API_BOOKS}?${queryString}` : API_BOOKS;

        const res = await fetch(url, { credentials: 'include' });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function getBookListingById(id: number): Promise<{ success: boolean; data?: BookListing; message?: string }> {
    try {
        const res = await fetch(`${API_BOOKS}/listings/${id}`, { credentials: 'include' });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function createBookListing(data: {
    title: string;
    author: string;
    isbn?: string;
    edition?: string;
    publisher?: string;
    publicationYear?: number;
    condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
    description?: string;
    price: string;
    courseCode?: string;
    categoryId?: number;
}): Promise<{ success: boolean; data?: BookListing; message?: string }> {
    try {
        const res = await fetch(API_BOOKS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data),
        });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function updateBookListing(id: number, data: Partial<{
    title: string;
    author: string;
    isbn: string;
    edition: string;
    publisher: string;
    publicationYear: number;
    condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
    description: string;
    price: string;
    courseCode: string;
    categoryId: number;
}>): Promise<{ success: boolean; data?: BookListing; message?: string }> {
    try {
        const res = await fetch(`${API_BOOKS}/listings/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data),
        });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function deleteBookListing(id: number): Promise<{ success: boolean; message?: string }> {
    try {
        const res = await fetch(`${API_BOOKS}/listings/${id}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function getMyBookListings(): Promise<{ success: boolean; data?: BookListing[]; message?: string }> {
    try {
        const res = await fetch(`${API_BOOKS}/my-listings`, { credentials: 'include' });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function markBookAsSold(id: number): Promise<{ success: boolean; data?: BookListing; message?: string }> {
    try {
        const res = await fetch(`${API_BOOKS}/listings/${id}/mark-sold`, {
            method: 'PUT',
            credentials: 'include',
        });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function uploadBookImage(listingId: number, image: File): Promise<{ success: boolean; data?: BookImage; message?: string }> {
    try {
        const formData = new FormData();
        formData.append('image', image);

        const res = await fetch(`${API_BOOKS}/listings/${listingId}/images`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
        });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function deleteBookImage(listingId: number, imageId: number): Promise<{ success: boolean; message?: string }> {
    try {
        const res = await fetch(`${API_BOOKS}/listings/${listingId}/images/${imageId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}


export async function getSavedBooks(): Promise<{ success: boolean; data?: SavedBook[]; message?: string }> {
    try {
        const res = await fetch(`${API_BOOKS}/saved`, { credentials: 'include' });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function saveBook(listingId: number, notes?: string): Promise<{ success: boolean; data?: SavedBook; message?: string }> {
    try {
        const res = await fetch(`${API_BOOKS}/listings/${listingId}/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ listingId, notes }),
        });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function unsaveBook(listingId: number): Promise<{ success: boolean; message?: string }> {
    try {
        const res = await fetch(`${API_BOOKS}/listings/${listingId}/save`, {
            method: 'DELETE',
            credentials: 'include',
        });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function updateSavedBookNotes(listingId: number, notes: string): Promise<{ success: boolean; message?: string }> {
    try {
        const res = await fetch(`${API_BOOKS}/saved/${listingId}/notes`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ notes }),
        });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

// Book Categories
export async function getBookCategories(): Promise<{ success: boolean; data?: BookCategory[]; message?: string }> {
    try {
        const res = await fetch(`${API_BOOKS}/categories`, { credentials: 'include' });
        return await res.json();
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}