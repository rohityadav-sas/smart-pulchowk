import { Request, Response } from "express";
import {
    createEventCategory,
    updateEventCategory,
    getEventCategories,
    getEventCategory,
    deleteEventCategory
} from "../services/eventCategories.services.ts";

export async function CreateEventCategory(req: Request, res: Response) {
    try {
        const { clubId, ...categoryData } = req.body;

        if (!clubId) {
            return res.json({
                success: false,
                message: "Club Id is required"
            });
        }

        if (!categoryData.name) {
            return res.json({
                success: false,
                message: "Category name is required"
            });
        }

        const result = await createEventCategory(parseInt(clubId), categoryData);

        return res.json(result);
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

export async function UpdateEventCategory(req: Request, res: Response) {
    try {
        const { categoryId } = req.params;
        const categoryData = req.body;

        if (!categoryId) {
            return res.json({
                success: false,
                message: "Category Id is required"
            });
        }

        const result = await updateEventCategory(parseInt(categoryId), categoryData);

        return res.json(result);
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

export async function GetEventCategories(req: Request, res: Response) {
    try {
        const { clubId } = req.params;

        if (!clubId) {
            return res.json({
                success: false,
                message: "Club Id is required"
            });
        }

        const result = await getEventCategories(parseInt(clubId));

        return res.json(result);
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

export async function GetEventCategory(req: Request, res: Response) {
    try {
        const { categoryId } = req.params;

        if (!categoryId) {
            return res.json({
                success: false,
                message: "Category Id is required"
            });
        }

        const result = await getEventCategory(parseInt(categoryId));

        return res.json(result);
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

export async function DeleteEventCategory(req: Request, res: Response) {
    try {
        const { categoryId } = req.params;

        if (!categoryId) {
            return res.json({
                success: false,
                message: "Category Id is required"
            });
        }

        const result = await deleteEventCategory(parseInt(categoryId));

        return res.json(result);
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}
