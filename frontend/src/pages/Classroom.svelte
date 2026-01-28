<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { authClient } from "../lib/auth-client";
  import StyledSelect from "../components/StyledSelect.svelte";
  import {
    addTeacherSubject,
    createAssignment,
    getAssignmentSubmissions,
    getFaculties,
    getMySubjects,
    getStudentProfile,
    getSubjects,
    getTeacherSubjects,
    submitAssignment,
    upsertStudentProfile,
    type Assignment,
    type AssignmentSubmission,
    type Faculty,
    type Subject,
  } from "../lib/api";

  const session = authClient.useSession();
  const sessionUser = $derived(
    $session.data?.user as { role?: string } | undefined
  );
  const isTeacher = $derived(sessionUser?.role === "teacher");
  const isAdmin = $derived(sessionUser?.role === "admin");
  const isStudent = $derived(!isTeacher && !isAdmin);

  const facultiesQuery = createQuery(() => ({
    queryKey: ["classroom-faculties"],
    queryFn: getFaculties,
    staleTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
  }));

  const profileQuery = createQuery(() => ({
    queryKey: ["classroom-profile", $session.data?.user?.id],
    queryFn: getStudentProfile,
    enabled: !!$session.data?.user?.id && isStudent,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  }));

  const mySubjectsQuery = createQuery(() => ({
    queryKey: ["classroom-subjects", $session.data?.user?.id],
    queryFn: getMySubjects,
    enabled: !!$session.data?.user?.id && isStudent,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
  }));

  const teacherSubjectsQuery = createQuery(() => ({
    queryKey: ["classroom-teacher-subjects", $session.data?.user?.id],
    queryFn: getTeacherSubjects,
    enabled: !!$session.data?.user?.id && isTeacher,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
  }));

  let profileForm = $state({
    facultyId: "",
    currentSemester: "1",
    semesterStartDate: new Date().toISOString().slice(0, 10),
    autoAdvance: true,
  });

  $effect(() => {
    const profile = profileQuery.data?.profile;
    if (!profile) return;
    profileForm.facultyId = String(profile.facultyId);
    profileForm.currentSemester = String(profile.currentSemester);
    profileForm.semesterStartDate = profile.semesterStartDate
      ? new Date(profile.semesterStartDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    profileForm.autoAdvance = profile.autoAdvance ?? true;
  });

  const selectedFaculty = $derived<Faculty | null>(
    facultiesQuery.data?.faculties?.find(
      (faculty) => faculty.id === Number(profileForm.facultyId),
    ) || null,
  );
  let profileSaving = $state(false);
  let profileError = $state<string | null>(null);

  async function saveProfile() {
    profileError = null;
    profileSaving = true;
    try {
      const result = await upsertStudentProfile({
        facultyId: Number(profileForm.facultyId),
        currentSemester: Number(profileForm.currentSemester),
        semesterStartDate: profileForm.semesterStartDate,
        autoAdvance: profileForm.autoAdvance,
      });
      if (!result.success) {
        profileError = result.message || "Failed to save profile.";
      } else {
        await profileQuery.refetch();
        await mySubjectsQuery.refetch();
      }
    } catch (error: any) {
      profileError = error.message;
    } finally {
      profileSaving = false;
    }
  }

  function formatDate(dateStr?: string | null) {
    if (!dateStr) return "No due date";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatDateTime(dateStr?: string | null) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getSemesterProgress() {
    const profile = profileQuery.data?.profile;
    if (!profile?.semesterStartDate || !profile?.semesterEndDate) return 0;
    const start = new Date(profile.semesterStartDate).getTime();
    const end = new Date(profile.semesterEndDate).getTime();
    if (!start || !end || end <= start) return 0;
    const now = Date.now();
    const progress = ((now - start) / (end - start)) * 100;
    return Math.max(0, Math.min(100, Math.round(progress)));
  }

  const semesterProgress = $derived(getSemesterProgress());
  let activeSubmissionId = $state<number | null>(null);
  let submissionFile = $state<File | null>(null);
  let submissionComment = $state("");
  let submissionError = $state<string | null>(null);
  let submissionLoading = $state(false);

  function openSubmission(assignmentId: number) {
    activeSubmissionId = assignmentId;
    submissionFile = null;
    submissionComment = "";
    submissionError = null;
  }

  async function handleSubmit(assignment: Assignment) {
    if (!submissionFile) {
      submissionError = "Please upload an image or PDF file.";
      return;
    }
    submissionError = null;
    submissionLoading = true;
    try {
      const result = await submitAssignment(
        assignment.id,
        submissionFile,
        submissionComment,
      );
      if (!result.success) {
        submissionError = result.message || "Submission failed.";
      } else {
        activeSubmissionId = null;
        await mySubjectsQuery.refetch();
      }
    } catch (error: any) {
      submissionError = error.message;
    } finally {
      submissionLoading = false;
    }
  }
  let teacherAssign = $state({
    facultyId: "",
    semester: "1",
    subjectId: "",
  });
  let availableSubjects = $state<Subject[]>([]);
  let assignError = $state<string | null>(null);
  let assignLoading = $state(false);

  $effect(() => {
    const facultyId = Number(teacherAssign.facultyId);
    const semester = Number(teacherAssign.semester);
    if (!facultyId) {
      availableSubjects = [];
      teacherAssign.subjectId = "";
      return;
    }

    let cancelled = false;
    (async () => {
      const result = await getSubjects(facultyId, semester);
      if (cancelled) return;
      if (result.success) {
        availableSubjects = result.subjects;
        teacherAssign.subjectId = result.subjects[0]
          ? String(result.subjects[0].id)
          : "";
      }
    })();

    return () => {
      cancelled = true;
    };
  });

  async function handleAddSubject() {
    assignError = null;
    assignLoading = true;
    try {
      const result = await addTeacherSubject(Number(teacherAssign.subjectId));
      if (!result.success) {
        assignError = result.message || "Failed to add subject.";
      } else {
        await teacherSubjectsQuery.refetch();
      }
    } catch (error: any) {
      assignError = error.message;
    } finally {
      assignLoading = false;
    }
  }
  let assignmentForm = $state({
    subjectId: "",
    title: "",
    description: "",
    type: "classwork" as "classwork" | "homework",
    dueAt: "",
  });
  let assignmentError = $state<string | null>(null);
  let assignmentLoading = $state(false);

  $effect(() => {
    const subjects = teacherSubjectsQuery.data?.subjects || [];
    if (!assignmentForm.subjectId && subjects.length > 0) {
      assignmentForm.subjectId = String(subjects[0].id);
    }
  });

  async function handleCreateAssignment() {
    assignmentError = null;
    assignmentLoading = true;
    try {
      const result = await createAssignment({
        subjectId: Number(assignmentForm.subjectId),
        title: assignmentForm.title,
        description: assignmentForm.description,
        type: assignmentForm.type,
        dueAt: assignmentForm.dueAt || undefined,
      });

      if (!result.success) {
        assignmentError = result.message || "Failed to create assignment.";
      } else {
        assignmentForm.title = "";
        assignmentForm.description = "";
        assignmentForm.dueAt = "";
        await teacherSubjectsQuery.refetch();
        await mySubjectsQuery.refetch();
      }
    } catch (error: any) {
      assignmentError = error.message;
    } finally {
      assignmentLoading = false;
    }
  }

  let submissionsByAssignment = $state<Record<number, AssignmentSubmission[]>>(
    {},
  );
  let submissionsLoading = $state<Record<number, boolean>>({});

  async function toggleSubmissions(assignmentId: number) {
    if (submissionsByAssignment[assignmentId]) {
      const updated = { ...submissionsByAssignment };
      delete updated[assignmentId];
      submissionsByAssignment = updated;
      return;
    }

    submissionsLoading = { ...submissionsLoading, [assignmentId]: true };
    const result = await getAssignmentSubmissions(assignmentId);
    submissionsLoading = { ...submissionsLoading, [assignmentId]: false };
    if (result.success) {
      submissionsByAssignment = {
        ...submissionsByAssignment,
        [assignmentId]: result.submissions,
      };
    }
  }
  const studentSummary = $derived.by(() => {
    const subjects = mySubjectsQuery.data?.subjects || [];
    const assignments = subjects.flatMap(
      (subject) => subject.assignments || [],
    );
    const now = Date.now();
    const submittedCount = assignments.filter(
      (assignment) => assignment.submission,
    ).length;
    const pendingCount = assignments.filter(
      (assignment) => !assignment.submission,
    ).length;
    const overdueCount = assignments.filter(
      (assignment) =>
        !assignment.submission &&
        assignment.dueAt &&
        new Date(assignment.dueAt).getTime() < now,
    ).length;
    return {
      subjectCount: subjects.length,
      assignmentCount: assignments.length,
      submittedCount,
      pendingCount,
      overdueCount,
    };
  });

  const teacherSummary = $derived.by(() => {
    const subjects = teacherSubjectsQuery.data?.subjects || [];
    const assignments = subjects.flatMap(
      (subject) => subject.assignments || [],
    );
    const classworkCount = assignments.filter(
      (assignment) => assignment.type === "classwork",
    ).length;
    const homeworkCount = assignments.filter(
      (assignment) => assignment.type === "homework",
    ).length;
    return {
      subjectCount: subjects.length,
      assignmentCount: assignments.length,
      classworkCount,
      homeworkCount,
    };
  });
</script>

<div class="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 via-white to-blue-50/40 px-4 py-8 sm:px-6 lg:px-10">
  <div class="max-w-6xl mx-auto space-y-8">
    {#if $session.isPending}
      <div class="flex items-center justify-center py-24">
        <div
          class="w-6 h-6 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"
        ></div>
      </div>
    {:else if !$session.data?.user}
      <div
        class="rounded-2xl border border-slate-200 bg-white/90 p-8 text-center shadow-sm"
      >
        <h2 class="text-xl font-semibold text-slate-900 mb-2">
          Sign in to access Classroom
        </h2>
        <p class="text-slate-500 mb-6">
          Classroom keeps your semester subjects and assignments organized.
        </p>
        <a
          href="/register"
          class="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
          >Sign In</a
        >
      </div>
    {:else}
      <div
        class="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/80 px-6 py-7 shadow-sm sm:px-8 sm:py-10"
      >
        <div
          class="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-blue-200/40 blur-3xl"
        ></div>
        <div
          class="pointer-events-none absolute -left-16 -bottom-20 h-52 w-52 rounded-full bg-emerald-200/30 blur-3xl"
        ></div>
        <div class="relative space-y-6">
          <div class="flex flex-wrap items-start justify-between gap-6">
            <div class="space-y-3">
              <div
                class="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                <span
                  class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700"
                >
                  Classroom
                </span>
                <span
                  class="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600"
                >
                  {isTeacher ? "Teacher" : isAdmin ? "Admin" : "Student"}
                </span>
              </div>
              <h1 class="text-2xl font-semibold text-slate-900 sm:text-3xl">
                {isTeacher
                  ? "Teacher Workspace"
                  : isAdmin
                    ? "Admin Overview"
                    : "Student Workspace"}
              </h1>
              <p class="max-w-2xl text-sm text-slate-600 sm:text-base">
                {isTeacher
                  ? "Post classwork, review submissions, and keep every subject on pace."
                  : isAdmin
                    ? "Classroom features are available for teacher and student accounts only."
                    : "Track your semester subjects, deadlines, and submissions in one place."}
              </p>
            </div>
            {#if !isAdmin}
              {#if isTeacher}
                <div
                  class="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm"
                >
                  <p class="text-xs uppercase tracking-wide text-slate-400">
                    Assigned subjects
                  </p>
                  <p class="text-2xl font-semibold text-slate-900">
                    {teacherSummary.subjectCount}
                  </p>
                  <p class="text-xs text-slate-500">Ready to publish</p>
                </div>
              {:else}
                <div
                  class="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm"
                >
                  <p class="text-xs uppercase tracking-wide text-slate-400">
                    Semester {profileQuery.data?.profile?.currentSemester || "-"}
                  </p>
                  <p class="text-2xl font-semibold text-slate-900">
                    {semesterProgress}%
                  </p>
                  <p class="text-xs text-slate-500">
                    Ends
                    {formatDate(profileQuery.data?.profile?.semesterEndDate)}
                  </p>
                </div>
              {/if}
            {/if}
          </div>

          {#if !isAdmin}
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {#if isTeacher}
                <div
                  class="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 shadow-sm"
                >
                  <p class="text-xs uppercase tracking-wide text-slate-400">
                    Subjects
                  </p>
                  <p class="text-2xl font-semibold text-slate-900">
                    {teacherSummary.subjectCount}
                  </p>
                </div>
                <div
                  class="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 shadow-sm"
                >
                  <p class="text-xs uppercase tracking-wide text-slate-400">
                    Assignments
                  </p>
                  <p class="text-2xl font-semibold text-slate-900">
                    {teacherSummary.assignmentCount}
                  </p>
                </div>
                <div
                  class="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 shadow-sm"
                >
                  <p class="text-xs uppercase tracking-wide text-slate-400">
                    Classwork
                  </p>
                  <p class="text-2xl font-semibold text-slate-900">
                    {teacherSummary.classworkCount}
                  </p>
                </div>
                <div
                  class="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 shadow-sm"
                >
                  <p class="text-xs uppercase tracking-wide text-slate-400">
                    Homework
                  </p>
                  <p class="text-2xl font-semibold text-slate-900">
                    {teacherSummary.homeworkCount}
                  </p>
                </div>
              {:else}
                <div
                  class="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 shadow-sm"
                >
                  <p class="text-xs uppercase tracking-wide text-slate-400">
                    Subjects
                  </p>
                  <p class="text-2xl font-semibold text-slate-900">
                    {studentSummary.subjectCount}
                  </p>
                </div>
                <div
                  class="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 shadow-sm"
                >
                  <p class="text-xs uppercase tracking-wide text-slate-400">
                    Assignments
                  </p>
                  <p class="text-2xl font-semibold text-slate-900">
                    {studentSummary.assignmentCount}
                  </p>
                </div>
                <div
                  class="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 shadow-sm"
                >
                  <p class="text-xs uppercase tracking-wide text-slate-400">
                    Submitted
                  </p>
                  <p class="text-2xl font-semibold text-slate-900">
                    {studentSummary.submittedCount}
                  </p>
                </div>
                <div
                  class="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 shadow-sm"
                >
                  <p class="text-xs uppercase tracking-wide text-slate-400">
                    Overdue
                  </p>
                  <p class="text-2xl font-semibold text-slate-900">
                    {studentSummary.overdueCount}
                  </p>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>

      {#if isAdmin}
        <div
          class="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm"
        >
          <div class="flex items-start gap-4">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600"
            >
              <span class="text-sm font-semibold">i</span>
            </div>
            <div class="space-y-2">
              <h2 class="text-lg font-semibold text-slate-900">
                Admin account
              </h2>
              <p class="text-sm text-slate-600">
                Admin accounts cannot create or submit classwork. Please sign in
                with a teacher account to post assignments or a student account
                to submit work.
              </p>
            </div>
          </div>
        </div>
      {:else if !isTeacher}
        <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
          <div
            class="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm space-y-4"
          >
            <div>
              <h2 class="text-lg font-semibold text-slate-900">
                Semester setup
              </h2>
              <p class="text-sm text-slate-500">
                Choose your faculty and current semester. We will auto-advance
                when the term ends.
              </p>
            </div>

            {#if profileError}
              <div
                class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {profileError}
              </div>
            {/if}

            <div class="grid gap-4 sm:grid-cols-2">
              <label
                class="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Faculty
                <StyledSelect
                  bind:value={profileForm.facultyId}
                  placeholder="Select faculty"
                  options={(facultiesQuery.data?.faculties || []).map(
                    (faculty) => ({
                      value: String(faculty.id),
                      label: faculty.name,
                    }),
                  )}
                />
              </label>
              <label
                class="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Current semester
                <StyledSelect
                  bind:value={profileForm.currentSemester}
                  placeholder="Select semester"
                  options={Array.from(
                    { length: selectedFaculty?.semestersCount || 8 },
                    (_, index) => ({
                      value: String(index + 1),
                      label: `Semester ${index + 1}`,
                    }),
                  )}
                />
              </label>
              <label
                class="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Semester start date
                <input
                  type="date"
                  class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  bind:value={profileForm.semesterStartDate}
                />
              </label>
              <label
                class="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                <input
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-300 text-blue-600"
                  bind:checked={profileForm.autoAdvance}
                />
                Auto-advance semester
              </label>
            </div>

            <button
              class="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              onclick={saveProfile}
              disabled={profileSaving || !profileForm.facultyId}
            >
              {profileSaving ? "Saving..." : "Save semester setup"}
            </button>
          </div>

          {#if profileQuery.data?.profile}
            <div
              class="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm space-y-4"
            >
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p
                    class="text-xs font-semibold uppercase tracking-wide text-slate-400"
                  >
                    Current term
                  </p>
                  <h3 class="text-lg font-semibold text-slate-900">
                    {mySubjectsQuery.data?.profile?.faculty?.name || "Faculty"}
                  </h3>
                  <p class="text-sm text-slate-500">
                    Semester {profileQuery.data.profile.currentSemester} - Ends
                    {formatDate(profileQuery.data.profile.semesterEndDate)}
                  </p>
                </div>
                <div class="text-right">
                  <p class="text-2xl font-semibold text-slate-900">
                    {semesterProgress}%
                  </p>
                  <p class="text-xs text-slate-400">progress</p>
                </div>
              </div>
              <div class="h-2 w-full rounded-full bg-slate-100">
                <div
                  class="h-2 rounded-full bg-blue-500 transition-all"
                  style={`width: ${semesterProgress}%`}
                ></div>
              </div>
              <p class="text-xs text-slate-500">
                Auto-advance is
                {profileQuery.data.profile.autoAdvance
                  ? " enabled."
                  : " disabled."}
              </p>
            </div>
          {:else}
            <div
              class="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm"
            >
              <p class="text-sm text-slate-500">
                Complete your semester setup to see progress and deadlines.
              </p>
            </div>
          {/if}
        </div>

        <div class="space-y-6">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold text-slate-900">
                Your subjects
              </h2>
              <p class="text-sm text-slate-500">
                Classwork and homework posted for your semester.
              </p>
            </div>
            <span
              class="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
            >
              {studentSummary.subjectCount} subjects
            </span>
          </div>

          {#if mySubjectsQuery.isLoading}
            <div class="flex items-center justify-center py-10">
              <div
                class="w-6 h-6 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"
              ></div>
            </div>
          {:else if mySubjectsQuery.data?.subjects?.length}
            {#each mySubjectsQuery.data.subjects as subject}
              <div
                class="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm space-y-4"
              >
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 class="text-lg font-semibold text-slate-900">
                      {subject.title}
                    </h3>
                    <p class="text-sm text-slate-500">
                      {subject.code ? `${subject.code} - ` : ""}Semester
                      {subject.semesterNumber}
                    </p>
                  </div>
                  <span
                    class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
                  >
                    {(subject.assignments || []).length} assignments
                  </span>
                </div>

                {#if subject.assignments?.length}
                  <div class="space-y-3">
                    {#each subject.assignments as assignment}
                      <div
                        class="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                      >
                        <div
                          class="flex flex-wrap items-start justify-between gap-4"
                        >
                          <div class="space-y-2">
                            <div
                              class="flex flex-wrap items-center gap-2 text-xs text-slate-500"
                            >
                              <span
                                class="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-600"
                              >
                                {assignment.type === "homework"
                                  ? "Homework"
                                  : "Classwork"}
                              </span>
                              <span>
                                {assignment.dueAt
                                  ? `Due ${formatDate(assignment.dueAt)}`
                                  : "No due date"}
                              </span>
                            </div>
                            <p class="text-sm font-semibold text-slate-900">
                              {assignment.title}
                            </p>
                            {#if assignment.description}
                              <p class="text-sm text-slate-600">
                                {assignment.description}
                              </p>
                            {/if}
                          </div>
                          <div class="flex flex-col items-end gap-2">
                            {#if assignment.submission}
                              <span
                                class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                                >Submitted</span
                              >
                              <span class="text-xs text-slate-400">
                                {formatDateTime(
                                  assignment.submission.submittedAt,
                                )}
                              </span>
                            {:else if assignment.dueAt && new Date(assignment.dueAt) < new Date()}
                              <span
                                class="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700"
                                >Overdue</span
                              >
                            {:else}
                              <span
                                class="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700"
                                >Not submitted</span
                              >
                            {/if}
                          </div>
                        </div>

                        <div class="mt-3">
                          <button
                            class="text-sm font-semibold text-blue-600 hover:text-blue-700"
                            onclick={() => openSubmission(assignment.id)}
                          >
                            {assignment.submission ? "Resubmit" : "Submit"} work
                          </button>
                        </div>

                        {#if activeSubmissionId === assignment.id}
                          <div
                            class="mt-4 rounded-xl border border-slate-200 bg-white p-4 space-y-3"
                          >
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              class="text-sm text-slate-600"
                              onchange={(event) => {
                                const target = event.target as HTMLInputElement;
                                submissionFile = target.files
                                  ? target.files[0]
                                  : null;
                              }}
                            />
                            <textarea
                              rows="3"
                              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                              placeholder="Add a short note (optional)"
                              bind:value={submissionComment}
                            ></textarea>
                            {#if submissionError}
                              <p class="text-sm text-rose-600">
                                {submissionError}
                              </p>
                            {/if}
                            <div class="flex items-center gap-3">
                              <button
                                class="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                                onclick={() => handleSubmit(assignment)}
                                disabled={submissionLoading}
                              >
                                {submissionLoading
                                  ? "Uploading..."
                                  : "Submit work"}
                              </button>
                              <button
                                class="text-sm font-semibold text-slate-500 hover:text-slate-700"
                                onclick={() => (activeSubmissionId = null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {:else}
                  <p class="text-sm text-slate-500">
                    No classwork or homework has been posted yet.
                  </p>
                {/if}
              </div>
            {/each}
          {:else}
            <div
              class="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm"
            >
              <p class="text-sm text-slate-500">
                No subjects are available yet. Confirm your semester setup or
                check back soon.
              </p>
            </div>
          {/if}
        </div>
      {:else}
        <div class="grid gap-6 lg:grid-cols-2">
          <div
            class="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm space-y-4"
          >
            <div>
              <h2 class="text-lg font-semibold text-slate-900">
                Create assignment
              </h2>
              <p class="text-sm text-slate-500">
                Post classwork or homework for your assigned subjects.
              </p>
            </div>
            {#if assignmentError}
              <div
                class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
              >
                {assignmentError}
              </div>
            {/if}
            {#if !teacherSubjectsQuery.isLoading && !(teacherSubjectsQuery.data?.subjects?.length)}
              <div
                class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700"
              >
                Add a teaching subject first so you can publish assignments.
              </div>
            {/if}
            <label
              class="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Subject
              <StyledSelect
                bind:value={assignmentForm.subjectId}
                placeholder={
                  teacherSubjectsQuery.data?.subjects?.length
                    ? "Select subject"
                    : "Add a subject first"
                }
                options={(teacherSubjectsQuery.data?.subjects || []).map(
                  (subject) => ({
                    value: String(subject.id),
                    label: subject.title,
                  }),
                )}
              />
            </label>
            <label
              class="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Title
              <input
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                bind:value={assignmentForm.title}
                placeholder="Homework 1: Lab report"
              />
            </label>
            <label
              class="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Type
              <StyledSelect
                bind:value={assignmentForm.type}
                options={[
                  { value: "classwork", label: "Classwork" },
                  { value: "homework", label: "Homework" },
                ]}
              />
            </label>
            <label
              class="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Due date
              <input
                type="datetime-local"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                bind:value={assignmentForm.dueAt}
              />
            </label>
            <label
              class="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Description
              <textarea
                rows="4"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                bind:value={assignmentForm.description}
                placeholder="Share instructions or link to materials..."
              ></textarea>
            </label>
            <button
              class="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              onclick={handleCreateAssignment}
              disabled={assignmentLoading || !assignmentForm.subjectId}
            >
              {assignmentLoading ? "Publishing..." : "Publish assignment"}
            </button>
          </div>

          <div
            class="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm space-y-4"
          >
            <div>
              <h2 class="text-lg font-semibold text-slate-900">
                Add teaching subject
              </h2>
              <p class="text-sm text-slate-500">
                Assign yourself to a subject so you can post work.
              </p>
            </div>
            {#if assignError}
              <div
                class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
              >
                {assignError}
              </div>
            {/if}
            <label
              class="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Faculty
              <StyledSelect
                bind:value={teacherAssign.facultyId}
                placeholder="Select faculty"
                options={(facultiesQuery.data?.faculties || []).map(
                  (faculty) => ({
                    value: String(faculty.id),
                    label: faculty.name,
                  }),
                )}
              />
            </label>
            <label
              class="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Semester
              <StyledSelect
                bind:value={teacherAssign.semester}
                placeholder="Select semester"
                options={Array.from(
                  {
                    length:
                      facultiesQuery.data?.faculties?.find(
                        (faculty) => faculty.id === Number(teacherAssign.facultyId),
                      )?.semestersCount || 8,
                  },
                  (_, index) => ({
                    value: String(index + 1),
                    label: `Semester ${index + 1}`,
                  }),
                )}
              />
            </label>
            <label
              class="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Subject
              <StyledSelect
                bind:value={teacherAssign.subjectId}
                placeholder={
                  availableSubjects.length === 0
                    ? "Select faculty and semester"
                    : "Select subject"
                }
                options={availableSubjects.map((subject) => ({
                  value: String(subject.id),
                  label: subject.title,
                }))}
              />
            </label>
            <button
              class="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
              onclick={handleAddSubject}
              disabled={assignLoading || !teacherAssign.subjectId}
            >
              {assignLoading ? "Adding..." : "Add subject"}
            </button>
          </div>
        </div>

        <div class="space-y-6">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold text-slate-900">
                Assigned subjects
              </h2>
              <p class="text-sm text-slate-500">
                Review assignments and check submissions.
              </p>
            </div>
            <span
              class="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
            >
              {teacherSummary.subjectCount} subjects
            </span>
          </div>

          {#if teacherSubjectsQuery.isLoading}
            <div class="flex items-center justify-center py-10">
              <div
                class="w-6 h-6 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"
              ></div>
            </div>
          {:else if teacherSubjectsQuery.data?.subjects?.length}
            {#each teacherSubjectsQuery.data.subjects as subject}
              <div
                class="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm space-y-4"
              >
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 class="text-lg font-semibold text-slate-900">
                      {subject.title}
                    </h3>
                    <p class="text-sm text-slate-500">
                      {subject.code ? `${subject.code} - ` : ""}Semester
                      {subject.semesterNumber}
                    </p>
                  </div>
                  <span
                    class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
                  >
                    {(subject.assignments || []).length} assignments
                  </span>
                </div>
                {#if subject.assignments?.length}
                  <div class="space-y-3">
                    {#each subject.assignments as assignment}
                      <div
                        class="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                      >
                        <div
                          class="flex flex-wrap items-start justify-between gap-4"
                        >
                          <div class="space-y-2">
                            <div
                              class="flex flex-wrap items-center gap-2 text-xs text-slate-500"
                            >
                              <span
                                class="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-600"
                              >
                                {assignment.type === "homework"
                                  ? "Homework"
                                  : "Classwork"}
                              </span>
                              <span>
                                {assignment.dueAt
                                  ? `Due ${formatDate(assignment.dueAt)}`
                                  : "No due date"}
                              </span>
                            </div>
                            <p class="text-sm font-semibold text-slate-900">
                              {assignment.title}
                            </p>
                            {#if assignment.description}
                              <p class="text-sm text-slate-600">
                                {assignment.description}
                              </p>
                            {/if}
                          </div>
                          <button
                            class="text-sm font-semibold text-blue-600 hover:text-blue-700"
                            onclick={() => toggleSubmissions(assignment.id)}
                          >
                            {submissionsByAssignment[assignment.id]
                              ? "Hide submissions"
                              : "View submissions"}
                          </button>
                        </div>

                        {#if submissionsLoading[assignment.id]}
                          <div class="mt-3 text-sm text-slate-500">
                            Loading submissions...
                          </div>
                        {/if}

                        {#if submissionsByAssignment[assignment.id]}
                          <div class="mt-4 space-y-2">
                            {#if submissionsByAssignment[assignment.id].length === 0}
                              <p class="text-sm text-slate-500">
                                No submissions yet.
                              </p>
                            {:else}
                              {#each submissionsByAssignment[assignment.id] as submission}
                                <div
                                  class="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"
                                >
                                  <div>
                                    <p
                                      class="text-sm font-medium text-slate-900"
                                    >
                                      {submission.student?.name ||
                                        submission.studentId}
                                    </p>
                                    <p class="text-xs text-slate-500">
                                      {formatDateTime(submission.submittedAt)}
                                    </p>
                                  </div>
                                  <a
                                    class="text-sm font-semibold text-blue-600 hover:text-blue-700"
                                    href={submission.fileUrl}
                                    target="_blank"
                                    rel="noreferrer">Open file</a
                                  >
                                </div>
                              {/each}
                            {/if}
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {:else}
                  <p class="text-sm text-slate-500">
                    No assignments posted yet for this subject.
                  </p>
                {/if}
              </div>
            {/each}
          {:else}
            <div
              class="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm"
            >
              <p class="text-sm text-slate-500">
                You are not assigned to any subjects yet. Add a subject above to
                start posting classwork.
              </p>
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</div>
