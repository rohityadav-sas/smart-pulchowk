import { Request, Response } from "express";
import {
    createClubProfile,
    updateClubProfile,
    getClubProfile,
    createExtraEventDetails,
    updateExtraEventDetail,
    getExtraEventDetails
} from "../services/clubProfiles.services.ts";

export async function CreateClubProfile(req: Request, res: Response) {
    try {
        const { clubId, ...profileData } = req.body;

        if (!clubId) {
            return res.json({
                success: false,
                message: "Club Id is required"
            });
        }

        const result = await createClubProfile(
            parseInt(clubId),
            profileData
        )

        if (!result.success) {
            return res.json(result);
        }

        return res.json(result);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

export async function UpdateClubProfile(req: Request, res: Response) {
    try {
        const { clubId } = req.params;
        const profileData = req.body;

        if (!clubId) {
            return res.json({
                success: false,
                message: "Club Id is required"
            });
        }

        const result = await updateClubProfile(
            parseInt(clubId),
            profileData
        );

        if (!result.success) {
            return res.json(result);
        }

        return res.json(result);
    } catch (error) {
        return res.json({
            success: false,
            message: error.message
        })
    }
}

export async function getProfile(req: Request, res: Response) {
    try {
        const { clubId } = req.params;

        if (!clubId) {
            return res.json({
                success: false,
                message: "Club Id is required"
            });
        }

        const result = await getClubProfile(parseInt(clubId));

        return res.json(result);
    } catch (error) {
        return res.json({
            success: false,
            message: error.message
        });
    }
}


export async function createEventDetail(req: Request, res: Response) {
    try {
        const { eventId, ...detailsData } = req.body;

        if (!eventId) {
            return res.json({
                success: false,
                message: "Event Id is required"
            });
        }

        const result = await createExtraEventDetails(
            parseInt(eventId),
            detailsData
        );

        if (!result.success) {
            return res.json(result);
        }

        return res.json(result);
    } catch (error) {
        return res.json({
            success: false,
            message: error.message
        });
    }
}

export async function UpdateEventDetail(req: Request, res: Response) {
    try {
        const { eventId, ...detailsData } = req.body;

        if (!eventId) {
            return res.json({
                success: false,
                message: "Event id is required"
            })
        }

        const result = await updateExtraEventDetail(
            parseInt(eventId),
            detailsData
        )
        if (!result.success) {
            return res.json(result);
        }

        return res.json(result);
    } catch (error) {
        return res.json({
            success: false,
            message: error.message
        });
    }
}

export async function GetEventDetails(req: Request, res: Response) {
    try {
        const { eventId } = req.params;

        if (!eventId) {
            return res.json({
                success: false,
                message: "Event Id is required"
            });
        }

        const result = await getExtraEventDetails(parseInt(eventId));

        return res.json(result);
    } catch (error) {
        return res.json({
            success: false,
            message: error.message
        })
    }
}

