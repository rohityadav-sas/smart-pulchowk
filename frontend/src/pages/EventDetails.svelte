<script lang="ts">
  import { route as routeAction, goto } from "@mateothegreat/svelte5-router";
  import { authClient } from "../lib/auth-client";
  import {
    getClubEvents,
    getClub,
    registerForEvent,
    cancelRegistration,
    getRegisteredStudents,
    getEnrollments,
     getExtraEventDetails,
    createExtraEventDetails,
    updateExtraEventDetails,
    type ClubEvent,
    type Club,
    type ExtraEventDetail,
  } from "../lib/api";
  import LoadingSpinner from "../components/LoadingSpinner.svelte";
  import { fade, fly, slide } from "svelte/transition";

  const { route } = $props();
  const clubId = $derived(route.result.path.params.clubId);
  const eventId = $derived(route.result.path.params.eventId);

  const session = authClient.useSession();
  const userId = $derived($session.data?.user?.id);

  let club = $state<Club | null>(null);
  let event = $state<ClubEvent | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let actionLoading = $state(false);
  let actionMessage = $state<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  let isRegistered = $state(false);
  let registeredStudents = $state<any[]>([]);
  let isClubOwner = $state(false);

  // Extra details state
  let extraDetails = $state<ExtraEventDetail | null>(null);
  let isEditingDetails = $state(false);
  let editedDetails = $state<Partial<ExtraEventDetail>>({});
  let saveLoading = $state(false);

  $effect(() => {
    if (clubId && eventId) {
      loadEventDetails();
    }
  });

  $effect(() => {
    if (club && userId) {
      isClubOwner = club.authClubId === userId;
    }
  });

  $effect(() => {
    if (userId && !isClubOwner && event) {
      checkRegistrationStatus();
    }
  });

  $effect(() => {
    if (userId && isClubOwner && event) {
      loadRegisteredStudents();
    }
  });

  async function loadRegisteredStudents() {
    try {
      const studentsResult = await getRegisteredStudents(parseInt(eventId));
      if (Array.isArray(studentsResult)) {
        registeredStudents = studentsResult;
      }
    } catch (e) {
      console.error("Failed to load registered students", e);
    }
  }

  async function loadEventDetails() {
    loading = true;
    error = null;
    try {
      const [clubResult, eventsResult, detailsResult] = await Promise.all([
        getClub(parseInt(clubId)),
        getClubEvents(parseInt(clubId)),
        getExtraEventDetails(parseInt(eventId)),
      ]);

      if (clubResult.success && clubResult.clubData) {
        club = clubResult.clubData;
      }

      if (eventsResult.success && eventsResult.clubEvents) {
        event =
          eventsResult.clubEvents.find((e) => e.id === parseInt(eventId)) ||
          null;
      }

      if (detailsResult.success) {
        extraDetails = detailsResult.details;
        if (extraDetails) editedDetails = { ...extraDetails };
      }

      if (!event) {
        error = "Event not found";
        return;
      }
    } catch (err: any) {
      error = err.message || "An error occurred";
    } finally {
      loading = false;
    }
  }

  async function handleUpdateDetails() {
    saveLoading = true;
    try {
      let result;
      if (extraDetails) {
        result = await updateExtraEventDetails(parseInt(eventId), editedDetails);
      } else {
        result = await createExtraEventDetails(parseInt(eventId), editedDetails);
      }

      if (result.success && result.details) {
        extraDetails = result.details;
        isEditingDetails = false;
      } else {
        alert(result.message || "Failed to update details");
      }
    } catch (err: any) {
      alert(err.message || "An error occurred");
    } finally {
      saveLoading = false;
    }
  }

  function startEditing() {
    editedDetails = extraDetails ? { ...extraDetails } : {};
    isEditingDetails = true;
  }

  async function checkRegistrationStatus() {
    if (!userId) return;

    try {
      const result = await getEnrollments(userId);
      if (result.success && result.registrations) {
        isRegistered = result.registrations.some(
          (reg) => reg.eventId === parseInt(eventId),
        );
      }
    } catch (err) {
      console.error("Error checking registration status:", err);
    }
  }

  async function handleRegister() {
    if (!userId) {
      goto("/register");
      return;
    }

    actionLoading = true;
    actionMessage = null;

    try {
      const result = await registerForEvent(userId, parseInt(eventId));
      if (result.success) {
        isRegistered = true;
        actionMessage = {
          type: "success",
          text: "Successfully registered for this event!",
        };
        // Reload to update participant count
        await loadEventDetails();
      } else {
        actionMessage = {
          type: "error",
          text: result.message || "Failed to register",
        };
      }
    } catch (err: any) {
      actionMessage = {
        type: "error",
        text: err.message || "An error occurred",
      };
    } finally {
      actionLoading = false;
    }
  }

  async function handleCancelRegistration() {
    if (!$session.data?.user) return;

    actionLoading = true;
    actionMessage = null;

    try {
      const result = await cancelRegistration(
        $session.data.user.id,
        parseInt(eventId),
      );
      if (result.success) {
        isRegistered = false;
        actionMessage = {
          type: "success",
          text: "Registration cancelled successfully!",
        };

        await loadEventDetails();
      } else {
        actionMessage = {
          type: "error",
          text: result.message || "Failed to cancel registration",
        };
      }
    } catch (err: any) {
      actionMessage = {
        type: "error",
        text: err.message || "An error occurred",
      };
    } finally {
      actionLoading = false;
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case "published":
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

  function isEventFull(): boolean {
    if (!event) return false;
    return event.maxParticipants
      ? event.currentParticipants >= event.maxParticipants
      : false;
  }

  function isRegistrationClosed(): boolean {
    if (!event) return false;
    if (!event.isRegistrationOpen) return true;
    if (
      event.registrationDeadline &&
      new Date() > new Date(event.registrationDeadline)
    )
      return true;
    return false;
  }
</script>

<div class="min-h-[calc(100vh-4rem)] bg-gray-50/30 px-4 py-8 sm:px-6 lg:px-8">
  <div class="max-w-5xl mx-auto">
    <!-- Breadcrumb -->
    <nav class="flex items-center gap-2 text-sm text-gray-500 mb-8" in:fade>
      <a
        href="/clubs"
        use:routeAction
        class="hover:text-blue-600 transition-colors hover:underline">Clubs</a
      >
      <svg
        class="w-4 h-4 text-gray-300"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 5l7 7-7 7"
        ></path>
      </svg>
      <a
        href="/clubs/{clubId}/events"
        use:routeAction
        class="hover:text-blue-600 transition-colors hover:underline"
        >{club?.name || "Club"}</a
      >
      <svg
        class="w-4 h-4 text-gray-300"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 5l7 7-7 7"
        ></path>
      </svg>
      <span class="text-gray-900 font-medium truncate"
        >{event?.title || "Event"}</span
      >
    </nav>

    {#if loading}
      <div class="flex items-center justify-center py-20" in:fade>
        <LoadingSpinner size="lg" text="Loading event details..." />
      </div>
    {:else if error}
      <div
        class="max-w-md mx-auto p-6 bg-white border border-red-100 rounded-2xl shadow-lg text-center"
        in:fly={{ y: 20, duration: 400 }}
      >
        <div
          class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <svg
            class="w-8 h-8 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
        </div>
        <p class="text-red-600 font-medium mb-4">{error}</p>
        <a
          href="/clubs/{clubId}/events"
          use:routeAction
          class="px-6 py-2 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-colors shadow-sm"
        >
          Back to Events
        </a>
      </div>
    {:else if event}
      <!-- Event Banner -->
      <div
        class="h-64 sm:h-80 bg-linear-to-br from-blue-500 to-purple-600 rounded-3xl overflow-hidden mb-8 relative shadow-xl"
        in:fly={{ y: 20, duration: 600 }}
      >
        {#if event.bannerUrl}
          <img
            src={event.bannerUrl}
            alt={event.title}
            class="w-full h-full object-cover"
          />
        {:else}
          <div
            class="w-full h-full flex items-center justify-center bg-gray-800"
          >
            <svg
              class="w-24 h-24 text-white/20"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              ></path>
            </svg>
          </div>
        {/if}
        <div
          class="absolute inset-0 bg-linear-to-t from-black/60 to-transparent"
        ></div>

        <div
          class="absolute bottom-6 left-6 right-6 flex items-end justify-between"
        >
          <div>
            <span
              class="inline-block px-3 py-1 mb-3 text-sm font-bold text-white bg-blue-600/80 backdrop-blur-sm rounded-full uppercase tracking-wider"
            >
              {event.eventType}
            </span>
            <h1
              class="text-3xl md:text-5xl font-extrabold text-white tracking-tight drop-shadow-md"
            >
              {event.title}
            </h1>
          </div>

          <div class="absolute top-6 right-6">
            <span
              class={`px-4 py-1.5 text-sm font-bold rounded-full shadow-lg border backdrop-blur-md ${getStatusColor(event.status)} uppercase tracking-wider`}
            >
              {event.status}
            </span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Main Content -->
        <div
          class="lg:col-span-2 space-y-8"
          in:fly={{ y: 20, duration: 600, delay: 100 }}
        >
          <!-- Action Message -->
          {#if actionMessage}
            <div
              class="p-4 rounded-xl flex items-center gap-3 {actionMessage.type ===
              'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'}"
              in:slide
            >
              <svg
                class="w-5 h-5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {#if actionMessage.type === "success"}
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  ></path>
                {:else}
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                {/if}
              </svg>
              <p class="font-medium">{actionMessage.text}</p>
            </div>
          {/if}

          <div
            class="bg-white rounded-3xl shadow-sm border border-gray-100 p-8"
          >
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-bold text-gray-900">
                About this Event
              </h2>
              {#if isClubOwner && !isEditingDetails}
                <button
                  onclick={startEditing}
                  class="flex items-center gap-2 px-4 py-2 text-sm font-bold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
                >
                  Edit Details
                </button>
              {/if}
            </div>
            
            <p class="text-gray-600 leading-relaxed whitespace-pre-wrap">
              {event.description || "No description provided."}
            </p>

            {#if isEditingDetails}
              <div class="mt-8 space-y-6 border-t pt-8" in:slide>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label for="fullDescription" class="block text-sm font-bold text-gray-700 mb-2">Full Description</label>
                    <textarea id="fullDescription" bind:value={editedDetails.fullDescription} class="w-full px-4 py-3 rounded-xl border-gray-200" rows="4"></textarea>
                  </div>
                  <div>
                    <label for="objectives" class="block text-sm font-bold text-gray-700 mb-2">Objectives</label>
                    <textarea id="objectives" bind:value={editedDetails.objectives} class="w-full px-4 py-3 rounded-xl border-gray-200" rows="4"></textarea>
                  </div>
                  <div>
                    <label for="rules" class="block text-sm font-bold text-gray-700 mb-2">Rules</label>
                    <textarea id="rules" bind:value={editedDetails.rules} class="w-full px-4 py-3 rounded-xl border-gray-200" rows="4"></textarea>
                  </div>
                  <div>
                    <label for="judgingCriteria" class="block text-sm font-bold text-gray-700 mb-2">Judging Criteria</label>
                    <textarea id="judgingCriteria" bind:value={editedDetails.judgingCriteria} class="w-full px-4 py-3 rounded-xl border-gray-200" rows="4"></textarea>
                  </div>
                  <div>
                    <label for="targetAudience" class="block text-sm font-bold text-gray-700 mb-2">Target Audience</label>
                    <input id="targetAudience" type="text" bind:value={editedDetails.targetAudience} class="w-full px-4 py-3 rounded-xl border-gray-200" />
                  </div>
                  <div>
                    <label for="prerequisites" class="block text-sm font-bold text-gray-700 mb-2">Prerequisites</label>
                    <input id="prerequisites" type="text" bind:value={editedDetails.prerequisites} class="w-full px-4 py-3 rounded-xl border-gray-200" />
                  </div>
                </div>
                <div class="flex gap-4">
                  <button
                    onclick={handleUpdateDetails}
                    disabled={saveLoading}
                    class="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saveLoading ? "Saving..." : "Save Details"}
                  </button>
                  <button
                    onclick={() => (isEditingDetails = false)}
                    class="px-6 py-2 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            {:else if extraDetails}
              <div class="mt-8 space-y-8 border-t pt-8" in:fade>
                {#if extraDetails.fullDescription}
                  <div>
                    <h3 class="text-lg font-bold text-gray-900 mb-3">Detailed Information</h3>
                    <p class="text-gray-600 leading-relaxed whitespace-pre-wrap">{extraDetails.fullDescription}</p>
                  </div>
                {/if}

                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {#if extraDetails.objectives}
                    <div class="p-6 bg-blue-50/50 rounded-2xl border border-blue-100">
                      <h3 class="text-md font-bold text-blue-900 mb-3">Objectives</h3>
                      <p class="text-sm text-blue-800 leading-relaxed whitespace-pre-wrap">{extraDetails.objectives}</p>
                    </div>
                  {/if}
                  
                  {#if extraDetails.rules}
                    <div class="p-6 bg-amber-50/50 rounded-2xl border border-amber-100">
                      <h3 class="text-md font-bold text-amber-900 mb-3">Rules & Regulations</h3>
                      <p class="text-sm text-amber-800 leading-relaxed whitespace-pre-wrap">{extraDetails.rules}</p>
                    </div>
                  {/if}
                </div>

                {#if extraDetails.judgingCriteria}
                   <div class="p-6 bg-purple-50/50 rounded-2xl border border-purple-100">
                      <h3 class="text-md font-bold text-purple-900 mb-3">Judging Criteria</h3>
                      <p class="text-sm text-purple-800 leading-relaxed whitespace-pre-wrap">{extraDetails.judgingCriteria}</p>
                    </div>
                {/if}

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {#if extraDetails.targetAudience}
                    <div class="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                      <div class="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-gray-400 shadow-sm">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div>
                        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Target Audience</p>
                        <p class="text-sm font-semibold text-gray-700">{extraDetails.targetAudience}</p>
                      </div>
                    </div>
                  {/if}

                   {#if extraDetails.prerequisites}
                    <div class="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                      <div class="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-gray-400 shadow-sm">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Prerequisites</p>
                        <p class="text-sm font-semibold text-gray-700">{extraDetails.prerequisites}</p>
                      </div>
                    </div>
                  {/if}
                </div>
              </div>
            {/if}

            <div class="mt-8 pt-8 border-t border-gray-100">
              <p class="text-gray-500 text-sm">
                Hosted by <span class="font-semibold text-gray-900"
                  >{club?.name}</span
                >
              </p>
            </div>
          </div>

          <!-- REGISTERED STUDENTS LIST (OWNER ONLY) -->
          {#if isClubOwner}
            <div
              class="bg-white rounded-3xl shadow-sm border border-gray-100 p-8"
            >
              <h2
                class="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2"
              >
                Registered Students
                <span
                  class="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-sm font-medium"
                >
                  {registeredStudents.length}
                </span>
              </h2>

              {#if registeredStudents.length === 0}
                <div
                  class="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200"
                >
                  <p class="text-gray-500">No students registered yet.</p>
                </div>
              {:else}
                <div class="overflow-x-auto">
                  <table class="w-full text-left border-collapse">
                    <thead>
                      <tr
                        class="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                      >
                        <th class="py-3 px-4">Student</th>
                        <th class="py-3 px-4">Status</th>
                        <th class="py-3 px-4">Registered At</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-50">
                      {#each registeredStudents as reg}
                        <tr class="hover:bg-gray-50/50 transition-colors">
                          <td
                            class="py-3 px-4 text-sm font-medium text-gray-900"
                          >
                            <div>
                              <div class="font-bold">{reg.student.name}</div>
                              <div class="text-xs text-gray-500">
                                {reg.student.email}
                              </div>
                            </div>
                          </td>
                          <td class="py-3 px-4">
                            <span
                              class="inline-flex px-2 py-1 text-xs font-medium rounded-full {reg.status ===
                              'registered'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'}"
                            >
                              {reg.status}
                            </span>
                          </td>
                          <td class="py-3 px-4 text-sm text-gray-500">
                            {new Date(reg.registeredAt).toLocaleDateString()}
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Sidebar Info -->
        <div class="space-y-6" in:fly={{ y: 20, duration: 600, delay: 200 }}>
          <!-- Event Details Card -->
          <div
            class="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-6"
          >
            <div class="flex items-start gap-4">
              <div
                class="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0"
              >
                <svg
                  class="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  ></path>
                </svg>
              </div>
              <div>
                <p
                  class="text-xs font-bold text-gray-400 uppercase tracking-wide"
                >
                  Date & Time
                </p>
                <p class="font-semibold text-gray-900 mt-1">
                  {formatDate(event.eventStartTime)}
                </p>
                <p class="text-sm text-gray-500">
                  {formatTime(event.eventStartTime)} - {formatTime(
                    event.eventEndTime,
                  )}
                </p>
              </div>
            </div>

            {#if event.venue}
              <div class="flex items-start gap-4">
                <div
                  class="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0"
                >
                  <svg
                    class="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    ></path>
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    ></path>
                  </svg>
                </div>
                <div>
                  <p
                    class="text-xs font-bold text-gray-400 uppercase tracking-wide"
                  >
                    Venue
                  </p>
                  <p class="font-semibold text-gray-900 mt-1">
                    {event.venue}
                  </p>
                </div>
              </div>
            {/if}

            <div class="flex items-start gap-4">
              <div
                class="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-green-600 shrink-0"
              >
                <svg
                  class="w-6 h-6"
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
              <div>
                <p
                  class="text-xs font-bold text-gray-400 uppercase tracking-wide"
                >
                  Participants
                </p>
                <p class="font-semibold text-gray-900 mt-1">
                  {event.currentParticipants}
                  {#if event.maxParticipants}
                    <span class="text-gray-400">/ {event.maxParticipants}</span>
                  {/if}
                </p>
                {#if event.maxParticipants}
                  <p class="text-xs text-gray-500 mt-0.5">
                    {Math.max(
                      0,
                      event.maxParticipants - event.currentParticipants,
                    )} spots remaining
                  </p>
                {/if}
              </div>
            </div>

            {#if event.registrationDeadline}
              <div class="flex items-start gap-4">
                <div
                  class="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600 shrink-0"
                >
                  <svg
                    class="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                </div>
                <div>
                  <p
                    class="text-xs font-bold text-gray-400 uppercase tracking-wide"
                  >
                    Registration Deadline
                  </p>
                  <p class="font-semibold text-gray-900 mt-1">
                    {formatDate(event.registrationDeadline)}
                  </p>
                  <p class="text-sm text-gray-500">
                    {formatTime(event.registrationDeadline)}
                  </p>
                </div>
              </div>
            {/if}
          </div>

          <!-- Registration Action -->
          {#if !isClubOwner}
            <div
              class="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sticky top-6"
            >
              {#if $session.isPending}
                <div class="h-12 bg-gray-100 rounded-xl animate-pulse"></div>
              {:else if !$session.data?.user}
                <div class="text-center">
                  <p class="text-gray-600 mb-4 font-medium">
                    Sign in to register for this event
                  </p>
                  <a
                    href="/register"
                    use:routeAction
                    class="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-blue-500/30"
                  >
                    Sign In to Register
                  </a>
                </div>
              {:else if event.status === "cancelled"}
                <div
                  class="text-center p-4 bg-red-50 rounded-xl border border-red-100"
                >
                  <p class="text-red-600 font-bold">Event Cancelled</p>
                </div>
              {:else if event.status === "completed"}
                <div
                  class="text-center p-4 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <p class="text-gray-600 font-bold">Event Ended</p>
                </div>
              {:else if isRegistered}
                <div class="space-y-4">
                  <div
                    class="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-xl border border-green-100"
                  >
                    <svg
                      class="w-5 h-5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                    <span class="font-bold text-sm">You are registered!</span>
                  </div>
                  <button
                    onclick={handleCancelRegistration}
                    disabled={actionLoading}
                    class="w-full px-6 py-3 border-2 border-red-50 text-red-600 hover:bg-red-50 hover:border-red-100 font-bold rounded-xl transition-all disabled:opacity-50"
                  >
                    {actionLoading ? "Processing..." : "Cancel Registration"}
                  </button>
                </div>
              {:else if isEventFull()}
                <div
                  class="text-center p-4 bg-amber-50 rounded-xl border border-amber-100"
                >
                  <p class="text-amber-800 font-bold">Event Full</p>
                  <p class="text-amber-600 text-sm mt-1">
                    No more spots available.
                  </p>
                </div>
              {:else if isRegistrationClosed()}
                <div
                  class="text-center p-4 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <p class="text-gray-600 font-bold">Registration Closed</p>
                  <p class="text-gray-500 text-sm mt-1">
                    The deadline has passed.
                  </p>
                </div>
              {:else}
                <button
                  onclick={handleRegister}
                  disabled={actionLoading}
                  class="w-full px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 shadow-lg hover:shadow-blue-500/30 ring-4 ring-transparent hover:ring-blue-500/10"
                >
                  {actionLoading ? "Registering..." : "Register Now"}
                </button>
                <p class="text-xs text-gray-500 text-center mt-3">
                  Clicking register will reserve your spot immediately.
                </p>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  /* Add any ephemeral animations or specific styles here if tailwind isn't enough */
</style>
