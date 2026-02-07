import { Request, Response } from "express";
import { globalSearch } from "../services/search.service.js";

const getUserId = (req: Request): string | undefined => {
  const authUser = (req as any).user;
  return authUser?.id;
};

export const SearchAll = async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string | undefined) ?? "";
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const userId = getUserId(req);

    const result = await globalSearch({
      query,
      limit,
      userId,
    });

    res.setHeader("Vary", "Cookie, Authorization");
    if (userId) {
      res.setHeader("Cache-Control", "private, max-age=15");
    } else {
      res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60");
    }

    return res.json(result);
  } catch (error) {
    console.error("Error in SearchAll controller:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to perform search.",
    });
  }
};

