<script lang="ts">
  import { route as routeAction, goto } from "@mateothegreat/svelte5-router";
  import { authClient } from "../lib/auth-client";
  import {
    createEvent,
    getClub,
    type Club,
    getClubAdmins,
    uploadEventBanner,
    createExtraEventDetails,
  } from "../lib/api";
  import LoadingSpinner from "../components/LoadingSpinner.svelte";
  import { fade, fly, slide, scale } from "svelte/transition";
  import { Datepicker, Input, Label, Timepicker, Badge } from "flowbite-svelte";

  const { route } = $props();
  const clubId = $derived(route.result.path.params.clubId);

  const session = authClient.useSession();
  const userId = $derived($session.data?.user?.id);

  let club = $state<Club | null>(null);
  let loading = $state(true);
  let submitting = $state(false);
  let error = $state<string | null>(null);
  let success = $state(false);
  let isAuthorized = $state<boolean | null>(null);
  let createdEventId = $state<number | null>(null);

  // Extra Details State
  let showExtraDetailsPrompt = $state(false);
  let isAddingExtraDetails = $state(false);
  let extraSubmitting = $state(false);

  let fullDescription = $state("");
  let objectives = $state("");
  let targetAudience = $state("");
  let prerequisites = $state("");
  let rules = $state("");
  let judgingCriteria = $state("");

  // Form Steps
  let currentStep = $state(1);
  const totalSteps = 3;

  // Form State
  let title = $state("");
  let description = $state("");
  let eventType = $state("workshop");
  let venue = $state("");
  let maxParticipants = $state<number | undefined>(undefined);

  // Date/Time States
  let startDate = $state<Date | undefined>(undefined);
  let startTime = $state("");
  let endDate = $state<Date | undefined>(undefined);
  let endTime = $state("");
  let regDate = $state<Date | undefined>(undefined);
  let regTime = $state("");
  let registrationMethod = $state<"internal" | "external">("internal");
  let externalRegistrationLink = $state("");

  // Media State
  let bannerUrl = $state("");
  let bannerFile = $state<File | null>(null);
  let bannerPreview = $state<string | null>(null);
  let bannerSource = $state<"url" | "local">("url");
  let isUploadingBanner = $state(false);

  // Derived ISO Strings
  const toLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const eventStartTime = $derived(
    startDate && startTime
      ? `${toLocalDateString(startDate)}T${startTime}`
      : "",
  );

  const eventEndTime = $derived(
    endDate && endTime ? `${toLocalDateString(endDate)}T${endTime}` : "",
  );

  const registrationDeadline = $derived(
    regDate && regTime ? `${toLocalDateString(regDate)}T${regTime}` : "",
  );

  const eventTypes = [
    "workshop",
    "seminar",
    "competition",
    "hackathon",
    "meetup",
    "conference",
    "cultural",
    "sports",
    "other",
  ];

  $effect(() => {
    if (clubId) {
      loadClub();
    }
  });

  $effect(() => {
    if (club && userId) {
      checkPermissions();
    }
  });

  $effect(() => {
    if (!$session.isPending && !$session.error && !$session.data?.user) {
      error = "You must be logged in to create events";
      isAuthorized = false;
    }
  });

  async function loadClub() {
    loading = true;
    try {
      const result = await getClub(parseInt(clubId));
      if (result.success && result.clubData) {
        club = result.clubData;
        // Initial permission check if user already loaded
        if (userId) await checkPermissions();
      } else {
        error = "Club not found";
        isAuthorized = false;
      }
    } catch (err: any) {
      error = err.message || "An error occurred";
      isAuthorized = false;
    } finally {
      loading = false;
    }
  }

  async function checkPermissions() {
    if (!club || !userId) return;

    if (club.authClubId === userId) {
      isAuthorized = true;
    } else {
      try {
        const adminRes = await getClubAdmins(parseInt(clubId));
        if (adminRes.success && adminRes.admins) {
          isAuthorized = adminRes.admins.some(
            (admin: any) => admin.id === userId,
          );
        } else {
          isAuthorized = false;
        }
      } catch (e) {
        isAuthorized = false;
      }
    }
  }

  function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      bannerFile = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        bannerPreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  function nextStep() {
    if (currentStep === 1) {
      if (!title || !eventType) {
        error = "Title and Type are required";
        return;
      }
    } else if (currentStep === 2) {
      if (!eventStartTime || !eventEndTime) {
        error = "Start and End times are required";
        return;
      }
      const start = new Date(eventStartTime);
      const end = new Date(eventEndTime);
      if (end <= start) {
        error = "Event end time must be after start time";
        return;
      }
    }
    error = null;
    currentStep++;
  }

  function prevStep() {
    error = null;
    currentStep--;
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();

    if (!$session.data?.user) {
      error = "You must be logged in to create events";
      return;
    }

    if (!title || !eventType || !eventStartTime || !eventEndTime) {
      error = "Please fill in all required fields";
      return;
    }

    if (!registrationDeadline) {
      error = "registration date is required";
      return;
    }

    const start = new Date(eventStartTime);
    const end = new Date(eventEndTime);
    const deadline = registrationDeadline
      ? new Date(registrationDeadline)
      : null;

    if (end <= start) {
      error = "Event end time must be after start time";
      return;
    }

    if (deadline && deadline >= start) {
      error = "Registration deadline must be before event start time";
      return;
    }

    submitting = true;
    error = null;

    try {
      let initialBannerUrl = bannerSource === "url" ? bannerUrl : undefined;

      const result = await createEvent(parseInt(clubId), {
        title,
        description,
        eventType,
        venue,
        maxParticipants: maxParticipants || 0,
        registrationDeadline: registrationDeadline,
        eventStartTime: eventStartTime,
        eventEndTime: eventEndTime,
        bannerUrl: initialBannerUrl || undefined,
        externalRegistrationLink:
          registrationMethod === "external"
            ? externalRegistrationLink
            : undefined,
      });

      if (result.success && result.event) {
        createdEventId = result.event.id;

        if (bannerSource === "local" && bannerFile) {
          isUploadingBanner = true;
          const uploadRes = await uploadEventBanner(createdEventId, bannerFile);
          isUploadingBanner = false;
          if (!uploadRes.success) {
            console.error("Banner upload failed:", uploadRes.message);
          }
        }

        success = true;
        showExtraDetailsPrompt = true;
      } else {
        error = result.message || "Failed to create event";
      }
    } catch (err: any) {
      error = err.message || "An error occurred";
    } finally {
      submitting = false;
    }
  }

  async function handleExtraDetailsSubmit(e: Event) {
    e.preventDefault();
    if (!createdEventId) return;

    extraSubmitting = true;
    error = null;

    try {
      const result = await createExtraEventDetails(createdEventId, {
        fullDescription,
        objectives,
        targetAudience,
        prerequisites,
        rules,
        judgingCriteria,
      });

      if (result.success) {
        isAddingExtraDetails = false;
        showExtraDetailsPrompt = false;
        // The success message will now show the final state
        setTimeout(() => {
          goto(`/clubs/${clubId}/events`);
        }, 2000);
      } else {
        error = result.message || "Failed to add extra details";
      }
    } catch (err: any) {
      error = err.message || "An error occurred";
    } finally {
      extraSubmitting = false;
    }
  }

  function skipExtraDetails() {
    showExtraDetailsPrompt = false;
    isAddingExtraDetails = false;
    setTimeout(() => {
      goto(`/clubs/${clubId}/events`);
    }, 1500);
  }

  const stepTitles = ["Basic Information", "Date & Venue", "Media & Finalize"];

  // Formatter for preview
  const formatDate = (date: Date | undefined) => {
    if (!date) return "TBD";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Custom shake transition
  function shake(node: HTMLElement, { duration = 400 } = {}) {
    return {
      duration,
      css: (t: number) => {
        const factor = (1 - t) * 10;
        const x = Math.sin(t * Math.PI * 10) * factor;
        return `transform: translateX(${x}px);`;
      },
    };
  }
</script>

<div
  class="create-event-compact min-h-screen bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-blue-50 via-white to-purple-50 px-4 py-8 sm:px-6 lg:px-8"
>
  <div class="max-w-6xl mx-auto">
    <!-- Breadcrumb -->
    <nav class="flex items-center gap-2 text-sm text-gray-500 mb-8" in:fade>
      <a
        href="/clubs"
        use:routeAction
        class="hover:text-blue-600 transition-colors">Clubs</a
      >
      <span class="text-gray-300">/</span>
      <a
        href="/clubs/{clubId}/events"
        use:routeAction
        class="hover:text-blue-600 transition-colors"
      >
        {club?.name || "Club"}
      </a>
      <span class="text-gray-300">/</span>
      <span class="text-gray-900 font-semibold">Create Event</span>
    </nav>

    {#if loading || isAuthorized === null}
      <div class="flex flex-col items-center justify-center py-32" in:fade>
        <LoadingSpinner size="xl" color="blue" />
        <p class="mt-4 text-gray-500 font-medium animate-pulse">
          Preparing your workspace...
        </p>
      </div>
    {:else if !isAuthorized}
      <div
        class="max-w-md mx-auto p-12 bg-white/80 backdrop-blur-xl border border-white shadow-2xl rounded-4xl text-center"
        in:fly={{ y: 20, duration: 600 }}
      >
        <div
          class="w-20 h-20 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner rotate-3"
        >
          <svg
            class="w-10 h-10"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h2 class="text-3xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p class="text-gray-500 mb-8 leading-relaxed">
          {error || "Only club authorized personnel can create events here."}
        </p>
        <button
          onclick={() => goto(`/clubs/${clubId}/events`)}
          class="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-black transition-all shadow-xl active:scale-95"
        >
          Return to Events
        </button>
      </div>
    {:else if success}
      <div
        class="max-w-4xl mx-auto p-8 sm:p-12 bg-white/80 backdrop-blur-xl border border-white shadow-2xl rounded-[2.5rem]"
        in:fly={{ y: 20, duration: 600 }}
      >
        {#if showExtraDetailsPrompt}
          <div class="text-center" in:fade>
            <div
              class="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner shadow-green-100/50"
            >
              <svg
                class="w-12 h-12"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 class="text-4xl font-black text-gray-900 mb-4 tracking-tight">
              Event Created!
            </h2>
            <p class="text-gray-500 text-lg mb-10 max-w-md mx-auto">
              Your event "{title}" is now live. Would you like to add extra
              details like rules, objectives, or prerequisites now?
            </p>
            <div class="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onclick={() =>
                  (isAddingExtraDetails = true) &&
                  (showExtraDetailsPrompt = false)}
                class="px-10 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
              >
                Yes, Add Details
              </button>
              <button
                onclick={skipExtraDetails}
                class="px-10 py-4 bg-gray-100 text-gray-600 font-black rounded-2xl hover:bg-gray-200 active:scale-95 transition-all"
              >
                Maybe Later
              </button>
            </div>
          </div>
        {:else if isAddingExtraDetails}
          <div in:fade>
            <div class="flex items-center justify-between mb-8">
              <div>
                <h2 class="text-3xl font-black text-gray-900 tracking-tight">
                  Extra Event Details
                </h2>
                <p class="text-gray-500 font-medium">
                  Add more context to your event (Optional)
                </p>
              </div>
              <button
                onclick={skipExtraDetails}
                class="text-gray-400 hover:text-gray-600 font-bold transition-colors"
              >
                Skip
              </button>
            </div>

            <form onsubmit={handleExtraDetailsSubmit} class="space-y-6">
              <div class="grid md:grid-cols-2 gap-6">
                <div class="space-y-2">
                  <label
                    class="block text-black font-bold mb-2"
                    for="full-description">Full Description</label
                  >
                  <textarea
                    id="full-description"
                    bind:value={fullDescription}
                    placeholder="Provide a detailed overview of the event..."
                    rows="4"
                    class="w-full bg-white/50 border border-gray-200 rounded-2xl p-4 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all resize-none placeholder:text-gray-400/70"
                  ></textarea>
                </div>
                <div class="space-y-2">
                  <label
                    class="block text-black font-bold mb-2"
                    for="objectives">Objectives</label
                  >
                  <textarea
                    id="objectives"
                    bind:value={objectives}
                    placeholder="What are the goals of this event?"
                    rows="4"
                    class="w-full bg-white/50 border border-gray-200 rounded-2xl p-4 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all resize-none placeholder:text-gray-400/70"
                  ></textarea>
                </div>
              </div>

              <div class="grid md:grid-cols-2 gap-6">
                <div class="space-y-2">
                  <label
                    class="block text-black font-bold mb-2"
                    for="target-audience">Target Audience</label
                  >
                  <textarea
                    id="target-audience"
                    bind:value={targetAudience}
                    placeholder="Who should attend? (e.g., Energetic students, Tech enthusiasts...)"
                    rows="4"
                    class="w-full bg-white/50 border border-gray-200 rounded-2xl p-4 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all resize-none shadow-sm placeholder:text-gray-400/70"
                  ></textarea>
                </div>
                <div class="space-y-2">
                  <label
                    class="block text-black font-bold mb-2"
                    for="prerequisites">Prerequisites</label
                  >
                  <textarea
                    id="prerequisites"
                    bind:value={prerequisites}
                    placeholder="Any requirements or skills needed? (e.g., Basic Python, Enthusiasm...)"
                    rows="4"
                    class="w-full bg-white/50 border border-gray-200 rounded-2xl p-4 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all resize-none shadow-sm placeholder:text-gray-400/70"
                  ></textarea>
                </div>
              </div>

              <div class="grid md:grid-cols-2 gap-6">
                <div class="space-y-2">
                  <label
                    class="block text-black font-bold mb-2"
                    for="event-rules">Event Rules</label
                  >
                  <textarea
                    id="event-rules"
                    bind:value={rules}
                    placeholder="List the do's and don'ts..."
                    rows="4"
                    class="w-full bg-white/50 border border-gray-200 rounded-2xl p-4 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all resize-none placeholder:text-gray-400/70"
                  ></textarea>
                </div>
                <div class="space-y-2">
                  <label
                    class="block text-black font-bold mb-2"
                    for="judging-criteria">Judging Criteria</label
                  >
                  <textarea
                    id="judging-criteria"
                    bind:value={judgingCriteria}
                    placeholder="How will participants be evaluated?"
                    rows="4"
                    class="w-full bg-white/50 border border-gray-200 rounded-2xl p-4 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all resize-none placeholder:text-gray-400/70"
                  ></textarea>
                </div>
              </div>

              {#if error}
                <div
                  class="p-4 bg-red-50 text-red-600 rounded-2xl font-semibold text-sm border border-red-100"
                >
                  {error}
                </div>
              {/if}

              <div class="flex justify-end gap-4 pt-4">
                <button
                  type="button"
                  onclick={skipExtraDetails}
                  class="px-8 py-4 text-gray-400 font-bold hover:text-gray-600 transition-colors"
                >
                  Skip for Now
                </button>
                <button
                  type="submit"
                  disabled={extraSubmitting}
                  class="px-10 py-4 bg-gray-900 text-white font-black rounded-2xl hover:bg-black shadow-2xl active:scale-95 transition-all disabled:opacity-50 min-w-45"
                >
                  {#if extraSubmitting}
                    <div class="flex items-center gap-2">
                      <div
                        class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"
                      ></div>
                      <span>Saving Details...</span>
                    </div>
                  {:else}
                    Save Details
                  {/if}
                </button>
              </div>
            </form>
          </div>
        {:else}
          <div class="text-center" in:fade>
            <div
              class="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner"
            >
              <svg
                class="w-12 h-12"
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
            <h2 class="text-4xl font-black text-gray-900 mb-4 tracking-tight">
              All Set!
            </h2>
            <p class="text-gray-500 text-lg mb-8 leading-relaxed">
              Your event is fully documented. Redirecting you to the events
              page...
            </p>
            <div class="flex gap-2 justify-center">
              <div
                class="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
              ></div>
              <div
                class="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:0.2s]"
              ></div>
              <div
                class="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:0.4s]"
              ></div>
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <div class="grid lg:grid-cols-[1fr_400px] gap-8 items-start">
        <!-- Main Form Area -->
        <div
          class="bg-white/70 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-white/50 relative"
          in:fly={{ x: -20, duration: 800 }}
        >
          <!-- Stepper Header -->
          <div class="px-8 pt-10 pb-6 border-b border-gray-100 bg-white/50">
            <div class="flex justify-between items-center mb-8">
              <div>
                <h1 class="text-3xl font-black text-gray-900 tracking-tight">
                  Design Your Event
                </h1>
                <p class="text-gray-500 font-medium">
                  Step {currentStep} of {totalSteps}: {stepTitles[
                    currentStep - 1
                  ]}
                </p>
              </div>
              <Badge
                color="blue"
                class="px-4 py-1 rounded-full text-sm font-bold shadow-sm"
              >
                Draft
              </Badge>
            </div>

            <!-- Progress Bar -->
            <div class="relative h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                class="absolute left-0 top-0 h-full bg-linear-to-r from-blue-600 to-indigo-600 transition-all duration-700 ease-out rounded-full shadow-[0_0_12px_rgba(37,99,235,0.4)]"
                style="width: {(currentStep / totalSteps) * 100}%"
              ></div>
            </div>
          </div>

          <form onsubmit={handleSubmit} class="p-8">
            <div class="min-h-100 relative">
              {#if currentStep === 1}
                <div
                  in:fly={{ x: 20, duration: 400, delay: 200 }}
                  out:fly={{ x: -20, duration: 400 }}
                >
                  <div class="space-y-6">
                    <div>
                      <label
                        class="block text-black font-bold mb-2"
                        for="event-title"
                        >Event Title <span class="text-red-500">*</span></label
                      >
                      <Input
                        id="event-title"
                        bind:value={title}
                        placeholder="What's the big announcement?"
                        class="bg-white/50 border-gray-200 focus:ring-blue-500/20 rounded-2xl py-4 shadow-sm placeholder:text-gray-400/70"
                        required
                      />
                    </div>
                    <div>
                      <label
                        class="block text-black font-bold mb-2"
                        for="event-category"
                        >Event Category <span class="text-red-500">*</span
                        ></label
                      >
                      <select
                        id="event-category"
                        bind:value={eventType}
                        class="w-full bg-white/50 border border-gray-200 hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl py-4 px-4 transition-all appearance-none outline-none shadow-sm"
                      >
                        {#each eventTypes as type}
                          <option value={type}>{type.toUpperCase()}</option>
                        {/each}
                      </select>
                    </div>
                    <div>
                      <label
                        class="block text-black font-bold mb-2"
                        for="event-description">Short Description</label
                      >
                      <textarea
                        id="event-description"
                        bind:value={description}
                        placeholder="Tell short description about the event..."
                        rows="6"
                        class="w-full bg-white/50 border border-gray-200 hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl p-4 transition-all outline-none resize-none shadow-sm placeholder:text-gray-400/70"
                      ></textarea>
                    </div>
                  </div>
                </div>
              {:else if currentStep === 2}
                <div
                  in:fly={{ x: 20, duration: 400, delay: 200 }}
                  out:fly={{ x: -20, duration: 400 }}
                >
                  <div class="space-y-8">
                    <div class="grid sm:grid-cols-2 gap-6">
                      <div class="space-y-2">
                        <div class="block text-black font-bold mb-2">
                          Start Schedule <span class="text-red-500">*</span>
                        </div>
                        <div class="flex gap-2">
                          <Datepicker
                            bind:value={startDate}
                            aria-label="Start date"
                            required
                            class="rounded-2xl flex-1 shadow-sm"
                          />
                          <div class="w-36">
                            <label class="sr-only" for="event-start-time"
                              >Start time</label
                            >
                            <Timepicker
                              id="event-start-time"
                              bind:value={startTime}
                              required
                              inputClass="w-full rounded-2xl border border-gray-200 bg-white/50 py-4 shadow-sm focus:ring-2 focus:ring-blue-500/20"
                            />
                          </div>
                        </div>
                      </div>
                      <div class="space-y-2">
                        <div class="block text-black font-bold mb-2">
                          End Schedule <span class="text-red-500">*</span>
                        </div>
                        <div class="flex gap-2">
                          <Datepicker
                            bind:value={endDate}
                            aria-label="End date"
                            required
                            class="rounded-2xl flex-1 shadow-sm"
                          />
                          <div class="w-36">
                            <label class="sr-only" for="event-end-time"
                              >End time</label
                            >
                            <Timepicker
                              id="event-end-time"
                              bind:value={endTime}
                              required
                              inputClass="w-full rounded-2xl border border-gray-200 bg-white/50 py-4 shadow-sm focus:ring-2 focus:ring-blue-500/20"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="grid sm:grid-cols-2 gap-6">
                      <div>
                        <label
                          class="block text-black font-bold mb-2"
                          for="event-venue">Location / Venue</label
                        >
                        <Input
                          id="event-venue"
                          bind:value={venue}
                          placeholder="Where is it happening?"
                          class="bg-white/50 border-gray-200 rounded-2xl py-4 shadow-sm placeholder:text-gray-400/70"
                        />
                      </div>
                      <div>
                        <label
                          class="block text-black font-bold mb-2"
                          for="event-capacity">Capacity</label
                        >
                        <Input
                          id="event-capacity"
                          type="number"
                          bind:value={maxParticipants}
                          placeholder="Seats available (Optional)"
                          class="bg-white/50 border-gray-200 rounded-2xl py-4 shadow-sm placeholder:text-gray-400/70"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              {:else if currentStep === 3}
                <div
                  in:fly={{ x: 20, duration: 400, delay: 200 }}
                  out:fly={{ x: -20, duration: 400 }}
                >
                  <div class="space-y-8">
                    <div class="space-y-4">
                      <div class="flex items-center justify-between">
                        <div class="block text-black font-bold mb-2">
                          Feature Image
                        </div>
                        <div
                          class="bg-gray-100 p-1 rounded-xl flex gap-1 shadow-inner"
                        >
                          <button
                            type="button"
                            class="px-4 py-1.5 text-xs font-black rounded-lg transition-all {bannerSource ===
                            'url'
                              ? 'bg-white text-blue-600 shadow-sm'
                              : 'text-gray-400 hover:text-gray-600'}"
                            onclick={() => (bannerSource = "url")}>URL</button
                          >
                          <button
                            type="button"
                            class="px-4 py-1.5 text-xs font-black rounded-lg transition-all {bannerSource ===
                            'local'
                              ? 'bg-white text-blue-600 shadow-sm'
                              : 'text-gray-400 hover:text-gray-600'}"
                            onclick={() => (bannerSource = "local")}
                            >UPLOAD</button
                          >
                        </div>
                      </div>

                      {#if bannerSource === "url"}
                        <Input
                          aria-label="Feature image URL"
                          type="url"
                          bind:value={bannerUrl}
                          placeholder="https://example.com/banner.png"
                          class="bg-white/50 border-gray-200 rounded-2xl py-4 shadow-sm placeholder:text-gray-400/70"
                        />
                      {:else}
                        <div
                          class="relative group border-2 border-dashed border-gray-200 rounded-2xl p-10 hover:border-blue-500 hover:bg-blue-50/50 transition-all text-center"
                        >
                          <input
                            type="file"
                            onchange={handleFileChange}
                            accept="image/*"
                            class="absolute inset-0 opacity-0 cursor-pointer z-10"
                            aria-label="Upload feature image"
                          />
                          <svg
                            class="mx-auto w-10 h-10 text-gray-300 group-hover:text-blue-500 mb-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          <p class="text-gray-500 font-bold">
                            Drop your masterpiece here
                          </p>
                          <p class="text-xs text-gray-400 mt-1">
                            High resolution assets preferred
                          </p>
                        </div>
                      {/if}
                    </div>

                    <div class="space-y-4 pt-4 border-t border-gray-100">
                      <div class="block text-black font-bold mb-2">
                        Registration Method <span class="text-red-500">*</span>
                      </div>
                      <div class="grid grid-cols-1 gap-4">
                        <button
                          type="button"
                          class="p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 {registrationMethod ===
                          'external'
                            ? 'border-blue-500 bg-blue-50 text-blue-600'
                            : 'border-gray-100 hover:border-gray-200 text-gray-400'}"
                          onclick={() =>
                            (registrationMethod =
                              registrationMethod === "external"
                                ? "internal"
                                : "external")}
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
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                          <span class="font-bold text-sm">External Link</span>
                        </button>
                      </div>

                      {#if registrationMethod === "external"}
                        <div in:slide>
                          <label
                            class="block text-black font-bold mb-2"
                            for="external-form-link"
                            >Form Link <span class="text-red-500">*</span
                            ></label
                          >
                          <Input
                            id="external-form-link"
                            type="url"
                            bind:value={externalRegistrationLink}
                            placeholder="https://forms.google.com/your-form"
                            class="bg-white/50 border-gray-200 rounded-2xl py-4 shadow-sm"
                            required
                          />
                          <p class="text-xs text-gray-400 mt-2">
                            Users will be redirected to this link to register
                            for your event.
                          </p>
                        </div>
                      {/if}
                    </div>

                    <div>
                      <div class="block text-black font-bold mb-2">
                        Registration Closes On <span class="text-red-500"
                          >*</span
                        >
                      </div>
                      <div class="flex gap-2">
                        <Datepicker
                          bind:value={regDate}
                          aria-label="Registration close date"
                          class="rounded-2xl flex-1 shadow-sm"
                        />
                        <div class="w-36">
                          <label class="sr-only" for="event-registration-time">
                            Registration close time
                          </label>
                          <Timepicker
                            id="event-registration-time"
                            bind:value={regTime}
                            inputClass="w-full rounded-2xl border border-gray-200 bg-white/50 py-4 shadow-sm focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              {/if}
            </div>

            {#if error}
              <div
                class="mt-6 p-4 bg-red-50 text-red-600 border border-red-100 rounded-2xl flex items-center gap-3 font-semibold text-sm shadow-sm"
                in:shake
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
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                {error}
              </div>
            {/if}

            <div
              class="flex items-center gap-4 mt-12 pt-8 border-t border-gray-100"
            >
              {#if currentStep > 1}
                <button
                  type="button"
                  onclick={prevStep}
                  class="px-8 py-4 text-gray-400 font-bold hover:text-gray-600 transition-colors"
                >
                  Back
                </button>
              {/if}

              <div class="flex-1"></div>

              {#if currentStep < totalSteps}
                <button
                  type="button"
                  onclick={nextStep}
                  class="px-10 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
                >
                  Continue
                </button>
              {:else}
                <button
                  type="submit"
                  disabled={submitting || isUploadingBanner}
                  class="px-10 py-4 bg-gray-900 text-white font-black rounded-2xl hover:bg-black shadow-2xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-w-45"
                >
                  {#if submitting || isUploadingBanner}
                    <div class="flex items-center gap-2">
                      <div
                        class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"
                      ></div>
                      <span
                        >{isUploadingBanner
                          ? "Uploading..."
                          : "Launching..."}</span
                      >
                    </div>
                  {:else}
                    Launch Event
                  {/if}
                </button>
              {/if}
            </div>
          </form>
        </div>

        <!-- Sidebar Preview -->
        <aside class="sticky top-8 space-y-6">
          <h3
            class="text-sm font-black text-gray-400 uppercase tracking-widest px-2"
          >
            Live Preview
          </h3>

          <div
            class="bg-white rounded-4xl shadow-2xl border border-white overflow-hidden group hover:shadow-blue-500/10 transition-all duration-500"
            style="transform: scale(1.02)"
          >
            <!-- Preview Banner -->
            <div class="relative h-48 bg-gray-100 overflow-hidden">
              {#if bannerSource === "url" && bannerUrl}
                <img
                  src={bannerUrl}
                  alt="Preview"
                  class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              {:else if bannerSource === "local" && bannerPreview}
                <img
                  src={bannerPreview}
                  alt="Preview"
                  class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              {:else}
                <div
                  class="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2"
                >
                  <svg
                    class="w-12 h-12 opacity-20"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span class="text-xs font-bold uppercase tracking-tighter"
                    >Event image is empty</span
                  >
                </div>
              {/if}
              <div class="absolute top-4 right-4">
                <Badge
                  color="gray"
                  class="rounded-lg backdrop-blur-md bg-black/50 border-none text-white font-black px-3 py-1"
                >
                  {eventType.toUpperCase()}
                </Badge>
              </div>
            </div>

            <!-- Preview Content -->
            <div class="p-6 space-y-4">
              <div class="space-y-1">
                <h4 class="text-xl font-black text-gray-900 leading-tight">
                  {title || "Untitled Event"}
                </h4>
                <div
                  class="flex items-center gap-2 text-blue-600 text-xs font-bold"
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
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                  </svg>
                  {venue || "Venue"}
                </div>
              </div>

              <p class="text-gray-500 text-sm line-clamp-2 leading-relaxed">
                {description ||
                  "Join us for an experience that's unlike anything you've seen before. Innovation meets community."}
              </p>

              <div
                class="pt-4 flex items-center justify-between border-t border-gray-50 mt-4"
              >
                <div class="space-y-0.5">
                  <p
                    class="text-[10px] font-black text-gray-400 uppercase tracking-tighter"
                  >
                    Going Live On
                  </p>
                  <p class="text-xs font-bold text-gray-900">
                    {formatDate(startDate)}
                  </p>
                </div>
                <div class="text-right space-y-0.5">
                  <p
                    class="text-[10px] font-black text-gray-400 uppercase tracking-tighter"
                  >
                    Open Seats
                  </p>
                  <p class="text-xs font-bold text-gray-900">
                    {maxParticipants || "∞"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Tips Card -->
          <div
            class="bg-blue-600 rounded-4xl p-8 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden"
          >
            <svg
              class="absolute -right-4 -bottom-4 w-32 h-32 opacity-10"
              fill="white"
              viewBox="0 0 24 24"
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <h5 class="text-lg font-black mb-2 relative z-10">Pro Tip</h5>
            <p class="text-blue-100 text-sm leading-relaxed relative z-10">
              Events with high resolution banners and clear descriptions see <span
                class="text-white font-bold">45% higher</span
              > engagement.
            </p>
          </div>
        </aside>
      </div>
    {/if}
  </div>
</div>

<style>
  :global(.datepicker) {
    --tw-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1),
      0 8px 10px -6px rgb(0 0 0 / 0.1) !important;
  }

  :global(.create-event-compact) {
    font-size: 0.92rem;
  }

  :global(.create-event-compact .text-4xl) {
    font-size: 1.95rem !important;
    line-height: 1.15 !important;
  }

  :global(.create-event-compact .text-3xl) {
    font-size: 1.55rem !important;
    line-height: 1.15 !important;
  }

  :global(.create-event-compact .text-xl) {
    font-size: 1.02rem !important;
    line-height: 1.25 !important;
  }

  :global(.create-event-compact .text-lg) {
    font-size: 0.92rem !important;
    line-height: 1.3 !important;
  }

  :global(.create-event-compact .text-base) {
    font-size: 0.84rem !important;
    line-height: 1.35 !important;
  }

  :global(.create-event-compact .text-sm) {
    font-size: 0.76rem !important;
    line-height: 1.35 !important;
  }

  :global(.create-event-compact .text-xs) {
    font-size: 0.68rem !important;
    line-height: 1.25 !important;
  }

  :global(.create-event-compact .p-12) {
    padding: 2rem !important;
  }

  :global(.create-event-compact .p-10) {
    padding: 1.6rem !important;
  }

  :global(.create-event-compact .p-8) {
    padding: 1.2rem !important;
  }

  :global(.create-event-compact .p-6) {
    padding: 0.95rem !important;
  }

  :global(.create-event-compact .p-4) {
    padding: 0.72rem !important;
  }

  :global(.create-event-compact .px-10) {
    padding-left: 1.45rem !important;
    padding-right: 1.45rem !important;
  }

  :global(.create-event-compact .px-8) {
    padding-left: 1.1rem !important;
    padding-right: 1.1rem !important;
  }

  :global(.create-event-compact .py-4) {
    padding-top: 0.68rem !important;
    padding-bottom: 0.68rem !important;
  }

  :global(.create-event-compact .gap-8) {
    gap: 1.15rem !important;
  }

  :global(.create-event-compact .gap-6) {
    gap: 0.9rem !important;
  }

  :global(.create-event-compact .gap-4) {
    gap: 0.66rem !important;
  }

  :global(.create-event-compact .mb-10) {
    margin-bottom: 1.45rem !important;
  }

  :global(.create-event-compact .mb-8) {
    margin-bottom: 1rem !important;
  }

  :global(.create-event-compact .mt-12) {
    margin-top: 1.5rem !important;
  }

  :global(.create-event-compact button),
  :global(.create-event-compact input),
  :global(.create-event-compact textarea),
  :global(.create-event-compact select) {
    font-size: 0.82rem;
  }

  :global(.create-event-compact .rounded-\[2\.5rem\]) {
    border-radius: 1.3rem !important;
  }

  :global(.create-event-compact .rounded-\[2rem\]) {
    border-radius: 1rem !important;
  }

  :global(.create-event-compact .rounded-2xl) {
    border-radius: 0.8rem !important;
  }

  :global(.create-event-compact .w-24.h-24) {
    width: 4.2rem !important;
    height: 4.2rem !important;
  }

  :global(.create-event-compact .w-20.h-20) {
    width: 3.5rem !important;
    height: 3.5rem !important;
  }

  :global(.create-event-compact .h-48) {
    height: 10.5rem !important;
  }

  :global(.create-event-compact .min-h-\[400px\]) {
    min-height: 340px !important;
  }
</style>
