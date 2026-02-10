<script lang="ts">
  import { route, query as routeQuery } from "@mateothegreat/svelte5-router";
  import { authClient } from "../lib/auth-client";
  import {
    getEnrollments,
    getMySubjects,
    getNoticeStats,
    getMyBookListings,
    getMyPurchaseRequests,
    getSavedBooks,
    type Registration,
    type Assignment,
    type BookListing,
    type PurchaseRequest,
    type NoticeStats,
  } from "../lib/api";
  import { createQuery } from "@tanstack/svelte-query";
  import { formatEventDate, formatEventTime } from "../lib/event-dates";

  let loading = $state(false);
  let error = $state<string | null>(null);
  const session = authClient.useSession();
  const sessionUser = $derived(
    $session.data?.user as
      | { role?: string; name?: string; email?: string; image?: string }
      | undefined,
  );
  const userRole = $derived(sessionUser?.role || "student");

  // Enrollments query
  const enrollmentsQuery = createQuery(() => ({
    queryKey: ["dashboard-enrollments", $session.data?.user?.id],
    queryFn: async () => {
      if (!$session.data?.user?.id) return [];
      const result = await getEnrollments();
      return result.success && result.registrations
        ? (result.registrations as Registration[])
        : [];
    },
    enabled: !!$session.data?.user?.id,
    staleTime: 1000 * 60,
  }));

  // Subjects + assignments query (for students/teachers)
  const subjectsQuery = createQuery(() => ({
    queryKey: ["dashboard-subjects", $session.data?.user?.id],
    queryFn: async () => {
      if (!$session.data?.user?.id) return { subjects: [] };
      const result = await getMySubjects();
      return result.success
        ? { subjects: result.subjects || [] }
        : { subjects: [] };
    },
    enabled:
      !!$session.data?.user?.id &&
      (userRole === "student" || userRole === "teacher"),
    staleTime: 1000 * 60,
  }));

  // Notice stats query
  const noticeStatsQuery = createQuery(() => ({
    queryKey: ["dashboard-notice-stats"],
    queryFn: async () => {
      const result = await getNoticeStats();
      return result.success && result.data ? result.data : null;
    },
    staleTime: 1000 * 60 * 5,
  }));

  // My book listings
  const myBooksQuery = createQuery(() => ({
    queryKey: ["dashboard-my-books", $session.data?.user?.id],
    queryFn: async () => {
      if (!$session.data?.user?.id) return [];
      const result = await getMyBookListings();
      return result.success && result.data ? result.data : [];
    },
    enabled: !!$session.data?.user?.id,
    staleTime: 1000 * 60,
  }));

  // Purchase requests (books I want to buy)
  const purchaseRequestsQuery = createQuery(() => ({
    queryKey: ["dashboard-purchase-requests", $session.data?.user?.id],
    queryFn: async () => {
      if (!$session.data?.user?.id) return [];
      const result = await getMyPurchaseRequests();
      return result.success && result.data ? result.data : [];
    },
    enabled: !!$session.data?.user?.id,
    staleTime: 1000 * 60,
  }));

  // Saved books
  const savedBooksQuery = createQuery(() => ({
    queryKey: ["dashboard-saved-books", $session.data?.user?.id],
    queryFn: async () => {
      if (!$session.data?.user?.id) return [];
      const result = await getSavedBooks();
      return result.success && result.data ? result.data : [];
    },
    enabled: !!$session.data?.user?.id,
    staleTime: 1000 * 60,
  }));

  // Derived data
  const enrollments = $derived((enrollmentsQuery.data || []) as Registration[]);
  const upcomingEvents = $derived(
    enrollments
      .filter((r) => {
        const t = r.event?.eventStartTime
          ? new Date(r.event.eventStartTime).getTime()
          : NaN;
        return Number.isFinite(t) && t > Date.now();
      })
      .sort(
        (a, b) =>
          new Date(a.event!.eventStartTime).getTime() -
          new Date(b.event!.eventStartTime).getTime(),
      ),
  );

  const allAssignments = $derived.by(() => {
    const subjects = subjectsQuery.data?.subjects || [];
    return subjects.flatMap((s: any) =>
      (s.assignments || []).map((a: Assignment) => ({
        ...a,
        subjectTitle: s.title,
        subjectCode: s.code,
      })),
    );
  });
  const pendingAssignments = $derived(
    allAssignments
      .filter((a: any) => !a.submission)
      .sort((a: any, b: any) => {
        if (!a.dueAt && !b.dueAt) return 0;
        if (!a.dueAt) return 1;
        if (!b.dueAt) return -1;
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      }),
  );

  const myBooks = $derived((myBooksQuery.data || []) as BookListing[]);
  const activeListings = $derived(
    myBooks.filter((b) => b.status === "available"),
  );
  const purchaseRequests = $derived(
    (purchaseRequestsQuery.data || []) as PurchaseRequest[],
  );
  const pendingRequests = $derived(
    purchaseRequests.filter((r) => r.status === "requested"),
  );
  const savedBooks = $derived(savedBooksQuery.data || []);
  const noticeStats = $derived(noticeStatsQuery.data as NoticeStats | null);

  // Urgent items (top 3 most time-sensitive)
  const urgentItems = $derived.by(() => {
    const items: {
      type: "assignment" | "event";
      title: string;
      subtitle: string;
      dueAt: Date;
      href: string;
      urgent: boolean;
    }[] = [];

    // Add upcoming assignments
    pendingAssignments.slice(0, 3).forEach((a: any) => {
      const due = a.dueAt ? new Date(a.dueAt) : null;
      const isUrgent = due && due.getTime() - Date.now() < 24 * 60 * 60 * 1000;
      items.push({
        type: "assignment",
        title: a.title,
        subtitle: a.subjectTitle || "Assignment",
        dueAt: due || new Date(Date.now() + 999999999),
        href: "/classroom",
        urgent: !!isUrgent,
      });
    });

    // Add upcoming events
    upcomingEvents.slice(0, 2).forEach((r) => {
      const start = new Date(r.event!.eventStartTime);
      const isUrgent = start.getTime() - Date.now() < 24 * 60 * 60 * 1000;
      items.push({
        type: "event",
        title: r.event!.title,
        subtitle: r.event?.club?.name || "Event",
        dueAt: start,
        href: `/clubs/${r.event!.clubId}/events/${r.eventId}`,
        urgent: isUrgent,
      });
    });

    return items
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
      .slice(0, 3);
  });

  const handleSignOut = async () => {
    loading = true;
    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            window.location.href = "/";
          },
        },
      });
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  };

  function formatDate(d: Date | string) {
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function formatTimeAgo(d: Date | string) {
    const date = typeof d === "string" ? new Date(d) : d;
    const diff = date.getTime() - Date.now();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `${days}d left`;
    if (hours > 0) return `${hours}h left`;
    if (diff > 0) return "Soon";
    return "Overdue";
  }

  const userInitial = $derived(
    sessionUser?.name?.charAt(0)?.toUpperCase() || "U",
  );

  let activeTab = $state<"assignments" | "events" | "books">("assignments");
  let highlightedSection = $state<string | null>(
    (routeQuery("highlightSection") as string | undefined) || null,
  );

  $effect(() => {
    if (!highlightedSection) return;
  });
</script>

<div
  class="min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 lg:px-8 relative overflow-hidden"
>
  <!-- Background -->
  <div
    class="pointer-events-none absolute -top-32 -right-32 h-64 w-64 rounded-full bg-emerald-200/20 blur-3xl"
  ></div>
  <div
    class="pointer-events-none absolute -bottom-32 -left-32 h-72 w-72 rounded-full bg-cyan-200/15 blur-3xl"
  ></div>

  <div class="max-w-5xl mx-auto">
    {#if $session.isPending}
      <div class="flex flex-col items-center justify-center py-20">
        <div class="flex items-center gap-1.5 mb-3">
          <div
            class="h-2 w-2 rounded-full bg-emerald-500 animate-bounce"
            style="animation-delay:0ms"
          ></div>
          <div
            class="h-2 w-2 rounded-full bg-cyan-500 animate-bounce"
            style="animation-delay:150ms"
          ></div>
          <div
            class="h-2 w-2 rounded-full bg-blue-500 animate-bounce"
            style="animation-delay:300ms"
          ></div>
        </div>
        <p class="text-xs text-slate-500">Loading dashboard...</p>
      </div>
    {:else if !sessionUser}
      <!-- Sign In Prompt -->
      <div class="max-w-md mx-auto text-center py-16">
        <div
          class="w-16 h-16 rounded-2xl bg-linear-to-br from-emerald-500 to-cyan-600 mx-auto flex items-center justify-center mb-5 shadow-lg shadow-emerald-200 rotate-3"
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
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            /></svg
          >
        </div>
        <h1 class="text-2xl font-black text-slate-900 mb-2">Dashboard</h1>
        <p class="text-sm text-slate-500 mb-6 max-w-xs mx-auto">
          Your personal hub for assignments, events, and campus activity.
        </p>
        <a
          href="/register"
          class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition shadow-lg shadow-slate-200"
        >
          Sign In
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
      <!-- User Header -->
      <div
        class="flex flex-wrap items-center justify-between gap-3 mb-6 rounded-2xl {highlightedSection ===
        'overview'
          ? 'ring-2 ring-cyan-400 ring-offset-2 px-3 py-3 bg-cyan-50/30 border border-cyan-300 notif-highlight-blink'
          : ''}"
      >
        <div class="flex items-center gap-3 min-w-0">
          <div
            class="w-12 h-12 rounded-xl overflow-hidden border-2 border-emerald-200 shadow-sm bg-emerald-50"
          >
            {#if sessionUser.image}
              <img
                src={sessionUser.image}
                alt="Avatar"
                class="w-full h-full object-cover"
              />
            {:else}
              <div
                class="w-full h-full flex items-center justify-center text-lg font-bold text-emerald-600"
              >
                {userInitial}
              </div>
            {/if}
          </div>
          <div class="min-w-0">
            <div
              class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 mb-0.5"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span
                class="text-[9px] font-bold uppercase tracking-wider text-emerald-700"
                >{userRole}</span
              >
            </div>
            <h1 class="text-lg font-bold text-slate-900 truncate">
              {sessionUser.name}
            </h1>
          </div>
        </div>
        <button
          onclick={handleSignOut}
          disabled={loading}
          class="px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition"
        >
          {loading ? "Signing out..." : "Sign Out"}
        </button>
      </div>

      {#if error}
        <div
          class="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700"
        >
          {error}
        </div>
      {/if}

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div
          class="bg-white rounded-xl border border-violet-100 p-4 shadow-sm hover:shadow-md transition"
        >
          <p class="text-2xl font-black text-violet-600">
            {pendingAssignments.length}
          </p>
          <p
            class="text-[10px] font-medium text-slate-500 uppercase tracking-wide mt-0.5"
          >
            Pending Tasks
          </p>
        </div>
        <div
          class="bg-white rounded-xl border border-blue-100 p-4 shadow-sm hover:shadow-md transition"
        >
          <p class="text-2xl font-black text-blue-600">
            {upcomingEvents.length}
          </p>
          <p
            class="text-[10px] font-medium text-slate-500 uppercase tracking-wide mt-0.5"
          >
            Upcoming Events
          </p>
        </div>
        <div
          class="bg-white rounded-xl border border-amber-100 p-4 shadow-sm hover:shadow-md transition"
        >
          <p class="text-2xl font-black text-amber-600">
            {noticeStats?.newCount || 0}
          </p>
          <p
            class="text-[10px] font-medium text-slate-500 uppercase tracking-wide mt-0.5"
          >
            New Notices
          </p>
        </div>
        <div
          class="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm hover:shadow-md transition"
        >
          <p class="text-2xl font-black text-emerald-600">
            {activeListings.length}
          </p>
          <p
            class="text-[10px] font-medium text-slate-500 uppercase tracking-wide mt-0.5"
          >
            Book Listings
          </p>
        </div>
      </div>

      <!-- Urgent Items -->
      {#if urgentItems.length > 0}
        <div class="mb-6">
          <h2
            class="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"
          >
            <span class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            Coming Up
          </h2>
          <div class="grid sm:grid-cols-3 gap-3">
            {#each urgentItems as item}
              <a
                href={item.href}
                use:route
                class="bg-white rounded-xl border {item.urgent
                  ? 'border-rose-200 bg-rose-50/30'
                  : 'border-slate-100'} p-4 shadow-sm hover:shadow-md transition group"
              >
                <div class="flex items-start gap-3">
                  <div
                    class="w-8 h-8 rounded-lg {item.type === 'assignment'
                      ? 'bg-violet-100 text-violet-600'
                      : 'bg-blue-100 text-blue-600'} flex items-center justify-center shrink-0"
                  >
                    {#if item.type === "assignment"}
                      <svg
                        class="w-4 h-4"
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
                    {:else}
                      <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        ><path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        /></svg
                      >
                    {/if}
                  </div>
                  <div class="min-w-0 flex-1">
                    <p
                      class="text-xs font-semibold text-slate-900 truncate group-hover:text-violet-600 transition"
                    >
                      {item.title}
                    </p>
                    <p class="text-[10px] text-slate-500 truncate">
                      {item.subtitle}
                    </p>
                    <p
                      class="text-[10px] font-medium {item.urgent
                        ? 'text-rose-600'
                        : 'text-slate-400'} mt-1"
                    >
                      {formatTimeAgo(item.dueAt)}
                    </p>
                  </div>
                </div>
              </a>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Quick Actions -->
      <div class="mb-6">
        <h2 class="text-sm font-bold text-slate-900 mb-3">Quick Actions</h2>
        <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {#if userRole === "student" || userRole === "teacher"}
            <a
              href="/classroom"
              use:route
              class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white border border-slate-100 hover:border-violet-200 hover:bg-violet-50 transition group"
            >
              <div
                class="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center group-hover:scale-110 transition"
              >
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  /></svg
                >
              </div>
              <span class="text-[10px] font-medium text-slate-600"
                >Classroom</span
              >
            </a>
          {/if}
          <a
            href="/events"
            use:route
            class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition group"
          >
            <div
              class="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                /></svg
              >
            </div>
            <span class="text-[10px] font-medium text-slate-600">Events</span>
          </a>
          <a
            href="/books"
            use:route
            class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50 transition group"
          >
            <div
              class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 6.25v13.5m0-13.5c-1.9-1.45-4.5-2.25-7.25-2.25v13.5c2.75 0 5.35.8 7.25 2.25m0-13.5c1.9-1.45 4.5-2.25 7.25-2.25v13.5c-2.75 0-5.35.8-7.25 2.25"
                /></svg
              >
            </div>
            <span class="text-[10px] font-medium text-slate-600">Books</span>
          </a>
          <a
            href="/notices"
            use:route
            class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white border border-slate-100 hover:border-amber-200 hover:bg-amber-50 transition group"
          >
            <div
              class="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center group-hover:scale-110 transition"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                /></svg
              >
            </div>
            <span class="text-[10px] font-medium text-slate-600">Notices</span>
          </a>
          <a
            href="/books/sell"
            use:route
            class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white border border-slate-100 hover:border-pink-200 hover:bg-pink-50 transition group"
          >
            <div
              class="w-8 h-8 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center group-hover:scale-110 transition"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4v16m8-8H4"
                /></svg
              >
            </div>
            <span class="text-[10px] font-medium text-slate-600">Sell Book</span
            >
          </a>
          <a
            href="/map"
            use:route
            class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition group"
          >
            <div
              class="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17.7 8.3A5.7 5.7 0 116.3 8.3c0 4.9 5.7 10.7 5.7 10.7s5.7-5.8 5.7-10.7z"
                /><circle cx="12" cy="8.3" r="2.2"></circle></svg
              >
            </div>
            <span class="text-[10px] font-medium text-slate-600">Map</span>
          </a>
        </div>
      </div>

      <!-- Activity Tabs -->
      <div
        class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"
      >
        <div class="flex border-b border-slate-100">
          <button
            onclick={() => (activeTab = "assignments")}
            class="flex-1 px-4 py-3 text-xs font-medium transition {activeTab ===
            'assignments'
              ? 'text-violet-700 bg-violet-50 border-b-2 border-violet-500'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}"
          >
            Assignments
            {#if pendingAssignments.length > 0}<span
                class="ml-1.5 px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[9px]"
                >{pendingAssignments.length}</span
              >{/if}
          </button>
          <button
            onclick={() => (activeTab = "events")}
            class="flex-1 px-4 py-3 text-xs font-medium transition {activeTab ===
            'events'
              ? 'text-blue-700 bg-blue-50 border-b-2 border-blue-500'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}"
          >
            Events
            {#if upcomingEvents.length > 0}<span
                class="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[9px]"
                >{upcomingEvents.length}</span
              >{/if}
          </button>
          <button
            onclick={() => (activeTab = "books")}
            class="flex-1 px-4 py-3 text-xs font-medium transition {activeTab ===
            'books'
              ? 'text-emerald-700 bg-emerald-50 border-b-2 border-emerald-500'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}"
          >
            Books
            {#if activeListings.length > 0}<span
                class="ml-1.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px]"
                >{activeListings.length}</span
              >{/if}
          </button>
        </div>

        <div class="p-4">
          {#if activeTab === "assignments"}
            {#if subjectsQuery.isLoading}
              <div class="flex justify-center py-8">
                <div
                  class="w-4 h-4 border-2 border-slate-200 border-t-violet-600 rounded-full animate-spin"
                ></div>
              </div>
            {:else if pendingAssignments.length === 0}
              <div class="text-center py-8">
                <div
                  class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2"
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
                      d="M5 13l4 4L19 7"
                    /></svg
                  >
                </div>
                <p class="text-sm font-medium text-slate-900">All caught up!</p>
                <p class="text-xs text-slate-500">No pending assignments</p>
              </div>
            {:else}
              <div class="space-y-2">
                {#each pendingAssignments.slice(0, 5) as assignment}
                  <a
                    href="/classroom"
                    use:route
                    class="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-violet-200 hover:bg-violet-50/50 transition group"
                  >
                    <div
                      class="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center shrink-0"
                    >
                      <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        ><path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        /></svg
                      >
                    </div>
                    <div class="flex-1 min-w-0">
                      <p
                        class="text-xs font-medium text-slate-900 truncate group-hover:text-violet-600"
                      >
                        {assignment.title}
                      </p>
                      <p class="text-[10px] text-slate-500">
                        {assignment.subjectTitle}
                      </p>
                    </div>
                    <div class="text-right shrink-0">
                      <p
                        class="text-[10px] font-medium {assignment.dueAt &&
                        new Date(assignment.dueAt).getTime() <
                          Date.now() + 24 * 60 * 60 * 1000
                          ? 'text-rose-600'
                          : 'text-slate-400'}"
                      >
                        {assignment.dueAt
                          ? formatDate(assignment.dueAt)
                          : "No due date"}
                      </p>
                      <span
                        class="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600"
                        >{assignment.type === "homework" ? "HW" : "CW"}</span
                      >
                    </div>
                  </a>
                {/each}
                {#if pendingAssignments.length > 5}
                  <a
                    href="/classroom"
                    use:route
                    class="block text-center text-xs font-medium text-violet-600 hover:underline py-2"
                    >View all {pendingAssignments.length} assignments â†’</a
                  >
                {/if}
              </div>
            {/if}
          {:else if activeTab === "events"}
            {#if enrollmentsQuery.isLoading}
              <div class="flex justify-center py-8">
                <div
                  class="w-4 h-4 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"
                ></div>
              </div>
            {:else if upcomingEvents.length === 0}
              <div class="text-center py-8">
                <div
                  class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2"
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
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    /></svg
                  >
                </div>
                <p class="text-sm font-medium text-slate-900">
                  No upcoming events
                </p>
                <p class="text-xs text-slate-500">Browse events to register</p>
                <a
                  href="/events"
                  use:route
                  class="inline-block mt-2 text-xs font-medium text-blue-600 hover:underline"
                  >Explore Events â†’</a
                >
              </div>
            {:else}
              <div class="space-y-2">
                {#each upcomingEvents.slice(0, 5) as registration}
                  <a
                    href={`/clubs/${registration.event!.clubId}/events/${registration.eventId}`}
                    use:route
                    class="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition group"
                  >
                    <div
                      class="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"
                    >
                      <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        ><path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        /></svg
                      >
                    </div>
                    <div class="flex-1 min-w-0">
                      <p
                        class="text-xs font-medium text-slate-900 truncate group-hover:text-blue-600"
                      >
                        {registration.event!.title}
                      </p>
                      <p class="text-[10px] text-slate-500">
                        {registration.event?.club?.name || "Event"}
                      </p>
                    </div>
                    <div class="text-right shrink-0">
                      <p class="text-[10px] font-medium text-slate-600">
                        {formatDate(registration.event!.eventStartTime)}
                      </p>
                      <p class="text-[10px] text-slate-400">
                        {formatEventTime(registration.event!.eventStartTime)}
                      </p>
                    </div>
                  </a>
                {/each}
              </div>
            {/if}
          {:else if myBooksQuery.isLoading}
            <div class="flex justify-center py-8">
              <div
                class="w-4 h-4 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin"
              ></div>
            </div>
          {:else}
            <div class="space-y-4">
              <!-- My Listings -->
              <div>
                <h3
                  class="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2"
                >
                  My Listings ({activeListings.length})
                </h3>
                {#if activeListings.length === 0}
                  <div class="text-center py-4 bg-slate-50 rounded-lg">
                    <p class="text-xs text-slate-500">No active listings</p>
                    <a
                      href="/books/sell"
                      use:route
                      class="inline-block mt-1 text-xs font-medium text-emerald-600 hover:underline"
                      >Sell a book â†’</a
                    >
                  </div>
                {:else}
                  <div class="space-y-2">
                    {#each activeListings.slice(0, 3) as book}
                      <a
                        href={`/books/${book.id}`}
                        use:route
                        class="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition group"
                      >
                        <div
                          class="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0"
                        >
                          {#if book.images?.[0]?.imageUrl}
                            <img
                              src={book.images[0].imageUrl}
                              alt={book.title}
                              class="w-full h-full object-cover"
                            />
                          {:else}
                            <div
                              class="w-full h-full flex items-center justify-center text-slate-400"
                            >
                              <svg
                                class="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                ><path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="1.5"
                                  d="M12 6.25v13.5"
                                /></svg
                              >
                            </div>
                          {/if}
                        </div>
                        <div class="flex-1 min-w-0">
                          <p
                            class="text-xs font-medium text-slate-900 truncate group-hover:text-emerald-600"
                          >
                            {book.title}
                          </p>
                          <p class="text-[10px] text-slate-500">
                            {book.author}
                          </p>
                        </div>
                        <p class="text-xs font-bold text-emerald-600">
                          Rs. {book.price}
                        </p>
                      </a>
                    {/each}
                  </div>
                {/if}
              </div>

              <!-- Purchase Requests -->
              {#if pendingRequests.length > 0}
                <div>
                  <h3
                    class="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2"
                  >
                    Pending Requests ({pendingRequests.length})
                  </h3>
                  <div class="space-y-2">
                    {#each pendingRequests.slice(0, 2) as request}
                      <div
                        class="p-3 rounded-lg border border-amber-200 bg-amber-50/50"
                      >
                        <p class="text-xs font-medium text-slate-900">
                          {request.listing?.title || "Book Request"}
                        </p>
                        <p class="text-[10px] text-slate-500">
                          Waiting for seller response
                        </p>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Saved Books -->
              {#if savedBooks.length > 0}
                <div>
                  <h3
                    class="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2"
                  >
                    Saved Books ({savedBooks.length})
                  </h3>
                  <a
                    href="/books/my-books"
                    use:route
                    class="text-xs font-medium text-emerald-600 hover:underline"
                    >View saved books â†’</a
                  >
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
