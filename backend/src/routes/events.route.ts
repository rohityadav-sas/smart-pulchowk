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
    DeleteClubLogo,
    UploadEventBanner,
    ExportRegisteredStudents,
    CancelEvent,
    UpdateEvent,
    DeleteEvent
} from "../controllers/event.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";
import multer from "multer";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/create-club", requireAuth, requireAdmin, CreateClub);
router.post("/club/add-admin", requireAuth, addAdmin);
router.post("/club/remove-admin", requireAuth, removeAdmin);
router.get("/club/admins/:clubId", requireAuth, getAdmins);
router.get("/clubs", requireAuth, existingClub);
router.get("/clubs/:clubId", requireAuth, existingClub);
router.put('/clubs/:clubId', requireAuth, UpdateClubInfo);

router.get("/events/:clubId", requireAuth, clubEvents);
router.post("/create-event", requireAuth,CreateEvent)
router.get("/get-upcoming-events",requireAuth, upcomingEvents);
router.get("/all-events",requireAuth,allEvents);
router.post("/register-event",requireAuth, eventRegistration);
router.post("/registered-student",requireAuth, registeredStudent);
router.post("/cancel-registration",requireAuth, cancelRegistration);
router.post("/:eventId/upload-banner", requireAuth, upload.single('banner'), UploadEventBanner); // Generic upload
router.post("/enrollment",requireAuth, eventEnrollment);
router.get("/:eventId/export-students", requireAuth, ExportRegisteredStudents);
router.put("/:eventId/cancel", requireAuth, CancelEvent);
router.put("/:eventId", requireAuth, UpdateEvent);
router.delete("/:eventId", requireAuth, DeleteEvent);


export default router;
