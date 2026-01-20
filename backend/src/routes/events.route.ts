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
    UpdateClubInfo
} from "../controllers/event.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/create-club", requireAuth, requireAdmin, CreateClub);
router.post("/club/add-admin", requireAuth, addAdmin);
router.post("/club/remove-admin", requireAuth, removeAdmin);
router.get("/club/admins/:clubId", requireAuth, getAdmins);
router.get("/clubs", existingClub);
router.get("/clubs/:clubId", existingClub);
router.put('/clubs/:clubId', UpdateClubInfo);

router.get("/events/:clubId", clubEvents);
router.post("/create-event", CreateEvent)
router.get("/get-upcoming-events", upcomingEvents);
router.get("/all-events", allEvents);
router.post("/register-event", eventRegistration);
router.post("/registered-student", registeredStudent);
router.post("/cancel-registration", cancelRegistration);
router.post("/enrollment", eventEnrollment);


export default router;