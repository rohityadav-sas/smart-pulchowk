import {
    cloudinary,
    UPLOAD_CONSTANTS,
    generatePublicId
} from "../config/cloudinary.js";

const {FOLDERS, TRANSFORMATIONS} = UPLOAD_CONSTANTS;

export async function uploadImageToCloudinary (
    dataUri: string,
    folder: string,
    publicId: string,
    transformation?: any[]
) {
    try {
        const uploadResult = await cloudinary.uploader.upload(dataUri, {
            folder,
            public_id: publicId,
            overwrite: false,
            resource_type: 'image',
            allowed_formats: ['jpg', 'png', 'webp'],
            transformation : transformation || TRANSFORMATIONS.CLUB_LOGO,
        });

        return {
            success: true,
            data: {
                url: uploadResult.secure_url,
                publicId: uploadResult.public_id,
                width: uploadResult. width,
                height:
                uploadResult.height,
            }
        };
    } catch (error) {
        console.error('cloudinary upload error:', error);

        return {
            success: false,
            message: error.message || 'Failed to upload to cloudinary'
        };
    }
}

export async function deleteImageFromCLoudinary (publicId: string) {
    try {
        await cloudinary.uploader.destroy(publicId);
        
        return {
            success: true,
            message: 'Image deleted from cloudinary'
        };
    } catch (error) {
        console.error('Cloudinary delete error:', error);

        return {
            success: false,
            message: error.message || ' Failed to delete from cloudinary'
        };
    }
}

export async function uploadClubLogoToCloudinary (
    clubId: number,
    fileDataUri: string
): Promise<{ success: boolean; url?: string; publicId?: string; message?: string }> {
    try {
        const publicId = generatePublicId('club', clubId);

        const result = await uploadImageToCloudinary(
            fileDataUri,
      FOLDERS.CLUB_LOGOS,
      publicId,
      TRANSFORMATIONS.CLUB_LOGO
        );

        if(!result.success) {
            return {
                success: false,
                message: result.message
            };
        }

        return {
      success: true,
      url: result.data!.url,
      publicId: result.data!.publicId,
    };

    } catch (error) {
        return {
            success: false,
            message: error.message || 'Failed to upload logo'
        };
    }
}