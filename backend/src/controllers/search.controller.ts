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
    const typesParam = (req.query.types as string | undefined)?.trim();
    const validTypes = new Set([
      "clubs",
      "events",
      "books",
      "notices",
      "places",
      "lost_found",
    ]);
    const parsedTypes = typesParam
      ? typesParam
          .split(",")
          .map((type) => type.trim().toLowerCase())
          .filter((type) => validTypes.has(type)) as Array<
            "clubs" | "events" | "books" | "notices" | "places" | "lost_found"
          >
      : undefined;

    const result = await globalSearch({
      query,
      limit,
      userId,
      types: parsedTypes,
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

