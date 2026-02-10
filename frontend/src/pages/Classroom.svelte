<script lang="ts">
  import { query as routeQuery } from "@mateothegreat/svelte5-router";
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
    type Assignment,
    type AssignmentSubmission,
    type Subject,
  } from "../lib/api";

  const session = authClient.useSession();
  const sessionUser = $derived(
    $session.data?.user as { role?: string } | undefined,
  );
  const userRole = $derived(sessionUser?.role || "");
  const isTeacher = $derived(userRole === "teacher");
  const isAdmin = $derived(userRole === "admin");
  const isStudent = $derived(userRole === "student");

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
    enabled:
      !!$session.data?.user?.id && isStudent && !!profileQuery.data?.profile,
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

  let teacherAssign = $state({ facultyId: "", semester: "1", subjectId: "" });
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
    const submittedCount = assignments.filter((a) => a.submission).length;
    const pendingCount = assignments.filter((a) => !a.submission).length;
    const overdueCount = assignments.filter(
      (a) => !a.submission && a.dueAt && new Date(a.dueAt).getTime() < now,
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
      (a) => a.type === "classwork",
    ).length;
    const homeworkCount = assignments.filter(
      (a) => a.type === "homework",
    ).length;
    return {
      subjectCount: subjects.length,
      assignmentCount: assignments.length,
      classworkCount,
      homeworkCount,
    };
  });

  let studentView = $state<"todo" | "done" | "subjects">("todo");
  let highlightedSection = $state<string | null>(
    (routeQuery("highlightSection") as string | undefined) || null,
  );

  $effect(() => {
    if (!highlightedSection) return;
  });

  const studentAssignments = $derived.by(() => {
    const subjects = mySubjectsQuery.data?.subjects || [];
    const all = subjects.flatMap((subject) =>
      (subject.assignments || []).map((a) => ({
        ...a,
        subjectTitle: subject.title,
        subjectCode: subject.code,
      })),
    );
    return all.sort((a, b) => {
      if (!a.dueAt && !b.dueAt) return 0;
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    });
  });

  const todoAssignments = $derived(
    studentAssignments.filter((a) => !a.submission),
  );
  const doneAssignments = $derived(
    studentAssignments.filter((a) => !!a.submission),
  );

  function getStatusColor(assignment: any) {
    if (assignment.submission)
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (!assignment.dueAt)
      return "bg-slate-100 text-slate-600 border-slate-200";
    const now = new Date();
    const due = new Date(assignment.dueAt);
    if (due < now) return "bg-rose-100 text-rose-700 border-rose-200";
    const diffHours = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (diffHours < 24) return "bg-amber-100 text-amber-700 border-amber-200";
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  function getStatusText(assignment: any) {
    if (assignment.submission) return "Done";
    if (!assignment.dueAt) return "No Due";
    const now = new Date();
    const due = new Date(assignment.dueAt);
    if (due < now) return "Overdue";
    const diffHours = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (diffHours < 24) return "Due Soon";
    return "Pending";
  }
</script>

<div
  class="min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 lg:px-8 relative overflow-hidden"
>
  <!-- Background -->
  <div
    class="pointer-events-none absolute -top-40 -right-40 h-80 w-80 rounded-full bg-violet-200/20 blur-3xl"
  ></div>
  <div
    class="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-blue-200/15 blur-3xl"
  ></div>

  <div
    class="max-w-5xl mx-auto rounded-2xl {highlightedSection === 'assignments'
      ? 'ring-2 ring-cyan-400 ring-offset-2 px-3 py-3 bg-cyan-50/20 border border-cyan-300 notif-highlight-blink'
      : ''}"
  >
    {#if $session.isPending}
      <div class="flex flex-col items-center justify-center py-20">
        <div class="flex items-center gap-1.5 mb-3">
          <div
            class="h-2 w-2 rounded-full bg-violet-500 animate-bounce"
            style="animation-delay:0ms"
          ></div>
          <div
            class="h-2 w-2 rounded-full bg-blue-500 animate-bounce"
            style="animation-delay:150ms"
          ></div>
          <div
            class="h-2 w-2 rounded-full bg-indigo-500 animate-bounce"
            style="animation-delay:300ms"
          ></div>
        </div>
        <p class="text-xs text-slate-500">Loading classroom...</p>
      </div>
    {:else if !$session.data?.user}
      <!-- Sign In Prompt -->
      <div class="max-w-md mx-auto text-center py-16">
        <div
          class="w-16 h-16 rounded-2xl bg-linear-to-br from-violet-500 to-indigo-600 mx-auto flex items-center justify-center mb-5 shadow-lg shadow-violet-200 rotate-3"
        >
          <svg
            class="w-8 h-8 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            /></svg
          >
        </div>
        <h1 class="text-2xl font-black text-slate-900 mb-2">Classroom</h1>
        <p class="text-sm text-slate-500 mb-6 max-w-xs mx-auto">
          Access assignments, subjects, and deadlines in one organized place.
        </p>
        <a
          href="/register"
          class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition shadow-lg shadow-slate-200"
        >
          Get Started
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M17 8l4 4m0 0l-4 4m4-4H3"
            /></svg
          >
        </a>
      </div>
    {:else}
      <!-- Header Badge -->
      <div class="text-center mb-6">
        <div
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-violet-200 shadow-sm"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse"
          ></span>
          <span
            class="text-[10px] font-bold uppercase tracking-wider text-violet-700"
          >
            {isTeacher
              ? "Teacher"
              : isAdmin
                ? "Admin"
                : isStudent
                  ? "Student"
                  : "Classroom"}
          </span>
        </div>
      </div>

      {#if isAdmin}
        <div
          class="max-w-lg mx-auto text-center py-8 px-6 bg-white rounded-2xl border border-slate-200 shadow-sm"
        >
          <div
            class="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-500"
          >
            <svg
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              /></svg
            >
          </div>
          <h2 class="font-bold text-slate-900 mb-1">Admin View</h2>
          <p class="text-sm text-slate-500">
            Admin accounts cannot create or submit classwork. Use a teacher or
            student account.
          </p>
        </div>
      {:else if isStudent}
        <!-- Student Dashboard -->
        {#if profileQuery.isLoading}
          <div class="flex justify-center py-12">
            <div
              class="w-5 h-5 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin"
            ></div>
          </div>
        {:else if !profileQuery.data?.profile}
          <div
            class="max-w-lg mx-auto p-5 bg-amber-50 border border-amber-200 rounded-2xl"
          >
            <div class="flex gap-3">
              <div
                class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 font-bold shrink-0"
              >
                !
              </div>
              <div>
                <h3 class="font-semibold text-amber-900">Profile Pending</h3>
                <p class="text-sm text-amber-700 mt-0.5">
                  Your profile will be created when you sign in with a valid
                  Pulchowk Campus email.
                </p>
              </div>
            </div>
          </div>
        {:else}
          <!-- Stats Grid -->
          <div class="grid grid-cols-4 gap-3 mb-6">
            <div
              class="bg-white rounded-xl border border-slate-100 p-4 text-center shadow-sm hover:shadow-md transition"
            >
              <p class="text-2xl font-black text-violet-600">
                {studentSummary.pendingCount}
              </p>
              <p
                class="text-[10px] font-medium text-slate-500 uppercase tracking-wide mt-0.5"
              >
                To Do
              </p>
            </div>
            <div
              class="bg-white rounded-xl border border-rose-100 p-4 text-center shadow-sm hover:shadow-md transition"
            >
              <p class="text-2xl font-black text-rose-600">
                {studentSummary.overdueCount}
              </p>
              <p
                class="text-[10px] font-medium text-slate-500 uppercase tracking-wide mt-0.5"
              >
                Overdue
              </p>
            </div>
            <div
              class="bg-white rounded-xl border border-emerald-100 p-4 text-center shadow-sm hover:shadow-md transition"
            >
              <p class="text-2xl font-black text-emerald-600">
                {studentSummary.submittedCount}
              </p>
              <p
                class="text-[10px] text-slate-500 font-medium uppercase tracking-wide mt-0.5"
              >
                Done
              </p>
            </div>
            <div
              class="bg-white rounded-xl border border-amber-100 p-4 text-center shadow-sm hover:shadow-md transition"
            >
              <p class="text-2xl font-black text-amber-600">
                {semesterProgress}%
              </p>
              <p
                class="text-[10px] font-medium text-slate-500 uppercase tracking-wide mt-0.5"
              >
                Semester
              </p>
              <div class="w-full bg-slate-100 rounded-full h-1 mt-2">
                <div
                  class="bg-amber-500 h-1 rounded-full"
                  style="width:{semesterProgress}%"
                ></div>
              </div>
            </div>
          </div>

          <!-- View Tabs -->
          <div
            class="flex items-center justify-center gap-1 p-1 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm w-fit mx-auto mb-6 sticky top-4 z-10"
          >
            <button
              class="px-4 py-2 rounded-lg text-xs font-medium transition-all {studentView ===
              'todo'
                ? 'bg-violet-100 text-violet-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}"
              onclick={() => (studentView = "todo")}
            >
              To Do
              {#if todoAssignments.length > 0}<span
                  class="ml-1.5 bg-violet-600 text-white px-1.5 py-0.5 rounded-full text-[9px]"
                  >{todoAssignments.length}</span
                >{/if}
            </button>
            <button
              class="px-4 py-2 rounded-lg text-xs font-medium transition-all {studentView ===
              'done'
                ? 'bg-emerald-100 text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}"
              onclick={() => (studentView = "done")}>Completed</button
            >
            <button
              class="px-4 py-2 rounded-lg text-xs font-medium transition-all {studentView ===
              'subjects'
                ? 'bg-blue-100 text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}"
              onclick={() => (studentView = "subjects")}>My Subjects</button
            >
          </div>

          {#if mySubjectsQuery.isLoading}
            <div class="flex justify-center py-12">
              <div
                class="w-5 h-5 border-2 border-slate-200 border-t-violet-600 rounded-full animate-spin"
              ></div>
            </div>
          {:else if studentView === "subjects"}
            <!-- Subjects Grid -->
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {#each mySubjectsQuery.data?.subjects || [] as subject}
                <div
                  class="group bg-white rounded-xl border border-slate-100 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <p
                    class="text-[9px] font-bold text-violet-600 uppercase tracking-wide"
                  >
                    {subject.code || "Subject"}
                  </p>
                  <h3
                    class="text-sm font-semibold text-slate-900 mt-0.5 line-clamp-2 group-hover:text-violet-600 transition"
                  >
                    {subject.title}
                  </h3>
                  <div
                    class="mt-3 pt-2 border-t border-slate-100 flex justify-between text-[10px]"
                  >
                    <span class="text-slate-500">Pending</span>
                    <span class="font-semibold text-slate-900"
                      >{(subject.assignments || []).filter((a) => !a.submission)
                        .length}</span
                    >
                  </div>
                </div>
              {:else}
                <div
                  class="col-span-full py-8 text-center text-sm text-slate-500 bg-white rounded-xl border border-dashed border-slate-200"
                >
                  No subjects found.
                </div>
              {/each}
            </div>
          {:else}
            <!-- Assignment List -->
            {@const assignmentsToShow =
              studentView === "todo" ? todoAssignments : doneAssignments}
            <div class="space-y-3 max-w-3xl mx-auto">
              {#each assignmentsToShow as assignment}
                <div
                  class="bg-white rounded-xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all"
                >
                  <div class="flex flex-col sm:flex-row gap-3 justify-between">
                    <div class="flex-1 min-w-0">
                      <div class="flex flex-wrap items-center gap-1.5 mb-1">
                        <span
                          class="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600"
                          >{assignment.type === "homework" ? "HW" : "CW"}</span
                        >
                        <span class="text-[10px] text-slate-400">•</span>
                        <span
                          class="text-[10px] font-medium text-slate-500 truncate"
                          >{assignment.subjectTitle}</span
                        >
                        <span
                          class={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded border ${getStatusColor(assignment)}`}
                          >{getStatusText(assignment)}</span
                        >
                      </div>
                      <h3 class="text-sm font-semibold text-slate-900">
                        {assignment.title}
                      </h3>
                      {#if assignment.description}<p
                          class="text-xs text-slate-500 line-clamp-2 mt-0.5"
                        >
                          {assignment.description}
                        </p>{/if}
                      <div
                        class="flex items-center gap-3 mt-2 text-[10px] text-slate-400"
                      >
                        {#if assignment.dueAt}<span
                            class="flex items-center gap-1"
                            ><svg
                              class="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              ><path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                              /></svg
                            >{formatDateTime(assignment.dueAt)}</span
                          >{/if}
                        {#if assignment.submission}<span
                            class="flex items-center gap-1 text-emerald-600"
                            ><svg
                              class="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              ><path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M5 13l4 4L19 7"
                              /></svg
                            >Submitted</span
                          >{/if}
                      </div>
                    </div>
                    <button
                      class="shrink-0 px-4 py-2 text-xs font-medium rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 transition"
                      onclick={() => openSubmission(assignment.id)}
                      >{assignment.submission ? "Resubmit" : "Submit"}</button
                    >
                  </div>

                  {#if activeSubmissionId === assignment.id}
                    <div
                      class="mt-4 pt-4 border-t border-slate-100 bg-slate-50/50 rounded-xl p-4"
                    >
                      <h4 class="text-xs font-semibold text-slate-900 mb-3">
                        Submit Assignment
                      </h4>
                      <div class="space-y-3">
                        <!-- svelte-ignore a11y_label_has_associated_control -->
                        <div>
                          <label
                            class="block text-[10px] font-medium text-slate-500 mb-1.5"
                            >File (Image/PDF)</label
                          >
                          <label
                            class="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer bg-white hover:bg-slate-50 hover:border-violet-300 transition"
                          >
                            <div
                              class="flex flex-col items-center justify-center py-3"
                            >
                              <svg
                                class="w-6 h-6 mb-1 text-slate-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                ><path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="1.5"
                                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                /></svg
                              >
                              {#if submissionFile}<p
                                  class="text-xs font-medium text-violet-600"
                                >
                                  {submissionFile.name}
                                </p>
                                <p class="text-[10px] text-slate-400">
                                  Click to change
                                </p>{:else}<p class="text-xs text-slate-500">
                                  <span class="font-medium text-violet-600"
                                    >Upload</span
                                  > or drag file
                                </p>
                                <p class="text-[10px] text-slate-400">
                                  PNG, JPG, PDF
                                </p>{/if}
                            </div>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              class="hidden"
                              onchange={(e) => {
                                const t = e.target as HTMLInputElement;
                                submissionFile = t.files ? t.files[0] : null;
                              }}
                            />
                          </label>
                        </div>
                        <!-- svelte-ignore a11y_label_has_associated_control -->
                        <div>
                          <label
                            class="block text-[10px] font-medium text-slate-500 mb-1.5"
                            >Comment (Optional)</label
                          >
                          <textarea
                            rows="2"
                            class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-violet-500 focus:ring-violet-500 resize-none"
                            placeholder="Add a note..."
                            bind:value={submissionComment}
                          ></textarea>
                        </div>
                        {#if submissionError}<div
                            class="p-2 bg-rose-50 border border-rose-100 rounded-lg text-[10px] text-rose-600"
                          >
                            {submissionError}
                          </div>{/if}
                        <div class="flex gap-2">
                          <button
                            class="px-4 py-2 text-xs font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition shadow-sm disabled:opacity-50"
                            onclick={() => handleSubmit(assignment)}
                            disabled={submissionLoading}
                            >{submissionLoading
                              ? "Submitting..."
                              : "Turn In"}</button
                          >
                          <button
                            class="px-4 py-2 text-xs font-medium rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
                            onclick={() => (activeSubmissionId = null)}
                            >Cancel</button
                          >
                        </div>
                      </div>
                    </div>
                  {/if}
                </div>
              {:else}
                <div
                  class="flex flex-col items-center py-12 px-4 bg-white rounded-xl border border-dashed border-slate-200"
                >
                  <div
                    class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3"
                  >
                    <svg
                      class="w-5 h-5 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      /></svg
                    >
                  </div>
                  <p class="font-medium text-slate-900">
                    No {studentView === "todo" ? "pending" : "completed"} assignments
                  </p>
                  <p class="text-sm text-slate-500 mt-0.5">
                    You're all caught up!
                  </p>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      {:else if isTeacher}
        <!-- Teacher Dashboard -->
        <!-- Stats -->
        <div class="grid grid-cols-4 gap-3 mb-6">
          <div
            class="bg-white rounded-xl border border-blue-100 p-4 text-center shadow-sm"
          >
            <p class="text-2xl font-black text-blue-600">
              {teacherSummary.subjectCount}
            </p>
            <p
              class="text-[10px] font-medium text-slate-500 uppercase tracking-wide mt-0.5"
            >
              Subjects
            </p>
          </div>
          <div
            class="bg-white rounded-xl border border-indigo-100 p-4 text-center shadow-sm"
          >
            <p class="text-2xl font-black text-indigo-600">
              {teacherSummary.assignmentCount}
            </p>
            <p
              class="text-[10px] font-medium text-slate-500 uppercase tracking-wide mt-0.5"
            >
              Tasks
            </p>
          </div>
          <div
            class="bg-white rounded-xl border border-purple-100 p-4 text-center shadow-sm"
          >
            <p class="text-2xl font-black text-purple-600">
              {teacherSummary.classworkCount}
            </p>
            <p
              class="text-[10px] font-medium text-slate-500 uppercase tracking-wide mt-0.5"
            >
              Classwork
            </p>
          </div>
          <div
            class="bg-white rounded-xl border border-emerald-100 p-4 text-center shadow-sm"
          >
            <p class="text-2xl font-black text-emerald-600">
              {teacherSummary.homeworkCount}
            </p>
            <p
              class="text-[10px] font-medium text-slate-500 uppercase tracking-wide mt-0.5"
            >
              Homework
            </p>
          </div>
        </div>

        <!-- Cards Grid -->
        <div class="grid md:grid-cols-2 gap-4 mb-6">
          <!-- Create Assignment -->
          <div
            class="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm"
          >
            <h2 class="text-sm font-bold text-slate-900 mb-1">
              Create Assignment
            </h2>
            <p class="text-xs text-slate-500 mb-4">
              Post new work for students
            </p>
            <div class="space-y-3">
              {#if assignmentError}<div
                  class="p-2 rounded-lg bg-rose-50 text-rose-700 text-xs border border-rose-100"
                >
                  {assignmentError}
                </div>{/if}
              {#if !teacherSubjectsQuery.isLoading && !teacherSubjectsQuery.data?.subjects?.length}<div
                  class="p-2 rounded-lg bg-amber-50 text-amber-700 text-xs border border-amber-100"
                >
                  Add a subject first.
                </div>{/if}
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <div>
                <label class="text-[10px] font-medium uppercase text-slate-500"
                  >Subject</label
                ><StyledSelect
                  bind:value={assignmentForm.subjectId}
                  placeholder={teacherSubjectsQuery.data?.subjects?.length
                    ? "Select"
                    : "None"}
                  options={(teacherSubjectsQuery.data?.subjects || []).map(
                    (s) => ({ value: String(s.id), label: s.title }),
                  )}
                />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <div>
                  <label
                    class="text-[10px] font-medium uppercase text-slate-500"
                    >Type</label
                  ><StyledSelect
                    bind:value={assignmentForm.type}
                    options={[
                      { value: "classwork", label: "Classwork" },
                      { value: "homework", label: "Homework" },
                    ]}
                  />
                </div>
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <div>
                  <label
                    class="text-[10px] font-medium uppercase text-slate-500"
                    >Due</label
                  ><input
                    type="datetime-local"
                    class="w-full rounded-lg border-slate-200 text-xs py-2"
                    bind:value={assignmentForm.dueAt}
                  />
                </div>
              </div>
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <div>
                <label class="text-[10px] font-medium uppercase text-slate-500"
                  >Title</label
                ><input
                  class="w-full rounded-lg border-slate-200 bg-slate-50 focus:bg-white text-xs py-2 px-3"
                  bind:value={assignmentForm.title}
                  placeholder="Lab Report 1"
                />
              </div>
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <div>
                <label class="text-[10px] font-medium uppercase text-slate-500"
                  >Description</label
                ><textarea
                  rows="2"
                  class="w-full rounded-lg border-slate-200 bg-slate-50 focus:bg-white text-xs py-2 px-3"
                  bind:value={assignmentForm.description}
                  placeholder="Instructions..."
                ></textarea>
              </div>
              <button
                class="w-full py-2.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
                onclick={handleCreateAssignment}
                disabled={assignmentLoading || !assignmentForm.subjectId}
                >{assignmentLoading ? "Publishing..." : "Publish"}</button
              >
            </div>
          </div>

          <!-- Add Subject -->
          <div
            class="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm h-fit"
          >
            <h2 class="text-sm font-bold text-slate-900 mb-1">Add Subject</h2>
            <p class="text-xs text-slate-500 mb-4">Assign yourself to teach</p>
            <div class="space-y-3">
              {#if assignError}<div
                  class="p-2 rounded-lg bg-rose-50 text-rose-700 text-xs border border-rose-100"
                >
                  {assignError}
                </div>{/if}
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <div>
                <label class="text-[10px] font-medium uppercase text-slate-500"
                  >Faculty</label
                ><StyledSelect
                  bind:value={teacherAssign.facultyId}
                  placeholder="Select"
                  options={(facultiesQuery.data?.faculties || []).map((f) => ({
                    value: String(f.id),
                    label: f.name,
                  }))}
                />
              </div>
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <div>
                <label class="text-[10px] font-medium uppercase text-slate-500"
                  >Semester</label
                ><StyledSelect
                  bind:value={teacherAssign.semester}
                  placeholder="Select"
                  options={Array.from(
                    {
                      length:
                        facultiesQuery.data?.faculties?.find(
                          (f) => f.id === Number(teacherAssign.facultyId),
                        )?.semestersCount || 8,
                    },
                    (_, i) => ({
                      value: String(i + 1),
                      label: `Semester ${i + 1}`,
                    }),
                  )}
                />
              </div>
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <div>
                <label class="text-[10px] font-medium uppercase text-slate-500"
                  >Subject</label
                ><StyledSelect
                  bind:value={teacherAssign.subjectId}
                  placeholder={availableSubjects.length
                    ? "Select"
                    : "Choose context"}
                  options={availableSubjects.map((s) => ({
                    value: String(s.id),
                    label: s.title,
                  }))}
                />
              </div>
              <button
                class="w-full py-2.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition shadow-sm disabled:opacity-50"
                onclick={handleAddSubject}
                disabled={assignLoading || !teacherAssign.subjectId}
                >{assignLoading ? "Adding..." : "Add Subject"}</button
              >
            </div>
          </div>
        </div>

        <!-- Subjects List -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-bold text-slate-900">Managed Subjects</h2>
            <span
              class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium"
              >{teacherSummary.subjectCount} Total</span
            >
          </div>

          {#if teacherSubjectsQuery.isLoading}
            <div class="py-8 flex justify-center">
              <div
                class="w-5 h-5 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"
              ></div>
            </div>
          {:else if teacherSubjectsQuery.data?.subjects?.length}
            <div class="space-y-4">
              {#each teacherSubjectsQuery.data.subjects as subject}
                <div
                  class="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm"
                >
                  <div
                    class="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center"
                  >
                    <div>
                      <h3 class="font-semibold text-sm text-slate-900">
                        {subject.title}
                      </h3>
                      <p class="text-[10px] text-slate-500">
                        {subject.code || "NO-CODE"} • Semester {subject.semesterNumber}
                      </p>
                    </div>
                    <span class="text-[10px] font-medium text-slate-500"
                      >{(subject.assignments || []).length} tasks</span
                    >
                  </div>
                  {#if subject.assignments?.length}
                    <div class="p-3 space-y-2">
                      {#each subject.assignments as assignment}
                        <div
                          class="rounded-lg border border-slate-100 p-3 hover:border-blue-200 hover:bg-blue-50/30 transition"
                        >
                          <div class="flex justify-between items-start gap-2">
                            <div>
                              <div class="flex items-center gap-1.5 mb-0.5">
                                <span
                                  class={`text-[9px] uppercase font-medium px-1 py-0.5 rounded border ${assignment.type === "homework" ? "bg-purple-50 text-purple-700 border-purple-100" : "bg-blue-50 text-blue-700 border-blue-100"}`}
                                  >{assignment.type}</span
                                >
                                {#if assignment.dueAt}<span
                                    class="text-[10px] text-slate-500"
                                    >Due {formatDate(assignment.dueAt)}</span
                                  >{/if}
                              </div>
                              <p class="font-medium text-slate-900 text-xs">
                                {assignment.title}
                              </p>
                            </div>
                            <button
                              class="text-[10px] font-medium text-blue-600 hover:underline"
                              onclick={() => toggleSubmissions(assignment.id)}
                              >{submissionsByAssignment[assignment.id]
                                ? "Hide"
                                : "View"}</button
                            >
                          </div>
                          {#if submissionsLoading[assignment.id]}<p
                              class="mt-1 text-[10px] text-slate-400"
                            >
                              Loading...
                            </p>{/if}
                          {#if submissionsByAssignment[assignment.id]}
                            <div
                              class="mt-2 pt-2 border-t border-slate-100 space-y-1.5"
                            >
                              {#if submissionsByAssignment[assignment.id].length === 0}
                                <p class="text-[10px] text-slate-400 italic">
                                  No submissions yet.
                                </p>
                              {:else}
                                {#each submissionsByAssignment[assignment.id] as submission}
                                  <div
                                    class="flex items-center justify-between text-xs bg-slate-50 px-2 py-1.5 rounded-md"
                                  >
                                    <div class="flex items-center gap-1.5">
                                      <div
                                        class="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-medium"
                                      >
                                        {(
                                          submission.student?.name?.[0] || "S"
                                        ).toUpperCase()}
                                      </div>
                                      <div class="flex flex-col">
                                        <span class="font-medium text-slate-900"
                                          >{submission.student?.name ||
                                            submission.studentId}</span
                                        ><span class="text-[9px] text-slate-500"
                                          >{formatDateTime(
                                            submission.submittedAt,
                                          )}</span
                                        >
                                      </div>
                                    </div>
                                    <a
                                      href={submission.fileUrl}
                                      target="_blank"
                                      class="text-[10px] font-medium text-blue-600 hover:underline"
                                      >View</a
                                    >
                                  </div>
                                {/each}
                              {/if}
                            </div>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <div
              class="text-center py-8 bg-white rounded-xl border border-dashed border-slate-200"
            >
              <h3 class="text-sm font-medium text-slate-900 mb-1">
                No subjects assigned
              </h3>
              <p class="text-xs text-slate-500">
                Use "Add Subject" to get started.
              </p>
            </div>
          {/if}
        </div>
      {:else if userRole === "notice_manager"}
        <div
          class="max-w-lg mx-auto text-center py-8 px-6 bg-white rounded-2xl border border-slate-200 shadow-sm"
        >
          <div
            class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3 text-amber-700 font-medium"
          >
            !
          </div>
          <h2 class="font-semibold text-slate-900 mb-1">
            Classroom Not Available
          </h2>
          <p class="text-sm text-slate-500">
            Your account is configured for notice management. Classroom is only
            available to student and teacher roles.
          </p>
        </div>
      {:else}
        <div
          class="max-w-lg mx-auto text-center py-8 px-6 bg-white rounded-2xl border border-slate-200 shadow-sm"
        >
          <div
            class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-500 font-medium"
          >
            i
          </div>
          <h2 class="font-semibold text-slate-900 mb-1">Role Pending</h2>
          <p class="text-sm text-slate-500">
            Your classroom role is being resolved. Please refresh in a moment.
          </p>
        </div>
      {/if}
    {/if}
  </div>
</div>
