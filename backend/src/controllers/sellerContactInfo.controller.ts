import { Request, Response } from "express";
import {
    upsertSellerContactInfo,
    getSellerContactInfo,
    deleteSellerContactInfo,
} from "../services/sellerContactInfo.service.js";

const getUserId = (req: Request): string | null => {
    const user = (req as any).user;
    return user?.id || null;
};

export const UpsertContactInfo = async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const listingId = parseInt(req.params.id);
        if (isNaN(listingId)) {
            return res.status(400).json({ success: false, message: "Valid listing ID required." });
        }

        const { primaryContactMethod, whatsapp, facebookMessenger, telegramUsername, email, phoneNumber, otherContactDetails } = req.body;

        if (!primaryContactMethod) {
            return res.status(400).json({ success: false, message: "Primary contact method is required." });
        }

        const result = await upsertSellerContactInfo(listingId, userId, {
            primaryContactMethod,
            whatsapp,
            facebookMessenger,
            telegramUsername,
            email,
            phoneNumber,
            otherContactDetails,
        });

        if (!result.success) {
            const status = result.message?.includes("not authorized") ? 403 : 400;
            return res.status(status).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error("Error in UpsertContactInfo:", error);
        return res.status(500).json({ success: false, message: "An error occurred." });
    }
};

export const GetContactInfo = async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        const listingId = parseInt(req.params.id);

        if (isNaN(listingId)) {
            return res.status(400).json({ success: false, message: "Valid listing ID required." });
        }

        const result = await getSellerContactInfo(listingId, userId || undefined);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error("Error in GetContactInfo:", error);
        return res.status(500).json({ success: false, message: "An error occurred." });
    }
};

export const DeleteContactInfo = async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const listingId = parseInt(req.params.id);
        if (isNaN(listingId)) {
            return res.status(400).json({ success: false, message: "Valid listing ID required." });
        }

        const result = await deleteSellerContactInfo(listingId, userId);

        if (!result.success) {
            const status = result.message?.includes("not authorized") ? 403 : 400;
            return res.status(status).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error("Error in DeleteContactInfo:", error);
        return res.status(500).json({ success: false, message: "An error occurred." });
    }
};
