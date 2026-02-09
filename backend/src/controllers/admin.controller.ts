import { Request, Response } from "express";
import {
  getAdminDashboardStats,
  getModerationReports,
  listAllBlocksForAdmin,
  listAllRatingsForAdmin,
  listUsersForAdmin,
  setSellerVerificationByAdmin,
  unblockUserByAdmin,
  updateModerationReport,
  updateUserRoleByAdmin,
} from "../services/admin.service.js";
import { type ReportStatus } from "../services/trust.service.js";

const getAdminId = (req: Request): string | null => {
  const authUser = (req as any).user;
  return authUser?.id || null;
};

export const GetAdminOverview = async (_req: Request, res: Response) => {
  try {
    const result = await getAdminDashboardStats();
    return res.json(result);
  } catch (error) {
    console.error("Error in GetAdminOverview controller:", error);
    return res.status(500).json({ success: false, message: "Failed to load admin overview." });
  }
};

export const GetAdminUsers = async (req: Request, res: Response) => {
  try {
    const { search, role, limit } = req.query;

    const result = await listUsersForAdmin({
      search: search as string | undefined,
      role: role as string | undefined,
      limit: limit ? Number(limit) : undefined,
    });

    return res.json(result);
  } catch (error) {
    console.error("Error in GetAdminUsers controller:", error);
    return res.status(500).json({ success: false, message: "Failed to load users." });
  }
};

export const UpdateAdminUserRole = async (req: Request, res: Response) => {
  try {
    const targetUserId = req.params.userId;
    const role = req.body?.role;

    if (!targetUserId || !role) {
      return res.status(400).json({
        success: false,
        message: "userId and role are required.",
      });
    }

    const result = await updateUserRoleByAdmin({ targetUserId, role });
    if (!result.success) return res.status(400).json(result);

    return res.json(result);
  } catch (error) {
    console.error("Error in UpdateAdminUserRole controller:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update user role.",
    });
  }
};

export const ToggleSellerVerification = async (req: Request, res: Response) => {
  try {
    const targetUserId = req.params.userId;
    const verified = Boolean(req.body?.verified);

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: "userId is required." });
    }

    const result = await setSellerVerificationByAdmin({
      targetUserId,
      verified,
    });

    if (!result.success) return res.status(404).json(result);

    return res.json(result);
  } catch (error) {
    console.error("Error in ToggleSellerVerification controller:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update seller verification.",
    });
  }
};

export const GetModerationReports = async (req: Request, res: Response) => {
  try {
    const status = req.query.status as ReportStatus | undefined;
    const result = await getModerationReports(status);
    return res.json(result);
  } catch (error) {
    console.error("Error in GetModerationReports controller:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load moderation reports.",
    });
  }
};

export const UpdateModerationReport = async (req: Request, res: Response) => {
  try {
    const reviewerId = getAdminId(req);
    if (!reviewerId) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const reportId = Number(req.params.reportId);
    const { status, resolutionNotes } = req.body;

    if (!reportId || Number.isNaN(reportId) || !status) {
      return res.status(400).json({
        success: false,
        message: "reportId and status are required.",
      });
    }

    const result = await updateModerationReport({
      reportId,
      reviewerId,
      status,
      resolutionNotes,
    });

    if (!result.success) return res.status(400).json(result);
    return res.json(result);
  } catch (error) {
    console.error("Error in UpdateModerationReport controller:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update moderation report.",
    });
  }
};

export const GetAdminRatings = async (_req: Request, res: Response) => {
  try {
    const result = await listAllRatingsForAdmin();
    return res.json(result);
  } catch (error) {
    console.error("Error in GetAdminRatings controller:", error);
    return res.status(500).json({ success: false, message: "Failed to load ratings." });
  }
};

export const GetAdminBlocks = async (_req: Request, res: Response) => {
  try {
    const result = await listAllBlocksForAdmin();
    return res.json(result);
  } catch (error) {
    console.error("Error in GetAdminBlocks controller:", error);
    return res.status(500).json({ success: false, message: "Failed to load blocks." });
  }
};

export const AdminUnblockUser = async (req: Request, res: Response) => {
  try {
    const blockId = Number(req.params.blockId);
    if (!blockId || Number.isNaN(blockId)) {
      return res.status(400).json({ success: false, message: "blockId is required." });
    }

    const result = await unblockUserByAdmin(blockId);
    if (!result.success) return res.status(404).json(result);

    return res.json(result);
  } catch (error) {
    console.error("Error in AdminUnblockUser controller:", error);
    return res.status(500).json({ success: false, message: "Failed to unblock user." });
  }
};
