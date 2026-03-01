<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import { query as routeQuery, route } from '@mateothegreat/svelte5-router'
  import { fade, fly } from 'svelte/transition'
  import { onMount } from 'svelte'
  import { searchEverything } from '../lib/api'
  import { getLocationIconUrlFor } from '../lib/location-icons'
  import LoadingSpinner from '../components/LoadingSpinner.svelte'

  let queryTerm = $state(routeQuery('q') || '')
  const searchTerm = $derived((queryTerm || '').trim())
  let selectedTypes = $state<
    Array<'clubs' | 'events' | 'books' | 'notices' | 'places' | 'lost_found'>
  >([
    'clubs',
    'events',
    'books',
    'notices',
    'places',
    'lost_found',
  ])

  function parseTypesFromUrl(value: string | null | undefined) {
    const valid = new Set(['clubs', 'events', 'books', 'notices', 'places', 'lost_found'])
    if (!value) return ['clubs', 'events', 'books', 'notices', 'places', 'lost_found'] as Array<
      'clubs' | 'events' | 'books' | 'notices' | 'places' | 'lost_found'
    >
    const parsed = value
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter((item) => valid.has(item)) as Array<
      'clubs' | 'events' | 'books' | 'notices' | 'places' | 'lost_found'
    >
    return parsed.length > 0
      ? parsed
      : (['clubs', 'events', 'books', 'notices', 'places', 'lost_found'] as Array<
          'clubs' | 'events' | 'books' | 'notices' | 'places' | 'lost_found'
        >)
  }

  function syncQueryFromUrl() {
    queryTerm = routeQuery('q') || ''
    selectedTypes = parseTypesFromUrl(routeQuery('types'))
  }

  onMount(() => {
    syncQueryFromUrl()
    window.addEventListener('pushState', syncQueryFromUrl)
    window.addEventListener('replaceState', syncQueryFromUrl)
    window.addEventListener('popstate', syncQueryFromUrl)

    return () => {
      window.removeEventListener('pushState', syncQueryFromUrl)
      window.removeEventListener('replaceState', syncQueryFromUrl)
      window.removeEventListener('popstate', syncQueryFromUrl)
    }
  })

  const searchQuery = createQuery(() => ({
    queryKey: ['global-search', searchTerm, selectedTypes.join(',')],
    enabled: searchTerm.length >= 2,
    queryFn: async () => {
      const result = await searchEverything(searchTerm, 20, selectedTypes)
      if (result.success && result.data) return result.data
      throw new Error(result.message || 'Search failed')
    },
    staleTime: 15 * 1000,
  }))

  function toggleType(type: 'clubs' | 'events' | 'books' | 'notices' | 'places' | 'lost_found') {
    const hasType = selectedTypes.includes(type)
    if (hasType) {
      if (selectedTypes.length === 1) return
      selectedTypes = selectedTypes.filter((item) => item !== type)
      return
    }
    selectedTypes = [...selectedTypes, type]
  }

  function getMapLocationHref(place: {
    name: string
    coordinates: { lat: number; lng: number }
  }) {
    const params = new URLSearchParams({
      focus: place.name,
      lat: String(place.coordinates.lat),
      lng: String(place.coordinates.lng),
    })
    return `/map?${params.toString()}`
  }

</script>

<div class="min-h-[calc(100vh-4rem)] bg-linear-to-b from-cyan-50 via-white to-blue-50 px-4 py-6 sm:px-6 lg:px-8">
  <div class="max-w-6xl mx-auto space-y-6">
    <section class="rounded-3xl border border-cyan-100 bg-white/80 backdrop-blur-sm p-6 shadow-lg shadow-cyan-100/45" in:fly={{ y: 16, duration: 300 }}>
      <p class="text-[11px] uppercase tracking-[0.18em] text-cyan-600 font-bold inline-flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3zm7 10l.9 2.1L22 16l-2.1.9L19 19l-.9-2.1L16 16l2.1-.9L19 13zM5 14l.9 2.1L8 17l-2.1.9L5 20l-.9-2.1L2 17l2.1-.9L5 14z"
          />
        </svg>
        Global Search
      </p>
      <h1 class="mt-2 text-2xl sm:text-3xl font-black text-slate-900">
        Results for <span class="text-cyan-600">"{searchTerm || '...'}"</span>
      </h1>
      <p class="mt-2 text-sm text-slate-500 max-w-3xl">
        Unified search across clubs, events, books, notices, lost &amp; found, and campus places.
      </p>
      <div class="mt-4 flex flex-wrap gap-2">
        {#each ['clubs', 'events', 'books', 'notices', 'lost_found', 'places'] as type}
          <button
            class="px-3 py-1.5 rounded-full text-xs font-semibold border transition {selectedTypes.includes(
              type as any,
            )
              ? 'bg-cyan-600 text-white border-cyan-600'
              : 'bg-white text-slate-600 border-slate-200 hover:border-cyan-300'}"
            onclick={() => toggleType(type as any)}
          >
            {type === 'lost_found' ? 'lost & found' : type}
          </button>
        {/each}
      </div>
    </section>

    {#if searchTerm.length < 2}
      <section class="rounded-3xl border border-slate-200 bg-white p-8 text-center" in:fade>
        <div class="mx-auto mb-3 w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-5.2-5.2M16 10.8a5.2 5.2 0 11-10.4 0 5.2 5.2 0 0110.4 0z"
            />
          </svg>
        </div>
        <h2 class="text-xl font-bold text-slate-900">Type at least 2 characters</h2>
        <p class="mt-2 text-sm text-slate-500">Try searching "robotics", "library", "civil", or "results".</p>
      </section>
    {:else if searchQuery.isLoading}
      <section class="rounded-3xl border border-slate-200 bg-white p-12 flex justify-center" in:fade>
        <LoadingSpinner size="lg" text="Searching all modules..." />
      </section>
    {:else if searchQuery.error}
      <section class="rounded-3xl border border-rose-200 bg-rose-50 p-8" in:fade>
        <h2 class="text-xl font-bold text-rose-700">Search failed</h2>
        <p class="mt-2 text-sm text-rose-600">{searchQuery.error.message}</p>
      </section>
    {:else if searchQuery.data}
      {@const data = searchQuery.data}
      <section class="grid items-start grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" transition:fade>
        {#if selectedTypes.includes('clubs')}
        <article class="rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm">
          <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
            <span class="w-7 h-7 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17 20h5v-2a4 4 0 00-5-3.87M17 20H7m10 0v-2c0-.65-.12-1.28-.34-1.87M7 20H2v-2a4 4 0 015-3.87M7 20v-2c0-.65.12-1.28.34-1.87M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM5 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </span>
            Clubs ({data.clubs.length})
          </h3>
          <div class="mt-2.5 space-y-1.5">
            {#if data.clubs.length === 0}
              <p class="text-[13px] text-slate-500">No matches.</p>
            {:else}
              {#each data.clubs as club}
                <a use:route href={`/clubs/${club.id}`} class="group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-cyan-50 text-slate-700 hover:text-cyan-700 transition">
                  <div class="w-8 h-8 rounded-lg bg-cyan-100 overflow-hidden flex items-center justify-center shrink-0">
                    {#if club.logoUrl}
                      <img src={club.logoUrl} alt={club.name} class="w-full h-full object-cover" />
                    {:else}
                      <span class="text-[13px] font-bold text-cyan-700">{club.name.charAt(0).toUpperCase()}</span>
                    {/if}
                  </div>
                  <span class="truncate flex-1 text-[13px]">{club.name}</span>
                  <svg class="w-3.5 h-3.5 text-slate-300 group-hover:text-cyan-600 transition shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              {/each}
            {/if}
          </div>
        </article>
        {/if}

        {#if selectedTypes.includes('events')}
        <article class="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
            <span class="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 7V3m8 4V3m-9 8h10m-13 9h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v11a2 2 0 002 2z"
                />
              </svg>
            </span>
            Events ({data.events.length})
          </h3>
          <div class="mt-2.5 space-y-1.5">
            {#if data.events.length === 0}
              <p class="text-[13px] text-slate-500">No matches.</p>
            {:else}
              {#each data.events as event}
                <a use:route href={`/clubs/${event.clubId}/events/${event.id}`} class="group flex items-start gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-blue-50 transition">
                  <div class="w-14 h-10 mt-0.5 rounded-lg border border-blue-100 bg-blue-50 overflow-hidden flex items-center justify-center shrink-0">
                    {#if event.bannerUrl}
                      <img
                        src={event.bannerUrl}
                        alt={`${event.title} banner`}
                        class="w-full h-full object-cover"
                        loading="lazy"
                      />
                    {:else}
                      <svg class="w-3.5 h-3.5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M4 9a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 010 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 010-4V9z"
                        />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v8" />
                      </svg>
                    {/if}
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-[13px] font-semibold text-slate-800 flex items-center justify-between gap-2">
                      <span class="truncate">{event.title}</span>
                      <svg class="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 transition shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </p>
                    <p class="text-[11px] text-slate-500 truncate">{event.club?.name || 'Event'}</p>
                  </div>
                </a>
              {/each}
            {/if}
          </div>
        </article>
        {/if}

        {#if selectedTypes.includes('books')}
        <article class="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
            <span class="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 6.25v13.5m0-13.5c-1.9-1.45-4.5-2.25-7.25-2.25v13.5c2.75 0 5.35.8 7.25 2.25m0-13.5c1.9-1.45 4.5-2.25 7.25-2.25v13.5c-2.75 0-5.35.8-7.25 2.25"
                />
              </svg>
            </span>
            Books ({data.books.length})
          </h3>
          <div class="mt-2.5 space-y-1.5">
            {#if data.books.length === 0}
              <p class="text-[13px] text-slate-500">No matches.</p>
            {:else}
              {#each data.books as book}
                <a use:route href={`/books/${book.id}`} class="group flex items-start gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-emerald-50 transition">
                  <div class="w-8 h-8 mt-0.5 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M7 4h10a1 1 0 011 1v15l-6-3-6 3V5a1 1 0 011-1z"
                      />
                    </svg>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-[13px] font-semibold text-slate-800 flex items-center justify-between gap-2">
                      <span class="truncate">{book.title}</span>
                      <svg class="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 transition shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </p>
                    <p class="text-[11px] text-slate-500 truncate">by {book.author}</p>
                  </div>
                </a>
              {/each}
            {/if}
          </div>
        </article>
        {/if}

        {#if selectedTypes.includes('notices')}
        <article class="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
          <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
            <span class="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .53-.2 1.04-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </span>
            Notices ({data.notices.length})
          </h3>
          <div class="mt-2.5 space-y-1.5">
            {#if data.notices.length === 0}
              <p class="text-[13px] text-slate-500">No matches.</p>
            {:else}
              {#each data.notices as notice}
                <a use:route href="/notices" class="group flex items-start gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-amber-50 transition">
                  <div class="w-8 h-8 mt-0.5 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8 3h7l4 4v13a1 1 0 01-1 1H8a2 2 0 01-2-2V5a2 2 0 012-2z"
                      />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 3v5h5M10 12h6M10 16h6" />
                    </svg>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-[13px] font-semibold text-slate-800 flex items-center justify-between gap-2">
                      <span class="truncate">{notice.title}</span>
                      <svg class="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-600 transition shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </p>
                    <p class="text-[11px] text-slate-500 line-clamp-2">{notice.section.toUpperCase()} / {notice.subsection.toUpperCase()}</p>
                  </div>
                </a>
              {/each}
            {/if}
          </div>
        </article>
        {/if}

        {#if selectedTypes.includes('lost_found')}
        <article class="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
          <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
            <span class="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="7" width="18" height="13" rx="2"></rect>
                <path d="M8 7V5a4 4 0 0 1 8 0v2"></path>
              </svg>
            </span>
            Lost &amp; Found ({data.lostFound.length})
          </h3>
          <div class="mt-2.5 space-y-1.5">
            {#if data.lostFound.length === 0}
              <p class="text-[13px] text-slate-500">No matches.</p>
            {:else}
              {#each data.lostFound as item}
                <a use:route href={`/lost-found/${item.id}`} class="group flex items-start gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-violet-50 transition">
                  <div class="w-8 h-8 mt-0.5 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shrink-0 overflow-hidden">
                    {#if item.imageUrl}
                      <img src={item.imageUrl} alt={item.title} class="w-full h-full object-cover" loading="lazy" />
                    {:else}
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="3" y="7" width="18" height="13" rx="2"></rect>
                        <path d="M8 7V5a4 4 0 0 1 8 0v2"></path>
                      </svg>
                    {/if}
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-[13px] font-semibold text-slate-800 flex items-center justify-between gap-2">
                      <span class="truncate">{item.title}</span>
                      <svg class="w-3.5 h-3.5 text-slate-300 group-hover:text-violet-600 transition shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </p>
                    <p class="text-[11px] text-slate-500 truncate">{item.itemType} • {item.locationText}</p>
                  </div>
                </a>
              {/each}
            {/if}
          </div>
        </article>
        {/if}

        {#if selectedTypes.includes('places')}
        <article class="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm md:col-span-2 xl:col-span-2">
          <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
            <span class="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17.7 8.3A5.7 5.7 0 116.3 8.3c0 4.9 5.7 10.7 5.7 10.7s5.7-5.8 5.7-10.7z"
                />
                <circle cx="12" cy="8.3" r="2.2" />
              </svg>
            </span>
            Campus Locations ({data.places.length})
          </h3>
          <div class="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {#if data.places.length === 0}
              <p class="text-[13px] text-slate-500">No matches.</p>
            {:else}
              {#each data.places as place}
                <a use:route href={getMapLocationHref(place)} class="group flex items-start gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-indigo-50 transition">
                  <div class="w-8 h-8 mt-0.5 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0 overflow-hidden">
                    <img
                      src={getLocationIconUrlFor(place)}
                      alt={`${place.name} icon`}
                      class="w-4 h-4 object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-[13px] font-semibold text-slate-800 flex items-center justify-between gap-2">
                      <span class="truncate">{place.name}</span>
                      <svg class="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 transition shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </p>
                    <p class="text-[11px] text-slate-500 line-clamp-2">{place.description}</p>
                  </div>
                </a>
              {/each}
            {/if}
          </div>
        </article>
        {/if}
      </section>
    {/if}
  </div>
</div>

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
