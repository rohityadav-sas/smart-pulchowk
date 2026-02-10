<script lang="ts">
  import { createQuery, useQueryClient } from "@tanstack/svelte-query";
  import { onMount } from "svelte";
  import { route, route as routeAction } from "@mateothegreat/svelte5-router";
  import {
    deleteLostFoundItem,
    getMyLostFoundClaims,
    getMyLostFoundItems,
    updateLostFoundItemStatus,
  } from "../lib/api";
  import { authClient } from "../lib/auth-client";
  import LoadingSpinner from "../components/LoadingSpinner.svelte";

  const queryClient = useQueryClient();
  const session = authClient.useSession();
  const role = $derived(
    ($session.data?.user as any)?.role as string | undefined,
  );
  const isGuest = $derived(role === "guest");
  const isAuthorized = $derived(!!$session.data?.user && !isGuest);

  let tab = $state<"posts" | "claims">("posts");
  let submitting = $state(false);

  const myItemsQuery = createQuery(() => ({
    queryKey: [
      "my-lost-found-items",
      ($session.data?.user as any)?.id ?? "anon",
    ],
    enabled: isAuthorized,
    queryFn: async () => {
      const result = await getMyLostFoundItems();
      if (!result.success || !result.data) {
        throw new Error(result.message || "Failed to load your posts.");
      }
      return result.data;
    },
    staleTime: 20_000,
    gcTime: 5 * 60_000,
  }));

  const myClaimsQuery = createQuery(() => ({
    queryKey: [
      "my-lost-found-claims",
      ($session.data?.user as any)?.id ?? "anon",
    ],
    enabled: isAuthorized,
    queryFn: async () => {
      const result = await getMyLostFoundClaims();
      if (!result.success || !result.data) {
        throw new Error(result.message || "Failed to load your claims.");
      }
      return result.data;
    },
    staleTime: 20_000,
    gcTime: 5 * 60_000,
  }));

  const myItems = $derived(myItemsQuery.data ?? []);
  const myClaims = $derived(myClaimsQuery.data ?? []);
  const loading = $derived(
    (isAuthorized && (myItemsQuery.isLoading || myClaimsQuery.isLoading)) ||
      false,
  );
  const errorMessage = $derived(
    (myItemsQuery.error as Error | null)?.message ||
      (myClaimsQuery.error as Error | null)?.message ||
      null,
  );

  async function markResolved(itemId: number) {
    submitting = true;
    const result = await updateLostFoundItemStatus(itemId, "resolved");
    submitting = false;
    if (!result.success) {
      alert(result.message || "Failed to update status");
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["my-lost-found-items"] }),
      queryClient.invalidateQueries({ queryKey: ["lost-found"] }),
      queryClient.invalidateQueries({ queryKey: ["lost-found-item", itemId] }),
    ]);
  }

  async function handleDelete(itemId: number) {
    if (!confirm("Delete this lost/found post?")) return;
    submitting = true;
    const result = await deleteLostFoundItem(itemId);
    submitting = false;
    if (!result.success) {
      alert(result.message || "Failed to delete post");
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["my-lost-found-items"] }),
      queryClient.invalidateQueries({ queryKey: ["lost-found"] }),
      queryClient.invalidateQueries({ queryKey: ["global-search"] }),
    ]);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function statusBadgeClass(status: string) {
    if (status === "open") return "bg-emerald-100 text-emerald-700";
    if (status === "claimed") return "bg-amber-100 text-amber-700";
    if (status === "resolved") return "bg-blue-100 text-blue-700";
    return "bg-slate-100 text-slate-700";
  }

  onMount(() => {
    tab = "posts";
  });
</script>

<div class="min-h-[calc(100vh-4rem)] bg-gray-50/50 px-3 py-4 sm:px-5 lg:px-6">
  <div class="max-w-4xl mx-auto">
    <a
      href="/lost-found"
      use:routeAction
      class="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 mb-3 transition-colors group"
    >
      <svg
        class="w-4 h-4 transition-transform group-hover:-translate-x-1"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M10 19l-7-7m0 0l7-7m-7 7h18"
        />
      </svg>
      Back to Lost &amp; Found
    </a>

    <div class="flex items-center justify-between mb-4">
      <div>
        <a href="/lost-found" use:routeAction class="group block">
          <h1
            class="text-lg lg:text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors"
          >
            My <span class="text-blue-600">Lost &amp; Found</span>
          </h1>
        </a>
        <p class="text-xs text-gray-600 mt-1">
          Manage your posted items and claim activity
        </p>
      </div>
      {#if isAuthorized}
        <a
          href="/lost-found/report"
          use:routeAction
          class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          Report Item
        </a>
      {/if}
    </div>

    {#if !$session.data?.user || isGuest}
      <div
        class="p-4 bg-white border border-red-100 rounded-2xl text-center text-sm"
      >
        <p class="text-red-600">
          Sign in with a non-guest account to manage lost/found posts.
        </p>
      </div>
    {:else}
      <div
        class="flex gap-1 mb-3 bg-white p-1 rounded-lg border border-gray-100 w-fit"
      >
        <button
          onclick={() => (tab = "posts")}
          class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all {tab ===
          'posts'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-gray-600 hover:bg-gray-50'}"
        >
          My Posts
          <span
            class="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full {tab ===
            'posts'
              ? 'bg-blue-500'
              : 'bg-gray-100'}"
          >
            {myItems.length}
          </span>
        </button>
        <button
          onclick={() => (tab = "claims")}
          class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all {tab ===
          'claims'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-gray-600 hover:bg-gray-50'}"
        >
          My Claims
          <span
            class="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full {tab ===
            'claims'
              ? 'bg-blue-500'
              : 'bg-gray-100'}"
          >
            {myClaims.length}
          </span>
        </button>
      </div>
      <p class="mb-3 text-xs text-gray-600">
        Manage your lost/found posts and claim responses in one place.
      </p>

      {#if loading}
        <div class="flex items-center justify-center py-10">
          <LoadingSpinner size="lg" text="Loading your data..." />
        </div>
      {:else if errorMessage}
        <div
          class="p-4 bg-white border border-red-100 rounded-2xl text-center text-sm"
        >
          <p class="text-red-600 mb-3">{errorMessage}</p>
          <button
            onclick={() => {
              myItemsQuery.refetch();
              myClaimsQuery.refetch();
            }}
            class="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm"
          >
            Try Again
          </button>
        </div>
      {:else if tab === "posts"}
        {#if myItems.length === 0}
          <div
            class="text-center py-10 bg-white rounded-2xl border border-gray-100"
          >
            <svg
              class="w-12 h-12 text-gray-200 mx-auto mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V7a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <h3 class="text-base font-medium text-gray-900 mb-2">
              No posts yet
            </h3>
            <p class="text-sm text-gray-500 mb-5">
              Report your first lost or found item.
            </p>
            <a
              href="/lost-found/report"
              use:routeAction
              class="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
            >
              Report Item
            </a>
          </div>
        {:else}
          <div class="space-y-2.5">
            {#each myItems as item}
              <article
                class="bg-white rounded-xl border border-gray-100 p-2.5 hover:shadow-md transition-shadow"
              >
                <div class="flex items-stretch justify-between gap-3">
                  <div class="flex min-w-0 gap-3">
                    <div
                      class="h-20 w-20 overflow-hidden rounded-lg border border-gray-100 bg-slate-100 shrink-0"
                    >
                      {#if item.images?.[0]?.imageUrl}
                        <img
                          src={item.images[0].imageUrl}
                          alt={item.title}
                          class="h-full w-full object-cover"
                          loading="lazy"
                        />
                      {:else}
                        <div
                          class="flex h-full w-full items-center justify-center"
                        >
                          <svg
                            class="h-6 w-6 text-slate-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="1.8"
                              d="M3 7h18M7 3v4m10-4v4M5 11h14v8H5z"
                            />
                          </svg>
                        </div>
                      {/if}
                    </div>

                    <div class="min-w-0">
                      <a
                        use:route
                        href={`/lost-found/${item.id}`}
                        class="line-clamp-1 text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                      >
                        {item.title}
                      </a>
                      <p class="mt-0.5 line-clamp-2 text-sm text-gray-600">
                        {item.description}
                      </p>
                      <p class="mt-2 text-xs text-gray-400">
                        Listed {formatDate(item.createdAt)} · {item.itemType} · {item.category.replace(
                          "_",
                          " ",
                        )}
                      </p>
                    </div>
                  </div>

                  <div
                    class="flex shrink-0 min-w-55 flex-col items-end justify-between gap-2"
                  >
                    <span
                      class="rounded-full px-2.5 py-0.5 text-[11px] font-semibold {statusBadgeClass(
                        item.status,
                      )}"
                    >
                      {item.status}
                    </span>
                    <div class="flex items-center gap-1.5">
                      <a
                        use:route
                        href={`/lost-found/${item.id}`}
                        class="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                      >
                        View
                      </a>
                      {#if item.status !== "resolved" && item.status !== "closed"}
                        <button
                          class="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 disabled:opacity-60"
                          onclick={() => markResolved(item.id)}
                          disabled={submitting}
                        >
                          Mark Resolved
                        </button>
                      {/if}
                      <button
                        class="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-60"
                        onclick={() => handleDelete(item.id)}
                        disabled={submitting}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            {/each}
          </div>
        {/if}
      {:else if myClaims.length === 0}
        <div
          class="text-center py-10 bg-white rounded-2xl border border-gray-100"
        >
          <svg
            class="w-12 h-12 text-gray-200 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.94 9.94 0 01-4.255-.949L3 20l1.245-3.113A7.927 7.927 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <h3 class="text-base font-medium text-gray-900 mb-2">
            No claims yet
          </h3>
          <p class="text-sm text-gray-500">
            You have not submitted any claim requests.
          </p>
        </div>
      {:else}
        <div class="space-y-2.5">
          {#each myClaims as claim}
            <article
              class="bg-white rounded-xl border border-gray-100 p-2.5 hover:shadow-md transition-shadow"
            >
              <div class="flex items-stretch justify-between gap-3">
                <div class="flex min-w-0 gap-3">
                  <div
                    class="h-20 w-20 overflow-hidden rounded-lg border border-gray-100 bg-slate-100 shrink-0"
                  >
                    {#if claim.item?.images?.[0]?.imageUrl}
                      <img
                        src={claim.item.images[0].imageUrl}
                        alt={claim.item?.title || `Item #${claim.itemId}`}
                        class="h-full w-full object-cover"
                        loading="lazy"
                      />
                    {:else}
                      <div
                        class="flex h-full w-full items-center justify-center"
                      >
                        <svg
                          class="h-6 w-6 text-slate-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="1.8"
                            d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.94 9.94 0 01-4.255-.949L3 20l1.245-3.113A7.927 7.927 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                          />
                        </svg>
                      </div>
                    {/if}
                  </div>

                  <div class="min-w-0">
                    <a
                      use:route
                      href={`/lost-found/${claim.itemId}`}
                      class="line-clamp-1 text-base font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                    >
                      {claim.item?.title || `Item #${claim.itemId}`}
                    </a>
                    <p class="mt-1 text-sm text-gray-600 line-clamp-2">
                      {claim.message}
                    </p>
                    <p class="mt-2 text-xs text-gray-400">
                      Claimed on {formatDate(claim.createdAt)}
                    </p>
                  </div>
                </div>

                <div
                  class="flex shrink-0 min-w-40 flex-col items-end justify-between gap-2"
                >
                  <span
                    class="rounded-full px-2.5 py-0.5 text-[11px] font-semibold {claim.status ===
                    'accepted'
                      ? 'bg-emerald-100 text-emerald-700'
                      : claim.status === 'pending'
                        ? 'bg-amber-100 text-amber-700'
                        : claim.status === 'rejected'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-slate-100 text-slate-700'}"
                  >
                    {claim.status}
                  </span>
                  <a
                    use:route
                    href={`/lost-found/${claim.itemId}`}
                    class="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                  >
                    View Item
                  </a>
                </div>
              </div>
            </article>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .line-clamp-1 {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
