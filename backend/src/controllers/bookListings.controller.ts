import { Request, Response } from "express";
import {
    createBookListing,
    getBookListings,
    getBookListingById,
    updateBookListing,
    deleteBookListing,
    getMyListings,
    markAsSold,
    addBookImage,
    deleteBookImage,
} from "../services/bookListings.service.js";
import { uploadImage, deleteImage } from "../services/cloudinary.service.js";


const getUserId = (req: Request): string | null => {
    const user = (req as any).user;
    return user?.id || null;
};

export const CreateListing = async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        const {
            title,
            author,
            isbn,
            edition,
            publisher,
            publicationYear,
            condition,
            description,
            price,
            courseCode,
            categoryId,
        } = req.body;

        if (!title || !author || !condition || !price) {
            return res.status(400).json({
                success: false,
                message: "Title, author, condition, and price are required.",
            });
        }

        const result = await createBookListing(userId, {
            title,
            author,
            isbn,
            edition,
            publisher,
            publicationYear,
            condition,
            description,
            price,
            courseCode,
            categoryId,
        });

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(201).json(result);
    } catch (error) {
        console.error("Error in CreateListing controller:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while creating the listing.",
        });
    }
};

export const GetListings = async (req: Request, res: Response) => {
    try {
        const {
            search,
            author,
            isbn,
            categoryId,
            condition,
            minPrice,
            maxPrice,
            status,
            sortBy,
            page,
            limit,
        } = req.query;

        const result = await getBookListings({
            search: search as string,
            author: author as string,
            isbn: isbn as string,
            categoryId: categoryId ? parseInt(categoryId as string) : undefined,
            condition: condition as string,
            minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
            maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
            status: status as string,
            sortBy: sortBy as any,
            page: page ? parseInt(page as string) : 1,
            limit: limit ? parseInt(limit as string) : 20,
        });

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error("Error in GetListings controller:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while fetching listings.",
        });
    }
};

export const GetListingById = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "Valid listing ID is required.",
            });
        }

        const userId = getUserId(req);
        const result = await getBookListingById(id, userId || undefined);

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error("Error in GetListingById controller:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while fetching the listing.",
        });
    }
};

export const UpdateListing = async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "Valid listing ID is required.",
            });
        }

        const result = await updateBookListing(id, userId, req.body);

        if (!result.success) {
            const status = result.message?.includes("not authorized") ? 403 : 400;
            return res.status(status).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error("Error in UpdateListing controller:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while updating the listing.",
        });
    }
};

export const DeleteListing = async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "Valid listing ID is required.",
            });
        }

        const result = await deleteBookListing(id, userId);

        if (!result.success) {
            const status = result.message?.includes("not authorized") ? 403 : 400;
            return res.status(status).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error("Error in DeleteListing controller:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while deleting the listing.",
        });
    }
};

export const GetMyListings = async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        const result = await getMyListings(userId);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error("Error in GetMyListings controller:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while fetching your listings.",
        });
    }
};

export const MarkAsSold = async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "Valid listing ID is required.",
            });
        }

        const result = await markAsSold(id, userId);

        if (!result.success) {
            const status = result.message?.includes("not authorized") ? 403 : 400;
            return res.status(status).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error("Error in MarkAsSold controller:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while marking the book as sold.",
        });
    }
};

export const UploadBookImage = async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        const listingId = parseInt(req.params.id);
        if (isNaN(listingId)) {
            return res.status(400).json({
                success: false,
                message: "Valid listing ID is required.",
            });
        }

        let imageUrl: string;
        let publicId: string | undefined;


        const file = (req as any).file;
        if (file) {
            const uploadResult = await uploadImage(file.buffer, "book-images");
            if (!uploadResult.success || !uploadResult.url) {
                return res.status(400).json({
                    success: false,
                    message: uploadResult.message || "Image upload failed.",
                });
            }
            imageUrl = uploadResult.url;
            publicId = uploadResult.publicId;
        } else if (req.body.imageUrl) {

            imageUrl = req.body.imageUrl;
        } else {
            return res.status(400).json({
                success: false,
                message: "Image file or URL is required.",
            });
        }

        const result = await addBookImage(listingId, userId, imageUrl, publicId);

        if (!result.success) {

            if (publicId) {
                await deleteImage(publicId).catch(console.error);
            }
            const status = result.message?.includes("not authorized") ? 403 : 400;
            return res.status(status).json(result);
        }

        return res.status(201).json(result);
    } catch (error) {
        console.error("Error in UploadBookImage controller:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while uploading the image.",
        });
    }
};

export const DeleteBookImage = async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        const imageId = parseInt(req.params.imageId);
        if (isNaN(imageId)) {
            return res.status(400).json({
                success: false,
                message: "Valid image ID is required.",
            });
        }

        const result = await deleteBookImage(imageId, userId);

        if (!result.success) {
            const status = result.message?.includes("not authorized") ? 403 : 400;
            return res.status(status).json(result);
        }


        if (result.data?.publicId) {
            await deleteImage(result.data.publicId).catch(console.error);
        }

        return res.json(result);
    } catch (error) {
        console.error("Error in DeleteBookImage controller:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while deleting the image.",
        });
    }
};
