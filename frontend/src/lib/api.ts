import { deriveEventStatus } from './event-status'

const API_EVENTS = '/api/events'
const API_CLUBS = '/api/clubs'
const API_BOOKS = '/api/books'
const API_CLASSROOM = '/api/classroom'
const API_CHAT = '/api/chat'

export interface Club {
  id: number
  authClubId: string
  name: string
  description: string | null
  logoUrl: string | null
  email?: string
  isActive?: boolean
  createdAt?: string
  upcomingEvents?: number
  completedEvents?: number
  totalParticipants?: number
}

export interface ClubEvent {
  id: number
  clubId: number
  title: string
  description: string | null
  eventType: string
  status: string
  venue: string | null
  maxParticipants: number | null
  currentParticipants: number
  registrationDeadline: string | null
  eventStartTime: string
  eventEndTime: string
  bannerUrl: string | null
  externalRegistrationLink: string | null
  isRegistrationOpen: boolean
  createdAt: string
  club?: Club
}

function withDerivedStatus(event: ClubEvent): ClubEvent {
  return {
    ...event,
    status: deriveEventStatus(event),
  }
}

export interface ClubProfile {
  id: number
  clubId: number
  aboutClub: string | null
  mission: string | null
  vision: string | null
  achievements: string | null
  benefits: string | null
  contactPhone: string | null
  websiteUrl: string | null
  socialLinks: Record<string, string> | null
  establishedYear: number | null
  totalEventHosted: number
  updatedAt: string | null
}

export interface ExtraEventDetail {
  id: number
  eventId: number
  fullDescription: string | null
  objectives: string | null
  targetAudience: string | null
  prerequisites: string | null
  rules: string | null
  judgingCriteria: string | null
  updatedAt: string | null
}

export interface Registration {
  id: number
  studentId: number
  eventId: number
  status: string
  registeredAt: string
  event?: ClubEvent & { club?: Club }
}

export interface EventCategory {
  id: number
  clubId: number
  name: string
  description: string | null
  objectives: string | null
  targetAudience: string | null
  prerequisites: string | null
  rules: string | null
  judgingCriteria: string | null
  bannerUrl: string | null
  createdAt: string
  updatedAt: string
  club?: {
    id: number
    name: string
    logoUrl: string | null
  }
}

export interface Faculty {
  id: number
  name: string
  slug: string
  code?: string | null
  semestersCount: number
  semesterDurationMonths: number
}

export interface Subject {
  id: number
  facultyId: number
  semesterNumber: number
  code?: string | null
  title: string
  isElective: boolean
  electiveGroup?: string | null
}

export interface StudentProfile {
  userId: string
  facultyId: number
  currentSemester: number
  semesterStartDate: string
  semesterEndDate: string | null
  autoAdvance: boolean
  faculty?: Faculty | null
}

export interface AssignmentSubmission {
  id: number
  assignmentId: number
  studentId: string
  comment?: string | null
  fileUrl: string
  fileName?: string | null
  fileMimeType?: string | null
  submittedAt: string
  updatedAt: string
  student?: {
    id: string
    name: string
    email: string
    image?: string | null
  }
}

export interface Assignment {
  id: number
  subjectId: number
  teacherId: string
  title: string
  description?: string | null
  type: 'classwork' | 'homework'
  dueAt?: string | null
  createdAt: string
  updatedAt: string
  submission?: AssignmentSubmission | null
}

export async function getClubs(): Promise<{
  success: boolean
  existingClub?: Club[]
  message?: string
}> {
  const res = await fetch(`${API_EVENTS}/clubs`, {
    credentials: 'include',
  })
  const clone = res.clone()
  try {
    const json = await res.json()
    return json.data
  } catch (e) {
    console.error('Failed to parse getClubs response', await clone.text())
    return { success: false, message: 'Invalid server response' }
  }
}

export async function getClub(
  clubId: number,
): Promise<{ success: boolean; clubData?: Club; message?: string }> {
  const res = await fetch(`${API_EVENTS}/clubs/${clubId}`, {
    credentials: 'include',
  })
  const clone = res.clone()
  try {
    const json = await res.json()
    if (typeof json?.data?.success === 'boolean') {
      return json.data
    }
    if (typeof json?.success === 'boolean') {
      return json
    }
    if (res.status === 404) {
      return { success: false, message: 'Club not found' }
    }
    return { success: false, message: 'Invalid server response' }
  } catch (e) {
    if (res.status === 404) {
      return { success: false, message: 'Club not found' }
    }
    console.error('Failed to parse getClub response', await clone.text())
    return { success: false, message: 'Invalid server response' }
  }
}

export async function getClubEvents(
  clubId: number,
): Promise<{ success: boolean; clubEvents?: ClubEvent[]; message?: string }> {
  const res = await fetch(`${API_EVENTS}/events/${clubId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  })
  const clone = res.clone()
  try {
    const json = await res.json()
    if (json?.data?.clubEvents) {
      json.data.clubEvents = json.data.clubEvents.map(withDerivedStatus)
    }
    return json.data
  } catch (e) {
    console.error('Failed to parse getClubEvents response', await clone.text())
    return { success: false, message: 'Invalid server response' }
  }
}

export async function getUpcomingEvents(): Promise<{
  success: boolean
  upcomingEvents?: ClubEvent[]
  message?: string
}> {
  try {
    const res = await fetch(`${API_EVENTS}/get-upcoming-events`, {
      credentials: 'include',
    })
    const json = await res.json()
    if (json?.data?.upcomingEvents) {
      json.data.upcomingEvents = json.data.upcomingEvents.map(withDerivedStatus)
    }
    return json.data
  } catch (error: any) {
    console.error('Error', error.message)
    return { success: false, message: 'Invalid server response' }
  }
}

export async function getAllEvents(): Promise<{
  success: boolean
  allEvents?: ClubEvent[]
  message?: string
}> {
  try {
    const res = await fetch(`${API_EVENTS}/all-events`, {
      credentials: 'include',
    })
    const json = await res.json()
    if (json?.data?.allEvents) {
      json.data.allEvents = json.data.allEvents.map(withDerivedStatus)
    }
    return json.data
  } catch (error: any) {
    console.error(error.message)
    return { success: false, message: 'Invalid server response' }
  }
}

export async function createEvent(
  clubId: number,
  eventData: {
    title: string
    description: string
    eventType: string
    venue: string
    maxParticipants: number
    registrationDeadline: string
    eventStartTime: string
    eventEndTime: string
    bannerUrl?: string
    externalRegistrationLink?: string
  },
): Promise<{ success: boolean; event?: ClubEvent; message?: string }> {
  try {
    const payload = { clubId, ...eventData }

    const bodyString = JSON.stringify(payload)

    const res = await fetch(`${API_EVENTS}/create-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: bodyString,
    })

    console.log('Response status:', res.status)
    const json = await res.json()
    console.log('Response json:', json)

    if (json?.data?.event) {
      json.data.event = withDerivedStatus(json.data.event)
    }
    return json.data
  } catch (error: any) {
    console.error('Error:', error.message)
    throw error
  }
}

export async function getClubAdmins(
  clubId: number,
): Promise<{ success: boolean; admins?: any[]; message?: string }> {
  try {
    const res = await fetch(`${API_EVENTS}/club/admins/${clubId}`, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function addClubAdmin(
  clubId: number,
  email: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_EVENTS}/club/add-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ clubId, email }),
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function removeClubAdmin(
  clubId: number,
  userId: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_EVENTS}/club/remove-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ clubId, userId }),
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function createClub(clubData: {
  name: string
  description?: string
  email: string
  logoUrl?: string
}): Promise<{ success: boolean; club?: Club; message?: string }> {
  try {
    const res = await fetch(`${API_EVENTS}/create-club`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(clubData),
    })
    const json = await res.json()
    return json
  } catch (error) {
    console.error(error)
    return { success: false, message: 'Internal server response' }
  }
}

export async function registerForEvent(
  eventId: number,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_EVENTS}/register-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ eventId }),
    })
    const json = await res.json()
    return json.data
  } catch (error) {
    console.error(error)
    return { success: false, message: 'Internal server response' }
  }
}

export async function cancelRegistration(
  eventId: number,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_EVENTS}/cancel-registration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ eventId }),
    })
    const json = await res.json()
    return json.data
  } catch (error) {
    console.error(error)
    return { success: false, message: 'Internal server response' }
  }
}

export async function getEnrollments(): Promise<{
  success: boolean
  registrations?: any[]
  message?: string
}> {
  const res = await fetch(`${API_EVENTS}/enrollment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({}),
  })
  const clone = res.clone()
  try {
    const json = await res.json()
    return json.data
  } catch (e) {
    console.error('Failed to parse getEnrollments response', await clone.text())
    return { success: false, message: 'Invalid server response' }
  }
}

export async function getRegisteredStudents(
  eventId: number,
): Promise<{ success: boolean; registrations?: any[]; message?: string }> {
  try {
    const res = await fetch(`${API_EVENTS}/registered-student`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ eventId }),
    })
    const json = await res.json()
    return json.data
  } catch (error) {
    return { success: false, message: 'Invalid server response' }
  }
}

export async function cancelEvent(
  eventId: number,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_EVENTS}/${eventId}/cancel`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function createClubProfile(
  clubId: number,
  profileData: Partial<ClubProfile>,
): Promise<{ success: boolean; profile?: ClubProfile; message?: string }> {
  try {
    const res = await fetch(`${API_CLUBS}/club-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ clubId, ...profileData }),
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function getClubProfile(clubId: number): Promise<{
  success: boolean
  profile: ClubProfile | null
  message?: string
}> {
  try {
    const res = await fetch(`${API_CLUBS}/club-profile/${clubId}`, {
      credentials: 'include',
    })
    const json = await res.json()
    return json
  } catch (error: any) {
    return { success: false, profile: null, message: error.message }
  }
}

export async function updateClubProfile(
  clubId: number,
  profileData: Partial<ClubProfile>,
): Promise<{ success: boolean; profile?: ClubProfile; message?: string }> {
  try {
    const res = await fetch(`${API_CLUBS}/club-profile/${clubId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(profileData),
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function updateClubInfo(
  clubId: number,
  clubData: Partial<Club>,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_EVENTS}/clubs/${clubId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(clubData),
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function uploadClubLogo(
  clubId: number,
  logo: File | string,
): Promise<{
  success: boolean
  data?: { url: string; publicId: string | null; source: string }
  message?: string
}> {
  try {
    let body: FormData | string
    let headers: Record<string, string> = {}

    if (logo instanceof File) {
      const formData = new FormData()
      formData.append('logo', logo)
      body = formData
    } else {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify({ imageUrl: logo })
    }

    const res = await fetch(`${API_CLUBS}/${clubId}/upload-logo`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body,
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function uploadEventBanner(
  eventId: number,
  banner: File | string,
): Promise<{
  success: boolean
  data?: { url: string; publicId: string | null }
  message?: string
}> {
  try {
    let body: FormData | string
    let headers: Record<string, string> = {}

    if (banner instanceof File) {
      const formData = new FormData()
      formData.append('banner', banner)
      body = formData
    } else {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify({ imageUrl: banner })
    }

    const res = await fetch(`${API_EVENTS}/${eventId}/upload-banner`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body,
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function deleteClubLogo(
  clubId: number,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_CLUBS}/${clubId}/upload-logo`, {
      method: 'DELETE',
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function createExtraEventDetails(
  eventId: number,
  detailsData: Partial<ExtraEventDetail>,
): Promise<{ success: boolean; details?: ExtraEventDetail; message?: string }> {
  try {
    const res = await fetch(`${API_CLUBS}/event-details/create-event-details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ eventId, ...detailsData }),
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function getExtraEventDetails(eventId: number): Promise<{
  success: boolean
  details: ExtraEventDetail | null
  message?: string
}> {
  try {
    const res = await fetch(`${API_CLUBS}/event-details/${eventId}`, {
      credentials: 'include',
    })
    const json = await res.json()
    return json
  } catch (error: any) {
    return { success: false, details: null, message: error.message }
  }
}

export async function updateExtraEventDetails(
  eventId: number,
  detailsData: Partial<ExtraEventDetail>,
): Promise<{ success: boolean; details?: ExtraEventDetail; message?: string }> {
  try {
    const res = await fetch(`${API_CLUBS}/event-details/update-eventdetail`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ eventId, ...detailsData }),
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function createEventCategory(
  clubId: number,
  data: Partial<EventCategory>,
): Promise<{ success: boolean; category?: EventCategory; message?: string }> {
  try {
    const res = await fetch(`${API_CLUBS}/event-categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ clubId, ...data }),
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function getEventCategories(clubId: number): Promise<{
  success: boolean
  categories: EventCategory[]
  message?: string
}> {
  try {
    const res = await fetch(`${API_CLUBS}/event-categories/${clubId}`, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, categories: [], message: error.message }
  }
}

export async function getEventCategory(categoryId: number): Promise<{
  success: boolean
  category: EventCategory | null
  message?: string
}> {
  try {
    const res = await fetch(`${API_CLUBS}/event-category/${categoryId}`, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, category: null, message: error.message }
  }
}

export async function updateEventCategory(
  categoryId: number,
  data: Partial<EventCategory>,
): Promise<{ success: boolean; category?: EventCategory; message?: string }> {
  try {
    const res = await fetch(`${API_CLUBS}/event-category/${categoryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function deleteEventCategory(
  categoryId: number,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_CLUBS}/event-category/${categoryId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function getFaculties(): Promise<{
  success: boolean
  faculties: Faculty[]
  message?: string
}> {
  try {
    const res = await fetch(`${API_CLASSROOM}/faculties`, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, faculties: [], message: error.message }
  }
}

export async function getSubjects(
  facultyId: number,
  semester?: number,
): Promise<{ success: boolean; subjects: Subject[]; message?: string }> {
  const params = new URLSearchParams({ facultyId: String(facultyId) })
  if (semester) params.append('semester', String(semester))

  try {
    const res = await fetch(`${API_CLASSROOM}/subjects?${params.toString()}`, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, subjects: [], message: error.message }
  }
}

export async function getStudentProfile(): Promise<{
  success: boolean
  profile: StudentProfile | null
  message?: string
}> {
  try {
    const res = await fetch(`${API_CLASSROOM}/me`, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, profile: null, message: error.message }
  }
}

export async function getMySubjects(): Promise<{
  success: boolean
  profile?: StudentProfile | null
  subjects?: (Subject & { assignments: Assignment[] })[]
  message?: string
}> {
  try {
    const res = await fetch(`${API_CLASSROOM}/me/subjects`, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function getTeacherSubjects(): Promise<{
  success: boolean
  subjects: (Subject & { assignments: Assignment[] })[]
  message?: string
}> {
  try {
    const res = await fetch(`${API_CLASSROOM}/teacher/subjects`, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, subjects: [], message: error.message }
  }
}

export async function addTeacherSubject(
  subjectId: number,
  teacherId?: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_CLASSROOM}/teacher/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ subjectId, teacherId }),
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function createAssignment(data: {
  subjectId: number
  title: string
  description?: string
  type?: 'classwork' | 'homework'
  dueAt?: string
}): Promise<{ success: boolean; assignment?: Assignment; message?: string }> {
  try {
    const res = await fetch(`${API_CLASSROOM}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function submitAssignment(
  assignmentId: number,
  file: File,
  comment?: string,
): Promise<{
  success: boolean
  submission?: AssignmentSubmission
  message?: string
}> {
  try {
    const formData = new FormData()
    formData.append('file', file)
    if (comment) formData.append('comment', comment)

    const res = await fetch(
      `${API_CLASSROOM}/assignments/${assignmentId}/submissions`,
      {
        method: 'POST',
        credentials: 'include',
        body: formData,
      },
    )
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function getAssignmentSubmissions(assignmentId: number): Promise<{
  success: boolean
  submissions: AssignmentSubmission[]
  message?: string
}> {
  try {
    const res = await fetch(
      `${API_CLASSROOM}/assignments/${assignmentId}/submissions`,
      {
        credentials: 'include',
      },
    )
    return await res.json()
  } catch (error: any) {
    return { success: false, submissions: [], message: error.message }
  }
}

export async function chatBot(query: string) {
  try {
    const res = await fetch(`/api/chatbot/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ query }),
    })
    const data = await res.json()

    console.log(data)
    return { success: true, ...data }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export interface BookListing {
  id: number
  sellerId: string
  title: string
  author: string
  isbn: string | null
  edition: string | null
  publisher: string | null
  publicationYear: number | null
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor'
  description: string | null
  price: string
  status: 'available' | 'pending' | 'sold' | 'removed'
  courseCode: string | null
  categoryId: number | null
  viewCount: number
  createdAt: string
  updatedAt: string
  soldAt: string | null
  seller?: {
    id: string
    name: string
    email?: string
    image: string | null
    isVerifiedSeller?: boolean
  }
  images?: BookImage[]
  category?: BookCategory
  isSaved?: boolean
  isOwner?: boolean
}

export interface BookImage {
  id: number
  listingId: number
  imageUrl: string
  imagePublicId: string | null
  createdAt: string
}

export interface BookCategory {
  id: number
  name: string
  description: string | null
  parentCategoryId: number | null
  createdAt: string
  updatedAt: string
  parentCategory?: BookCategory
  subcategories?: BookCategory[]
}

export interface SavedBook {
  id: number
  userId: string
  listingId: number
  notes: string | null
  createdAt: string
  updatedAt: string
  listing?: BookListing
}

export interface BookListingsResponse {
  success: boolean
  data?: {
    listings: BookListing[]
    pagination: {
      page: number
      limit: number
      totalCount: number
      totalPages: number
    }
  }
  message?: string
}

export interface BookFilters {
  search?: string
  author?: string
  isbn?: string
  categoryId?: number
  condition?: string
  minPrice?: number
  maxPrice?: number
  status?: string
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'oldest'
  page?: number
  limit?: number
}

export async function getBookListings(
  filters: BookFilters = {},
): Promise<BookListingsResponse> {
  try {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, String(value))
      }
    })
    const queryString = params.toString()
    const url = queryString ? `${API_BOOKS}?${queryString}` : API_BOOKS

    const res = await fetch(url, { credentials: 'include' })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function getBookListingById(
  id: number,
): Promise<{ success: boolean; data?: BookListing; message?: string }> {
  try {
    const res = await fetch(`${API_BOOKS}/listings/${id}`, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function createBookListing(data: {
  title: string
  author: string
  isbn?: string
  edition?: string
  publisher?: string
  publicationYear?: number
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor'
  description?: string
  price: string
  courseCode?: string
  categoryId?: number
}): Promise<{ success: boolean; data?: BookListing; message?: string }> {
  try {
    const res = await fetch(API_BOOKS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function updateBookListing(
  id: number,
  data: Partial<{
    title: string
    author: string
    isbn: string
    edition: string
    publisher: string
    publicationYear: number
    condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor'
    description: string
    price: string
    courseCode: string
    categoryId: number
  }>,
): Promise<{ success: boolean; data?: BookListing; message?: string }> {
  try {
    const res = await fetch(`${API_BOOKS}/listings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function deleteBookListing(
  id: number,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_BOOKS}/listings/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function getMyBookListings(): Promise<{
  success: boolean
  data?: BookListing[]
  message?: string
}> {
  try {
    const res = await fetch(`${API_BOOKS}/my-listings`, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function markBookAsSold(
  id: number,
): Promise<{ success: boolean; data?: BookListing; message?: string }> {
  try {
    const res = await fetch(`${API_BOOKS}/listings/${id}/mark-sold`, {
      method: 'PUT',
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function uploadBookImage(
  listingId: number,
  image: File,
): Promise<{ success: boolean; data?: BookImage; message?: string }> {
  try {
    const formData = new FormData()
    formData.append('image', image)

    const res = await fetch(`${API_BOOKS}/listings/${listingId}/images`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function deleteBookImage(
  listingId: number,
  imageId: number,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(
      `${API_BOOKS}/listings/${listingId}/images/${imageId}`,
      {
        method: 'DELETE',
        credentials: 'include',
      },
    )
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function getSavedBooks(): Promise<{
  success: boolean
  data?: SavedBook[]
  message?: string
}> {
  try {
    const res = await fetch(`${API_BOOKS}/saved`, { credentials: 'include' })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function saveBook(
  listingId: number,
  notes?: string,
): Promise<{ success: boolean; data?: SavedBook; message?: string }> {
  try {
    const res = await fetch(`${API_BOOKS}/listings/${listingId}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ listingId, notes }),
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function unsaveBook(
  listingId: number,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_BOOKS}/listings/${listingId}/save`, {
      method: 'DELETE',
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function updateSavedBookNotes(
  listingId: number,
  notes: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_BOOKS}/saved/${listingId}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ notes }),
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function getBookCategories(): Promise<{
  success: boolean
  data?: BookCategory[]
  message?: string
}> {
  try {
    const res = await fetch(`${API_BOOKS}/categories`, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export interface SellerContactInfo {
  id: number
  listingId: number
  primaryContactMethod:
    | 'whatsapp'
    | 'facebook_messenger'
    | 'telegram'
    | 'email'
    | 'phone'
    | 'other'
  whatsapp?: string
  facebookMessenger?: string
  telegramUsername?: string
  email?: string
  phoneNumber?: string
  otherContactDetails?: string
  createdAt: string
  updatedAt: string
}

export interface PurchaseRequest {
  id: number
  listingId: number
  buyerId: string
  status: 'requested' | 'accepted' | 'rejected' | 'completed' | 'cancelled'
  message?: string
  createdAt: string
  respondedAt?: string
  buyer?: {
    id: string
    name: string
    email: string
    image?: string
  }
  listing?: BookListing
}

export async function upsertSellerContactInfo(
  listingId: number,
  data: {
    primaryContactMethod: SellerContactInfo['primaryContactMethod']
    whatsapp?: string
    facebookMessenger?: string
    telegramUsername?: string
    email?: string
    phoneNumber?: string
    otherContactDetails?: string
  },
): Promise<{ success: boolean; data?: SellerContactInfo; message?: string }> {
  try {
    const res = await fetch(`${API_BOOKS}/listings/${listingId}/contact-info`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function getSellerContactInfo(listingId: number): Promise<{
  success: boolean
  data?: SellerContactInfo | null
  hasContactInfo?: boolean
  isOwner?: boolean
  hasAccess?: boolean
  message?: string
}> {
  try {
    const res = await fetch(`${API_BOOKS}/listings/${listingId}/contact-info`, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function createPurchaseRequest(
  listingId: number,
  message?: string,
): Promise<{
  success: boolean
  data?: PurchaseRequest
  message?: string
  existingStatus?: string
}> {
  try {
    const res = await fetch(`${API_BOOKS}/listings/${listingId}/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message }),
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function getPurchaseRequestStatus(listingId: number): Promise<{
  success: boolean
  data?: PurchaseRequest | null
  message?: string
}> {
  try {
    const res = await fetch(
      `${API_BOOKS}/listings/${listingId}/request-status`,
      { credentials: 'include' },
    )
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function getListingPurchaseRequests(
  listingId: number,
): Promise<{ success: boolean; data?: PurchaseRequest[]; message?: string }> {
  try {
    const res = await fetch(`${API_BOOKS}/listings/${listingId}/requests`, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function getMyPurchaseRequests(): Promise<{
  success: boolean
  data?: PurchaseRequest[]
  message?: string
}> {
  try {
    const res = await fetch(`${API_BOOKS}/my-requests`, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function respondToPurchaseRequest(
  requestId: number,
  accept: boolean,
): Promise<{ success: boolean; data?: PurchaseRequest; message?: string }> {
  try {
    const res = await fetch(`${API_BOOKS}/requests/${requestId}/respond`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accept }),
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function cancelPurchaseRequest(
  requestId: number,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_BOOKS}/requests/${requestId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function deletePurchaseRequest(
  requestId: number,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_BOOKS}/requests/${requestId}/delete`, {
      method: 'DELETE',
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export interface ChatUser {
  id: string
  name: string
  email: string
  image: string | null
}

export interface ChatMessage {
  id: number
  conversationId: number
  senderId: string
  content: string
  isRead: boolean
  createdAt: string
  sender?: ChatUser
}

export interface ChatConversation {
  id: number
  listingId: number
  buyerId: string
  sellerId: string
  createdAt: string
  updatedAt: string
  listing?: {
    id: number
    title: string
    price: string
    images?: { imageUrl: string }[]
  }
  buyer?: ChatUser
  seller?: ChatUser
  messages?: ChatMessage[]
}

export async function getConversations(): Promise<{
  success: boolean
  data?: ChatConversation[]
  message?: string
}> {
  try {
    const res = await fetch(`${API_CHAT}/conversations`, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function getMessages(
  conversationId: number,
  options?: { limit?: number; before?: string },
): Promise<{
  success: boolean
  data?: ChatMessage[]
  message?: string
  meta?: { limit: number; hasMore: boolean; nextBefore: string | null }
}> {
  try {
    const params = new URLSearchParams()
    if (options?.limit) params.set('limit', String(options.limit))
    if (options?.before) params.set('before', options.before)
    const queryString = params.toString()
    const url = queryString
      ? `${API_CHAT}/conversations/${conversationId}/messages?${queryString}`
      : `${API_CHAT}/conversations/${conversationId}/messages`

    const res = await fetch(url, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function startConversation(
  listingId: number,
  content: string,
): Promise<{ success: boolean; data?: ChatMessage; message?: string }> {
  try {
    const res = await fetch(`${API_CHAT}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ listingId, content }),
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function sendMessageToConversation(
  conversationId: number,
  content: string,
): Promise<{ success: boolean; data?: ChatMessage; message?: string }> {
  try {
    const res = await fetch(
      `${API_CHAT}/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content }),
      },
    )
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function deleteConversation(
  conversationId: number,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_CHAT}/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// ============ NOTICES API ============
const API_NOTICES = '/api/notices'

export interface Notice {
  id: number
  title: string
  content: string
  section: 'results' | 'routines'
  subsection: 'be' | 'msc'
  attachmentUrl: string | null

  attachmentName: string | null
  authorId: string

  createdAt: string
  updatedAt: string
  author?: {
    id: string
    name: string
    email?: string
  }
}

export interface NoticeStats {
  total: number
  beResults: number
  mscResults: number
  beRoutines: number
  mscRoutines: number
  newCount: number
}

export interface NoticeFilters {
  section?: 'results' | 'routines'
  subsection?: 'be' | 'msc'
  search?: string
  limit?: number
  offset?: number
}

export interface PaginationMeta {
  total?: number
  limit: number
  offset: number
}

export async function getNotices(
  filters?: NoticeFilters,
): Promise<{
  success: boolean
  data?: Notice[]
  message?: string
  meta?: PaginationMeta
}> {
  try {
    const params = new URLSearchParams()
    if (filters?.section) params.append('section', filters.section)
    if (filters?.subsection) params.append('subsection', filters.subsection)
    if (filters?.search) params.append('search', filters.search)
    if (filters?.limit) params.append('limit', filters.limit.toString())
    if (filters?.offset) params.append('offset', filters.offset.toString())

    const queryString = params.toString()
    const url = queryString ? `${API_NOTICES}?${queryString}` : API_NOTICES

    const res = await fetch(url, {
      credentials: 'include',
    })
    const json = await res.json()

    // Preferred shape: { success, data }
    if (typeof json?.success === 'boolean') {
      return {
        success: json.success,
        data: json.data,
        message: json.message,
        meta: json.meta,
      }
    }

    // Legacy/alternate shape: { data: { success, notices, message } }
    if (typeof json?.data?.success === 'boolean') {
      return {
        success: json.data.success,
        data: json.data.notices,
        message: json.data.message,
      }
    }

    return { success: false, message: 'Invalid server response' }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function getNoticeStats(): Promise<{
  success: boolean
  data?: NoticeStats
  message?: string
}> {
  try {
    const res = await fetch(`${API_NOTICES}/stats`, {
      credentials: 'include',
    })
    const json = await res.json()

    // Preferred shape: { success, data }
    if (typeof json?.success === 'boolean') return json

    // Legacy/alternate shape: { data: { success, stats, message } }
    if (typeof json?.data?.success === 'boolean') {
      return {
        success: json.data.success,
        data: json.data.stats,
        message: json.data.message,
      }
    }

    return { success: false, message: 'Invalid server response' }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function uploadNoticeAttachment(file: File): Promise<{
  success: boolean
  data?: { url: string; type: 'pdf' | 'image' | null; name: string }
  message?: string
}> {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`${API_NOTICES}/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })

    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function createNotice(
  data: Omit<Notice, 'id' | 'authorId' | 'createdAt' | 'updatedAt' | 'author'>,
): Promise<{ success: boolean; data?: Notice; message?: string }> {
  try {
    const res = await fetch(API_NOTICES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    const json = await res.json()

    if (typeof json?.success === 'boolean') return json

    if (typeof json?.data?.success === 'boolean') {
      return {
        success: json.data.success,
        data: json.data.notice,
        message: json.data.message,
      }
    }

    return { success: false, message: 'Invalid server response' }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function updateNotice(
  id: number,
  data: Partial<
    Omit<Notice, 'id' | 'authorId' | 'createdAt' | 'updatedAt' | 'author'>
  >,
): Promise<{ success: boolean; data?: Notice; message?: string }> {
  try {
    const res = await fetch(`${API_NOTICES}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    const json = await res.json()

    if (typeof json?.success === 'boolean') return json

    if (typeof json?.data?.success === 'boolean') {
      return {
        success: json.data.success,
        data: json.data.notice,
        message: json.data.message,
      }
    }

    return { success: false, message: 'Invalid server response' }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function deleteNotice(
  id: number,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_NOTICES}/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    const json = await res.json()

    if (typeof json?.success === 'boolean') return json

    if (typeof json?.data?.success === 'boolean') {
      return {
        success: json.data.success,
        message: json.data.message,
      }
    }

    return { success: false, message: 'Invalid server response' }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function markNoticeAsRead(
  id: number,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_NOTICES}/${id}/read`, {
      method: 'PATCH',
      credentials: 'include',
    })
    const json = await res.json()

    if (typeof json?.success === 'boolean') return json

    if (typeof json?.data?.success === 'boolean') {
      return {
        success: json.data.success,
        message: json.data.message,
      }
    }

    return { success: false, message: 'Invalid server response' }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// ============ TRUST + ADMIN + GLOBAL SEARCH ============
const API_BOOK_TRUST = '/api/books/trust'
const API_ADMIN = '/api/admin'
const API_SEARCH = '/api/search'

export interface SellerRatingReview {
  id: number
  sellerId: string
  raterId: string
  listingId: number
  rating: number
  review: string | null
  createdAt: string
  updatedAt: string
  rater?: {
    id: string
    name: string
    image: string | null
  }
  listing?: {
    id: number
    title: string
  }
}

export interface SellerReputation {
  averageRating: number
  totalRatings: number
  distribution: Record<number, number>
  recentRatings: SellerRatingReview[]
}

export interface BlockedUser {
  id: number
  blockerId: string
  blockedUserId: string
  reason: string | null
  createdAt: string
  blockedUser?: {
    id: string
    name: string
    email: string
    image: string | null
  }
}

export interface MarketplaceReport {
  id: number
  reporterId: string
  reportedUserId: string
  listingId: number | null
  category:
    | 'spam'
    | 'fraud'
    | 'abusive'
    | 'fake_listing'
    | 'suspicious_payment'
    | 'other'
  description: string
  status: 'open' | 'in_review' | 'resolved' | 'rejected'
  resolutionNotes: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  reporter?: { id: string; name: string; email: string }
  reportedUser?: { id: string; name: string; email: string }
  reviewer?: { id: string; name: string }
  listing?: { id: number; title: string }
}

export async function getSellerReputation(sellerId: string): Promise<{
  success: boolean
  data?: SellerReputation
  message?: string
}> {
  try {
    const res = await fetch(`${API_BOOK_TRUST}/sellers/${sellerId}/reputation`, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function rateSeller(
  sellerId: string,
  data: { listingId: number; rating: number; review?: string },
): Promise<{ success: boolean; data?: SellerRatingReview; message?: string }> {
  try {
    const res = await fetch(`${API_BOOK_TRUST}/sellers/${sellerId}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function blockMarketplaceUser(
  userId: string,
  reason?: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_BOOK_TRUST}/users/${userId}/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ reason }),
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function unblockMarketplaceUser(
  userId: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_BOOK_TRUST}/users/${userId}/block`, {
      method: 'DELETE',
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function getBlockedMarketplaceUsers(): Promise<{
  success: boolean
  data?: BlockedUser[]
  message?: string
}> {
  try {
    const res = await fetch(`${API_BOOK_TRUST}/blocked-users`, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function createMarketplaceReport(data: {
  reportedUserId: string
  listingId?: number
  category: MarketplaceReport['category']
  description: string
}): Promise<{ success: boolean; data?: MarketplaceReport; message?: string }> {
  try {
    const res = await fetch(`${API_BOOK_TRUST}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function getMyMarketplaceReports(): Promise<{
  success: boolean
  data?: MarketplaceReport[]
  message?: string
}> {
  try {
    const res = await fetch(`${API_BOOK_TRUST}/reports/my`, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export interface AdminUser {
  id: string
  name: string
  email: string
  image: string | null
  role: string
  isVerifiedSeller: boolean
  createdAt: string
  updatedAt: string
  reputation: {
    averageRating: number
    totalRatings: number
  }
}

export interface AdminOverview {
  users: number
  admins: number
  teachers: number
  listingsAvailable: number
  openReports: number
  activeBlocks: number
  ratingsCount: number
  averageSellerRating: number
}

export async function getAdminOverview(): Promise<{
  success: boolean
  data?: AdminOverview
  message?: string
}> {
  try {
    const res = await fetch(`${API_ADMIN}/overview`, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function getAdminUsers(filters?: {
  search?: string
  role?: string
  limit?: number
}): Promise<{ success: boolean; data?: AdminUser[]; message?: string }> {
  try {
    const params = new URLSearchParams()
    if (filters?.search) params.set('search', filters.search)
    if (filters?.role) params.set('role', filters.role)
    if (filters?.limit) params.set('limit', String(filters.limit))

    const qs = params.toString()
    const url = qs ? `${API_ADMIN}/users?${qs}` : `${API_ADMIN}/users`
    const res = await fetch(url, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function updateAdminUserRole(
  userId: string,
  role: string,
): Promise<{ success: boolean; data?: AdminUser; message?: string }> {
  try {
    const res = await fetch(`${API_ADMIN}/users/${userId}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role }),
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function toggleSellerVerification(
  userId: string,
  verified: boolean,
): Promise<{ success: boolean; data?: AdminUser; message?: string }> {
  try {
    const res = await fetch(`${API_ADMIN}/users/${userId}/verify-seller`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ verified }),
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function getModerationReports(status?: string): Promise<{
  success: boolean
  data?: MarketplaceReport[]
  message?: string
}> {
  try {
    const qs = status ? `?status=${encodeURIComponent(status)}` : ''
    const res = await fetch(`${API_ADMIN}/reports${qs}`, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function updateModerationReport(
  reportId: number,
  payload: { status: MarketplaceReport['status']; resolutionNotes?: string },
): Promise<{ success: boolean; data?: MarketplaceReport; message?: string }> {
  try {
    const res = await fetch(`${API_ADMIN}/reports/${reportId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function getAdminRatings(): Promise<{
  success: boolean
  data?: SellerRatingReview[]
  message?: string
}> {
  try {
    const res = await fetch(`${API_ADMIN}/ratings`, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function getAdminBlocks(): Promise<{
  success: boolean
  data?: (BlockedUser & { blocker?: AdminUser })[]
  message?: string
}> {
  try {
    const res = await fetch(`${API_ADMIN}/blocks`, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function adminUnblockUser(
  blockId: number,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_ADMIN}/blocks/${blockId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export interface GlobalSearchResponse {
  query: string
  clubs: Club[]
  events: Array<
    Pick<
      ClubEvent,
      'id' | 'title' | 'description' | 'eventStartTime' | 'eventEndTime' | 'venue' | 'clubId' | 'bannerUrl'
    > & {
      club?: Pick<Club, 'id' | 'name' | 'logoUrl'>
    }
  >
  books: Array<
    Pick<BookListing, 'id' | 'title' | 'author' | 'price' | 'status'> & {
      images?: Array<{ imageUrl: string }>
      seller?: {
        id: string
        name: string
        image: string | null
        isVerifiedSeller?: boolean
      }
    }
  >
  notices: Array<
    Pick<
      Notice,
      'id' | 'title' | 'content' | 'section' | 'subsection' | 'attachmentUrl' | 'createdAt'
    >
  >
  places: Array<{
    id: string
    name: string
    description: string
    coordinates: { lat: number; lng: number }
    icon: string
    services: Array<{ name: string; purpose: string; location: string }>
  }>
  total: number
}

export async function searchEverything(
  query: string,
  limit = 6,
  types?: Array<'clubs' | 'events' | 'books' | 'notices' | 'places'>,
): Promise<{ success: boolean; data?: GlobalSearchResponse; message?: string }> {
  try {
    const params = new URLSearchParams()
    params.set('q', query)
    params.set('limit', String(limit))
    if (types && types.length > 0) {
      params.set('types', types.join(','))
    }

    const res = await fetch(`${API_SEARCH}?${params.toString()}`, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// ============ IN-APP NOTIFICATIONS ============
const API_NOTIFICATIONS = '/api/notifications'

export interface InAppNotification {
  id: number
  type: string
  title: string
  body: string
  data?: Record<string, string | number | boolean | null> | null
  recipientId?: string | null
  audience: 'direct' | 'all' | 'students' | 'teachers' | 'admins'
  createdAt: string
  isRead: boolean
  readAt?: string | null
}

export interface InAppNotificationListResponse {
  success: boolean
  data?: InAppNotification[]
  meta?: {
    total: number
    limit: number
    offset: number
  }
  message?: string
}

export async function getInAppNotifications(filters?: {
  limit?: number
  offset?: number
  type?: string
  unreadOnly?: boolean
}): Promise<InAppNotificationListResponse> {
  try {
    const params = new URLSearchParams()
    if (filters?.limit) params.set('limit', String(filters.limit))
    if (filters?.offset) params.set('offset', String(filters.offset))
    if (filters?.type) params.set('type', filters.type)
    if (filters?.unreadOnly) params.set('unreadOnly', 'true')
    const qs = params.toString()
    const url = qs ? `${API_NOTIFICATIONS}?${qs}` : API_NOTIFICATIONS

    const res = await fetch(url, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function getUnreadNotificationsCount(): Promise<{
  success: boolean
  count?: number
  message?: string
}> {
  try {
    const res = await fetch(`${API_NOTIFICATIONS}/unread-count`, {
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function markInAppNotificationRead(id: number): Promise<{
  success: boolean
  message?: string
}> {
  try {
    const res = await fetch(`${API_NOTIFICATIONS}/${id}/read`, {
      method: 'PATCH',
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function markAllInAppNotificationsRead(): Promise<{
  success: boolean
  updated?: number
  message?: string
}> {
  try {
    const res = await fetch(`${API_NOTIFICATIONS}/mark-all-read`, {
      method: 'POST',
      credentials: 'include',
    })
    return await res.json()
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}
