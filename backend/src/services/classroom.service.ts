import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import fs from "fs";
import { db } from "../lib/db.js";
import {
  assignments,
  faculties,
  studentProfiles,
  submissions,
  subjects,
  teacherSubjects,
} from "../models/classroom-schema.js";
import {
  UPLOAD_CONSTANTS,
  generatePublicId,
} from "../config/cloudinary.js";
import {
  deleteFileFromCloudinary,
  uploadAssignmentFileToCloudinary,
} from "./cloudinary.service.js";
import { sendToTopic, sendToUser } from "./notification.service.js";

const { ASSIGNMENT_FILES, FOLDERS } = UPLOAD_CONSTANTS;

type SyllabusSubject = {
  semesterNumber: number;
  code?: string | null;
  title: string;
  isElective: boolean;
  electiveGroup?: string | null;
};

type SyllabusFaculty = {
  name: string;
  slug: string;
  semestersCount?: number;
  semesterDurationMonths?: number;
  subjects: SyllabusSubject[];
};

type SyllabusData = {
  faculties: SyllabusFaculty[];
};

let cachedSyllabus: SyllabusData | null = null;

function getSyllabusData(): SyllabusData {
  if (cachedSyllabus) return cachedSyllabus;
  const raw = fs.readFileSync(
    new URL("../data/syllabus.json", import.meta.url),
    "utf-8"
  );
  cachedSyllabus = JSON.parse(raw) as SyllabusData;
  return cachedSyllabus;
}

async function ensureSyllabusSeeded() {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(faculties);
  if (Number(row?.count || 0) > 0) return;

  const data = getSyllabusData();
  for (const facultyData of data.faculties) {
    const [createdFaculty] = await db
      .insert(faculties)
      .values({
        name: facultyData.name,
        slug: facultyData.slug,
        semestersCount: facultyData.semestersCount || 8,
        semesterDurationMonths: facultyData.semesterDurationMonths || 6,
      })
      .returning();

    if (facultyData.subjects.length > 0) {
      await db.insert(subjects).values(
        facultyData.subjects.map((subject) => ({
          facultyId: createdFaculty.id,
          semesterNumber: subject.semesterNumber,
          code: subject.code ?? null,
          title: subject.title,
          isElective: subject.isElective,
          electiveGroup: subject.electiveGroup ?? null,
        }))
      );
    }
  }
}

function addMonths(date: Date, months: number) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

export async function listFaculties() {
  await ensureSyllabusSeeded();
  const result = await db.query.faculties.findMany({
    orderBy: [asc(faculties.name)],
  });
  return { success: true, faculties: result };
}

export async function listSubjectsByFaculty(
  facultyId: number,
  semesterNumber?: number
) {
  await ensureSyllabusSeeded();
  const filters = [eq(subjects.facultyId, facultyId)];
  if (semesterNumber) {
    filters.push(eq(subjects.semesterNumber, semesterNumber));
  }

  const result = await db.query.subjects.findMany({
    where: and(...filters),
    orderBy: [asc(subjects.semesterNumber), asc(subjects.title)],
  });

  return { success: true, subjects: result };
}

export async function getStudentProfile(userId: string) {
  const profile = await db.query.studentProfiles.findFirst({
    where: eq(studentProfiles.userId, userId),
    with: {
      faculty: true,
    },
  });

  if (!profile) {
    return null;
  }

  const now = new Date();
  const durationMonths = profile.faculty?.semesterDurationMonths || 6;
  const maxSemesters = profile.faculty?.semestersCount || 8;

  let currentSemester = profile.currentSemester;
  let semesterStartDate = profile.semesterStartDate;
  let semesterEndDate = profile.semesterEndDate;
  let shouldUpdate = false;

  if (!semesterEndDate) {
    semesterEndDate = addMonths(semesterStartDate, durationMonths);
    shouldUpdate = true;
  }

  if (profile.autoAdvance && semesterEndDate) {
    while (semesterEndDate < now && currentSemester < maxSemesters) {
      currentSemester += 1;
      semesterStartDate = semesterEndDate;
      semesterEndDate = addMonths(semesterStartDate, durationMonths);
      shouldUpdate = true;
    }
  }

  if (shouldUpdate) {
    await db
      .update(studentProfiles)
      .set({
        currentSemester,
        semesterStartDate,
        semesterEndDate,
        updatedAt: now,
      })
      .where(eq(studentProfiles.userId, userId));

    return {
      ...profile,
      currentSemester,
      semesterStartDate,
      semesterEndDate,
    };
  }

  return profile;
}

export async function upsertStudentProfile(
  userId: string,
  data: {
    facultyId: number;
    currentSemester?: number;
    semesterStartDate?: string;
    autoAdvance?: boolean;
  }
) {
  await ensureSyllabusSeeded();
  const faculty = await db.query.faculties.findFirst({
    where: eq(faculties.id, data.facultyId),
  });

  if (!faculty) {
    throw new Error("Faculty not found");
  }

  const now = new Date();
  const existing = await db.query.studentProfiles.findFirst({
    where: eq(studentProfiles.userId, userId),
  });

  const currentSemester = Math.min(
    Math.max(data.currentSemester ?? existing?.currentSemester ?? 1, 1),
    faculty.semestersCount
  );
  const semesterStartDate = data.semesterStartDate
    ? new Date(data.semesterStartDate)
    : existing?.semesterStartDate ?? now;
  const semesterEndDate = addMonths(
    semesterStartDate,
    faculty.semesterDurationMonths
  );

  if (existing) {
    await db
      .update(studentProfiles)
      .set({
        facultyId: faculty.id,
        currentSemester,
        semesterStartDate,
        semesterEndDate,
        autoAdvance: data.autoAdvance ?? existing.autoAdvance ?? true,
        updatedAt: now,
      })
      .where(eq(studentProfiles.userId, userId));
  } else {
    await db.insert(studentProfiles).values({
      userId,
      facultyId: faculty.id,
      currentSemester,
      semesterStartDate,
      semesterEndDate,
      autoAdvance: data.autoAdvance ?? true,
      updatedAt: now,
    });
  }

  const profile = await db.query.studentProfiles.findFirst({
    where: eq(studentProfiles.userId, userId),
    with: { faculty: true },
  });

  return { success: true, profile };
}

export async function getStudentSubjects(userId: string) {
  await ensureSyllabusSeeded();
  const profile = await getStudentProfile(userId);

  if (!profile) {
    return {
      success: false,
      message: "Student profile not found",
    };
  }

  const subjectList = await db.query.subjects.findMany({
    where: and(
      eq(subjects.facultyId, profile.facultyId),
      eq(subjects.semesterNumber, profile.currentSemester)
    ),
    orderBy: [asc(subjects.title)],
  });

  const subjectIds = subjectList.map((subject) => subject.id);
  const assignmentList =
    subjectIds.length === 0
      ? []
      : await db.query.assignments.findMany({
        where: inArray(assignments.subjectId, subjectIds),
        orderBy: [desc(assignments.createdAt)],
      });

  const assignmentIds = assignmentList.map((assignment) => assignment.id);
  const submissionList =
    assignmentIds.length === 0
      ? []
      : await db.query.submissions.findMany({
        where: and(
          inArray(submissions.assignmentId, assignmentIds),
          eq(submissions.studentId, userId)
        ),
      });

  const submissionsByAssignment = new Map(
    submissionList.map((submission) => [submission.assignmentId, submission])
  );

  const assignmentsBySubject = new Map<number, any[]>();
  assignmentList.forEach((assignment) => {
    const bucket = assignmentsBySubject.get(assignment.subjectId) || [];
    bucket.push({
      ...assignment,
      submission: submissionsByAssignment.get(assignment.id) || null,
    });
    assignmentsBySubject.set(assignment.subjectId, bucket);
  });

  const subjectsWithAssignments = subjectList.map((subject) => ({
    ...subject,
    assignments: assignmentsBySubject.get(subject.id) || [],
  }));

  return {
    success: true,
    profile,
    subjects: subjectsWithAssignments,
  };
}

export async function listTeacherSubjects(teacherId: string) {
  await ensureSyllabusSeeded();
  const teacherRows = await db.query.teacherSubjects.findMany({
    where: eq(teacherSubjects.teacherId, teacherId),
    with: {
      subject: {
        with: {
          faculty: true,
        },
      },
    },
  });

  const subjectIds = teacherRows.map((row) => row.subjectId);
  const assignmentList =
    subjectIds.length === 0
      ? []
      : await db.query.assignments.findMany({
        where: inArray(assignments.subjectId, subjectIds),
        orderBy: [desc(assignments.createdAt)],
      });

  const assignmentsBySubject = new Map<number, any[]>();
  assignmentList.forEach((assignment) => {
    const bucket = assignmentsBySubject.get(assignment.subjectId) || [];
    bucket.push(assignment);
    assignmentsBySubject.set(assignment.subjectId, bucket);
  });

  const subjectsWithAssignments = teacherRows.map((row) => ({
    ...row.subject,
    assignments: assignmentsBySubject.get(row.subjectId) || [],
  }));

  return { success: true, subjects: subjectsWithAssignments };
}

export async function addTeacherSubject(
  teacherId: string,
  subjectId: number
) {
  await ensureSyllabusSeeded();
  const subject = await db.query.subjects.findFirst({
    where: eq(subjects.id, subjectId),
  });

  if (!subject) {
    throw new Error("Subject not found");
  }

  const existing = await db.query.teacherSubjects.findFirst({
    where: and(
      eq(teacherSubjects.teacherId, teacherId),
      eq(teacherSubjects.subjectId, subjectId)
    ),
  });

  if (existing) {
    return { success: true };
  }

  await db.insert(teacherSubjects).values({
    teacherId,
    subjectId,
  });

  return { success: true };
}

export async function createAssignmentForSubject(
  teacherId: string,
  subjectId: number,
  data: {
    title: string;
    description?: string;
    type?: "classwork" | "homework";
    dueAt?: string;
  },
  allowUnassigned = false
) {
  const subject = await db.query.subjects.findFirst({
    where: eq(subjects.id, subjectId),
  });

  if (!subject) {
    throw new Error("Subject not found");
  }

  if (!allowUnassigned) {
    const assignment = await db.query.teacherSubjects.findFirst({
      where: and(
        eq(teacherSubjects.teacherId, teacherId),
        eq(teacherSubjects.subjectId, subjectId)
      ),
    });

    if (!assignment) {
      throw new Error("You are not assigned to this subject");
    }
  }

  const [created] = await db
    .insert(assignments)
    .values({
      subjectId,
      teacherId,
      title: data.title,
      description: data.description,
      type: data.type || "classwork",
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
    })
    .returning();

  // Notify students in the faculty (non-blocking)
  // We use the faculty ID to target students: 'faculty_1', 'faculty_2', etc.
  sendToTopic(`faculty_${subject.facultyId}`, {
    title: 'New Assignment!',
    body: `A new ${data.type || 'classwork'} was posted for ${subject.title}: ${created.title}`,
    data: {
      type: 'new_assignment',
      assignmentId: created.id.toString(),
      subjectId: subjectId.toString(),
    }
  }).catch(err => console.error('Failed to send assignment notification:', err));

  return { success: true, assignment: created };
}

export async function submitAssignmentWork(
  assignmentId: number,
  studentId: string,
  file: Express.Multer.File,
  comment?: string
) {
  if (!file) {
    throw new Error("Submission file is required");
  }

  if (!ASSIGNMENT_FILES.ALLOWED_TYPES.includes(file.mimetype as any)) {
    throw new Error("Only images or PDF files are allowed");
  }

  if (file.size > ASSIGNMENT_FILES.MAX_FILE_SIZE) {
    throw new Error("File too large. Maximum size is 10MB");
  }

  const assignment = await db.query.assignments.findFirst({
    where: eq(assignments.id, assignmentId),
    with: {
      subject: true,
    },
  });

  if (!assignment) {
    throw new Error("Assignment not found");
  }

  const profile = await getStudentProfile(studentId);

  if (!profile) {
    throw new Error("Student profile not found");
  }

  if (assignment.subject.facultyId !== profile.facultyId) {
    throw new Error("You are not enrolled in this faculty");
  }

  if (assignment.subject.semesterNumber !== profile.currentSemester) {
    throw new Error("This assignment is not in your current semester");
  }

  const existingSubmission = await db.query.submissions.findFirst({
    where: and(
      eq(submissions.assignmentId, assignmentId),
      eq(submissions.studentId, studentId)
    ),
  });

  if (existingSubmission?.filePublicId) {
    await deleteFileFromCloudinary(
      existingSubmission.filePublicId,
      existingSubmission.fileResourceType
    );
  }

  const base64 = file.buffer.toString("base64");
  const dataUri = `data:${file.mimetype};base64,${base64}`;
  const publicId = generatePublicId(
    "submission",
    `${assignmentId}_${studentId}`
  );

  const uploadResult = await uploadAssignmentFileToCloudinary(
    dataUri,
    FOLDERS.ASSIGNMENT_SUBMISSIONS,
    publicId
  );

  if (!uploadResult.success || !uploadResult.data) {
    throw new Error(uploadResult.message || "Upload failed");
  }

  const now = new Date();

  if (existingSubmission) {
    const [updated] = await db
      .update(submissions)
      .set({
        comment: comment ?? existingSubmission.comment,
        fileUrl: uploadResult.data.url,
        filePublicId: uploadResult.data.publicId,
        fileResourceType: uploadResult.data.resourceType,
        fileMimeType: file.mimetype,
        fileName: file.originalname,
        fileSize: file.size,
        submittedAt: now,
        updatedAt: now,
      })
      .where(eq(submissions.id, existingSubmission.id))
      .returning();

    return { success: true, submission: updated };
  }

  const [created] = await db
    .insert(submissions)
    .values({
      assignmentId,
      studentId,
      comment: comment || null,
      fileUrl: uploadResult.data.url,
      filePublicId: uploadResult.data.publicId,
      fileResourceType: uploadResult.data.resourceType,
      fileMimeType: file.mimetype,
      fileName: file.originalname,
      fileSize: file.size,
      status: "submitted",
      submittedAt: now,
      updatedAt: now,
    })
    .returning();

  return { success: true, submission: created };
}

export async function listSubmissionsForAssignment(
  assignmentId: number,
  teacherId: string,
  allowUnassigned = false
) {
  const assignment = await db.query.assignments.findFirst({
    where: eq(assignments.id, assignmentId),
  });

  if (!assignment) {
    throw new Error("Assignment not found");
  }

  if (!allowUnassigned) {
    const teacherAccess = await db.query.teacherSubjects.findFirst({
      where: and(
        eq(teacherSubjects.teacherId, teacherId),
        eq(teacherSubjects.subjectId, assignment.subjectId)
      ),
    });

    if (!teacherAccess) {
      throw new Error("You are not assigned to this subject");
    }
  }

  const results = await db.query.submissions.findMany({
    where: eq(submissions.assignmentId, assignmentId),
    with: {
      student: {
        columns: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
    orderBy: [desc(submissions.submittedAt)],
  });

  return { success: true, submissions: results };
}

export async function gradeSubmission(
  submissionId: number,
  teacherId: string,
  gradeData: { status: "graded" | "returned"; feedback?: string }
) {
  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, submissionId),
    with: {
      assignment: {
        with: {
          subject: true,
        },
      },
    },
  });

  if (!submission) {
    throw new Error("Submission not found");
  }

  // Verify teacher has access
  const teacherAccess = await db.query.teacherSubjects.findFirst({
    where: and(
      eq(teacherSubjects.teacherId, teacherId),
      eq(teacherSubjects.subjectId, submission.assignment.subjectId)
    ),
  });

  if (!teacherAccess) {
    throw new Error("You are not authorized to grade this submission");
  }

  const [updated] = await db
    .update(submissions)
    .set({
      status: gradeData.status,
      updatedAt: new Date(),
    })
    .where(eq(submissions.id, submissionId))
    .returning();

  // Notify student (non-blocking)
  sendToUser(submission.studentId, {
    title: gradeData.status === 'graded' ? 'Assignment Graded!' : 'Assignment Returned',
    body: `Your submission for "${submission.assignment.title}" has been ${gradeData.status}.`,
    data: {
      type: 'grading_update',
      assignmentId: submission.assignmentId.toString(),
      status: gradeData.status,
    }
  }).catch(err => console.error('Failed to notify student of grading update:', err));

  return { success: true, submission: updated };
}
