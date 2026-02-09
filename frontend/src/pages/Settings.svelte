<script lang="ts">
  import { createQuery, useQueryClient } from "@tanstack/svelte-query";
  import {
    getBlockedMarketplaceUsers,
    getMyMarketplaceReports,
    unblockMarketplaceUser,
    type BlockedUser,
    type MarketplaceReport,
  } from "../lib/api";
  import { fade } from "svelte/transition";
  import LoadingSpinner from "../components/LoadingSpinner.svelte";
  import { authClient } from "../lib/auth-client";

  const session = authClient.useSession();
  const queryClient = useQueryClient();

  let activeTab = $state<"reports" | "blocks">("reports");
  let unblockingId = $state<string | null>(null);
  let signingOut = $state(false);

  async function handleSignOut() {
    if (!confirm("Are you sure you want to sign out?")) return;
    signingOut = true;
    try {
      await authClient.signOut();
      window.location.href = "/";
    } catch (error) {
      console.error("Sign out error:", error);
      signingOut = false;
    }
  }

  const reportsQuery = createQuery(() => ({
    queryKey: ["my-marketplace-reports"],
    queryFn: async () => {
      const result = await getMyMarketplaceReports();
      if (result.success && result.data) return result.data;
      throw new Error(result.message || "Failed to load reports");
    },
    enabled: !!$session.data?.user,
  }));

  const blocksQuery = createQuery(() => ({
    queryKey: ["my-blocked-users"],
    queryFn: async () => {
      const result = await getBlockedMarketplaceUsers();
      if (result.success && result.data) return result.data;
      throw new Error(result.message || "Failed to load blocked users");
    },
    enabled: !!$session.data?.user,
  }));

  async function handleUnblock(user: BlockedUser) {
    unblockingId = user.blockedUserId;
    try {
      const result = await unblockMarketplaceUser(user.blockedUserId);
      if (result.success) {
        await queryClient.invalidateQueries({
          queryKey: ["my-blocked-users"],
        });
      } else {
        alert(result.message || "Failed to unblock user");
      }
    } catch (error) {
      console.error("Unblock error:", error);
    } finally {
      unblockingId = null;
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const statusColors = {
    open: "bg-amber-100 text-amber-700 border-amber-200",
    in_review: "bg-blue-100 text-blue-700 border-blue-200",
    resolved: "bg-emerald-100 text-emerald-700 border-emerald-200",
    rejected: "bg-slate-100 text-slate-600 border-slate-200",
  };
</script>

<div
  class="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 lg:px-8 relative overflow-hidden"
>
  <!-- Background Decorations -->
  <div
    class="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-blue-100/30 blur-3xl"
  ></div>
  <div
    class="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-violet-100/30 blur-3xl"
  ></div>

  <div class="max-w-4xl mx-auto relative">
    <header
      class="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6"
    >
      <div>
        <h1 class="text-3xl font-black text-slate-900 tracking-tight">
          Settings & Privacy
        </h1>
        <p class="text-slate-500 mt-2">
          Manage your interactions, reports, and blocked users on the
          marketplace.
        </p>
      </div>

      {#if $session.data?.user}
        <div
          class="flex items-center gap-4 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm shadow-slate-200/50"
        >
          <div
            class="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 overflow-hidden relative"
          >
            {#if $session.data.user.image}
              <img
                src={$session.data.user.image}
                alt=""
                class="w-full h-full object-cover"
              />
            {:else}
              <span class="text-lg font-black"
                >{$session.data.user.name.charAt(0).toUpperCase()}</span
              >
            {/if}
          </div>
          <div class="min-w-0 pr-4">
            <h3 class="font-black text-slate-900 leading-none mb-1">
              {$session.data.user.name}
            </h3>
            <p class="text-xs text-slate-400 truncate">
              {$session.data.user.email}
            </p>
          </div>
          <button
            onclick={handleSignOut}
            disabled={signingOut}
            class="ml-auto px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            {signingOut ? "Signing out..." : "Sign Out"}
          </button>
        </div>
      {/if}
    </header>

    <div
      class="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden"
    >
      <!-- Tabs -->
      <div class="flex border-b border-slate-100 p-1 bg-slate-50/50">
        <button
          onclick={() => (activeTab = "reports")}
          class="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition-all rounded-2xl {activeTab ===
          'reports'
            ? 'bg-white text-blue-600 shadow-sm shadow-blue-100 ring-1 ring-slate-200'
            : 'text-slate-500 hover:text-slate-700'}"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          My Reports
        </button>
        <button
          onclick={() => (activeTab = "blocks")}
          class="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition-all rounded-2xl {activeTab ===
          'blocks'
            ? 'bg-white text-rose-600 shadow-sm shadow-rose-100 ring-1 ring-slate-200'
            : 'text-slate-500 hover:text-slate-700'}"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
          Blocked Users
        </button>
      </div>

      <div class="p-6">
        {#if activeTab === "reports"}
          <div in:fade={{ duration: 150 }}>
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-lg font-black text-slate-900">
                Submitted Reports
              </h2>
              <span
                class="text-xs font-bold text-slate-400 uppercase tracking-wider"
              >
                {reportsQuery.data?.length || 0} Reports Total
              </span>
            </div>

            {#if reportsQuery.isLoading}
              <div class="py-12 flex justify-center"><LoadingSpinner /></div>
            {:else if reportsQuery.data?.length === 0}
              <div class="py-16 text-center">
                <div
                  class="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-100"
                >
                  <svg
                    class="w-8 h-8 text-slate-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <p class="font-bold text-slate-900">Clean Slate!</p>
                <p class="text-sm text-slate-500 mt-1">
                  You haven't submitted any reports yet.
                </p>
              </div>
            {:else if reportsQuery.data}
              <div class="space-y-4">
                {#each reportsQuery.data as report}
                  <div
                    class="group relative bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-2xl p-4 transition-all"
                  >
                    <div class="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <span
                          class="inline-flex px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest {statusColors[
                            report.status
                          ]} border"
                        >
                          {report.status.replace("_", " ")}
                        </span>
                        <h3
                          class="mt-2 text-sm font-black text-slate-900 line-clamp-1"
                        >
                          Report against {report.reportedUser?.name}
                        </h3>
                      </div>
                      <span class="text-[10px] font-bold text-slate-400">
                        {formatDate(report.createdAt)}
                      </span>
                    </div>

                    <p
                      class="text-sm text-slate-600 bg-white border border-slate-100 rounded-xl p-3 leading-relaxed mb-3"
                    >
                      "{report.description}"
                    </p>

                    {#if report.resolutionNotes}
                      <div class="mt-3 pt-3 border-t border-slate-200/50">
                        <p
                          class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1"
                        >
                          Admin Response
                        </p>
                        <p
                          class="text-xs text-slate-700 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100 italic"
                        >
                          {report.resolutionNotes}
                        </p>
                      </div>
                    {/if}

                    {#if report.listing}
                      <div
                        class="mt-3 flex items-center gap-2 text-[11px] text-slate-500"
                      >
                        <svg
                          class="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                          />
                        </svg>
                        Related to:
                        <span class="font-bold text-slate-700"
                          >{report.listing.title}</span
                        >
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {:else if activeTab === "blocks"}
          <div in:fade={{ duration: 150 }}>
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-lg font-black text-slate-900">
                Blocked Marketplace Users
              </h2>
              <span
                class="text-xs font-bold text-slate-400 uppercase tracking-wider"
              >
                {blocksQuery.data?.length || 0} Blocked
              </span>
            </div>

            {#if blocksQuery.isLoading}
              <div class="py-12 flex justify-center"><LoadingSpinner /></div>
            {:else if blocksQuery.data?.length === 0}
              <div class="py-16 text-center">
                <div
                  class="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-100"
                >
                  <svg
                    class="w-8 h-8 text-slate-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <p class="font-bold text-slate-900">No blocks!</p>
                <p class="text-sm text-slate-500 mt-1">
                  You haven't blocked any users yet.
                </p>
              </div>
            {:else if blocksQuery.data}
              <div class="grid gap-4">
                {#each blocksQuery.data as block}
                  <div
                    class="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-md transition-all group"
                  >
                    <div class="flex items-center gap-4">
                      <div
                        class="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 overflow-hidden relative group-hover:rotate-3 transition-transform"
                      >
                        {#if block.blockedUser?.image}
                          <img
                            src={block.blockedUser.image}
                            alt=""
                            class="w-full h-full object-cover"
                          />
                        {:else}
                          <span class="text-lg font-black"
                            >{block.blockedUser?.name
                              .charAt(0)
                              .toUpperCase()}</span
                          >
                        {/if}
                      </div>
                      <div>
                        <h3 class="font-black text-slate-900 leading-none mb-1">
                          {block.blockedUser?.name}
                        </h3>
                        <p
                          class="text-[10px] text-slate-400 font-bold uppercase tracking-wider"
                        >
                          Blocked on {formatDate(block.createdAt)}
                        </p>
                        {#if block.reason}
                          <p
                            class="text-xs text-slate-500 mt-1.5 line-clamp-1 italic"
                          >
                            Reason: {block.reason}
                          </p>
                        {/if}
                      </div>
                    </div>
                    <button
                      onclick={() => handleUnblock(block)}
                      disabled={unblockingId === block.blockedUserId}
                      class="px-4 py-2 rounded-2xl bg-rose-50 text-rose-600 text-xs font-black border border-rose-100 hover:bg-rose-600 hover:text-white transition-all disabled:opacity-50 shadow-sm shadow-rose-50"
                    >
                      {unblockingId === block.blockedUserId
                        ? "Unblocking..."
                        : "Unblock"}
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #e2e8f0;
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #cbd5e1;
  }
</style>
