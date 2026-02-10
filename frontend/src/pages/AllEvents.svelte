<script lang="ts">
  import { query as routeQuery } from "@mateothegreat/svelte5-router";
  import { getAllEvents, type ClubEvent } from "../lib/api";
  import LoadingSpinner from "../components/LoadingSpinner.svelte";
  import EventCard from "../components/EventCard.svelte";
  import { fade } from "svelte/transition";
  import { authClient } from "../lib/auth-client";
  import { goto } from "@mateothegreat/svelte5-router";
  import { createQuery } from "@tanstack/svelte-query";
  import { getEventTimeMs, parseEventDateTime } from "../lib/event-dates";
  import { untrack } from "svelte";

  const session = authClient.useSession();
  let hasRedirectedToLogin = $state(false);
  const highlightedEventIdParam = Number(routeQuery("highlightEventId") || 0);
  let highlightedEventId = $state<number | null>(
    highlightedEventIdParam > 0 ? highlightedEventIdParam : null,
  );
  let hasAppliedEventHighlight = $state(false);

  const query = createQuery(() => ({
    queryKey: ["events"],
    queryFn: async () => {
      const result = await getAllEvents();
      if (!result.success || !result.allEvents) {
        throw new Error(result.message || "Failed to load events");
      }
      return result.allEvents;
    },
  }));

  $effect(() => {
    if (hasRedirectedToLogin) return;

    if (!$session.isPending && !$session.error && !$session.data?.user) {
      hasRedirectedToLogin = true;
      untrack(() => {
        goto("/register?message=login_required");
      });
    }
  });

  const categorizedEvents = $derived.by(
    (): {
      ongoing: ClubEvent[];
      upcoming: ClubEvent[];
      completed: ClubEvent[];
    } => {
      if (!query.data) {
        return { ongoing: [], upcoming: [], completed: [] };
      }
      const now = new Date();
      const sorted: ClubEvent[] = [...query.data].sort(
        (a, b) =>
          getEventTimeMs(b.eventStartTime) - getEventTimeMs(a.eventStartTime),
      );

      return {
        ongoing: sorted.filter((e) => {
          const start = parseEventDateTime(e.eventStartTime);
          const end = parseEventDateTime(e.eventEndTime);
          return (
            (e.status === "ongoing" || (start <= now && end >= now)) &&
            e.status !== "draft" &&
            e.status !== "completed" &&
            e.status !== "cancelled"
          );
        }),
        upcoming: sorted.filter((e) => {
          const start = parseEventDateTime(e.eventStartTime);
          return (
            start > now &&
            e.status !== "draft" &&
            e.status !== "completed" &&
            e.status !== "cancelled" &&
            e.status !== "ongoing"
          );
        }),
        completed: sorted.filter((e) => {
          const end = parseEventDateTime(e.eventEndTime);
          return (
            e.status !== "draft" &&
            (e.status === "completed" || end < now || e.status === "cancelled")
          );
        }),
      };
    },
  );

  $effect(() => {
    if (hasAppliedEventHighlight || !highlightedEventId) return;

    const exists =
      categorizedEvents.ongoing.some(
        (event) => event.id === highlightedEventId,
      ) ||
      categorizedEvents.upcoming.some(
        (event) => event.id === highlightedEventId,
      ) ||
      categorizedEvents.completed.some(
        (event) => event.id === highlightedEventId,
      );

    if (!exists) return;

    hasAppliedEventHighlight = true;
    requestAnimationFrame(() => {
      const element = document.getElementById(`event-${highlightedEventId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  });
</script>

<div class="min-h-[calc(100vh-4rem)] bg-gray-50/30 px-8 py-6 sm:px-6 lg:px-8">
  <div class="max-w-7xl mx-auto sm:px-4">
    {#if query.isLoading}
      <div class="flex items-center justify-center py-16" in:fade>
        <LoadingSpinner size="lg" text="Loading campus events..." />
      </div>
    {:else if query.error}
      <div class="text-center py-16 text-red-600" in:fade>
        <p class="text-lg font-bold">Failed to load events</p>
        <p class="mt-2 text-sm text-gray-600">{query.error.message}</p>
        <button
          onclick={() => query.refetch()}
          class="mt-4 px-4 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
        >
          Try Again
        </button>
      </div>
    {:else}
      <!-- Events Sections -->
      <div class="space-y-14">
        <!-- Ongoing Events -->
        {#if categorizedEvents.ongoing.length > 0}
          <section in:fade>
            <div class="flex items-center gap-3 mb-6">
              <h2 class="text-xl font-black text-gray-900 tracking-tight">
                Ongoing Events
              </h2>
              <div
                class="h-1 flex-1 bg-linear-to-r from-blue-500/20 to-transparent rounded-full"
              ></div>
              <span
                class="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-[11px] font-bold rounded-full uppercase"
                >Live Now</span
              >
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {#each categorizedEvents.ongoing as event, i (event.id)}
                <div
                  id={"event-" + event.id}
                  class={highlightedEventId === event.id
                    ? "rounded-2xl ring-2 ring-cyan-400 ring-offset-2 notif-highlight-blink"
                    : ""}
                >
                  <EventCard
                    {event}
                    clubId={event.clubId.toString()}
                    index={i}
                    isOngoing={true}
                  />
                </div>
              {/each}
            </div>
          </section>
        {/if}

        <!-- Upcoming Events -->
        <section in:fade>
          <div class="flex items-center gap-3 mb-6">
            <h2 class="text-xl font-black text-gray-900 tracking-tight">
              Upcoming Events
            </h2>
            <div
              class="h-1 flex-1 bg-linear-to-r from-emerald-500/20 to-transparent rounded-full"
            ></div>
            <span
              class="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded-full uppercase"
              >{categorizedEvents.upcoming.length} Events</span
            >
          </div>

          {#if categorizedEvents.upcoming.length === 0}
            <div
              class="bg-white rounded-3xl p-9 text-center border border-dashed border-gray-200"
            >
              <p class="text-sm text-gray-400 font-medium">
                No upcoming events scheduled yet.
              </p>
            </div>
          {:else}
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {#each categorizedEvents.upcoming as event, i (event.id)}
                <div
                  id={"event-" + event.id}
                  class={highlightedEventId === event.id
                    ? "rounded-2xl ring-2 ring-cyan-400 ring-offset-2 notif-highlight-blink"
                    : ""}
                >
                  <EventCard
                    {event}
                    clubId={event.clubId.toString()}
                    index={i}
                  />
                </div>
              {/each}
            </div>
          {/if}
        </section>

        <!-- Completed Events -->
        {#if categorizedEvents.completed.length > 0}
          <section in:fade>
            <div class="flex items-center gap-3 mb-6 text-gray-400">
              <h2 class="text-xl font-black tracking-tight">
                Completed Events
              </h2>
              <div class="h-1 flex-1 bg-gray-100 rounded-full"></div>
            </div>
            <div
              class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 opacity-75 grayscale-[0.5] hover:opacity-100 hover:grayscale-0 transition-all duration-500"
            >
              {#each categorizedEvents.completed as event, i (event.id)}
                <div
                  id={"event-" + event.id}
                  class={highlightedEventId === event.id
                    ? "rounded-2xl ring-2 ring-cyan-400 ring-offset-2 notif-highlight-blink"
                    : ""}
                >
                  <EventCard
                    {event}
                    clubId={event.clubId.toString()}
                    index={i}
                    isCompleted={true}
                  />
                </div>
              {/each}
            </div>
          </section>
        {/if}
      </div>
    {/if}
  </div>
</div>
