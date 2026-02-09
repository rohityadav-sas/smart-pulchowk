<script lang="ts">
  import { createQuery, useQueryClient } from "@tanstack/svelte-query";
  import { authClient } from "../lib/auth-client";
  import {
    adminUnblockUser,
    getAdminBlocks,
    getAdminOverview,
    getAdminRatings,
    getAdminUsers,
    getModerationReports,
    toggleSellerVerification,
    updateAdminUserRole,
    updateModerationReport,
    type AdminUser,
    type BlockedUser,
    type MarketplaceReport,
    type SellerRatingReview,
  } from "../lib/api";
  import { fade } from "svelte/transition";
  import LoadingSpinner from "../components/LoadingSpinner.svelte";

  const session = authClient.useSession();
  const queryClient = useQueryClient();

  const sessionRole = $derived(
    ($session.data?.user as any)?.role as string | undefined,
  );
  const isAdmin = $derived(sessionRole === "admin");

  let userSearch = $state("");
  let roleFilter = $state("");
  let reportsFilter = $state<
    "all" | "open" | "in_review" | "resolved" | "rejected"
  >("all");
  let activeTab = $state<"users" | "moderation" | "reviews" | "blocks">(
    "users",
  );

  let busyUserId = $state<string | null>(null);
  let busyReportId = $state<number | null>(null);
  let roleUpdateUserId = $state<string | null>(null);
  let roleStatusByUserId = $state<
    Record<string, { type: "success" | "error"; message: string }>
  >({});

  function setRoleStatus(
    userId: string,
    status: { type: "success" | "error"; message: string } | null,
  ) {
    const next = { ...roleStatusByUserId };
    if (!status) delete next[userId];
    else next[userId] = status;
    roleStatusByUserId = next;
  }

  const overviewQuery = createQuery(() => ({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const result = await getAdminOverview();
      if (result.success && result.data) return result.data;
      throw new Error(result.message || "Failed to load overview");
    },
    enabled: isAdmin,
    staleTime: 1000 * 60,
  }));

  const usersQuery = createQuery(() => ({
    queryKey: ["admin-users", userSearch, roleFilter],
    queryFn: async () => {
      const result = await getAdminUsers({
        search: userSearch.trim() || undefined,
        role: roleFilter || undefined,
        limit: 100,
      });
      if (result.success && result.data) return result.data;
      throw new Error(result.message || "Failed to load users");
    },
    enabled: isAdmin && activeTab === "users",
  }));

  const reportsQuery = createQuery(() => ({
    queryKey: ["admin-reports", reportsFilter],
    queryFn: async () => {
      const result = await getModerationReports(
        reportsFilter === "all" ? undefined : reportsFilter,
      );
      if (result.success && result.data) return result.data;
      throw new Error(result.message || "Failed to load reports");
    },
    enabled: isAdmin && activeTab === "moderation",
  }));

  const ratingsQuery = createQuery(() => ({
    queryKey: ["admin-ratings"],
    queryFn: async () => {
      const result = await getAdminRatings();
      if (result.success && result.data) return result.data;
      throw new Error(result.message || "Failed to load ratings");
    },
    enabled: isAdmin && activeTab === "reviews",
  }));

  const blocksQuery = createQuery(() => ({
    queryKey: ["admin-blocks"],
    queryFn: async () => {
      const result = await getAdminBlocks();
      if (result.success && result.data) return result.data;
      throw new Error(result.message || "Failed to load blocks");
    },
    enabled: isAdmin && activeTab === "blocks",
  }));

  async function handleRoleUpdate(user: AdminUser, role: string) {
    if (role === user.role) return;
    busyUserId = user.id;
    roleUpdateUserId = user.id;
    setRoleStatus(user.id, null);

    const result = await updateAdminUserRole(user.id, role);

    busyUserId = null;
    roleUpdateUserId = null;
    if (result.success) {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      setRoleStatus(user.id, {
        type: "success",
        message: `Role updated to ${role}.`,
      });
      setTimeout(() => setRoleStatus(user.id, null), 3000);
    } else {
      setRoleStatus(user.id, {
        type: "error",
        message: result.message || "Failed to update role.",
      });
    }
  }

  async function handleVerification(user: AdminUser, verified: boolean) {
    busyUserId = user.id;
    const result = await toggleSellerVerification(user.id, verified);
    busyUserId = null;
    if (result.success) {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    } else {
      alert(result.message || "Failed to update verification");
    }
  }

  async function handleModeration(
    report: MarketplaceReport,
    status: MarketplaceReport["status"],
  ) {
    busyReportId = report.id;
    const result = await updateModerationReport(report.id, {
      status,
      resolutionNotes:
        status === "resolved" || status === "rejected"
          ? `Status updated to ${status} via admin panel.`
          : undefined,
    });
    busyReportId = null;
    if (result.success) {
      await queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    } else {
      alert(result.message || "Failed to update report");
    }
  }

  async function handleAdminUnblock(block: BlockedUser) {
    if (!confirm("Are you sure you want to unblock this user?")) return;

    busyReportId = block.id; // Reusing busyReportId for block id
    const result = await adminUnblockUser(block.id);
    busyReportId = null;

    if (result.success) {
      await queryClient.invalidateQueries({ queryKey: ["admin-blocks"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    } else {
      alert(result.message || "Failed to unblock user");
    }
  }

  const roleOptions = ["student", "teacher", "admin", "guest"];

  function getInitials(name: string) {
    return name?.charAt(0)?.toUpperCase() || "U";
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
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
    {#if !isAdmin && !$session.isPending}
      <div class="flex flex-col items-center justify-center py-20 text-center">
        <div
          class="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-4 rotate-3 shadow-lg shadow-rose-100"
        >
          <svg
            class="w-8 h-8 text-rose-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            /></svg
          >
        </div>
        <h2 class="text-2xl font-black text-slate-900 mb-2">Access Denied</h2>
        <p class="text-slate-500 mb-6">
          This area is restricted to administrators only.
        </p>
        <a
          href="/"
          class="inline-flex px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition"
          >Return Home</a
        >
      </div>
    {:else if $session.isPending || overviewQuery.isLoading}
      <div class="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    {:else if overviewQuery.data}
      <!-- Header -->
      <div class="mb-8">
        <div
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 mb-3"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"
          ></span>
          <span
            class="text-[10px] font-bold uppercase tracking-wider text-emerald-700"
            >Admin Control Center</span
          >
        </div>
        <h1 class="text-3xl font-black text-slate-900">Platform Overview</h1>
        <p class="text-sm text-slate-500 mt-1 max-w-2xl">
          Manage users, verify sellers, and moderate content to keep the
          platform safe.
        </p>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <div
          class="bg-white rounded-xl border border-violet-100 p-4 shadow-sm hover:shadow-md transition group"
        >
          <div class="flex items-center justify-between mb-2">
            <div
              class="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"
                ><path
                  d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"
                ></path></svg
              >
            </div>
            <span class="text-2xl font-black text-violet-700"
              >{overviewQuery.data.users}</span
            >
          </div>
          <p
            class="text-[10px] uppercase tracking-wide text-slate-500 font-bold mb-1"
          >
            Total Users
          </p>
          <div class="flex gap-2">
            <span
              class="text-[9px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 font-medium"
              >{overviewQuery.data.teachers} Teachers</span
            >
            <span
              class="text-[9px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 font-medium"
              >{overviewQuery.data.admins} Admins</span
            >
          </div>
        </div>

        <div
          class="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm hover:shadow-md transition"
        >
          <div class="flex items-center justify-between mb-2">
            <div
              class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"
                ><path
                  d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 001-1l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z"
                ></path></svg
              >
            </div>
            <span class="text-2xl font-black text-emerald-700"
              >{overviewQuery.data.listingsAvailable}</span
            >
          </div>
          <p
            class="text-[10px] uppercase tracking-wide text-slate-500 font-bold"
          >
            Active Listings
          </p>
          <p class="text-[10px] text-emerald-600 mt-1">Marketplace is active</p>
        </div>

        <div
          class="bg-white rounded-xl border border-amber-100 p-4 shadow-sm hover:shadow-md transition"
        >
          <div class="flex items-center justify-between mb-2">
            <div
              class="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"
                ><path
                  fill-rule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clip-rule="evenodd"
                ></path></svg
              >
            </div>
            <span
              class="text-2xl font-black {overviewQuery.data.openReports > 0
                ? 'text-amber-600'
                : 'text-slate-900'}">{overviewQuery.data.openReports}</span
            >
          </div>
          <p
            class="text-[10px] uppercase tracking-wide text-slate-500 font-bold"
          >
            Open Reports
          </p>
          <p class="text-[10px] text-slate-400 mt-1">
            {overviewQuery.data.activeBlocks} blocked users
          </p>
        </div>

        <div
          class="bg-white rounded-xl border border-blue-100 p-4 shadow-sm hover:shadow-md transition"
        >
          <div class="flex items-center justify-between mb-2">
            <div
              class="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"
                ><path
                  d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                ></path></svg
              >
            </div>
            <span class="text-2xl font-black text-blue-700"
              >{overviewQuery.data.averageSellerRating.toFixed(1)}</span
            >
          </div>
          <p
            class="text-[10px] uppercase tracking-wide text-slate-500 font-bold"
          >
            Avg Rating
          </p>
          <p class="text-[10px] text-slate-400 mt-1">
            {overviewQuery.data.ratingsCount} reviews total
          </p>
        </div>
      </div>

      <!-- Main Content Tabs -->
      <div
        class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden min-h-[500px]"
      >
        <div class="flex border-b border-slate-100">
          <button
            onclick={() => (activeTab = "users")}
            class="flex-1 px-4 py-3 text-xs font-medium transition {activeTab ===
            'users'
              ? 'text-violet-700 bg-violet-50 border-b-2 border-violet-500'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}"
          >
            User Roles
            <button
              onclick={() => (activeTab = "moderation")}
              class="flex-1 px-4 py-3 text-xs font-medium transition {activeTab ===
              'moderation'
                ? 'text-amber-700 bg-amber-50 border-b-2 border-amber-500'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}"
            >
              Moderation Queue
              {#if overviewQuery.data.openReports > 0}
                <span
                  class="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-bold"
                  >{overviewQuery.data.openReports}</span
                >
              {/if}
            </button>
            <button
              onclick={() => (activeTab = "reviews")}
              class="flex-1 px-4 py-3 text-xs font-medium transition {activeTab ===
              'reviews'
                ? 'text-blue-700 bg-blue-50 border-b-2 border-blue-500'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}"
            >
              Reviews
              {#if overviewQuery.data.ratingsCount > 0}
                <span
                  class="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-500 text-white text-[9px] font-bold"
                  >{overviewQuery.data.ratingsCount}</span
                >
              {/if}
            </button>
            <button
              onclick={() => (activeTab = "blocks")}
              class="flex-1 px-4 py-3 text-xs font-medium transition {activeTab ===
              'blocks'
                ? 'text-rose-700 bg-rose-50 border-b-2 border-rose-500'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}"
            >
              Blocked Users
              {#if overviewQuery.data.activeBlocks > 0}
                <span
                  class="ml-1.5 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold"
                  >{overviewQuery.data.activeBlocks}</span
                >
              {/if}
            </button>
          </button>
        </div>

        <div class="p-4 sm:p-6">
          {#if activeTab === "users"}
            <div in:fade={{ duration: 150 }}>
              <!-- Filters -->
              <div class="flex flex-col sm:flex-row gap-3 mb-6">
                <div class="relative flex-1">
                  <input
                    bind:value={userSearch}
                    type="text"
                    placeholder="Search by name or email..."
                    class="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                  />
                  <svg
                    class="w-4 h-4 text-slate-400 absolute left-3 top-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    ><path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    /></svg
                  >
                </div>
                <select
                  bind:value={roleFilter}
                  class="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-violet-500 w-full sm:w-48"
                >
                  <option value="">All Roles</option>
                  {#each roleOptions as role}<option value={role}>{role}</option
                    >{/each}
                </select>
              </div>

              <!-- Users Table -->
              <div class="rounded-xl border border-slate-200 overflow-hidden">
                {#if usersQuery.isLoading}
                  <div class="p-12 flex justify-center"><LoadingSpinner /></div>
                {:else if usersQuery.data?.length === 0}
                  <div class="p-12 text-center text-slate-500 text-sm">
                    No users found matching your filters.
                  </div>
                {:else if usersQuery.data}
                  <div class="overflow-x-auto">
                    <table class="w-full text-sm text-left">
                      <thead
                        class="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-bold"
                      >
                        <tr>
                          <th class="px-4 py-3">User</th>
                          <th class="px-4 py-3">Role</th>
                          <th class="px-4 py-3">Status</th>
                          <th class="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100">
                        {#each usersQuery.data as user}
                          <tr class="hover:bg-slate-50/50 transition">
                            <td class="px-4 py-3">
                              <div class="flex items-center gap-3">
                                <div
                                  class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 overflow-hidden shrink-0 transform rotate-1"
                                >
                                  {#if user.image}
                                    <img
                                      src={user.image}
                                      alt=""
                                      class="w-full h-full object-cover"
                                    />
                                  {:else}
                                    {getInitials(user.name)}
                                  {/if}
                                </div>
                                <div class="min-w-0">
                                  <div
                                    class="font-medium text-slate-900 truncate max-w-[150px]"
                                  >
                                    {user.name}
                                  </div>
                                  <div
                                    class="text-[10px] text-slate-500 truncate max-w-[150px]"
                                  >
                                    {user.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td class="px-4 py-3">
                              <div class="flex flex-col gap-1">
                                <select
                                  value={user.role}
                                  disabled={busyUserId === user.id}
                                  onchange={(e) =>
                                    handleRoleUpdate(
                                      user,
                                      (e.currentTarget as HTMLSelectElement)
                                        .value,
                                    )}
                                  class="text-[10px] font-bold uppercase tracking-wider bg-slate-100 border-none rounded py-1 pl-2 pr-6 focus:ring-2 focus:ring-violet-500"
                                >
                                  {#each roleOptions as role}
                                    <option value={role}>{role}</option>
                                  {/each}
                                </select>
                                {#if roleUpdateUserId === user.id}
                                  <span class="text-[10px] text-slate-500"
                                    >Updating role...</span
                                  >
                                {:else if roleStatusByUserId[user.id]}
                                  <span
                                    class="text-[10px] {roleStatusByUserId[
                                      user.id
                                    ].type === 'success'
                                      ? 'text-emerald-600'
                                      : 'text-rose-600'}"
                                  >
                                    {roleStatusByUserId[user.id].message}
                                  </span>
                                {/if}
                              </div>
                            </td>
                            <td class="px-4 py-3">
                              {#if user.isVerifiedSeller}
                                <span
                                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100 uppercase tracking-wide"
                                >
                                  <svg
                                    class="w-3 h-3"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                    ><path
                                      fill-rule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clip-rule="evenodd"
                                    ></path></svg
                                  >
                                  Verified
                                </span>
                              {:else}
                                <span
                                  class="text-[10px] text-slate-400 font-medium"
                                  >Unverified</span
                                >
                              {/if}
                            </td>
                            <td class="px-4 py-3 text-right">
                              {#if user.isVerifiedSeller}
                                <button
                                  onclick={() =>
                                    handleVerification(user, false)}
                                  disabled={busyUserId === user.id}
                                  class="text-[10px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 px-2 py-1 rounded border border-rose-100 transition"
                                  >Revoke</button
                                >
                              {:else}
                                <button
                                  onclick={() => handleVerification(user, true)}
                                  disabled={busyUserId === user.id}
                                  class="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 transition"
                                  >Verify</button
                                >
                              {/if}
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {/if}
              </div>
            </div>
          {:else if activeTab === "moderation"}
            <div in:fade={{ duration: 150 }}>
              <div class="flex items-center justify-between mb-6 px-2">
                <h3 class="text-sm font-bold text-slate-900">
                  Moderation Queue
                </h3>
                <select
                  bind:value={reportsFilter}
                  class="text-[10px] font-bold uppercase tracking-wider bg-slate-50 border-slate-200 rounded-lg py-1.5 hover:bg-slate-100 transition"
                >
                  <option value="all">All Reports</option>
                  <option value="open">Open</option>
                  <option value="in_review">In Review</option>
                  <option value="resolved">Resolved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {#if reportsQuery.isLoading}
                <div class="p-12 flex justify-center"><LoadingSpinner /></div>
              {:else if reportsQuery.data?.length === 0}
                <div class="py-12 text-center text-slate-500 text-sm">
                  No reports found matching the filter.
                </div>
              {:else if reportsQuery.data}
                <div class="grid gap-3 px-2">
                  {#each reportsQuery.data as report}
                    <div
                      class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm"
                    >
                      <div class="flex flex-col md:flex-row gap-4">
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 mb-2">
                            <span
                              class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border {reportsFilter ===
                              'all'
                                ? 'bg-slate-50 text-slate-600 border-slate-200'
                                : 'bg-blue-50 text-blue-600 border-blue-100'}"
                            >
                              {report.category}
                            </span>
                            <span class="text-[10px] text-slate-400"
                              >{formatDate(report.createdAt)}</span
                            >
                          </div>
                          <p
                            class="text-sm text-slate-800 mb-3 leading-relaxed"
                          >
                            "{report.description}"
                          </p>
                          <div class="flex flex-wrap gap-4 text-[11px]">
                            <span class="text-slate-500"
                              >Reporter: <span class="text-slate-900 font-bold"
                                >{report.reporter?.name}</span
                              ></span
                            >
                            <span class="text-slate-500"
                              >Reported: <span class="text-slate-900 font-bold"
                                >{report.reportedUser?.name}</span
                              ></span
                            >
                          </div>
                        </div>
                        <div
                          class="flex md:flex-col gap-2 justify-end items-end"
                        >
                          <div class="flex gap-2">
                            <button
                              onclick={() =>
                                handleModeration(report, "resolved")}
                              disabled={busyReportId === report.id}
                              class="px-3 py-1.5 rounded-lg text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition border border-emerald-100"
                            >
                              Resolve
                            </button>
                            <button
                              onclick={() =>
                                handleModeration(report, "rejected")}
                              disabled={busyReportId === report.id}
                              class="px-3 py-1.5 rounded-lg text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition border border-rose-100"
                            >
                              Reject
                            </button>
                          </div>
                          <button
                            onclick={() =>
                              handleModeration(report, "in_review")}
                            disabled={busyReportId === report.id}
                            class="px-3 py-1.5 rounded-lg text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition border border-blue-100"
                          >
                            Mark In Review
                          </button>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {:else if activeTab === "reviews"}
            <div in:fade={{ duration: 150 }}>
              <h3 class="text-sm font-bold text-slate-900 mb-4 px-2">
                Latest Seller Reviews
              </h3>
              {#if ratingsQuery.isLoading}
                <div class="p-12 flex justify-center"><LoadingSpinner /></div>
              {:else if ratingsQuery.data?.length === 0}
                <div class="py-12 text-center text-slate-500 text-sm">
                  No reviews have been posted yet.
                </div>
              {:else if ratingsQuery.data}
                <div class="grid gap-3 px-2">
                  {#each ratingsQuery.data as rating}
                    <div
                      class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm"
                    >
                      <div class="flex flex-col sm:flex-row gap-4">
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 mb-2">
                            <div class="flex text-amber-400">
                              {#each Array(5) as _, i}
                                <svg
                                  class="w-3.5 h-3.5"
                                  fill={i < rating.rating
                                    ? "currentColor"
                                    : "none"}
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                                  />
                                </svg>
                              {/each}
                            </div>
                            <span class="text-[10px] text-slate-400"
                              >{formatDate(rating.createdAt)}</span
                            >
                          </div>
                          <p class="text-sm text-slate-800 italic mb-3">
                            "{rating.review || "No comment provided."}"
                          </p>
                          <div class="flex flex-wrap gap-4 text-[11px]">
                            <span class="text-slate-500"
                              >Rater: <span class="text-slate-900 font-bold"
                                >{rating.rater?.name}</span
                              ></span
                            >
                            <span class="text-slate-500"
                              >Seller: <span class="text-slate-900 font-bold"
                                >{rating.seller?.name}</span
                              ></span
                            >
                            {#if rating.listing}
                              <span class="text-slate-500"
                                >Book: <span class="text-slate-900 font-bold"
                                  >{rating.listing.title}</span
                                ></span
                              >
                            {/if}
                          </div>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {:else if activeTab === "blocks"}
            <div in:fade={{ duration: 150 }}>
              <h3 class="text-sm font-bold text-slate-900 mb-4 px-2">
                Platform-wide Active Blocks
              </h3>
              {#if blocksQuery.isLoading}
                <div class="p-12 flex justify-center"><LoadingSpinner /></div>
              {:else if blocksQuery.data?.length === 0}
                <div class="py-12 text-center text-slate-500 text-sm">
                  There are no active user blocks at this time.
                </div>
              {:else if blocksQuery.data}
                <div class="grid gap-3 px-2">
                  {#each blocksQuery.data as block}
                    <div
                      class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between gap-4"
                    >
                      <div class="min-w-0">
                        <p class="text-sm font-bold text-slate-900 truncate">
                          {block.blockedUser?.name}
                        </p>
                        <p class="text-[10px] text-slate-500 truncate mb-2">
                          {block.blockedUser?.email}
                        </p>
                        <div class="flex flex-wrap gap-3 text-[10px]">
                          <span class="text-slate-400"
                            >Blocked by: <span class="text-slate-700"
                              >{block.blocker?.name || "Unknown"}</span
                            ></span
                          >
                          <span class="text-slate-400"
                            >Reason: <span class="text-slate-700 italic"
                              >{block.reason || "None provided"}</span
                            ></span
                          >
                          <span class="text-slate-400"
                            >Date: {formatDate(block.createdAt)}</span
                          >
                        </div>
                      </div>
                      <button
                        onclick={() => handleAdminUnblock(block)}
                        disabled={busyReportId === block.id}
                        class="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition border border-rose-100"
                      >
                        {busyReportId === block.id ? "Wait..." : "Unblock"}
                      </button>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
