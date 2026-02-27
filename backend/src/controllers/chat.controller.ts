import { Request, Response } from "express";
import {
    sendMessage,
    getConversations,
    getMessages,
    deleteConversation,
    sendMessageToConversation,
    markMessagesAsRead,
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

        const { listingId, content, buyerId } = req.body;

        if (!listingId || !content) {
            return res.status(400).json({
                success: false,
                message: "Listing ID and content are required.",
            });
        }

        const result = await sendMessage(userId, listingId, content, buyerId);

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

        const parsedLimit = Number(req.query.limit);
        const limit = Number.isFinite(parsedLimit) ? parsedLimit : undefined;

        const beforeQuery = req.query.before as string | undefined;
        const before = beforeQuery ? new Date(beforeQuery) : undefined;
        if (beforeQuery && Number.isNaN(before?.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid before cursor timestamp.",
            });
        }

        const result = await getMessages(conversationId, userId, { limit, before });

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

export const SendMessageToConversation = async (req: Request, res: Response) => {
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

        const { content } = req.body;
        if (!content || typeof content !== "string" || content.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: "Message content is required.",
            });
        }

        const result = await sendMessageToConversation(conversationId, userId, content.trim());

        if (!result.success) {
            const statusCode = result.message?.includes("denied") || result.message?.includes("no longer available")
                ? 403
                : 400;
            return res.status(statusCode).json(result);
        }

        return res.status(201).json(result);
    } catch (error) {
        console.error("Error in SendMessageToConversation controller:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while sending the message.",
        });
    }
};

export const DeleteConversation = async (req: Request, res: Response) => {
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

        const result = await deleteConversation(conversationId, userId);

        if (!result.success) {
            return res.status(result.message?.includes("denied") ? 403 : 400).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error("Error in DeleteConversation controller:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while deleting the conversation.",
        });
    }
};
export const MarkMessagesAsRead = async (req: Request, res: Response) => {
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

        const result = await markMessagesAsRead(conversationId, userId);

        if (!result.success) {
            return res.status(result.message?.includes("denied") ? 403 : 400).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error("Error in MarkMessagesAsRead controller:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while marking messages as read.",
        });
    }
};
