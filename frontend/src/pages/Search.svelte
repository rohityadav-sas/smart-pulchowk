<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import { query as routeQuery, route } from '@mateothegreat/svelte5-router'
  import { fade, fly } from 'svelte/transition'
  import { onMount } from 'svelte'
  import { searchEverything } from '../lib/api'
  import LoadingSpinner from '../components/LoadingSpinner.svelte'

  let queryTerm = $state(routeQuery('q') || '')
  const searchTerm = $derived((queryTerm || '').trim())

  function syncQueryFromUrl() {
    queryTerm = routeQuery('q') || ''
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
    queryKey: ['global-search', searchTerm],
    enabled: searchTerm.length >= 2,
    queryFn: async () => {
      const result = await searchEverything(searchTerm, 20)
      if (result.success && result.data) return result.data
      throw new Error(result.message || 'Search failed')
    },
  }))

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

<div class="min-h-[calc(100vh-4rem)] bg-linear-to-b from-cyan-50 via-white to-blue-50 px-4 py-8 sm:px-6 lg:px-8">
  <div class="max-w-6xl mx-auto space-y-8">
    <section class="rounded-3xl border border-cyan-100 bg-white/80 backdrop-blur-sm p-8 shadow-xl shadow-cyan-100/50" in:fly={{ y: 16, duration: 300 }}>
      <p class="text-xs uppercase tracking-[0.2em] text-cyan-600 font-bold inline-flex items-center gap-2">
        <svg class="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3zm7 10l.9 2.1L22 16l-2.1.9L19 19l-.9-2.1L16 16l2.1-.9L19 13zM5 14l.9 2.1L8 17l-2.1.9L5 20l-.9-2.1L2 17l2.1-.9L5 14z"
          />
        </svg>
        Global Search
      </p>
      <h1 class="mt-2 text-3xl sm:text-4xl font-black text-slate-900">
        Results for <span class="text-cyan-600">"{searchTerm || '...'}"</span>
      </h1>
      <p class="mt-3 text-slate-500 max-w-3xl">
        Unified search across clubs, events, books, notices, and campus places.
      </p>
    </section>

    {#if searchTerm.length < 2}
      <section class="rounded-3xl border border-slate-200 bg-white p-10 text-center" in:fade>
        <div class="mx-auto mb-4 w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-5.2-5.2M16 10.8a5.2 5.2 0 11-10.4 0 5.2 5.2 0 0110.4 0z"
            />
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-slate-900">Type at least 2 characters</h2>
        <p class="mt-2 text-slate-500">Try searching "robotics", "library", "civil", or "results".</p>
      </section>
    {:else if searchQuery.isLoading}
      <section class="rounded-3xl border border-slate-200 bg-white p-16 flex justify-center" in:fade>
        <LoadingSpinner size="lg" text="Searching all modules..." />
      </section>
    {:else if searchQuery.error}
      <section class="rounded-3xl border border-rose-200 bg-rose-50 p-10" in:fade>
        <h2 class="text-2xl font-bold text-rose-700">Search failed</h2>
        <p class="mt-2 text-rose-600">{searchQuery.error.message}</p>
      </section>
    {:else if searchQuery.data}
      {@const data = searchQuery.data}
      <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5" transition:fade>
        <article class="rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm">
          <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span class="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div class="mt-3 space-y-2">
            {#if data.clubs.length === 0}
              <p class="text-sm text-slate-500">No matches.</p>
            {:else}
              {#each data.clubs as club}
                <a use:route href={`/clubs/${club.id}`} class="group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-cyan-50 text-slate-700 hover:text-cyan-700 transition">
                  <div class="w-9 h-9 rounded-xl bg-cyan-100 overflow-hidden flex items-center justify-center shrink-0">
                    {#if club.logoUrl}
                      <img src={club.logoUrl} alt={club.name} class="w-full h-full object-cover" />
                    {:else}
                      <span class="text-sm font-bold text-cyan-700">{club.name.charAt(0).toUpperCase()}</span>
                    {/if}
                  </div>
                  <span class="truncate flex-1">{club.name}</span>
                  <svg class="w-4 h-4 text-slate-300 group-hover:text-cyan-600 transition shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              {/each}
            {/if}
          </div>
        </article>

        <article class="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span class="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div class="mt-3 space-y-2">
            {#if data.events.length === 0}
              <p class="text-sm text-slate-500">No matches.</p>
            {:else}
              {#each data.events as event}
                <a use:route href={`/clubs/${event.clubId}/events/${event.id}`} class="group flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-blue-50 transition">
                  <div class="w-9 h-9 mt-0.5 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4 9a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 010 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 010-4V9z"
                      />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v8" />
                    </svg>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold text-slate-800 flex items-center justify-between gap-2">
                      <span class="truncate">{event.title}</span>
                      <svg class="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </p>
                    <p class="text-xs text-slate-500 truncate">{event.club?.name || 'Event'}</p>
                  </div>
                </a>
              {/each}
            {/if}
          </div>
        </article>

        <article class="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span class="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div class="mt-3 space-y-2">
            {#if data.books.length === 0}
              <p class="text-sm text-slate-500">No matches.</p>
            {:else}
              {#each data.books as book}
                <a use:route href={`/books/${book.id}`} class="group flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-emerald-50 transition">
                  <div class="w-9 h-9 mt-0.5 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M7 4h10a1 1 0 011 1v15l-6-3-6 3V5a1 1 0 011-1z"
                      />
                    </svg>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold text-slate-800 flex items-center justify-between gap-2">
                      <span class="truncate">{book.title}</span>
                      <svg class="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </p>
                    <p class="text-xs text-slate-500 truncate">by {book.author}</p>
                  </div>
                </a>
              {/each}
            {/if}
          </div>
        </article>

        <article class="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span class="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div class="mt-3 space-y-2">
            {#if data.notices.length === 0}
              <p class="text-sm text-slate-500">No matches.</p>
            {:else}
              {#each data.notices as notice}
                <a use:route href="/notices" class="group flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-amber-50 transition">
                  <div class="w-9 h-9 mt-0.5 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <p class="font-semibold text-slate-800 flex items-center justify-between gap-2">
                      <span class="truncate">{notice.title}</span>
                      <svg class="w-4 h-4 text-slate-300 group-hover:text-amber-600 transition shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </p>
                    <p class="text-xs text-slate-500 line-clamp-2">{notice.section.toUpperCase()} / {notice.subsection.toUpperCase()}</p>
                  </div>
                </a>
              {/each}
            {/if}
          </div>
        </article>

        <article class="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm md:col-span-2 xl:col-span-2">
          <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span class="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {#if data.places.length === 0}
              <p class="text-sm text-slate-500">No matches.</p>
            {:else}
              {#each data.places as place}
                <a use:route href={getMapLocationHref(place)} class="group flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-indigo-50 transition">
                  <div class="w-9 h-9 mt-0.5 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M5 3v18M5 4h10l-1.5 3L15 10H5"
                      />
                    </svg>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold text-slate-800 flex items-center justify-between gap-2">
                      <span class="truncate">{place.name}</span>
                      <svg class="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </p>
                    <p class="text-xs text-slate-500 line-clamp-2">{place.description}</p>
                  </div>
                </a>
              {/each}
            {/if}
          </div>
        </article>
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
