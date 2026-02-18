import { and, eq, inArray, sql } from 'drizzle-orm'
import ky from 'ky'
import { parse } from 'node-html-parser'
import { db } from '../lib/db.js'
import { notice, type NewNotice } from '../models/notice-schema.js'
import { notifications } from '../models/notification-schema.js'
import { UPLOAD_CONSTANTS, generatePublicId } from '../config/cloudinary.js'
import { uploadAssignmentFileToCloudinary } from './cloudinary.service.js'
import { createInAppNotificationForAudience } from './inAppNotification.service.js'
import { sendToTopic } from './notification.service.js'

export type NoticeSyncCategory =
  | 'results'
  | 'application_forms'
  | 'exam_centers'
  | 'general'

export interface SyncNoticesResult {
  inserted: number
  updated: number
  totalScraped: number
  categories: Array<{
    category: NoticeSyncCategory
    scraped: number
    inserted: number
    updated: number
  }>
}

interface NoticeSource {
  category: NoticeSyncCategory
  listUrl: string
}

interface ScrapedNotice {
  category: NoticeSyncCategory
  title: string
  publishedDate: string | null
  attachmentUrl: string | null
  sourceUrl: string | null
  externalRef: string | null
}

interface ExistingNoticeRow {
  id: number
  title: string
  category: string
  level: string | null
  attachmentUrl: string | null
  publishedDate: string | null
  sourceUrl: string | null
  externalRef: string | null
  createdAt: Date
}

const NOTICE_SOURCES: NoticeSource[] = [
  {
    category: 'results',
    listUrl: 'https://exam.ioe.tu.edu.np/notices?notice_type=930',
  },
  {
    category: 'application_forms',
    listUrl: 'https://exam.ioe.tu.edu.np/notices?notice_type=929',
  },
  {
    category: 'exam_centers',
    listUrl: 'https://exam.ioe.tu.edu.np/notices?notice_type=928',
  },
  {
    category: 'general',
    listUrl: 'https://exam.ioe.tu.edu.np/notices?notice_type=943',
  },
]

const { FOLDERS } = UPLOAD_CONSTANTS

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeUrl(
  value: string | null | undefined,
  baseUrl: string,
): string | null {
  const raw = normalizeText(value)
  if (!raw) return null
  try {
    return new URL(raw, baseUrl).toString()
  } catch {
    return null
  }
}

function getExternalRefFromUrl(url: string | null): string | null {
  if (!url) return null
  const match = /\/notices\/(\d+)(?:\/)?(?:\?.*)?$/i.exec(url)
  return match?.[1] ?? null
}

function isCloudinaryNoticeAttachment(url: string | null | undefined): boolean {
  const value = normalizeText(url)
  if (!value) return false
  return (
    /res\.cloudinary\.com/i.test(value) && /\/notice-attachments\//i.test(value)
  )
}

function isImageUrl(url: string | null | undefined): boolean {
  const value = normalizeText(url)
  if (!value) return false
  return /\.(jpg|jpeg|png|webp|gif|avif|svg)(\?.*)?$/i.test(value)
}

function createHttpClient() {
  if (process.env.NOTICE_SYNC_ALLOW_INSECURE_TLS === 'true') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  }
  return ky.create({
    retry: 1,
    timeout: 20000,
  })
}

async function fetchHtml(
  client: ReturnType<typeof createHttpClient>,
  url: string,
): Promise<string> {
  return await client.get(url).text()
}

function inferImageMimeTypeFromUrl(url: string): string {
  const lower = url.toLowerCase()
  if (lower.includes('.png')) return 'image/png'
  if (lower.includes('.webp')) return 'image/webp'
  if (lower.includes('.gif')) return 'image/gif'
  if (lower.includes('.svg')) return 'image/svg+xml'
  if (lower.includes('.jpeg') || lower.includes('.jpg')) return 'image/jpeg'
  return 'image/jpeg'
}

function isDataImageUri(value: string): boolean {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(value.trim())
}

function findBestImageSrc(
  detailHtml: ReturnType<typeof parse>,
  detailUrl: string,
): string | null {
  const images = detailHtml.querySelectorAll('.ck-table img')
  if (images.length === 0) return null

  const resolved = images
    .map((img) => {
      const raw = normalizeText(
        img.getAttribute('src') ??
          img.getAttribute('data-src') ??
          img.getAttribute('data-original'),
      )
      if (!raw) return null
      if (isDataImageUri(raw)) return raw
      return normalizeUrl(raw, detailUrl)
    })
    .filter((value): value is string => !!value)

  if (resolved.length === 0) return null

  const dataUri = resolved.find((src) => isDataImageUri(src))
  if (dataUri) return dataUri

  return resolved[0] ?? null
}

async function uploadDetailImageToCloudinary(
  client: ReturnType<typeof createHttpClient>,
  imageSrc: string,
  detailUrl: string,
): Promise<string | null> {
  try {
    let dataUri = imageSrc

    if (!isDataImageUri(imageSrc)) {
      const response = await client.get(imageSrc)
      const arrayBuffer = await response.arrayBuffer()
      const mimeType =
        response.headers.get('content-type')?.split(';')[0]?.trim() ||
        inferImageMimeTypeFromUrl(imageSrc)
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      dataUri = `data:${mimeType};base64,${base64}`
    }

    const detailRef = getExternalRefFromUrl(detailUrl) || Date.now().toString()
    const publicId = generatePublicId('notice_sync', detailRef)
    const uploadResult = await uploadAssignmentFileToCloudinary(
      dataUri,
      FOLDERS.NOTICE_ATTACHMENTS,
      publicId,
      'image',
    )

    if (!uploadResult.success || !uploadResult.data?.url) {
      return null
    }

    return uploadResult.data.url
  } catch (error) {
    console.error('Failed to upload fallback notice image:', detailUrl, error)
    return null
  }
}

async function scrapeDetailAttachment(
  client: ReturnType<typeof createHttpClient>,
  detailUrl: string,
  existingAttachmentUrl?: string | null,
): Promise<string | null> {
  try {
    const detailHtml = parse(await fetchHtml(client, detailUrl))

    const ckTableHref = normalizeUrl(
      detailHtml.querySelector('.ck-table a')?.getAttribute('href'),
      detailUrl,
    )
    if (ckTableHref) return ckTableHref

    if (isCloudinaryNoticeAttachment(existingAttachmentUrl)) {
      return existingAttachmentUrl ?? null
    }

    const imageSrc = findBestImageSrc(detailHtml, detailUrl)
    if (!imageSrc) return null

    const uploadedUrl = await uploadDetailImageToCloudinary(
      client,
      imageSrc,
      detailUrl,
    )
    if (uploadedUrl) return uploadedUrl
  } catch (error) {
    console.error('Failed to scrape detail attachment:', detailUrl, error)
  }

  return null
}

async function scrapeSource(
  client: ReturnType<typeof createHttpClient>,
  source: NoticeSource,
  existingByRef: Map<string, ExistingNoticeRow>,
): Promise<ScrapedNotice[]> {
  const html = parse(await fetchHtml(client, source.listUrl))
  const wrappers = html.querySelectorAll('.recent-post-wrapper')

  const settled = await Promise.allSettled(
    wrappers.map(async (wrapper) => {
      const title = normalizeText(
        wrapper.querySelector('.detail')?.textContent ??
          wrapper.querySelector('a')?.textContent,
      )
      if (!title) return null

      const publishedDate =
        normalizeText(wrapper.querySelector('.nep_date')?.textContent) || null

      const detailUrl = normalizeUrl(
        wrapper.querySelector('a')?.getAttribute('href'),
        source.listUrl,
      )
      const externalRef = getExternalRefFromUrl(detailUrl)
      const existingAttachmentUrl =
        (externalRef ? existingByRef.get(externalRef)?.attachmentUrl : null) ??
        null
      const attachmentUrl = detailUrl
        ? ((await scrapeDetailAttachment(
            client,
            detailUrl,
            existingAttachmentUrl,
          )) ?? detailUrl)
        : null

      return {
        category: source.category,
        title,
        publishedDate,
        attachmentUrl,
        sourceUrl: detailUrl,
        externalRef,
      } satisfies ScrapedNotice
    }),
  )

  const results: ScrapedNotice[] = []
  for (const item of settled) {
    if (item.status === 'fulfilled') {
      if (item.value) results.push(item.value)
      continue
    }
    console.error('Failed to scrape notice row:', source.category, item.reason)
  }

  return results
}

function makeLegacySubsection(category: NoticeSyncCategory): string {
  if (category === 'results') return 'be'
  if (category === 'application_forms') return 'msc'
  if (category === 'exam_centers') return 'be'
  return 'msc'
}

function toLegacySection(category: NoticeSyncCategory): string {
  if (category === 'results' || category === 'application_forms')
    return 'results'
  return 'routines'
}

function toNoticePayload(item: ScrapedNotice): NewNotice {
  return {
    title: item.title,
    category: item.category,
    level: makeLegacySubsection(item.category),
    attachmentUrl: item.attachmentUrl,
    publishedDate: item.publishedDate,
    sourceUrl: item.sourceUrl,
    externalRef: item.externalRef,
  }
}

function buildFallbackKey(
  category: string,
  title: string,
  publishedDate: string | null,
): string {
  return `${category}::${title}::${publishedDate ?? ''}`
}

function buildScrapedKey(item: ScrapedNotice): string {
  return item.externalRef
    ? `ref::${item.externalRef}`
    : `fallback::${buildFallbackKey(item.category, item.title, item.publishedDate)}`
}

export async function syncExamNotices(): Promise<SyncNoticesResult> {
  const client = createHttpClient()

  const existingRows: ExistingNoticeRow[] = await db
    .select({
      id: notice.id,
      title: notice.title,
      category: notice.category,
      level: notice.level,
      attachmentUrl: notice.attachmentUrl,
      publishedDate: notice.publishedDate,
      sourceUrl: notice.sourceUrl,
      externalRef: notice.externalRef,
      createdAt: notice.createdAt,
    })
    .from(notice)

  const existingByRef = new Map<string, ExistingNoticeRow>()
  for (const row of existingRows) {
    if (row.externalRef) {
      existingByRef.set(row.externalRef, row)
    }
  }

  const scrapedBySourceSettled = await Promise.allSettled(
    NOTICE_SOURCES.map(async (source) => ({
      source,
      scraped: await scrapeSource(client, source, existingByRef),
    })),
  )
  const scrapedBySource = scrapedBySourceSettled.map((entry, index) => {
    if (entry.status === 'fulfilled') {
      return entry.value
    }
    const source = NOTICE_SOURCES[index]
    console.error(
      'Failed to scrape notice category:',
      source.category,
      entry.reason,
    )
    return {
      source,
      scraped: [] as ScrapedNotice[],
    }
  })

  const totalScraped = scrapedBySource.reduce(
    (sum, entry) => sum + entry.scraped.length,
    0,
  )

  const dedupedMap = new Map<string, ScrapedNotice>()
  for (const entry of scrapedBySource) {
    for (const item of entry.scraped) {
      dedupedMap.set(buildScrapedKey(item), item)
    }
  }
  const dedupedScraped = Array.from(dedupedMap.values())

  const existingByFallback = new Map<string, ExistingNoticeRow>()

  for (const row of existingRows) {
    existingByFallback.set(
      buildFallbackKey(row.category, row.title, row.publishedDate),
      row,
    )
  }

  const inserts: NewNotice[] = []
  const updates: Array<{
    id: number
    payload: NewNotice
    category: NoticeSyncCategory
  }> = []

  const insertedByCategory = new Map<NoticeSyncCategory, number>()
  const updatedByCategory = new Map<NoticeSyncCategory, number>()

  for (const item of dedupedScraped) {
    const payload = toNoticePayload(item)
    const existing =
      (item.externalRef ? existingByRef.get(item.externalRef) : undefined) ??
      existingByFallback.get(
        buildFallbackKey(item.category, item.title, item.publishedDate),
      )

    if (!existing) {
      inserts.push(payload)
      insertedByCategory.set(
        item.category,
        (insertedByCategory.get(item.category) ?? 0) + 1,
      )
      continue
    }

    const hasChanges =
      existing.title !== payload.title ||
      existing.category !== payload.category ||
      (existing.level ?? null) !== (payload.level ?? null) ||
      (existing.attachmentUrl ?? null) !== (payload.attachmentUrl ?? null) ||
      (existing.publishedDate ?? null) !== (payload.publishedDate ?? null) ||
      (existing.sourceUrl ?? null) !== (payload.sourceUrl ?? null) ||
      (existing.externalRef ?? null) !== (payload.externalRef ?? null)

    if (!hasChanges) continue

    updates.push({
      id: existing.id,
      payload,
      category: item.category,
    })
    updatedByCategory.set(
      item.category,
      (updatedByCategory.get(item.category) ?? 0) + 1,
    )
  }

  const insertedRows =
    inserts.length > 0
      ? await db.insert(notice).values(inserts).returning({
          id: notice.id,
          title: notice.title,
          attachmentUrl: notice.attachmentUrl,
          category: notice.category,
        })
      : []

  await Promise.all(
    updates.map((item) =>
      db.update(notice).set(item.payload).where(eq(notice.id, item.id)),
    ),
  )

  const recentlyTouchedNoticeIds = new Set<number>(insertedRows.map((row) => row.id))
  for (const item of dedupedScraped) {
    const existing =
      (item.externalRef ? existingByRef.get(item.externalRef) : undefined) ??
      existingByFallback.get(
        buildFallbackKey(item.category, item.title, item.publishedDate),
      )
    if (existing) recentlyTouchedNoticeIds.add(existing.id)
  }

  const notificationPromises: Promise<unknown>[] = []
  for (const created of insertedRows) {
    const category = created.category as NoticeSyncCategory
    const normalizedLevel = makeLegacySubsection(category)
    notificationPromises.push(
      createInAppNotificationForAudience({
        audience: 'all',
        type: 'notice_created',
        title: 'New Notice Published',
        body: created.title,
        data: {
          noticeId: created.id,
          noticeTitle: created.title,
          category,
          section: toLegacySection(category),
          subsection: normalizedLevel,
          iconKey: 'notice',
          ...(isImageUrl(created.attachmentUrl)
            ? { thumbnailUrl: created.attachmentUrl as string }
            : {}),
        },
      }).catch((error) =>
        console.error(
          'Failed to create sync notice in-app notification:',
          error,
        ),
      ),
    )

    notificationPromises.push(
      sendToTopic('notices', {
        title: 'New Notice Published',
        body: created.title,
        data: {
          noticeId: String(created.id),
          type: 'notice_created',
          category,
          section: toLegacySection(category),
          subsection: normalizedLevel,
          iconKey: 'notice',
        },
      }).catch((error) =>
        console.error('Failed to send sync notice FCM notification:', error),
      ),
    )
  }

  for (const updated of updates) {
    const category = updated.category
    const normalizedLevel = updated.payload.level || makeLegacySubsection(category)
    notificationPromises.push(
      createInAppNotificationForAudience({
        audience: 'all',
        type: 'notice_updated',
        title: 'Notice Updated',
        body: updated.payload.title,
        data: {
          noticeId: updated.id,
          noticeTitle: updated.payload.title,
          category,
          section: toLegacySection(category),
          subsection: normalizedLevel,
          iconKey: 'notice',
          ...(isImageUrl(updated.payload.attachmentUrl)
            ? { thumbnailUrl: updated.payload.attachmentUrl as string }
            : {}),
        },
      }).catch((error) =>
        console.error(
          'Failed to create sync notice update in-app notification:',
          error,
        ),
      ),
    )

    notificationPromises.push(
      sendToTopic('announcements', {
        title: 'Notice Updated',
        body: updated.payload.title,
        data: {
          noticeId: String(updated.id),
          type: 'notice_updated',
          category,
          section: toLegacySection(category),
          subsection: normalizedLevel,
          iconKey: 'notice',
        },
      }).catch((error) =>
        console.error(
          'Failed to send sync notice update FCM notification:',
          error,
        ),
      ),
    )
  }

  // Backfill missing "notice_created" in-app entries for recently touched notices.
  // This repairs cases where notice insertion succeeded but notification creation failed.
  if (recentlyTouchedNoticeIds.size > 0) {
    const touchedIds = [...recentlyTouchedNoticeIds]
    const touchedRows = await db
      .select({
        id: notice.id,
        title: notice.title,
        category: notice.category,
        level: notice.level,
        attachmentUrl: notice.attachmentUrl,
        createdAt: notice.createdAt,
      })
      .from(notice)
      .where(inArray(notice.id, touchedIds))

    const now = Date.now()
    const recentRows = touchedRows.filter(
      (row) => now - row.createdAt.getTime() <= 14 * 24 * 60 * 60 * 1000,
    )

    if (recentRows.length > 0) {
      const recentIdsAsText = recentRows.map((row) => String(row.id))
      const existingCreatedNotifRows = await db
        .select({
          noticeId: sql<string>`coalesce(${notifications.data}->>'noticeId', '')`,
        })
        .from(notifications)
        .where(
          and(
            eq(notifications.type, 'notice_created'),
            inArray(
              sql<string>`coalesce(${notifications.data}->>'noticeId', '')`,
              recentIdsAsText,
            ),
          ),
        )

      const existingCreatedNoticeIds = new Set(
        existingCreatedNotifRows.map((row) => row.noticeId),
      )

      for (const row of recentRows) {
        if (existingCreatedNoticeIds.has(String(row.id))) continue

        const category = row.category as NoticeSyncCategory
        const normalizedLevel = row.level || makeLegacySubsection(category)
        notificationPromises.push(
          createInAppNotificationForAudience({
            audience: 'all',
            type: 'notice_created',
            title: 'New Notice Published',
            body: row.title,
            data: {
              noticeId: row.id,
              noticeTitle: row.title,
              category,
              section: toLegacySection(category),
              subsection: normalizedLevel,
              iconKey: 'notice',
              ...(isImageUrl(row.attachmentUrl)
                ? { thumbnailUrl: row.attachmentUrl as string }
                : {}),
            },
          }).catch((error) =>
            console.error(
              'Failed to backfill sync notice in-app notification:',
              error,
            ),
          ),
        )
      }
    }
  }

  await Promise.allSettled(notificationPromises)

  const inserted = insertedRows.length
  const updated = updates.length
  const categoryStats: SyncNoticesResult['categories'] = NOTICE_SOURCES.map(
    ({ category }) => {
      const sourceEntry = scrapedBySource.find(
        (entry) => entry.source.category === category,
      )
      return {
        category,
        scraped: sourceEntry?.scraped.length ?? 0,
        inserted: insertedByCategory.get(category) ?? 0,
        updated: updatedByCategory.get(category) ?? 0,
      }
    },
  )

  return {
    inserted,
    updated,
    totalScraped,
    categories: categoryStats,
  }
}
