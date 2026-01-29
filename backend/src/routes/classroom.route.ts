import express from "express";
import multer from "multer";
import {
  addSubjectForTeacher,
  createAssignment,
  getAssignmentSubmissions,
  getFaculties,
  getMyProfile,
  getMySubjects,
  getSubjects,
  getTeacherSubjects,
  submitAssignment,
  upsertMyProfile,
  gradeStudentSubmission,
} from "../controllers/classroom.controller.js";
import { requireAuth, requireTeacher } from "../middleware/auth.middleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/faculties", getFaculties);
router.get("/subjects", getSubjects);

router.get("/me", requireAuth, getMyProfile);
router.post("/me", requireAuth, upsertMyProfile);
router.get("/me/subjects", requireAuth, getMySubjects);

router.get("/teacher/subjects", requireAuth, requireTeacher, getTeacherSubjects);
router.post("/teacher/subjects", requireAuth, requireTeacher, addSubjectForTeacher);

router.post("/assignments", requireAuth, requireTeacher, createAssignment);
router.post(
  "/assignments/:assignmentId/submissions",
  requireAuth,
  upload.single("file"),
  submitAssignment
);
router.get(
  "/assignments/:assignmentId/submissions",
  requireAuth,
  requireTeacher,
  getAssignmentSubmissions
);

router.put(
  "/submissions/:submissionId/grade",
  requireAuth,
  requireTeacher,
  gradeStudentSubmission
);

export default router;
