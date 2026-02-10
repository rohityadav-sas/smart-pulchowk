<script lang="ts">
  import { createQuery, useQueryClient } from "@tanstack/svelte-query";
  import { route } from "@mateothegreat/svelte5-router";
  import { slide } from "svelte/transition";
  import {
    getLostFoundItems,
    type LostFoundCategory,
    type LostFoundItem,
    type LostFoundStatus,
    type LostFoundItemType,
  } from "../lib/api";
  import { authClient } from "../lib/auth-client";
  import LoadingSpinner from "../components/LoadingSpinner.svelte";

  const queryClient = useQueryClient();
  const session = authClient.useSession();
  const isGuest = $derived(($session.data?.user as any)?.role === "guest");
  const canManage = $derived(!!$session.data?.user && !isGuest);

  const categories: Array<{ value: LostFoundCategory | "all"; label: string }> =
    [
      { value: "all", label: "All categories" },
      { value: "documents", label: "Documents" },
      { value: "electronics", label: "Electronics" },
      { value: "accessories", label: "Accessories" },
      { value: "ids_cards", label: "ID Cards" },
      { value: "keys", label: "Keys" },
      { value: "bags", label: "Bags" },
      { value: "other", label: "Other" },
    ];

  const statuses: Array<{ value: LostFoundStatus | "all"; label: string }> = [
    { value: "all", label: "Open + Claimed" },
    { value: "open", label: "Open" },
    { value: "claimed", label: "Claimed" },
    { value: "resolved", label: "Resolved" },
    { value: "closed", label: "Closed" },
  ];

  let itemType = $state<LostFoundItemType>("lost");
  let category = $state<LostFoundCategory | "all">("all");
  let status = $state<LostFoundStatus | "all">("all");
  let search = $state("");
  let showFilters = $state(false);

  let loadingMore = $state(false);
  let extraPages = $state<
    Array<{
      items: LostFoundItem[];
      nextCursor: string | null;
      hasMore: boolean;
    }>
  >([]);

  const trimmedSearch = $derived(search.trim());
  const filterSignature = $derived(
    `${itemType}|${category}|${status}|${trimmedSearch}`,
  );

  const listQuery = createQuery(() => ({
    queryKey: ["lost-found", itemType, category, status, trimmedSearch],
    queryFn: async () => {
      const result = await getLostFoundItems({
        itemType,
        category: category === "all" ? undefined : category,
        status: status === "all" ? undefined : status,
        q: trimmedSearch || undefined,
        limit: 8,
      });

      if (!result.success || !result.data) {
        throw new Error(result.message || "Failed to load lost/found items.");
      }

      return result;
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  }));

  let lastSignature = $state("");
  $effect(() => {
    const current = filterSignature;
    if (current !== lastSignature) {
      lastSignature = current;
      extraPages = [];
      loadingMore = false;
    }
  });

  const initialPage = $derived(listQuery.data?.data ?? null);
  const pages = $derived(initialPage ? [initialPage, ...extraPages] : []);
  const items = $derived(pages.flatMap((page) => page.items));
  const total = $derived(
    (listQuery.data?.meta?.total as number | undefined) ?? items.length,
  );
  const hasMore = $derived(
    pages.length > 0 ? pages[pages.length - 1].hasMore : false,
  );
  const nextCursor = $derived(
    pages.length > 0 ? pages[pages.length - 1].nextCursor : null,
  );

  function statusClass(value: LostFoundStatus) {
    if (value === "open") return "bg-emerald-100 text-emerald-700";
    if (value === "claimed") return "bg-amber-100 text-amber-700";
    if (value === "resolved") return "bg-blue-100 text-blue-700";
    return "bg-slate-100 text-slate-700";
  }

  function getTimeAgo(dateLike: string) {
    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) return "Unknown";
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  }

  async function loadMore() {
    if (!hasMore || loadingMore || !nextCursor) return;

    loadingMore = true;
    try {
      const nextPage = await queryClient.fetchQuery({
        queryKey: [
          "lost-found",
          itemType,
          category,
          status,
          trimmedSearch,
          "cursor",
          nextCursor,
        ],
        queryFn: async () => {
          const result = await getLostFoundItems({
            itemType,
            category: category === "all" ? undefined : category,
            status: status === "all" ? undefined : status,
            q: trimmedSearch || undefined,
            limit: 8,
            cursor: nextCursor,
          });

          if (!result.success || !result.data) {
            throw new Error(result.message || "Failed to load more items.");
          }

          return result.data;
        },
        staleTime: 60_000,
        gcTime: 5 * 60_000,
      });

      if (nextPage.items.length > 0) {
        extraPages = [...extraPages, nextPage];
      }
    } catch {
      // keep existing list stable
    } finally {
      loadingMore = false;
    }
  }
</script>

<div class="min-h-[calc(100vh-4rem)] bg-gray-50/50 px-4 py-8 sm:px-6 lg:px-8">
  <div class="mx-auto max-w-7xl">
    <div class="relative z-30 mb-5">
      <div class="mx-auto max-w-4xl space-y-3">
        <div
          class="group flex flex-col items-center gap-1.5 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-lg shadow-blue-100/50 transition-all duration-500 focus-within:ring-2 focus-within:ring-blue-500/10 sm:flex-row"
        >
          <div class="relative w-full flex-1">
            <svg
              class="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="What item are you looking for?"
              bind:value={search}
              class="w-full border-none bg-transparent py-3 pl-10 pr-8 text-sm font-semibold text-slate-900 placeholder:text-slate-300 focus:ring-0"
            />
          </div>

          <div class="flex w-full items-center gap-2 p-1 sm:w-auto">
            <button
              onclick={() => (showFilters = !showFilters)}
              class="relative flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all sm:flex-none {showFilters
                ? 'bg-blue-600 text-white shadow-xl shadow-blue-200'
                : 'border border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'}"
            >
              <svg
                class="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2.5"
                  d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                />
              </svg>
              Filters
            </button>
            <button
              onclick={() =>
                queryClient.invalidateQueries({ queryKey: ["lost-found"] })}
              class="flex-1 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-200/50 transition-all hover:bg-slate-800 sm:flex-none"
            >
              Search
            </button>
            {#if canManage}
              <a
                use:route
                href="/lost-found/report"
                class="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-200 transition-all hover:bg-slate-800 active:scale-95"
              >
                <svg
                  class="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2.5"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Report Item
              </a>
            {/if}
          </div>
        </div>

        {#if showFilters}
          <div
            class="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-blue-900/5 ring-1 ring-black/5"
            transition:slide={{ duration: 500 }}
          >
            <div class="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
              <div>
                <p
                  class="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500"
                >
                  Type
                </p>
                <div class="grid grid-cols-2 gap-1.5">
                  <button
                    onclick={() => (itemType = "lost")}
                    class="h-10 rounded-lg px-3 text-xs font-semibold transition {itemType ===
                    'lost'
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}"
                  >
                    Lost
                  </button>
                  <button
                    onclick={() => (itemType = "found")}
                    class="h-10 rounded-lg px-3 text-xs font-semibold transition {itemType ===
                    'found'
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}"
                  >
                    Found
                  </button>
                </div>
              </div>

              <div class="relative">
                <label
                  for="lf-category-filter"
                  class="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500"
                  >Category</label
                >
                <select
                  id="lf-category-filter"
                  bind:value={category}
                  class="h-10 w-full bg-none rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-9 text-sm font-medium text-slate-700"
                >
                  {#each categories as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
                <svg
                  class="pointer-events-none absolute right-3 top-8.25 h-4 w-4 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>

              <div class="relative">
                <label
                  for="lf-status-filter"
                  class="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500"
                  >Status</label
                >
                <select
                  id="lf-status-filter"
                  bind:value={status}
                  class="h-10 w-full bg-none rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-9 text-sm font-medium text-slate-700"
                >
                  {#each statuses as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
                <svg
                  class="pointer-events-none absolute right-3 top-8.25 h-4 w-4 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>
        {/if}

        <div class="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            onclick={() => (itemType = "lost")}
            class="rounded-xl border px-4 py-2 text-xs font-bold transition-all {itemType ===
            'lost'
              ? 'border-blue-200 bg-blue-50 text-blue-700'
              : 'border-slate-100 bg-white text-slate-500 hover:border-blue-100 hover:bg-slate-50 hover:text-blue-600'}"
          >
            Lost
          </button>
          <button
            onclick={() => (itemType = "found")}
            class="rounded-xl border px-4 py-2 text-xs font-bold transition-all {itemType ===
            'found'
              ? 'border-blue-200 bg-blue-50 text-blue-700'
              : 'border-slate-100 bg-white text-slate-500 hover:border-blue-100 hover:bg-slate-50 hover:text-blue-600'}"
          >
            Found
          </button>
        </div>
      </div>
    </div>

    {#if listQuery.isLoading}
      <div class="flex flex-col items-center justify-center py-32">
        <LoadingSpinner text="Loading items..." />
      </div>
    {:else if listQuery.error}
      <div
        class="mx-auto max-w-md rounded-4xl border border-rose-100 bg-white p-10 text-center shadow-2xl"
      >
        <div
          class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-50 shadow-inner"
        >
          <svg
            class="h-10 w-10 text-rose-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <p class="text-lg font-black text-slate-900">
          Failed to load lost/found items
        </p>
        <p class="mt-2 text-sm text-slate-500">{listQuery.error.message}</p>
      </div>
    {:else}
      <div class="space-y-2.5">
        <div class="mb-4 flex items-center justify-between px-2">
          <div class="flex items-center gap-3">
            <div
              class="rounded-full bg-blue-600 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-white shadow-md shadow-blue-200"
            >
              Results
            </div>
            <p class="text-sm font-bold text-slate-500">
              {total} items discovered
            </p>
          </div>
          {#if canManage}
            <a
              use:route
              href="/lost-found/my"
              class="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50"
            >
              <svg
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              Personal Dashboard
            </a>
          {/if}
        </div>

        {#if items.length === 0}
          <div
            class="mx-auto mt-4 max-w-xl rounded-2xl border border-slate-100 bg-white px-6 py-8 text-center shadow-sm"
          >
            <div class="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <svg
                class="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <p class="text-xl font-extrabold tracking-tight text-slate-900">
              No items found
            </p>
            <p class="mt-1.5 text-sm text-slate-500">
              Try changing filters or search terms.
            </p>
          </div>
        {:else}
          <div
            class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          >
            {#each items as item (item.id)}
              <a
                use:route
                href={`/lost-found/${item.id}`}
                class="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"
              >
                <div
                  class="relative h-28 overflow-hidden bg-linear-to-br from-blue-50 to-indigo-100"
                >
                  {#if item.images?.[0]?.imageUrl}
                    <img
                      src={item.images[0].imageUrl}
                      alt={item.title}
                      class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  {:else}
                    <div class="flex h-full w-full items-center justify-center">
                      <svg
                        class="h-8 w-8 text-indigo-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M3 7h18M7 3v4m10-4v4M5 11h14v8H5z"
                        />
                      </svg>
                    </div>
                  {/if}

                  <div class="absolute left-2 top-2">
                    <span
                      class="inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold {statusClass(
                        item.status,
                      )}"
                    >
                      {item.status}
                    </span>
                  </div>
                  <div class="absolute right-2 top-2">
                    <span
                      class="inline-flex rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-gray-900 shadow-sm"
                    >
                      {item.itemType === "lost" ? "Lost" : "Found"}
                    </span>
                  </div>
                </div>

                <div class="p-3">
                  <h3
                    class="line-clamp-1 text-sm font-bold text-gray-900 transition-colors group-hover:text-blue-600"
                  >
                    {item.title}
                  </h3>
                  <p class="mt-0.5 line-clamp-1 text-xs text-gray-500">
                    {item.description}
                  </p>

                  <span
                    class="mt-2 inline-block rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600"
                  >
                    {item.category.replace("_", " ")}
                  </span>

                  <div
                    class="mt-2 flex items-center justify-between border-t border-gray-50 pt-2 text-[10px] text-gray-400"
                  >
                    <div class="flex items-center gap-1.5">
                      <svg
                        class="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M5.1 19a8 8 0 0113.8 0M12 11a4 4 0 100-8 4 4 0 000 8z"
                        />
                      </svg>
                      <span class="line-clamp-1"
                        >{item.owner?.name || "Unknown"}</span
                      >
                    </div>
                    <span>{getTimeAgo(item.createdAt)}</span>
                  </div>
                </div>
              </a>
            {/each}
          </div>
        {/if}
      </div>

      {#if hasMore}
        <div class="mt-6 flex justify-center">
          <button
            class="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-gray-50 disabled:opacity-60"
            onclick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
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
