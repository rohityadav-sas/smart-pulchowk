import express from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
    SendMessage,
    GetConversations,
    GetMessages,
} from "../controllers/chat.controller.js";

const router = express.Router();

router.post("/send", requireAuth, SendMessage);
router.get("/conversations", requireAuth, GetConversations);
router.get("/conversations/:conversationId/messages", requireAuth, GetMessages);

export default router;
