import express from "express";
import {
    CreateClub,
    CreateEvent,
    allEvents,
    cancelRegistration,
    clubEvents,
    eventEnrollment,
    eventRegistration,
    existingClub,
    registeredStudent,
    upcomingEvents,
    addAdmin,
    removeAdmin,
    getAdmins,
    UpdateClubInfo,
    UploadClubLogo,
    DeleteClubLogo
} from "../controllers/event.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";
import multer from "multer";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/create-club", requireAuth, requireAdmin, CreateClub);
router.post("/club/add-admin", requireAuth, addAdmin);
router.post("/club/remove-admin", requireAuth, removeAdmin);
router.get("/club/admins/:clubId", requireAuth, getAdmins);
router.get("/clubs", existingClub);
router.get("/clubs/:clubId", existingClub);
router.put('/clubs/:clubId', requireAuth, UpdateClubInfo);
router.post("/clubs/:clubId/upload-logo", requireAuth, upload.single('logo'), UploadClubLogo);
router.delete("/clubs/:clubId/upload-logo", requireAuth, DeleteClubLogo);

router.get("/events/:clubId", clubEvents);
router.post("/create-event", CreateEvent)
router.get("/get-upcoming-events", upcomingEvents);
router.get("/all-events", allEvents);
router.post("/register-event", eventRegistration);
router.post("/registered-student", registeredStudent);
router.post("/cancel-registration", cancelRegistration);
router.post("/events/upload-banner", requireAuth, upload.single('banner'), UploadClubLogo); // Reusing logic for now or add a new one
router.post("/enrollment", eventEnrollment);


export default router;