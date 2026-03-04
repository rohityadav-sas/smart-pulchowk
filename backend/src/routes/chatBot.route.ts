import express from "express";
import { chatAI } from "../controllers/chatBot.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/chat", requireAuth, chatAI);

export default router;