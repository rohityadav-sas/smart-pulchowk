import express from "express";
import {
    CreateClubProfile,
    createEventDetail,
    GetEventDetails,
    getProfile,
    UpdateClubProfile,
    UpdateEventDetail
} from "../controllers/clubProfiles.controller.ts";
import {
    CreateEventCategory,
    UpdateEventCategory,
    GetEventCategories,
    GetEventCategory,
    DeleteEventCategory
} from "../controllers/eventCategories.controller.ts";


const router = express.Router();

router.post("/club-profile", CreateClubProfile);
router.get("/club-profile/:clubId", getProfile);
router.put("/club-profile/:clubId", UpdateClubProfile);

router.post("/event-details/create-event-details", createEventDetail);
router.put("/event-details/update-eventdetail", UpdateEventDetail);
router.get("/event-details/:eventId", GetEventDetails);


router.post("/event-categories", CreateEventCategory);
router.get("/event-categories/:clubId", GetEventCategories);
router.get("/event-category/:categoryId", GetEventCategory);
router.put("/event-category/:categoryId", UpdateEventCategory);
router.delete("/event-category/:categoryId", DeleteEventCategory);

export default router;
