import express from "express";
import { requireAuth, requireAdmin, optionalAuth } from "../middleware/auth.middleware.js";
import multer from "multer";


import {
    CreateListing,
    GetListings,
    GetListingById,
    UpdateListing,
    DeleteListing,
    GetMyListings,
    MarkAsSold,
    UploadBookImage,
    DeleteBookImage,
} from "../controllers/bookListings.controller.js";


import {
    SaveBook,
    UnsaveBook,
    GetSavedBooks,
    UpdateNotes,
    CheckIfSaved,
    GetSavedBooksCount,
} from "../controllers/savedBooks.controller.js";


import {
    CreateCategory,
    GetAllCategories,
    GetCategoriesById,
    GetSubCategories,
    UpdateCategory,
    DeleteCategory,
} from "../controllers/bookCategories.controller.js";

import {
    UpsertContactInfo,
    GetContactInfo,
    DeleteContactInfo,
} from "../controllers/sellerContactInfo.controller.js";

import {
    CreatePurchaseRequest,
    GetListingRequests,
    GetMyRequests,
    RespondToRequest,
    GetRequestStatus,
    CancelRequest,
} from "../controllers/purchaseRequest.controller.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", optionalAuth, GetListings);
router.get("/listings/:id", optionalAuth, GetListingById);


router.post("/", requireAuth, CreateListing);
router.get("/my-listings", requireAuth, GetMyListings);
router.put("/listings/:id", requireAuth, UpdateListing);
router.delete("/listings/:id", requireAuth, DeleteListing);
router.put("/listings/:id/mark-sold", requireAuth, MarkAsSold);


router.post("/listings/:id/images", requireAuth, upload.single("image"), UploadBookImage);
router.delete("/listings/:id/images/:imageId", requireAuth, DeleteBookImage);


router.get("/saved", requireAuth, GetSavedBooks);
router.get("/saved/count", requireAuth, GetSavedBooksCount);
router.post("/listings/:id/save", requireAuth, SaveBook);
router.delete("/listings/:id/save", requireAuth, UnsaveBook);
router.get("/listings/:id/is-saved", requireAuth, CheckIfSaved);
router.put("/saved/:id/notes", requireAuth, UpdateNotes);

router.put("/listings/:id/contact-info", requireAuth, UpsertContactInfo);
router.get("/listings/:id/contact-info", requireAuth, GetContactInfo);
router.delete("/listings/:id/contact-info", requireAuth, DeleteContactInfo);

router.post("/listings/:id/request", requireAuth, CreatePurchaseRequest);
router.get("/listings/:id/requests", requireAuth, GetListingRequests);
router.get("/listings/:id/request-status", requireAuth, GetRequestStatus);
router.get("/my-requests", requireAuth, GetMyRequests);
router.put("/requests/:requestId/respond", requireAuth, RespondToRequest);
router.delete("/requests/:requestId", requireAuth, CancelRequest);

router.get("/categories", GetAllCategories);
router.get("/categories/:id", GetCategoriesById);
router.get("/categories/:id/subcategories", GetSubCategories);

router.post("/categories", requireAuth, requireAdmin, CreateCategory);
router.put("/categories/:id", requireAuth, requireAdmin, UpdateCategory);
router.delete("/categories/:id", requireAuth, requireAdmin, DeleteCategory);

export default router;

