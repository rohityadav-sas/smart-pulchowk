import { Request, Response } from "express";
import {
    sendMessage,
    getConversations,
    getMessages,
} from "../services/chat.service.js";

const getUserId = (req: Request): string | null => {
    const user = (req as any).user;
    return user?.id || null;
};

export const SendMessage = async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        const { listingId, content } = req.body;

        if (!listingId || !content) {
            return res.status(400).json({
                success: false,
                message: "Listing ID and content are required.",
            });
        }

        const result = await sendMessage(userId, listingId, content);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(201).json(result);
    } catch (error) {
        console.error("Error in SendMessage controller:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while sending the message.",
        });
    }
};

export const GetConversations = async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        const result = await getConversations(userId);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error("Error in GetConversations controller:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while fetching conversations.",
        });
    }
};

export const GetMessages = async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        const conversationId = parseInt(req.params.conversationId);
        if (isNaN(conversationId)) {
            return res.status(400).json({
                success: false,
                message: "Valid conversation ID is required.",
            });
        }

        const result = await getMessages(conversationId, userId);

        if (!result.success) {
            return res.status(result.message?.includes("denied") ? 403 : 400).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error("Error in GetMessages controller:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while fetching messages.",
        });
    }
};
