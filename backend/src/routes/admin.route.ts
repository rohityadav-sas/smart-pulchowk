import express from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.middleware.js";
import {
  AdminUnblockUser,
  GetAdminBlocks,
  GetAdminOverview,
  GetAdminRatings,
  GetAdminUsers,
  GetModerationReports,
  ToggleSellerVerification,
  UpdateAdminUserRole,
  UpdateModerationReport,
} from "../controllers/admin.controller.js";

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get("/overview", GetAdminOverview);
router.get("/users", GetAdminUsers);
router.put("/users/:userId/role", UpdateAdminUserRole);
router.put("/users/:userId/verify-seller", ToggleSellerVerification);
router.get("/reports", GetModerationReports);
router.put("/reports/:reportId", UpdateModerationReport);
router.get("/ratings", GetAdminRatings);
router.get("/blocks", GetAdminBlocks);
router.delete("/blocks/:blockId", AdminUnblockUser);

export default router;

