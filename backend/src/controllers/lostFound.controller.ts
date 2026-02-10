import type { Request, Response } from "express";
import {
  addLostFoundImage,
  createClaimRequest,
  createLostFoundItem,
  deleteLostFoundImage,
  deleteLostFoundItem,
  getLostFoundItemById,
  getMyLostFoundClaims,
  getMyLostFoundItems,
  listClaimsForOwnerItem,
  listLostFoundItems,
  markItemStatus,
  setClaimStatus,
  updateLostFoundItem,
} from "../services/lostFound.service.js";
import { deleteImage, uploadImage } from "../services/cloudinary.service.js";
import { sendToTopic } from "../services/notification.service.js";

function getAuth(req: Request) {
  const authUser = (req as any).user as { id: string; role?: string } | undefined;
  return { userId: authUser?.id, role: authUser?.role };
}

export async function ListLostFoundItems(req: Request, res: Response) {
  try {
    const result = await listLostFoundItems({
      itemType: req.query.itemType as "lost" | "found" | undefined,
      category: req.query.category as any,
      status: req.query.status as any,
      q: (req.query.q as string | undefined)?.trim(),
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      cursor: (req.query.cursor as string | undefined) ?? null,
    });
    return res.json(result);
  } catch (error) {
    console.error("Error in ListLostFoundItems controller:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to list lost/found items." });
  }
}

export async function GetLostFoundItem(req: Request, res: Response) {
  try {
    const itemId = Number(req.params.id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid item id." });
    }
    const { userId } = getAuth(req);
    const result = await getLostFoundItemById(itemId, userId);
    if (!result.success) return res.status(404).json(result);
    return res.json(result);
  } catch (error) {
    console.error("Error in GetLostFoundItem controller:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load lost/found item." });
  }
}

export async function CreateLostFoundItem(req: Request, res: Response) {
  try {
    const { userId, role } = getAuth(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const result = await createLostFoundItem(userId, role, req.body || {});
    if (!result.success) return res.status(400).json(result);

    if (result.data) {
      sendToTopic("lost_found", {
        title: `New ${result.data.itemType} item: ${result.data.title}`,
        body: `A new ${result.data.category} item was reported as ${result.data.itemType}.`,
        data: {
          type: "lost_found_published",
          itemId: result.data.id.toString(),
          itemType: result.data.itemType,
          iconKey: "search",
        },
      });
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error("Error in CreateLostFoundItem controller:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create lost/found item." });
  }
}

export async function UpdateLostFoundItem(req: Request, res: Response) {
  try {
    const itemId = Number(req.params.id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid item id." });
    }
    const { userId, role } = getAuth(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const result = await updateLostFoundItem(itemId, userId, role, req.body || {});
    if (!result.success) {
      const statusCode = result.message?.toLowerCase().includes("authorized") ? 403 : 400;
      return res.status(statusCode).json(result);
    }
    return res.json(result);
  } catch (error) {
    console.error("Error in UpdateLostFoundItem controller:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update lost/found item." });
  }
}

export async function DeleteLostFoundItem(req: Request, res: Response) {
  try {
    const itemId = Number(req.params.id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid item id." });
    }
    const { userId, role } = getAuth(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const result = await deleteLostFoundItem(itemId, userId, role);
    if (!result.success) {
      const statusCode = result.message?.toLowerCase().includes("authorized") ? 403 : 400;
      return res.status(statusCode).json(result);
    }
    return res.json(result);
  } catch (error) {
    console.error("Error in DeleteLostFoundItem controller:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete lost/found item." });
  }
}

export async function AddLostFoundImage(req: Request, res: Response) {
  try {
    const itemId = Number(req.params.id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid item id." });
    }
    const { userId, role } = getAuth(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({ success: false, message: "Image file is required." });
    }

    const uploaded = await uploadImage(file.buffer, "lost-found");
    if (!uploaded.success || !uploaded.url) {
      return res.status(400).json({ success: false, message: uploaded.message || "Upload failed." });
    }

    const result = await addLostFoundImage(
      itemId,
      userId,
      role,
      uploaded.url,
      uploaded.publicId || null,
    );
    if (!result.success) {
      if (uploaded.publicId) {
        await deleteImage(uploaded.publicId).catch(() => null);
      }
      const statusCode = result.message?.toLowerCase().includes("authorized") ? 403 : 400;
      return res.status(statusCode).json(result);
    }
    return res.status(201).json(result);
  } catch (error) {
    console.error("Error in AddLostFoundImage controller:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to upload image." });
  }
}

export async function DeleteLostFoundImage(req: Request, res: Response) {
  try {
    const itemId = Number(req.params.id);
    const imageId = Number(req.params.imageId);
    if (!Number.isInteger(itemId) || itemId <= 0 || !Number.isInteger(imageId) || imageId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid id." });
    }
    const { userId, role } = getAuth(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const result = await deleteLostFoundImage(itemId, imageId, userId, role);
    if (!result.success) {
      const statusCode = result.message?.toLowerCase().includes("authorized") ? 403 : 400;
      return res.status(statusCode).json(result);
    }

    const deleted = result.data as { cloudinaryPublicId?: string | null } | undefined;
    if (deleted?.cloudinaryPublicId) {
      await deleteImage(deleted.cloudinaryPublicId).catch(() => null);
    }
    return res.json(result);
  } catch (error) {
    console.error("Error in DeleteLostFoundImage controller:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete image." });
  }
}

export async function CreateLostFoundClaim(req: Request, res: Response) {
  try {
    const itemId = Number(req.params.id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid item id." });
    }
    const { userId, role } = getAuth(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const result = await createClaimRequest(
      itemId,
      userId,
      role,
      (req.body?.message as string) || "",
    );
    if (!result.success) return res.status(400).json(result);
    return res.status(201).json(result);
  } catch (error) {
    console.error("Error in CreateLostFoundClaim controller:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create claim request." });
  }
}

export async function ListOwnerItemClaims(req: Request, res: Response) {
  try {
    const itemId = Number(req.params.id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid item id." });
    }
    const { userId, role } = getAuth(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const result = await listClaimsForOwnerItem(itemId, userId, role);
    if (!result.success) {
      const statusCode = result.message?.toLowerCase().includes("forbidden") ? 403 : 400;
      return res.status(statusCode).json(result);
    }
    return res.json(result);
  } catch (error) {
    console.error("Error in ListOwnerItemClaims controller:", error);
    return res.status(500).json({ success: false, message: "Failed to list claims." });
  }
}

export async function UpdateClaimStatus(req: Request, res: Response) {
  try {
    const itemId = Number(req.params.id);
    const claimId = Number(req.params.claimId);
    if (!Number.isInteger(itemId) || itemId <= 0 || !Number.isInteger(claimId) || claimId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid id." });
    }
    const { userId, role } = getAuth(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const status = req.body?.status as "accepted" | "rejected" | "cancelled" | undefined;
    if (!status || !["accepted", "rejected", "cancelled"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid claim status." });
    }

    const result = await setClaimStatus(itemId, claimId, userId, role, status);
    if (!result.success) {
      const statusCode = result.message?.toLowerCase().includes("forbidden") ? 403 : 400;
      return res.status(statusCode).json(result);
    }
    return res.json(result);
  } catch (error) {
    console.error("Error in UpdateClaimStatus controller:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update claim status." });
  }
}

export async function UpdateLostFoundItemStatus(req: Request, res: Response) {
  try {
    const itemId = Number(req.params.id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid item id." });
    }
    const { userId, role } = getAuth(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const status = req.body?.status as "open" | "claimed" | "resolved" | "closed" | undefined;
    if (!status || !["open", "claimed", "resolved", "closed"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid item status." });
    }

    const result = await markItemStatus(itemId, userId, role, status);
    if (!result.success) {
      const statusCode = result.message?.toLowerCase().includes("forbidden") ? 403 : 400;
      return res.status(statusCode).json(result);
    }
    return res.json(result);
  } catch (error) {
    console.error("Error in UpdateLostFoundItemStatus controller:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update item status." });
  }
}

export async function GetMyLostFoundItems(req: Request, res: Response) {
  try {
    const { userId, role } = getAuth(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const result = await getMyLostFoundItems(userId, role);
    if (!result.success) return res.status(400).json(result);
    return res.json(result);
  } catch (error) {
    console.error("Error in GetMyLostFoundItems controller:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load your lost/found items." });
  }
}

export async function GetMyLostFoundClaims(req: Request, res: Response) {
  try {
    const { userId, role } = getAuth(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const result = await getMyLostFoundClaims(userId, role);
    if (!result.success) return res.status(400).json(result);
    return res.json(result);
  } catch (error) {
    console.error("Error in GetMyLostFoundClaims controller:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load your claims." });
  }
}
