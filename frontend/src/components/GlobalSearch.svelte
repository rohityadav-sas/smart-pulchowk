<script lang="ts">
  import { goto, route } from "@mateothegreat/svelte5-router";
  import { fade, fly } from "svelte/transition";
  import { onMount } from "svelte";
  import { searchEverything, type GlobalSearchResponse } from "../lib/api";
  import { getLocationIconUrlFor } from "../lib/location-icons";

  let wrapper: HTMLDivElement | null = $state(null);
  let query = $state("");
  let open = $state(false);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let results = $state<GlobalSearchResponse | null>(null);
  let { size = "lg" }: { size?: "sm" | "lg" } = $props();

  let scope = $state<
    "all" | "clubs" | "events" | "books" | "notices" | "places" | "lost_found"
  >("all");
  const quickResultsCache = new Map<string, GlobalSearchResponse>();

  const trimmedQuery = $derived(query.trim());

  let debounce: ReturnType<typeof setTimeout> | null = null;

  function normalizeSearchTerm(term: string) {
    return term.trim().toLowerCase();
  }

  function getMapLocationHref(place: GlobalSearchResponse["places"][number]) {
    const params = new URLSearchParams({
      focus: place.name,
      lat: String(place.coordinates.lat),
      lng: String(place.coordinates.lng),
    });
    return `/map?${params.toString()}`;
  }

  async function runSearch(term: string) {
    const cacheKey = `${scope}:${normalizeSearchTerm(term)}`;
    const cached = quickResultsCache.get(cacheKey);
    if (cached) {
      error = null;
      loading = false;
      results = cached;
      return;
    }

    loading = true;
    error = null;
    const response = await searchEverything(
      term,
      4,
      scope === "all" ? undefined : [scope],
    );
    if (response.success && response.data) {
      quickResultsCache.set(cacheKey, response.data);
      results = response.data;
    } else {
      error = response.message || "Search failed";
      results = null;
    }
    loading = false;
  }

  function submitSearch() {
    const term = trimmedQuery;
    if (!term) return;

    open = false;
    const params = new URLSearchParams({ q: term });
    if (scope !== "all") params.set("types", scope);
    goto(`/search?${params.toString()}`);
  }

  function handleClickOutside(event: MouseEvent) {
    if (!wrapper) return;
    if (!wrapper.contains(event.target as Node)) open = false;
  }

  onMount(() => {
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  });

  $effect(() => {
    const term = trimmedQuery;

    if (debounce) clearTimeout(debounce);

    if (!open || term.length < 2) {
      loading = false;
      if (term.length < 2) results = null;
      return;
    }

    const cached = quickResultsCache.get(
      `${scope}:${normalizeSearchTerm(term)}`,
    );
    if (cached) {
      error = null;
      loading = false;
      results = cached;
      return;
    }

    debounce = setTimeout(() => {
      runSearch(term);
    }, 250);

    return () => {
      if (debounce) clearTimeout(debounce);
    };
  });
</script>

<div bind:this={wrapper} class="relative w-full max-w-2xl">
  <form
    class="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/92 {size ===
    'sm'
      ? 'p-1'
      : 'p-1.5'}"
    onsubmit={(e) => {
      e.preventDefault();
      submitSearch();
    }}
  >
    <div
      class="flex-1 flex items-center gap-2.5 {size === 'sm'
        ? 'px-1.5'
        : 'px-2.5'}"
    >
      <div
        class="{size === 'sm'
          ? 'h-6 w-8'
          : 'h-7 w-9'} rounded-lg bg-cyan-50 border border-cyan-100 flex items-center justify-center"
      >
        <svg
          class="{size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} text-cyan-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-5.2-5.2M16 10.8a5.2 5.2 0 11-10.4 0 5.2 5.2 0 0110.4 0z"
          />
        </svg>
      </div>
      <input
        bind:value={query}
        onfocus={() => (open = true)}
        placeholder={size === "sm"
          ? "Search..."
          : "Search clubs, events, books, notices, locations..."}
        class="{size === 'sm'
          ? 'h-8'
          : 'h-9'} w-full bg-transparent text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-hidden"
      />
    </div>
    <div class="relative {size === 'sm' ? 'hidden' : 'block'}">
      <select
        bind:value={scope}
        aria-label="Search scope"
        class="h-9 min-w-24 appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-sm font-medium text-slate-600 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 focus:outline-none"
      >
        <option value="all">All</option>
        <option value="clubs">Clubs</option>
        <option value="events">Events</option>
        <option value="books">Books</option>
        <option value="notices">Notices</option>
        <option value="lost_found">Lost & Found</option>
        <option value="places">Places</option>
      </select>
      <svg
        class="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
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
    <button
      type="submit"
      class="inline-flex cursor-pointer {size === 'sm'
        ? 'h-8 px-2.5'
        : 'h-9 px-3.5'} items-center gap-1.5 rounded-xl bg-linear-to-r from-cyan-600 to-blue-600 text-white text-[13px] font-semibold hover:from-cyan-700 hover:to-blue-700 transition-colors"
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
          d="M21 21l-5.2-5.2M16 10.8a5.2 5.2 0 11-10.4 0 5.2 5.2 0 0110.4 0z"
        />
      </svg>
      {#if size !== "sm"}
        Search
      {/if}
    </button>
  </form>

  {#if open && trimmedQuery.length >= 2}
    <div
      class="absolute z-60 top-[calc(100%+0.5rem)] w-full bg-white border border-slate-200 rounded-2xl shadow-lg shadow-slate-300/25 overflow-hidden"
      transition:fade
    >
      {#if loading}
        <div class="px-4 py-5 text-[13px] text-slate-500">
          Searching campus...
        </div>
      {:else if error}
        <div class="px-4 py-5 text-[13px] text-rose-600">{error}</div>
      {:else if results}
        <div class="max-h-[65vh] overflow-auto">
          {#if results.total === 0}
            <div class="px-4 py-6 text-sm text-slate-500">
              No results found.
            </div>
          {:else}
            <div
              class="p-2.5 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] font-bold text-slate-400"
            >
              <svg
                class="w-3 h-3 text-cyan-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3zm7 10l.9 2.1L22 16l-2.1.9L19 19l-.9-2.1L16 16l2.1-.9L19 13zM5 14l.9 2.1L8 17l-2.1.9L5 20l-.9-2.1L2 17l2.1-.9L5 14z"
                />
              </svg>
              Quick Results
            </div>

            {#if results.clubs.length > 0}
              <div class="px-3 pb-2">
                <p
                  class="px-2 py-1 text-[11px] font-semibold text-slate-500 flex items-center gap-1.5"
                >
                  <svg
                    class="w-3 h-3 text-cyan-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M17 20h5v-2a4 4 0 00-5-3.87M17 20H7m10 0v-2c0-.65-.12-1.28-.34-1.87M7 20H2v-2a4 4 0 015-3.87M7 20v-2c0-.65.12-1.28.34-1.87M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM5 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  Clubs
                </p>
                {#each results.clubs as club}
                  <a
                    use:route
                    href={`/clubs/${club.id}`}
                    onclick={() => (open = false)}
                    class="group flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-cyan-50 transition"
                  >
                    <div
                      class="w-7 h-7 rounded-lg bg-cyan-100 overflow-hidden flex items-center justify-center"
                    >
                      {#if club.logoUrl}
                        <img
                          src={club.logoUrl}
                          alt={club.name}
                          class="w-full h-full object-cover"
                        />
                      {:else}
                        <span class="text-[11px] font-bold text-cyan-700"
                          >{club.name.charAt(0)}</span
                        >
                      {/if}
                    </div>
                    <div class="min-w-0">
                      <p
                        class="text-[13px] font-semibold text-slate-800 truncate"
                      >
                        {club.name}
                      </p>
                    </div>
                    <svg
                      class="w-3.5 h-3.5 text-slate-300 group-hover:text-cyan-600 ml-auto transition"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </a>
                {/each}
              </div>
            {/if}

            {#if results.events.length > 0}
              <div class="px-3 pb-2">
                <p
                  class="px-2 py-1 text-[11px] font-semibold text-slate-500 flex items-center gap-1.5"
                >
                  <svg
                    class="w-3 h-3 text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 7V3m8 4V3m-9 8h10m-13 9h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v11a2 2 0 002 2z"
                    />
                  </svg>
                  Events
                </p>
                {#each results.events as event}
                  <a
                    use:route
                    href={`/clubs/${event.clubId}/events/${event.id}`}
                    onclick={() => (open = false)}
                    class="group flex items-start gap-2.5 px-2 py-1.5 rounded-lg hover:bg-blue-50 transition"
                  >
                    <div
                      class="w-9 h-9 mt-0.5 rounded-lg border border-blue-100 bg-blue-50 overflow-hidden flex items-center justify-center shrink-0"
                    >
                      {#if event.bannerUrl}
                        <img
                          src={event.bannerUrl}
                          alt={`${event.title} banner`}
                          class="w-full h-full object-cover"
                          loading="lazy"
                        />
                      {:else}
                        <svg
                          class="w-3 h-3 text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M8 7V3m8 4V3m-9 8h10m-13 9h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v11a2 2 0 002 2z"
                          />
                        </svg>
                      {/if}
                    </div>
                    <div class="min-w-0 flex-1">
                      <p
                        class="text-[13px] font-semibold text-slate-800 truncate"
                      >
                        {event.title}
                      </p>
                      <p class="text-[11px] text-slate-500 truncate">
                        {event.club?.name || "Event"}
                      </p>
                    </div>
                    <svg
                      class="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 mt-1 transition"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </a>
                {/each}
              </div>
            {/if}

            {#if results.books.length > 0}
              <div class="px-3 pb-2">
                <p
                  class="px-2 py-1 text-[11px] font-semibold text-slate-500 flex items-center gap-1.5"
                >
                  <svg
                    class="w-3 h-3 text-emerald-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 6.25v13.5m0-13.5c-1.9-1.45-4.5-2.25-7.25-2.25v13.5c2.75 0 5.35.8 7.25 2.25m0-13.5c1.9-1.45-4.5-2.25-7.25-2.25v13.5c-2.75 0-5.35.8-7.25 2.25"
                    />
                  </svg>
                  Books
                </p>
                {#each results.books as book}
                  <a
                    use:route
                    href={`/books/${book.id}`}
                    onclick={() => (open = false)}
                    class="group flex items-start gap-2.5 px-2 py-1.5 rounded-lg hover:bg-emerald-50 transition"
                  >
                    <div
                      class="w-6 h-6 mt-0.5 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0"
                    >
                      <svg
                        class="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M12 6.25v13.5m0-13.5c-1.9-1.45-4.5-2.25-7.25-2.25v13.5c2.75 0 5.35.8 7.25 2.25m0-13.5c1.9-1.45-4.5-2.25-7.25-2.25v13.5c-2.75 0-5.35.8-7.25 2.25"
                        />
                      </svg>
                    </div>
                    <div class="min-w-0 flex-1">
                      <p
                        class="text-[13px] font-semibold text-slate-800 truncate"
                      >
                        {book.title}
                      </p>
                      <p class="text-[11px] text-slate-500 truncate">
                        by {book.author}
                      </p>
                    </div>
                    <svg
                      class="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 mt-1 transition"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </a>
                {/each}
              </div>
            {/if}

            {#if results.notices.length > 0}
              <div class="px-3 pb-2">
                <p
                  class="px-2 py-1 text-[11px] font-semibold text-slate-500 flex items-center gap-1.5"
                >
                  <svg
                    class="w-3 h-3 text-amber-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .53-.2 1.04-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  Notices
                </p>
                {#each results.notices as note}
                  <a
                    use:route
                    href="/notices"
                    onclick={() => (open = false)}
                    class="group flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-amber-50 transition"
                  >
                    <div
                      class="w-6 h-6 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0"
                    >
                      <svg
                        class="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .53-.2 1.04-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                        />
                      </svg>
                    </div>
                    <p
                      class="text-[13px] font-semibold text-slate-800 truncate flex-1"
                    >
                      {note.title}
                    </p>
                    <svg
                      class="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-600 transition"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </a>
                {/each}
              </div>
            {/if}

            {#if results.lostFound.length > 0}
              <div class="px-3 pb-2">
                <p
                  class="px-2 py-1 text-[11px] font-semibold text-slate-500 flex items-center gap-1.5"
                >
                  <svg
                    class="w-3 h-3 text-indigo-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M20 13V7a2 2 0 00-2-2h-3V3H9v2H6a2 2 0 00-2 2v6m16 0v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6m16 0H4"
                    />
                  </svg>
                  Lost & Found
                </p>
                {#each results.lostFound as item}
                  <a
                    use:route
                    href={`/lost-found/${item.id}`}
                    onclick={() => (open = false)}
                    class="group flex items-start gap-2.5 px-2 py-1.5 rounded-lg hover:bg-indigo-50 transition"
                  >
                    <div
                      class="w-7 h-7 mt-0.5 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0 overflow-hidden"
                    >
                      {#if item.imageUrl}
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          class="w-full h-full object-cover"
                        />
                      {:else}
                        <svg
                          class="w-3.5 h-3.5 text-indigo-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M20 13V7a2 2 0 00-2-2h-3V3H9v2H6a2 2 0 00-2 2v6m16 0v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6m16 0H4"
                          />
                        </svg>
                      {/if}
                    </div>
                    <div class="min-w-0 flex-1">
                      <p
                        class="text-[13px] font-semibold text-slate-800 truncate"
                      >
                        {item.title}
                      </p>
                      <p class="text-[11px] text-slate-500 truncate capitalise">
                        {item.itemType} • {item.locationText}
                      </p>
                    </div>
                    <svg
                      class="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 mt-1 transition"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </a>
                {/each}
              </div>
            {/if}

            {#if results.places.length > 0}
              <div class="px-3 pb-2">
                <p
                  class="px-2 py-1 text-[11px] font-semibold text-slate-500 flex items-center gap-1.5"
                >
                  <svg
                    class="w-3 h-3 text-indigo-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M17.7 8.3A5.7 5.7 0 116.3 8.3c0 4.9 5.7 10.7 5.7 10.7s5.7-5.8 5.7-10.7z"
                    />
                    <circle cx="12" cy="8.3" r="2.2" />
                  </svg>
                  Places
                </p>
                {#each results.places as place}
                  <a
                    use:route
                    href={getMapLocationHref(place)}
                    onclick={() => (open = false)}
                    class="group flex items-start gap-2.5 px-2 py-1.5 rounded-lg hover:bg-indigo-50 transition"
                  >
                    <div
                      class="w-6 h-6 mt-0.5 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0 overflow-hidden"
                    >
                      <img
                        src={getLocationIconUrlFor(place)}
                        alt={`${place.name} icon`}
                        class="w-3.5 h-3.5 object-contain"
                        loading="lazy"
                      />
                    </div>
                    <div class="min-w-0 flex-1">
                      <p
                        class="text-[13px] font-semibold text-slate-800 truncate"
                      >
                        {place.name}
                      </p>
                      <p class="text-[11px] text-slate-500 truncate">
                        {place.description}
                      </p>
                    </div>
                    <svg
                      class="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 mt-1 transition"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </a>
                {/each}
              </div>
            {/if}

            <div class="p-3 border-t border-slate-100">
              <button
                onclick={submitSearch}
                class="w-full px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[13px] font-semibold hover:bg-slate-800 transition"
              >
                View all results for "{trimmedQuery}"
              </button>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>
