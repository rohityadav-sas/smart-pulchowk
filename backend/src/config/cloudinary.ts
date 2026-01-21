import { v2 as cloudinary } from "cloudinary";
import ENV from "./ENV.js";

cloudinary.config({
    cloud_name: ENV.CLOUDINARY_CLOUD_NAME,
    api_key: ENV.CLOUDINARY_API_KEY,
    api_secret: ENV.CLOUDINARY_API_SECRET,
    secure: true,
});

export const UPLOAD_CONSTANTS = {
    MAX_FILE_SIZE: 5 * 1024 * 1024,
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'] as const,

    FOLDERS: {
        CLUB_LOGOS: 'club-logos',
        EVENT_BANNERS: 'event-banners',
    },
    TRANSFORMATIONS: {
        CLUB_LOGO: [
            {
                width: 800,
                height: 800,
                crop: 'limit'
            },
            {
                quality: 'auto:good'
            },
            {
                fetch_format: 'auto'
            },
        ],
        EVENT_BANNER: [
            {
                width: 1200,
                height: 800,
                crop: 'limit'
            },
            {
                quality: 'auto:good'
            },
            {
                fetch_format: 'auto'
            }
        ],
    },
};

export function generatePublicId(prefix: string, id: number | string): string {
    return `${prefix}_${id}_${Date.now()}`;
}

export function isValidImageUrl(url: string): boolean {
    try {
        const parsedUrl = new URL(url);
        const validProtocols = ['http:', 'https:'];
        return validProtocols.includes(parsedUrl.protocol);
    } catch (error) {
        return false;
    }
}

export { cloudinary };