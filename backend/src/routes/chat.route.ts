import express from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
    SendMessage,
    GetConversations,
    GetMessages,
    DeleteConversation,
    SendMessageToConversation,
    MarkMessagesAsRead,
} from "../controllers/chat.controller.js";

const router = express.Router();

router.post("/send", requireAuth, SendMessage);
router.get("/conversations", requireAuth, GetConversations);
router.get("/conversations/:conversationId/messages", requireAuth, GetMessages);
router.post("/conversations/:conversationId/messages", requireAuth, SendMessageToConversation);
router.delete("/conversations/:conversationId", requireAuth, DeleteConversation);
router.patch("/conversations/:conversationId/read", requireAuth, MarkMessagesAsRead);

export default router;
