import { Request, Response } from 'express'
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { db } from '../lib/db.js'
import { notice, type NewNotice } from '../models/notice-schema.js'
import { user } from '../models/auth-schema.js'
import { UPLOAD_CONSTANTS, generatePublicId } from '../config/cloudinary.js'
import { uploadAssignmentFileToCloudinary } from '../services/cloudinary.service.js'

type AuthedRequest = Request & { user?: { id: string; role?: string | null } }

const isNoticeManager = (req: AuthedRequest): boolean => {
  const role = req.user?.role
  return role === 'notice_manager' || role === 'admin'
}

const { NOTICE_ATTACHMENTS, FOLDERS } = UPLOAD_CONSTANTS

// Get all notices (with optional filtering)
export async function getNotices(req: Request, res: Response) {
  try {
    const section = (req.query.section as string | undefined)?.trim() // 'results' | 'routines'
    const subsection = (req.query.subsection as string | undefined)?.trim() // 'be' | 'msc'
    const search = (req.query.search as string | undefined)?.trim()
    const parsedLimit = Number(req.query.limit)
    const parsedOffset = Number(req.query.offset)
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(Math.floor(parsedLimit), 100)
        : 20
    const offset =
      Number.isFinite(parsedOffset) && parsedOffset >= 0
        ? Math.floor(parsedOffset)
        : 0

    const filters: any[] = []
    if (section) filters.push(eq(notice.section, section))
    if (subsection) filters.push(eq(notice.subsection, subsection))
    if (search) {
      const term = `%${search}%`
      filters.push(or(ilike(notice.title, term), ilike(notice.content, term)))
    }

    const whereClause =
      filters.length > 1 ? and(...filters) : filters.length === 1 ? filters[0] : undefined

    const [totalRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notice)
      .where(whereClause)

    const results = await db
      .select({
        id: notice.id,
        title: notice.title,
        content: notice.content,
        section: notice.section,
        subsection: notice.subsection,
        attachmentUrl: notice.attachmentUrl,
        attachmentName: notice.attachmentName,
        createdAt: notice.createdAt,
        updatedAt: notice.updatedAt,
        authorId: notice.authorId,
        author: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      })
      .from(notice)
      .leftJoin(user, eq(notice.authorId, user.id))
      .where(whereClause)
      .orderBy(desc(notice.createdAt))
      .limit(limit)
      .offset(offset)

    return res.json({
      success: true,
      data: results,
      meta: {
        total: totalRow?.count ?? 0,
        limit,
        offset,
      },
    })
  } catch (error: any) {
    console.error('Error fetching notices:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch notices',
    })
  }
}

// Get notice stats
export async function getNoticeStats(_req: Request, res: Response) {
  try {
    const [stats] = await db
      .select({
        beResults:
          sql<number>`count(*) filter (where ${notice.section} = 'results' and ${notice.subsection} = 'be')::int`,
        mscResults:
          sql<number>`count(*) filter (where ${notice.section} = 'results' and ${notice.subsection} = 'msc')::int`,
        beRoutines:
          sql<number>`count(*) filter (where ${notice.section} = 'routines' and ${notice.subsection} = 'be')::int`,
        mscRoutines:
          sql<number>`count(*) filter (where ${notice.section} = 'routines' and ${notice.subsection} = 'msc')::int`,
        newCount:
          sql<number>`count(*) filter (where ${notice.createdAt} >= now() - interval '7 days')::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(notice)

    return res.json({ success: true, data: stats ?? {} })
  } catch (error: any) {
    console.error('Error fetching notice stats:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch notice stats',
    })
  }
}

// Create a new notice (notice_manager/admin only)
export async function createNotice(req: AuthedRequest, res: Response) {
  try {
    if (!req.user || !isNoticeManager(req)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. Only notice managers can create notices.',
      })
    }

    const body = req.body ?? {}
    const {
      title,
      content,
      section,
      subsection,
      attachmentUrl,

      attachmentName,
    } = body

    if (!title || !content || !section || !subsection) {
      return res.status(400).json({
        success: false,
        message: 'Title, content, section, and subsection are required',
      })
    }

    if (!['results', 'routines'].includes(section)) {
      return res.status(400).json({
        success: false,
        message: "Section must be 'results' or 'routines'",
      })
    }

    if (!['be', 'msc'].includes(subsection)) {
      return res.status(400).json({
        success: false,
        message: "Subsection must be 'be' or 'msc'",
      })
    }

    const newNotice: NewNotice = {
      title,
      content,
      section,
      subsection,
      attachmentUrl: attachmentUrl || null,

      attachmentName: attachmentName || null,
      authorId: req.user.id,
    }

    const [created] = await db.insert(notice).values(newNotice).returning()

    return res.json({
      success: true,
      message: 'Notice created successfully',
      data: created,
    })
  } catch (error: any) {
    console.error('Error creating notice:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create notice',
    })
  }
}

// Update a notice (notice_manager/admin only)
export async function updateNotice(req: AuthedRequest, res: Response) {
  try {
    if (!req.user || !isNoticeManager(req)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. Only notice managers can update notices.',
      })
    }

    const noticeId = Number(req.params.id)
    if (!noticeId || Number.isNaN(noticeId)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid notice ID' })
    }

    const body = req.body ?? {}
    const {
      title,
      content,
      section,
      subsection,
      attachmentUrl,

      attachmentName,
    } = body

    const updateData: Partial<NewNotice> = {}
    if (title) updateData.title = title
    if (content) updateData.content = content
    if (section) updateData.section = section
    if (subsection) updateData.subsection = subsection
    if (attachmentUrl !== undefined) updateData.attachmentUrl = attachmentUrl

    if (attachmentName !== undefined) updateData.attachmentName = attachmentName

    const [updated] = await db
      .update(notice)
      .set(updateData)
      .where(eq(notice.id, noticeId))
      .returning()

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: 'Notice not found' })
    }

    return res.json({
      success: true,
      message: 'Notice updated successfully',
      data: updated,
    })
  } catch (error: any) {
    console.error('Error updating notice:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update notice',
    })
  }
}

// Upload notice attachment (notice_manager/admin only)
export async function uploadNoticeAttachment(
  req: AuthedRequest,
  res: Response,
) {
  try {
    if (!req.user || !isNoticeManager(req)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. Only notice managers can upload attachments.',
      })
    }

    const file = (req as any).file as Express.Multer.File | undefined
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Attachment file is required',
      })
    }

    if (!NOTICE_ATTACHMENTS.ALLOWED_TYPES.includes(file.mimetype as any)) {
      return res.status(400).json({
        success: false,
        message: 'Only images or PDF files are allowed',
      })
    }

    if (file.size > NOTICE_ATTACHMENTS.MAX_FILE_SIZE) {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB',
      })
    }

    const base64 = file.buffer.toString('base64')
    const dataUri = `data:${file.mimetype};base64,${base64}`

    // Generate public ID (no extension needed - Cloudinary handles format automatically)
    const publicId = generatePublicId('notice', req.user.id)

    // Use 'image' for both images and PDFs - Cloudinary treats PDFs as images
    // This ensures public access via /image/upload/ URL path
    const cloudinaryResourceType = 'image'

    const uploadResult = await uploadAssignmentFileToCloudinary(
      dataUri,
      FOLDERS.NOTICE_ATTACHMENTS,
      publicId,
      cloudinaryResourceType,
    )

    if (!uploadResult.success || !uploadResult.data) {
      return res.status(400).json({
        success: false,
        message: uploadResult.message || 'Upload failed',
      })
    }

    return res.json({
      success: true,
      data: {
        url: uploadResult.data.url,

        name: file.originalname,
      },
    })
  } catch (error: any) {
    console.error('Error uploading notice attachment:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload file',
    })
  }
}

// Delete a notice (notice_manager/admin only)
export async function deleteNotice(req: AuthedRequest, res: Response) {
  try {
    if (!req.user || !isNoticeManager(req)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. Only notice managers can delete notices.',
      })
    }

    const noticeId = Number(req.params.id)
    if (!noticeId || Number.isNaN(noticeId)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid notice ID' })
    }

    const [deleted] = await db
      .delete(notice)
      .where(eq(notice.id, noticeId))
      .returning()

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: 'Notice not found' })
    }

    return res.json({
      success: true,
      message: 'Notice deleted successfully',
    })
  } catch (error: any) {
    console.error('Error deleting notice:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete notice',
    })
  }
}
