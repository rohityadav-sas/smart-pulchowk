<script lang="ts">
  import { route } from "@mateothegreat/svelte5-router";
  import { fly } from "svelte/transition";
  import type { ClubEvent } from "../lib/api";
  import {
    formatEventTime,
    parseEventDateTime,
  } from "../lib/event-dates";
  import { getEventStatusLabel } from "../lib/event-status";

  interface Props {
    event: ClubEvent;
    clubId: string;
    index: number;
    isOngoing?: boolean;
    isCompleted?: boolean;
  }

  let {
    event,
    clubId,
    index,
    isOngoing = false,
    isCompleted = false,
  }: Props = $props();

  function formatTime(dateStr: string): string {
    return formatEventTime(dateStr);
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case "published":
      case "upcoming":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "draft":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "cancelled":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "completed":
        return "bg-slate-100 text-slate-800 border-slate-200";
      case "ongoing":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  }
</script>

<a
  href="/clubs/{clubId}/events/{event.id}"
  use:route
  class="group relative bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-2xl hover:border-blue-200 transition-all duration-500 transform hover:-translate-y-2 flex flex-col h-full"
  in:fly={{ y: 20, duration: 600, delay: index * 50 }}
>
  <!-- Banner -->
  <div class="relative h-56 overflow-hidden">
    {#if event.bannerUrl}
      <img
        src={event.bannerUrl}
        alt={event.title}
        class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
      />
    {:else}
      <div
        class="w-full h-full bg-linear-to-br from-gray-800 to-gray-900 flex items-center justify-center"
      >
        <span class="text-2xl font-semibold text-white/70">Event</span>
      </div>
    {/if}

    <!-- Overlay for Ongoing -->
    {#if isOngoing}
      <div class="absolute inset-0 bg-blue-600/10 backdrop-blur-[2px]"></div>
      <div
        class="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-full uppercase shadow-lg animate-pulse"
      >
        <span class="w-2 h-2 bg-white rounded-full"></span>
        Live
      </div>
    {/if}

    <!-- Status Badge -->
    <div class="absolute top-4 right-4">
      <span
        class={`px-3 py-1 text-[10px] font-bold rounded-full shadow-sm border ${getStatusColor(event.status)} uppercase tracking-widest backdrop-blur-md bg-white/90`}
      >
        {getEventStatusLabel(event.status)}
      </span>
    </div>

    <!-- Date Block -->
    <div
      class="absolute bottom-4 left-4 right-4 flex items-end justify-between"
    >
      <div
        class="bg-white/95 backdrop-blur-sm px-3 py-2 rounded-2xl shadow-xl flex items-center"
      >
        <span class="text-[11px] font-bold text-blue-600 uppercase whitespace-nowrap">
          {parseEventDateTime(event.eventStartTime).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
    </div>
  </div>

  <!-- Content -->
  <div class="p-6 flex flex-col flex-1">
    {#if event.club?.name}
      <div class="mb-2">
        <span
          class="text-[10px] font-bold text-blue-600 uppercase tracking-widest"
          >{event.club.name}</span
        >
      </div>
    {/if}
    <h3
      class="text-xl font-extrabold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2"
    >
      {event.title}
    </h3>
    <p class="text-gray-500 text-sm leading-relaxed mb-6 line-clamp-2 flex-1">
      {event.description ||
        "Join us for an experience that's unlike anything you've seen before. Innovation meets community."}
    </p>

    <!-- Metadata -->
    <div class="space-y-3 pt-4 border-t border-gray-50">
      <div class="flex items-center justify-between text-xs text-gray-500">
        <div class="flex items-center gap-1.5">
          <svg
            class="w-4 h-4 text-blue-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{formatTime(event.eventStartTime)}</span>
        </div>
        {#if event.venue}
          <div class="flex items-center gap-1.5">
            <svg
              class="w-4 h-4 text-rose-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
            </svg>
            <span class="font-medium truncate max-w-25">{event.venue}</span>
          </div>
        {/if}
      </div>

      <!-- Registration Progress -->
      <div class="flex flex-col gap-1.5">
        <div
          class="flex items-center justify-between text-[10px] font-bold uppercase tracking-tight text-gray-400"
        >
          <span>Registration</span>
          <span
            >{event.currentParticipants}{event.maxParticipants
              ? ` / ${event.maxParticipants}`
              : ""}</span
          >
        </div>
        <div class="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <div
            class="h-full bg-blue-600 rounded-full transition-all duration-1000"
            style="width: {event.maxParticipants
              ? Math.min(
                  (event.currentParticipants / event.maxParticipants) * 100,
                  100,
                )
              : 100}%"
          ></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Hover Indicator -->
  <div
    class="absolute inset-0 ring-2 ring-blue-500 ring-opacity-0 group-hover:ring-opacity-20 transition-all duration-500 pointer-events-none rounded-3xl"
  ></div>
</a>

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
