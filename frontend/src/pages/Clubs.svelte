<script lang="ts">
  import { route, goto } from "@mateothegreat/svelte5-router";
  import { getClubs, type Club } from "../lib/api";
  import LoadingSpinner from "../components/LoadingSpinner.svelte";
  import { fade, fly } from "svelte/transition";
  import { authClient } from "../lib/auth-client";
  import { createQuery } from "@tanstack/svelte-query";
  import { untrack } from "svelte";

  const session = authClient.useSession();

  const query = createQuery(() => ({
    queryKey: ["clubs"],
    queryFn: async () => {
      const result = await getClubs();
      if (result.success && result.existingClub) {
        return result.existingClub;
      }
      throw new Error(result.message || "Failed to load clubs");
    },
  }));

  $effect(() => {
    if (!$session.isPending && !$session.error && !$session.data?.user) {
      untrack(() => {
        goto("/register?message=login_required");
      });
    }
  });

  const gradients = [
    "from-blue-500 to-indigo-600",
    "from-purple-500 to-pink-600",
    "from-emerald-500 to-teal-600",
    "from-orange-500 to-red-600",
    "from-cyan-500 to-blue-600",
    "from-rose-500 to-purple-600",
    "from-amber-500 to-orange-600",
    "from-lime-500 to-emerald-600",
  ];

  function getGradient(index: number): string {
    return gradients[index % gradients.length];
  }
</script>

<div class="min-h-[calc(100vh-4rem)] bg-gray-50/50 px-4 py-6 sm:px-6 lg:px-8">
  <div class="max-w-7xl mx-auto sm:px-4">
    <!-- Header -->
    <div class="text-center mb-10 animate-fade-in">
      {#if $session.data?.user && ($session.data.user as any).role === "admin"}
        <a
          href="/create-club"
          use:route
          class="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 active:scale-95"
          in:fly={{ y: 10, duration: 400, delay: 200 }}
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
          Create New Club
        </a>
      {/if}
    </div>

    {#if query.isLoading}
      <div class="flex items-center justify-center py-16" in:fade>
        <LoadingSpinner size="lg" text="Discovering clubs..." />
      </div>
    {:else if query.error}
      <div
        class="max-w-md mx-auto p-5 bg-white border border-red-100 rounded-2xl shadow-lg text-center"
        in:fly={{ y: 20, duration: 400 }}
      >
        <div
          class="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3"
        >
          <svg
            class="w-7 h-7 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            ></path>
          </svg>
        </div>
        <h3 class="text-base font-bold text-gray-900 mb-2">
          Something went wrong
        </h3>
        <p class="text-sm text-gray-500 mb-5">{query.error.message}</p>
        <button
          onclick={() => query.refetch()}
          class="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95"
        >
          Try Again
        </button>
      </div>
    {:else if !query.data || query.data.length === 0}
      <div
        class="text-center py-16 bg-white rounded-3xl shadow-sm border border-gray-100 p-6"
        in:fade
      >
        <div
          class="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-5"
        >
          <svg
            class="w-10 h-10 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            ></path>
          </svg>
        </div>
        <h2 class="text-xl font-bold text-gray-900 mb-2">No Clubs Found</h2>
        <p class="text-sm text-gray-500">
          The campus is quiet for now. Check back later!
        </p>
      </div>
    {:else}
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {#each query.data as club, i (club.id)}
          <a
            href="/clubs/{club.id}"
            use:route
            class="group relative bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:border-blue-300 transition-all duration-500 transform hover:-translate-y-1.5 animate-slide-up"
            style="animation-delay: {i * 100}ms"
          >
            <!-- Club Banner/Logo -->
            <div class="relative h-32 overflow-hidden">
              {#if club.logoUrl}
                <img
                  src={club.logoUrl}
                  alt={club.name}
                  class="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                />
                <div
                  class="absolute inset-0 bg-linear-to-t from-gray-900/80 via-gray-900/20 to-transparent opacity-80"
                ></div>
              {:else}
                <div
                  class="w-full h-full bg-linear-to-br {getGradient(
                    i,
                  )} flex items-center justify-center relative overflow-hidden"
                >
                  <!-- Abstract pattern/overlay -->
                  <div
                    class="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,var(--tw-gradient-from)_0%,transparent_70%)]"
                  ></div>
                  <span
                    class="text-4xl font-black text-white/90 transform group-hover:scale-115 transition-transform duration-500 drop-shadow-2xl"
                  >
                    {club.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              {/if}

              <!-- Floating Badge -->
              <div
                class="absolute top-2 right-2 bg-gray-900/50 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[8px] font-bold text-white uppercase tracking-wider border border-white/20 shadow-lg"
              >
                Official Club
              </div>
            </div>

            <!-- Club Info -->
            <div class="p-4 relative">
              <!-- Floating Icon Profile -->
              <div class="absolute -top-6 left-4">
                <div
                  class="w-11 h-11 rounded-lg bg-white p-0.5 shadow-lg border border-gray-50 transform -rotate-3 group-hover:rotate-0 transition-transform duration-300"
                >
                  {#if club.logoUrl}
                    <img
                      src={club.logoUrl}
                      alt=""
                      class="w-full h-full object-cover rounded-lg"
                    />
                  {:else}
                    <div
                      class="w-full h-full rounded-lg bg-gray-50 flex items-center justify-center font-bold text-sm text-blue-600"
                    >
                      {club.name.charAt(0)}
                    </div>
                  {/if}
                </div>
              </div>

              <div class="mt-4">
                <h3
                  class="text-sm font-extrabold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors line-clamp-1"
                >
                  {club.name}
                </h3>
                <p
                  class="text-gray-500 text-[11px] leading-relaxed line-clamp-3 min-h-10"
                >
                  {club.description ||
                    "The vibrant community of students at Pulchowk Campus, dedicated to excellence and innovation."}
                </p>

                <!-- Stats/Details Row -->
                <div
                  class="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between text-gray-400"
                >
                  <div class="flex items-center gap-1">
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
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span class="text-[10px] font-medium">Club Details</span>
                  </div>

                  <div
                    class="flex items-center text-blue-600 text-[10px] font-bold uppercase tracking-wide group-hover:translate-x-0.5 transition-transform duration-300"
                  >
                    <span>View Events</span>
                    <svg
                      class="w-3 h-3 ml-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M17 8l4 4m0 0l-4 4m4-4H3"
                      ></path>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <!-- Hover Glow Effect -->
            <div
              class="absolute inset-0 rounded-2xl ring-2 ring-blue-500 ring-opacity-0 group-hover:ring-opacity-20 transition-all duration-300 pointer-events-none"
            ></div>
          </a>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  /* Custom scrollbar for better aesthetics if needed */
  :global(body) {
    scrollbar-gutter: stable;
  }
</style>
