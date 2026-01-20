import { Request, Response } from "express";
import {
    createClub,
    getClubEvents,
    getClubs,
    getUpcomingevents,
    getClubById,
    getAllEvents,
    addClubAdmin,
    removeClubAdmin,
    getClubAdmins,
    updateClubInfo
} from "../services/clubEvents.service.js";
import { createEvent } from "../services/createEvent.service.js";
import {
    cancelEventRegistration,
    getEventRegistrations,
    getStudentActiveRegistration,
    registerStudentForEvent
} from "../services/registerEvent.js";
import { db } from "../lib/db.js";
import { user } from "../models/auth-schema.js";
import { eq } from "drizzle-orm";

export async function getAdmins(req: Request, res: Response) {
    const { clubId } = req.params;
    const result = await getClubAdmins(parseInt(clubId));
    return res.json(result);
}

export async function addAdmin(req: Request, res: Response) {
    const { clubId, email, ownerId } = req.body;
    const result = await addClubAdmin(ownerId, clubId, email);
    return res.json(result);
}

export async function removeAdmin(req: Request, res: Response) {
    const { clubId, userId, ownerId } = req.body;
    const result = await removeClubAdmin(ownerId, clubId, userId);
    return res.json(result);
}

export async function allEvents(req: Request, res: Response) {
    try {
        const result = await getAllEvents();
        return res.json({ data: result });
    } catch (error) {
        return res.json({ message: (error as Error).message });
    }
}

export async function CreateClub(req: Request, res: Response) {
    const { ...clubData } = req.body;

    // Verify email is provided
    if (!clubData.email) {
        return res.status(400).json({ success: false, message: "Email is required to link club to a user" });
    }

    // Look up the user by email to get their ID
    const targetUser = await db.query.user.findFirst({
        where: eq(user.email, clubData.email)
    });

    if (!targetUser) {
        return res.status(404).json({ success: false, message: "User with this email not found. Please ask them to register first." });
    }

    // Use the target user's ID as the authClubId
    const result = await createClub(targetUser.id, clubData);

    return res.json(result);
}

export async function existingClub(req: Request, res: Response) {
    try {
        const { clubId } = req.params;

        if (clubId) {
            const result = await getClubById(parseInt(clubId));
            if (!result) {
                return res.status(404).json({ message: "Club not found" });
            }
            return res.json({ data: result });
        }

        const result = await getClubs();
        return res.json({ data: result })

    } catch (error) {
        return res.json({ message: error.message });
    }

}

export async function UpdateClubInfo(req: Request, res: Response) {
    try{
        const clubId = parseInt(req.params.clubId);
        const clubData = req.body;

        if(!clubId){
            return res.json({message: "clubId must be included"});
        }

        const result = await updateClubInfo(clubId, clubData);

        if (!result.success) {
            return res.status(404).json({
                success: false,
                message: result.message
            });
        }

        return res.json({
            success: true,
            message: result.message
        })

    }catch(error){
        return res.json({message: error.message});
    }
}

export async function clubEvents(req: Request, res: Response) {
    try {
        const { clubId } = req.params;

        if (!clubId) {

            const { clubId: bodyId } = req.body;
            if (bodyId) {

                const result = await getClubEvents(bodyId);
                return res.json({ data: result });
            }
            throw Error("clubId must be included");
        }

        const result = await getClubEvents(parseInt(clubId));

        if (!result) {
            throw Error("No Events yet..")
        }

        return res.json({ data: result });
    } catch (error) {
        return res.json({ message: error.message });
    }
}

export async function CreateEvent(req: Request, res: Response) {
    try {
        const { authId, clubId, ...eventData } = req.body;

        console.log(eventData);
        if (!authId || !clubId || !eventData) {
            throw Error("Id, ClubId and Data are needed");
        }
        const result = await createEvent(authId, parseInt(clubId), eventData);

        return res.json({ data: result });
    } catch (error) {
        return res.json({ message: error.message });
    }
}

export async function upcomingEvents(req: Request, res: Response) {
    try {
        const result = await getUpcomingevents();

        return res.json({ data: result });
    } catch (error) {
        return res.json({ message: error.message });
    }

}

export async function eventRegistration(req: Request, res: Response) {
    try {
        const registerData = req.body;

        if (!registerData) {
            throw Error("Id's are required");
        }

        const result = await registerStudentForEvent(registerData);

        return res.json({ data: result });

    } catch (error) {
        return res.json({ message: error.message });
    }
}

export async function registeredStudent(req: Request, res: Response) {
    try {
        const { eventId } = req.body;

        if (!eventId) {
            throw Error("Id is required");
        }

        const result = await getEventRegistrations(eventId);

        return res.json({ data: result });

    } catch (error) {
        return res.json({ message: error.message });
    }
}

export async function cancelRegistration(req: Request, res: Response) {
    try {
        const eventDetail = req.body;

        if (!eventDetail) {
            throw Error("Detail is required");
        }

        const result = await cancelEventRegistration(eventDetail);

        return res.json({ data: result });

    } catch (error) {
        return res.json({ message: error.message });
    }
}

export async function eventEnrollment(req: Request, res: Response) {
    try {
        const { authStudentId } = req.body;

        if (!authStudentId) {
            throw Error("Login First");
        }

        const result = await getStudentActiveRegistration(authStudentId);

        return res.json({ data: result });
    } catch (error) {
        return res.json({ message: error.message });
    }
}

