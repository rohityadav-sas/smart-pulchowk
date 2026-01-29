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
    uploadEventBanner,
    type ClubEvent,
    type Club,
    type ExtraEventDetail,
  } from "../lib/api";
  import LoadingSpinner from "../components/LoadingSpinner.svelte";
  import { fade, fly, slide } from "svelte/transition";
  import { quintOut } from "svelte/easing";

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

  // Banner editing state
  let isEditingBanner = $state(false);
  let bannerInputType = $state<"file" | "url">("file");
  let bannerUrlInput = $state("");
  let bannerFile = $state<File | null>(null);
  let bannerPreview = $state<string | null>(null);
  let uploadLoading = $state(false);

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

  function handleFileChange(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      bannerFile = target.files[0];
      bannerPreview = URL.createObjectURL(bannerFile);
    }
  }

  function handleUrlChange() {
    bannerPreview = bannerUrlInput;
  }

  async function handleSaveBanner() {
    if (!bannerPreview) return;

    uploadLoading = true;
    try {
      const bannerData =
        bannerInputType === "file" ? (bannerFile as File) : bannerUrlInput;
      const result = await uploadEventBanner(parseInt(eventId), bannerData);

      if (result.success) {
        if (event) event.bannerUrl = result.data?.url || bannerPreview;
        isEditingBanner = false;
        bannerFile = null;
        bannerUrlInput = "";
        bannerPreview = null;
        actionMessage = {
          type: "success",
          text: "Banner updated successfully!",
        };
      } else {
        alert(result.message || "Failed to update banner");
      }
    } catch (err: any) {
      alert(err.message || "An error occurred");
    } finally {
      uploadLoading = false;
    }
  }

  function startEditingBanner() {
    isEditingBanner = true;
    bannerPreview = event?.bannerUrl || null;
    bannerUrlInput = event?.bannerUrl || "";
    bannerInputType = "file";
  }

  async function handleUpdateDetails() {
    saveLoading = true;
    try {
      let result;
      if (extraDetails) {
        result = await updateExtraEventDetails(
          parseInt(eventId),
          editedDetails,
        );
      } else {
        result = await createExtraEventDetails(
          parseInt(eventId),
          editedDetails,
        );
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

        {#if isClubOwner}
          <div class="absolute top-6 left-6 z-10">
            <button
              onclick={startEditingBanner}
              class="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-black/40 backdrop-blur-md rounded-xl hover:bg-black/60 transition-all border border-white/20"
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
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                ></path>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                ></path>
              </svg>
              Update Banner
            </button>
          </div>
        {/if}

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
              <h2 class="text-xl font-bold text-gray-900">About this Event</h2>
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
                    <label
                      for="fullDescription"
                      class="block text-sm font-bold text-gray-700 mb-2"
                      >Full Description</label
                    >
                    <textarea
                      id="fullDescription"
                      bind:value={editedDetails.fullDescription}
                      class="w-full px-4 py-3 rounded-xl border-gray-200"
                      rows="4"
                    ></textarea>
                  </div>
                  <div>
                    <label
                      for="objectives"
                      class="block text-sm font-bold text-gray-700 mb-2"
                      >Objectives</label
                    >
                    <textarea
                      id="objectives"
                      bind:value={editedDetails.objectives}
                      class="w-full px-4 py-3 rounded-xl border-gray-200"
                      rows="4"
                    ></textarea>
                  </div>
                  <div>
                    <label
                      for="rules"
                      class="block text-sm font-bold text-gray-700 mb-2"
                      >Rules</label
                    >
                    <textarea
                      id="rules"
                      bind:value={editedDetails.rules}
                      class="w-full px-4 py-3 rounded-xl border-gray-200"
                      rows="4"
                    ></textarea>
                  </div>
                  <div>
                    <label
                      for="judgingCriteria"
                      class="block text-sm font-bold text-gray-700 mb-2"
                      >Judging Criteria</label
                    >
                    <textarea
                      id="judgingCriteria"
                      bind:value={editedDetails.judgingCriteria}
                      class="w-full px-4 py-3 rounded-xl border-gray-200"
                      rows="4"
                    ></textarea>
                  </div>
                  <div>
                    <label
                      for="targetAudience"
                      class="block text-sm font-bold text-gray-700 mb-2"
                      >Target Audience</label
                    >
                    <input
                      id="targetAudience"
                      type="text"
                      bind:value={editedDetails.targetAudience}
                      class="w-full px-4 py-3 rounded-xl border-gray-200"
                    />
                  </div>
                  <div>
                    <label
                      for="prerequisites"
                      class="block text-sm font-bold text-gray-700 mb-2"
                      >Prerequisites</label
                    >
                    <input
                      id="prerequisites"
                      type="text"
                      bind:value={editedDetails.prerequisites}
                      class="w-full px-4 py-3 rounded-xl border-gray-200"
                    />
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
                    <h3 class="text-lg font-bold text-gray-900 mb-3">
                      Detailed Information
                    </h3>
                    <p
                      class="text-gray-600 leading-relaxed whitespace-pre-wrap"
                    >
                      {extraDetails.fullDescription}
                    </p>
                  </div>
                {/if}

                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {#if extraDetails.objectives}
                    <div
                      class="p-6 bg-blue-50/50 rounded-2xl border border-blue-100"
                    >
                      <h3 class="text-md font-bold text-blue-900 mb-3">
                        Objectives
                      </h3>
                      <p
                        class="text-sm text-blue-800 leading-relaxed whitespace-pre-wrap"
                      >
                        {extraDetails.objectives}
                      </p>
                    </div>
                  {/if}

                  {#if extraDetails.rules}
                    <div
                      class="p-6 bg-amber-50/50 rounded-2xl border border-amber-100"
                    >
                      <h3 class="text-md font-bold text-amber-900 mb-3">
                        Rules & Regulations
                      </h3>
                      <p
                        class="text-sm text-amber-800 leading-relaxed whitespace-pre-wrap"
                      >
                        {extraDetails.rules}
                      </p>
                    </div>
                  {/if}
                </div>

                {#if extraDetails.judgingCriteria}
                  <div
                    class="p-6 bg-purple-50/50 rounded-2xl border border-purple-100"
                  >
                    <h3 class="text-md font-bold text-purple-900 mb-3">
                      Judging Criteria
                    </h3>
                    <p
                      class="text-sm text-purple-800 leading-relaxed whitespace-pre-wrap"
                    >
                      {extraDetails.judgingCriteria}
                    </p>
                  </div>
                {/if}

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {#if extraDetails.targetAudience}
                    <div
                      class="flex items-center gap-3 p-4 bg-gray-50 rounded-xl"
                    >
                      <div
                        class="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-gray-400 shadow-sm"
                      >
                        <svg
                          class="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p
                          class="text-[10px] font-bold text-gray-400 uppercase tracking-widest"
                        >
                          Target Audience
                        </p>
                        <p class="text-sm font-semibold text-gray-700">
                          {extraDetails.targetAudience}
                        </p>
                      </div>
                    </div>
                  {/if}

                  {#if extraDetails.prerequisites}
                    <div
                      class="flex items-center gap-3 p-4 bg-gray-50 rounded-xl"
                    >
                      <div
                        class="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-gray-400 shadow-sm"
                      >
                        <svg
                          class="w-5 h-5"
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
                      <div>
                        <p
                          class="text-[10px] font-bold text-gray-400 uppercase tracking-widest"
                        >
                          Prerequisites
                        </p>
                        <p class="text-sm font-semibold text-gray-700">
                          {extraDetails.prerequisites}
                        </p>
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
                {#if event.externalRegistrationLink}
                  <p class="font-semibold text-gray-900 mt-1 italic">
                    Refer to external form
                  </p>
                {:else}
                  <p class="font-semibold text-gray-900 mt-1">
                    {event.currentParticipants}
                    {#if event.maxParticipants}
                      <span class="text-gray-400"
                        >/ {event.maxParticipants}</span
                      >
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
                    The deadline {new Date(
                      event.registrationDeadline as string,
                    ) < new Date()
                      ? "has passed"
                      : "is approaching quickly"}.
                  </p>
                </div>
              {:else if event.externalRegistrationLink}
                <div class="space-y-4">
                  <a
                    href={event.externalRegistrationLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="w-full inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all active:scale-95 shadow-lg hover:shadow-blue-500/30 ring-4 ring-transparent hover:ring-blue-500/10"
                  >
                    <span>Register via External Form</span>
                    <svg
                      class="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                  <p class="text-xs text-gray-500 text-center">
                    Registration is handled via an external platform. Please
                    follow the link above to complete your registration.
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

{#if isEditingBanner}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
    in:fade
  >
    <div
      class="bg-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] w-full max-w-2xl overflow-hidden border border-white/20"
      in:fly={{ y: 40, duration: 800, easing: quintOut }}
    >
      <!-- Premium Header -->
      <div
        class="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50"
      >
        <div>
          <h2 class="text-2xl font-black text-gray-900 tracking-tight">
            Update Event Banner
          </h2>
          <p class="text-sm text-gray-500 font-medium">
            First impressions are everything.
          </p>
        </div>
        <button
          onclick={() => (isEditingBanner = false)}
          class="p-3 hover:bg-white rounded-2xl transition-all hover:shadow-sm active:scale-95 group"
        >
          <svg
            class="w-6 h-6 text-gray-400 group-hover:text-gray-900 transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
              d="M6 18L18 6M6 6l12 12"
            ></path>
          </svg>
        </button>
      </div>

      <div class="p-8 space-y-8">
        <!-- Live Preview Component -->
        <div class="space-y-4">
          <div class="flex items-center justify-between px-1">
            <label
              class="block text-sm font-bold text-gray-900 uppercase tracking-widest"
              >Live Preview</label
            >
            <span
              class="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md uppercase"
              >Hero Display</span
            >
          </div>

          <div
            class="relative h-48 sm:h-56 w-full rounded-[2rem] overflow-hidden shadow-inner bg-gray-100 group"
          >
            {#if bannerPreview}
              <img
                src={bannerPreview}
                alt="Banner preview"
                class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div
                class="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent"
              ></div>

              <!-- Mock Content Overlay -->
              {#if event}
                <div
                  class="absolute bottom-6 left-8 right-8 flex items-end justify-between"
                >
                  <div in:fade>
                    <span
                      class="inline-block px-2 py-0.5 mb-2 text-[10px] font-bold text-white bg-blue-600/80 backdrop-blur-sm rounded-full uppercase tracking-wider"
                    >
                      {event.eventType}
                    </span>
                    <p
                      class="text-xl font-black text-white leading-none tracking-tight"
                    >
                      {event.title}
                    </p>
                  </div>
                </div>
              {/if}
            {:else}
              <div
                class="absolute inset-0 flex flex-col items-center justify-center bg-linear-to-br from-gray-50 to-gray-100 border-2 border-dashed border-gray-200 rounded-[2rem]"
              >
                <div
                  class="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 text-gray-300"
                >
                  <svg
                    class="w-8 h-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    ></path>
                  </svg>
                </div>
                <p class="text-gray-400 font-bold text-sm tracking-tight">
                  Select an image to see the magic
                </p>
              </div>
            {/if}
          </div>
        </div>

        <!-- Input Methods -->
        <div class="space-y-6">
          <div class="flex items-center justify-center">
            <div
              class="flex p-1 bg-gray-100 rounded-2xl shadow-inner w-full max-w-xs"
            >
              <button
                onclick={() => (bannerInputType = "file")}
                class={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all uppercase tracking-widest ${bannerInputType === "file" ? "bg-white text-blue-600 shadow-md scale-[1.02]" : "text-gray-400 hover:text-gray-600"}`}
              >
                Local File
              </button>
              <button
                onclick={() => (bannerInputType = "url")}
                class={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all uppercase tracking-widest ${bannerInputType === "url" ? "bg-white text-blue-600 shadow-md scale-[1.02]" : "text-gray-400 hover:text-gray-600"}`}
              >
                Remote URL
              </button>
            </div>
          </div>

          {#if bannerInputType === "file"}
            <div in:fly={{ y: 10, duration: 400 }}>
              <label
                class="relative flex flex-col items-center justify-center w-full h-40 transition-all bg-gray-50/50 border-2 border-gray-200 border-dashed rounded-[2rem] cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 group overflow-hidden"
              >
                <div
                  class="flex flex-col items-center justify-center pb-6 pt-5 px-4 text-center"
                >
                  <div
                    class="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-3 transition-transform group-hover:scale-110 group-hover:rotate-3 duration-500 text-blue-500"
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
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      ></path>
                    </svg>
                  </div>
                  {#if bannerFile}
                    <p
                      class="text-gray-900 font-bold text-sm tracking-tight truncate max-w-[250px]"
                    >
                      {bannerFile.name}
                    </p>
                    <p
                      class="text-gray-400 text-[10px] font-black uppercase mt-1"
                    >
                      Ready for upgrade
                    </p>
                  {:else}
                    <p class="text-gray-900 font-bold text-sm tracking-tight">
                      Drop your banner here
                    </p>
                    <p class="text-gray-400 text-xs mt-1 font-medium">
                      Click to browse your desktop
                    </p>
                  {/if}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  class="hidden"
                  onchange={handleFileChange}
                />
              </label>
            </div>
          {:else}
            <div in:fly={{ y: 10, duration: 400 }} class="space-y-4">
              <div class="relative group">
                <input
                  type="text"
                  bind:value={bannerUrlInput}
                  oninput={handleUrlChange}
                  placeholder="https://images.unsplash.com/your-epic-banner"
                  class="w-full pl-6 pr-14 py-5 bg-gray-50 border-none rounded-[1.5rem] font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-gray-400/50 shadow-inner"
                />
                <div
                  class="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300"
                >
                  <svg
                    class="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    ></path>
                  </svg>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>

      <!-- Actions -->
      <div class="p-8 bg-gray-50/80 border-t border-gray-100 flex gap-4">
        <button
          onclick={() => (isEditingBanner = false)}
          class="flex-1 px-8 py-4 bg-white text-gray-500 font-black rounded-2xl border border-gray-200 hover:bg-gray-100 hover:text-gray-700 transition-all active:scale-95 uppercase tracking-widest text-[10px]"
        >
          Cancel
        </button>
        <button
          onclick={handleSaveBanner}
          disabled={uploadLoading || !bannerPreview}
          class="flex-[2] px-8 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 shadow-2xl shadow-blue-500/20 active:scale-95 transition-all text-[10px] uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-3"
        >
          {#if uploadLoading}
            <div
              class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
            ></div>
            <span>Uploading...</span>
          {:else}
            <span>Update Banner</span>
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              ></path>
            </svg>
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Add any ephemeral animations or specific styles here if tailwind isn't enough */
</style>
