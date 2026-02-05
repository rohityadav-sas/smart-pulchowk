import {
  cloudinary,
  UPLOAD_CONSTANTS,
  generatePublicId,
} from '../config/cloudinary.js'

const { FOLDERS, TRANSFORMATIONS } = UPLOAD_CONSTANTS

export async function uploadImageToCloudinary(
  dataUri: string,
  folder: string,
  publicId: string,
  transformation?: any[],
) {
  try {
    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      folder,
      public_id: publicId,
      overwrite: false,
      resource_type: 'image',
      allowed_formats: ['jpg', 'png', 'webp'],
      transformation: transformation || TRANSFORMATIONS.CLUB_LOGO,
    })

    return {
      success: true,
      data: {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        width: uploadResult.width,
        height: uploadResult.height,
      },
    }
  } catch (error) {
    console.error('cloudinary upload error:', error)

    return {
      success: false,
      message: error.message || 'Failed to upload to cloudinary',
    }
  }
}

export async function deleteImageFromCLoudinary(publicId: string) {
  try {
    await cloudinary.uploader.destroy(publicId)

    return {
      success: true,
      message: 'Image deleted from cloudinary',
    }
  } catch (error) {
    console.error('Cloudinary delete error:', error)

    return {
      success: false,
      message: error.message || ' Failed to delete from cloudinary',
    }
  }
}

export async function uploadClubLogoToCloudinary(
  clubId: number,
  fileDataUri: string,
): Promise<{
  success: boolean
  url?: string
  publicId?: string
  message?: string
}> {
  try {
    const publicId = generatePublicId('club', clubId)

    const result = await uploadImageToCloudinary(
      fileDataUri,
      FOLDERS.CLUB_LOGOS,
      publicId,
      TRANSFORMATIONS.CLUB_LOGO,
    )

    if (!result.success) {
      return {
        success: false,
        message: result.message,
      }
    }

    return {
      success: true,
      url: result.data!.url,
      publicId: result.data!.publicId,
    }
  } catch (error) {
    return {
      success: false,
      message: error.message || 'Failed to upload logo',
    }
  }
}

export async function uploadEventBanner(
  eventId: number,
  fileDataUri: string,
): Promise<{
  success: boolean
  url?: string
  publicId?: string
  message?: string
}> {
  try {
    const publicId = generatePublicId('event', eventId)

    const result = await uploadImageToCloudinary(
      fileDataUri,
      FOLDERS.EVENT_BANNERS,
      publicId,
      TRANSFORMATIONS.EVENT_BANNER,
    )

    if (!result.success) {
      return {
        success: false,
        message: result.message,
      }
    }

    return {
      success: true,
      url: result.data!.url,
      publicId: result.data!.publicId,
    }
  } catch (error) {
    return {
      success: false,
      message: error.message || 'Failed to upload banner',
    }
  }
}

export async function uploadEventBannerToCloudinary(
  fileDataUri: string,
): Promise<{
  success: boolean
  url?: string
  publicId?: string
  message?: string
}> {
  try {
    const publicId = `event_banner_${Date.now()}`

    const result = await uploadImageToCloudinary(
      fileDataUri,
      FOLDERS.EVENT_BANNERS,
      publicId,
      TRANSFORMATIONS.EVENT_BANNER,
    )

    if (!result.success) {
      return {
        success: false,
        message: result.message,
      }
    }

    return {
      success: true,
      url: result.data!.url,
      publicId: result.data!.publicId,
    }
  } catch (error) {
    return {
      success: false,
      message: error.message || 'Failed to upload event banner',
    }
  }
}

export async function uploadImage(
  buffer: Buffer,
  folder: string = 'book-images',
): Promise<{
  success: boolean
  url?: string
  publicId?: string
  message?: string
}> {
  try {
    const base64 = buffer.toString('base64')
    const dataUri = `data:image/jpeg;base64,${base64}`
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`

    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      folder: `pulchowk-x/${folder}`,
      public_id: uniqueId,
      resource_type: 'image',
      allowed_formats: ['jpg', 'png', 'webp', 'jpeg'],
      transformation: [
        { width: 800, height: 800, crop: 'limit' },
        { quality: 'auto:good' },
      ],
    })

    return {
      success: true,
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    }
  } catch (error) {
    console.error('Cloudinary upload error:', error)
    return {
      success: false,
      message: error.message || 'Failed to upload image',
    }
  }
}

export async function uploadAssignmentFileToCloudinary(
  dataUri: string,
  folder: string,
  publicId: string,
  resourceType: 'image' | 'raw' | 'auto' = 'auto',
): Promise<{
  success: boolean
  data?: {
    url: string
    publicId: string
    resourceType: string
    bytes: number
    originalFilename?: string
    format?: string
  }
  message?: string
}> {
  try {
    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      folder,
      public_id: publicId,
      overwrite: false,
      resource_type: resourceType,
      type: 'upload',
    })

    return {
      success: true,
      data: {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        resourceType: uploadResult.resource_type,
        bytes: uploadResult.bytes,
        originalFilename: uploadResult.original_filename,
        format: uploadResult.format,
      },
    }
  } catch (error) {
    console.error('cloudinary assignment upload error:', error)
    return {
      success: false,
      message: error.message || 'Failed to upload assignment file',
    }
  }
}

export async function deleteImage(
  publicId: string,
): Promise<{ success: boolean; message?: string }> {
  return deleteImageFromCLoudinary(publicId)
}

export async function deleteFileFromCloudinary(
  publicId: string,
  resourceType: string | null | undefined,
): Promise<{ success: boolean; message?: string }> {
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType || 'image',
    })

    return {
      success: true,
      message: 'File deleted from cloudinary',
    }
  } catch (error) {
    console.error('Cloudinary delete error:', error)
    return {
      success: false,
      message: error.message || 'Failed to delete file',
    }
  }
}
