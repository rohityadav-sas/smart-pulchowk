import { relations } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  serial,
  varchar,
  integer,
  text,
  timestamp,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema.js";

export const assignmentTypeEnum = pgEnum("assignment_type", [
  "classwork",
  "homework",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "submitted",
  "graded",
  "returned",
]);

export const faculties = pgTable(
  "faculties",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    code: varchar("code", { length: 20 }),
    semestersCount: integer("semesters_count").default(8).notNull(),
    semesterDurationMonths: integer("semester_duration_months")
      .default(6)
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("faculties_slug_idx").on(table.slug)]
);

export const subjects = pgTable(
  "subjects",
  {
    id: serial("id").primaryKey(),
    facultyId: integer("faculty_id")
      .references(() => faculties.id, { onDelete: "cascade" })
      .notNull(),
    semesterNumber: integer("semester_number").notNull(),
    code: varchar("code", { length: 50 }),
    title: varchar("title", { length: 255 }).notNull(),
    isElective: boolean("is_elective").default(false).notNull(),
    electiveGroup: varchar("elective_group", { length: 50 }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("subjects_faculty_semester_idx").on(
      table.facultyId,
      table.semesterNumber
    ),
    uniqueIndex("subjects_unique_idx").on(
      table.facultyId,
      table.semesterNumber,
      table.title
    ),
  ]
);

export const studentProfiles = pgTable(
  "student_profiles",
  {
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .primaryKey(),
    facultyId: integer("faculty_id")
      .references(() => faculties.id, { onDelete: "restrict" })
      .notNull(),
    currentSemester: integer("current_semester").default(1).notNull(),
    semesterStartDate: timestamp("semester_start_date", { mode: "date" })
      .defaultNow()
      .notNull(),
    semesterEndDate: timestamp("semester_end_date", { mode: "date" }),
    autoAdvance: boolean("auto_advance").default(true).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("student_profiles_faculty_idx").on(table.facultyId)]
);

export const teacherSubjects = pgTable(
  "teacher_subjects",
  {
    id: serial("id").primaryKey(),
    teacherId: text("teacher_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    subjectId: integer("subject_id")
      .references(() => subjects.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("teacher_subjects_unique_idx").on(
      table.teacherId,
      table.subjectId
    ),
    index("teacher_subjects_teacher_idx").on(table.teacherId),
  ]
);

export const assignments = pgTable(
  "assignments",
  {
    id: serial("id").primaryKey(),
    subjectId: integer("subject_id")
      .references(() => subjects.id, { onDelete: "cascade" })
      .notNull(),
    teacherId: text("teacher_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    type: assignmentTypeEnum("type").default("classwork").notNull(),
    dueAt: timestamp("due_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("assignments_subject_idx").on(table.subjectId),
    index("assignments_teacher_idx").on(table.teacherId),
  ]
);

export const submissions = pgTable(
  "submissions",
  {
    id: serial("id").primaryKey(),
    assignmentId: integer("assignment_id")
      .references(() => assignments.id, { onDelete: "cascade" })
      .notNull(),
    studentId: text("student_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    comment: text("comment"),
    fileUrl: varchar("file_url", { length: 500 }).notNull(),
    filePublicId: varchar("file_public_id", { length: 255 }),
    fileResourceType: varchar("file_resource_type", { length: 50 }),
    fileMimeType: varchar("file_mime_type", { length: 100 }),
    fileName: varchar("file_name", { length: 255 }),
    fileSize: integer("file_size"),
    status: submissionStatusEnum("status").default("submitted").notNull(),
    submittedAt: timestamp("submitted_at", { mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("submissions_unique_idx").on(
      table.assignmentId,
      table.studentId
    ),
    index("submissions_assignment_idx").on(table.assignmentId),
    index("submissions_student_idx").on(table.studentId),
  ]
);

export const facultiesRelations = relations(faculties, ({ many }) => ({
  subjects: many(subjects),
  studentProfiles: many(studentProfiles),
}));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  faculty: one(faculties, {
    fields: [subjects.facultyId],
    references: [faculties.id],
  }),
  assignments: many(assignments),
  teacherSubjects: many(teacherSubjects),
}));

export const studentProfilesRelations = relations(
  studentProfiles,
  ({ one }) => ({
    user: one(user, {
      fields: [studentProfiles.userId],
      references: [user.id],
    }),
    faculty: one(faculties, {
      fields: [studentProfiles.facultyId],
      references: [faculties.id],
    }),
  })
);

export const teacherSubjectsRelations = relations(teacherSubjects, ({ one }) => ({
  teacher: one(user, {
    fields: [teacherSubjects.teacherId],
    references: [user.id],
  }),
  subject: one(subjects, {
    fields: [teacherSubjects.subjectId],
    references: [subjects.id],
  }),
}));

export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  subject: one(subjects, {
    fields: [assignments.subjectId],
    references: [subjects.id],
  }),
  teacher: one(user, {
    fields: [assignments.teacherId],
    references: [user.id],
  }),
  submissions: many(submissions),
}));

export const submissionsRelations = relations(submissions, ({ one }) => ({
  assignment: one(assignments, {
    fields: [submissions.assignmentId],
    references: [assignments.id],
  }),
  student: one(user, {
    fields: [submissions.studentId],
    references: [user.id],
  }),
}));
