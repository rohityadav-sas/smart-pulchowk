<script lang="ts">
  import { goto, route } from "@mateothegreat/svelte5-router";
  import { authClient } from "../lib/auth-client";
  import {
    createClub,
    createClubProfile,
    uploadClubLogo,
    updateClubInfo,
    type ClubProfile,
  } from "../lib/api";
  import LoadingSpinner from "../components/LoadingSpinner.svelte";
  import { fade, fly, slide } from "svelte/transition";
  import { untrack } from "svelte";

  const session = authClient.useSession();

  let submitting = $state(false);
  let error = $state<string | null>(null);
  let success = $state(false);

  let name = $state("");
  let nameInputElement = $state<HTMLInputElement | null>(null);
  let email = $state("");
  let description = $state("");

  // Step 2: Profile Fields
  let aboutClub = $state("");
  let mission = $state("");
  let vision = $state("");
  let establishedYear = $state<number | undefined>(undefined);
  let achievements = $state("");
  let benefits = $state("");

  // Step 3: Links & Media
  let contactPhone = $state("");
  let websiteUrl = $state("");
  let facebookUrl = $state("");
  let instagramUrl = $state("");
  let twitterUrl = $state("");
  let linkedinUrl = $state("");
  let discordUrl = $state("");
  let githubUrl = $state("");

  let logoUrl = $state("");
  let logoFile = $state<File | null>(null);
  let logoPreview = $state<string | null>(null);
  let logoSource = $state<"url" | "local">("local");

  // Flow State
  let currentStep = $state(1);
  const totalSteps = 4;
  let creationProgress = $state(0); // 0-100% for the background sequence
  let hasNavigatedAway = $state(false);

  $effect(() => {
    if (hasNavigatedAway) return;

    if (!$session.isPending && !$session.error && !$session.data?.user) {
      hasNavigatedAway = true;
      untrack(() => {
        goto("/register?message=login_required");
      });
      return;
    } else if (
      $session.data?.user &&
      ($session.data.user as any).role !== "admin"
    ) {
      hasNavigatedAway = true;
      untrack(() => {
        goto("/clubs?error=unauthorized");
      });
      return;
    }
    // Auto-fill email from session if available
    if ($session.data?.user?.email && !email) {
      email = $session.data.user.email;
    }
  });

  function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      logoFile = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        logoPreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  function nextStep() {
    if (currentStep === 1) {
      if (!name || !email) {
        error = "Club name and email are required";
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
      error = "You must be logged in to create a club";
      return;
    }

    submitting = true;
    error = null;
    creationProgress = 10;

    try {
      // 1. Create Core Club
      const clubRes = await createClub({
        name,
        email,
        description,
      });

      if (!clubRes.success || !clubRes.club) {
        throw new Error(clubRes.message || "Failed to create club identity");
      }

      const clubId = clubRes.club.id;
      creationProgress = 40;

      // 2. Create Club Profile
      const socialLinks: Record<string, string> = {};
      if (facebookUrl) socialLinks.facebook = facebookUrl;
      if (instagramUrl) socialLinks.instagram = instagramUrl;
      if (twitterUrl) socialLinks.twitter = twitterUrl;
      if (linkedinUrl) socialLinks.linkedin = linkedinUrl;
      if (discordUrl) socialLinks.discord = discordUrl;
      if (githubUrl) socialLinks.github = githubUrl;

      const profileRes = await createClubProfile(clubId, {
        aboutClub: aboutClub || description,
        mission,
        vision,
        establishedYear,
        achievements,
        benefits,
        contactPhone,
        websiteUrl,
        socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : null,
      });

      if (!profileRes.success) {
        console.error(
          "Profile creation failed, but club exists:",
          profileRes.message,
        );
      }

      creationProgress = 70;

      // 3. Handle Logo
      if (logoSource === "local" && logoFile) {
        const logoRes = await uploadClubLogo(clubId, logoFile);
        if (!logoRes.success) {
          console.error("Logo upload failed:", logoRes.message);
        }
      } else if (logoSource === "url" && logoUrl) {
        const logoRes = await updateClubInfo(clubId, { logoUrl });
        if (!logoRes.success) {
          console.error("URL logo update failed:", logoRes.message);
        }
      }

      creationProgress = 100;
      success = true;

      setTimeout(() => {
        goto(`/clubs/${clubId}`);
      }, 2000);
    } catch (err: any) {
      console.error(err);
      const errorMessage =
        err.message || "A sequence error occurred while creating the club";
      error = errorMessage;

      // Revert to step 1 and focus if it's a name conflict
      if (
        errorMessage.toLowerCase().includes("name") &&
        errorMessage.toLowerCase().includes("exist")
      ) {
        currentStep = 1;
        setTimeout(() => {
          nameInputElement?.focus();
        }, 100);
      }
    } finally {
      submitting = false;
    }
  }

  const stepTitles = [
    "The Basics",
    "Vision & Mission",
    "Social Presence",
    "Identity & Branding",
  ];
</script>

<div
  class="min-h-screen bg-gray-50 flex items-center justify-center p-4 sm:p-6 lg:p-8"
>
  <div
    class="max-w-6xl w-full bg-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] border border-white overflow-hidden flex flex-col lg:flex-row min-h-[750px]"
  >
    <!-- Sidebar Left: Vertical Stepper -->
    <aside
      class="w-full lg:w-[400px] bg-blue-50/30 p-10 lg:p-12 border-r border-gray-100 flex flex-col justify-between"
    >
      <div>
        <nav class="flex items-center gap-2 text-sm text-gray-500 mb-8" in:fade>
          <a
            href="/clubs"
            use:route
            class="hover:text-blue-600 transition-colors">Clubs</a
          >
          <span class="text-gray-300">/</span>
          <span class="text-gray-900 font-bold">New Heritage</span>
        </nav>

        <h1
          class="text-4xl font-black text-gray-900 mb-12 leading-[1.1] tracking-tight"
        >
          Establish your <br />
          <span class="text-blue-600">Heritage</span>
        </h1>

        <!-- Vertical Stepper -->
        <div class="space-y-8 relative">
          <!-- Connector Line -->
          <div
            class="absolute left-6 top-2 bottom-2 w-0.5 bg-gray-100 -z-0"
          ></div>

          {#each stepTitles as title, i}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="flex items-center gap-6 relative z-10 transition-all duration-300 {i +
                1 <
              currentStep
                ? 'cursor-pointer hover:opacity-80'
                : ''}"
              onclick={() => {
                if (i + 1 < currentStep) {
                  currentStep = i + 1;
                }
              }}
            >
              <div
                class="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 {currentStep >
                i + 1
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                  : currentStep === i + 1
                    ? 'bg-blue-600 text-white shadow-xl shadow-blue-300 scale-110'
                    : 'bg-white text-gray-400 border border-gray-100 shadow-sm'}"
              >
                {#if currentStep > i + 1}
                  <svg
                    class="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="3"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                {:else}
                  <span class="text-sm font-black">{i + 1}</span>
                {/if}
              </div>
              <div class="flex flex-col">
                <span
                  class="text-[10px] font-black uppercase tracking-[0.2em] {currentStep ===
                  i + 1
                    ? 'text-blue-600'
                    : 'text-gray-400'}">Step {i + 1}</span
                >
                <span
                  class="text-base font-bold {currentStep === i + 1
                    ? 'text-gray-900'
                    : 'text-gray-400'}">{title}</span
                >
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Pro-Tip Box -->
      <div
        class="mt-12 p-8 bg-blue-600 rounded-[2rem] text-white shadow-2xl shadow-blue-500/20 relative overflow-hidden group"
      >
        <svg
          class="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 group-hover:scale-110 transition-transform duration-700"
          fill="white"
          viewBox="0 0 24 24"
        >
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
        <p class="text-blue-100 text-sm italic leading-relaxed relative z-10">
          "A club is more than a name; it's a legacy. Build it with clear vision
          and true passion."
        </p>
      </div>
    </aside>

    <!-- Main Content Right: Form Steps -->
    <main class="flex-1 p-10 lg:p-16 flex flex-col">
      {#if submitting}
        <div
          class="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto"
          in:fade
        >
          <div class="w-32 h-32 mb-8 relative">
            <div
              class="absolute inset-0 border-[6px] border-blue-50 rounded-full"
            ></div>
            <div
              class="absolute inset-0 border-[6px] border-blue-600 rounded-full border-t-transparent animate-spin"
            ></div>
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="text-2xl font-black text-blue-600"
                >{creationProgress}%</span
              >
            </div>
          </div>
          <h2 class="text-3xl font-black text-gray-900 mb-4 tracking-tight">
            Syncing with Campus
          </h2>
          <p class="text-gray-500 font-medium leading-relaxed">
            We're establishing your club identity and preparing your workspace.
            almost there...
          </p>
        </div>
      {:else if success}
        <div
          class="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto"
          in:fly={{ y: 20 }}
        >
          <div
            class="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-8 shadow-inner shadow-green-100/50"
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
          <h2
            class="text-4xl font-black text-gray-900 mb-4 tracking-tight uppercase"
          >
            Club Created
          </h2>
          <p class="text-gray-500 text-lg mb-8 leading-relaxed">
            The {name} identity has been firmly established in the alumni records.
          </p>
          <div class="flex gap-2">
            <div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
            <div
              class="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:0.2s]"
            ></div>
            <div
              class="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:0.4s]"
            ></div>
          </div>
        </div>
      {:else}
        <div class="flex-1 flex flex-col">
          <div class="mb-10">
            <h2 class="text-3xl font-black text-gray-900 mb-2 tracking-tight">
              {stepTitles[currentStep - 1]}
            </h2>
            <p class="text-gray-500 font-medium">
              Please provide the details to continue the establishment process.
            </p>
          </div>

          <form onsubmit={handleSubmit} class="flex-1 flex flex-col">
            <div class="flex-1 space-y-8">
              {#if currentStep === 1}
                <div
                  in:fly={{ x: 20, duration: 400, delay: 200 }}
                  out:fly={{ x: -20, duration: 400 }}
                >
                  <div class="grid grid-cols-1 gap-8">
                    <div class="space-y-2">
                      <label
                        class="block text-sm font-black text-gray-700 uppercase tracking-widest px-1"
                        for="club-name"
                        >Club Name <span class="text-red-500">*</span></label
                      >
                      <input
                        id="club-name"
                        type="text"
                        bind:value={name}
                        bind:this={nameInputElement}
                        placeholder="e.g. Robotics Club, Art Society..."
                        class="w-full bg-gray-50 border-none rounded-3xl py-5 px-6 font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-gray-400/50 shadow-sm"
                        required
                      />
                    </div>
                    <div class="space-y-2">
                      <label
                        class="block text-sm font-black text-gray-700 uppercase tracking-widest px-1"
                        for="club-email"
                        >Contact Email <span class="text-red-500">*</span
                        ></label
                      >
                      <input
                        id="club-email"
                        type="email"
                        bind:value={email}
                        placeholder="club@pcampus.edu.np"
                        class="w-full bg-gray-50 border-none rounded-[1.5rem] py-5 px-6 font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-gray-400/50 shadow-sm"
                        required
                      />
                    </div>
                    <div class="space-y-2">
                      <label
                        class="block text-sm font-black text-gray-700 uppercase tracking-widest px-1"
                        for="club-tagline"
                        >Punchline / Tagline</label
                      >
                      <textarea
                        id="club-tagline"
                        bind:value={description}
                        placeholder="Wait... how would you summarize your club in one line?"
                        rows="3"
                        class="w-full bg-gray-50 border-none rounded-[1.5rem] py-5 px-6 font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none placeholder:text-gray-400/50 shadow-sm"
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
                        <label
                          class="block text-sm font-black text-gray-700 uppercase tracking-widest px-1"
                          for="club-mission"
                          >Mission</label
                        >
                        <textarea
                          id="club-mission"
                          bind:value={mission}
                          placeholder="Your core purpose..."
                          rows="4"
                          class="w-full bg-gray-50 border-none rounded-[1.5rem] py-5 px-6 font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none placeholder:text-gray-400/50 shadow-sm"
                        ></textarea>
                      </div>
                      <div class="space-y-2">
                        <label
                          class="block text-sm font-black text-gray-700 uppercase tracking-widest px-1"
                          for="club-vision"
                          >Vision</label
                        >
                        <textarea
                          id="club-vision"
                          bind:value={vision}
                          placeholder="Where are you heading?"
                          rows="4"
                          class="w-full bg-gray-50 border-none rounded-[1.5rem] py-5 px-6 font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none placeholder:text-gray-400/50 shadow-sm"
                        ></textarea>
                      </div>
                    </div>
                    <div class="space-y-2">
                      <label
                        class="block text-sm font-black text-gray-700 uppercase tracking-widest px-1"
                        for="club-about"
                        >About Club</label
                      >
                      <textarea
                        id="club-about"
                        bind:value={aboutClub}
                        placeholder="Brief introduction about your club..."
                        rows="4"
                        class="w-full bg-gray-50 border-none rounded-[1.5rem] py-5 px-6 font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none placeholder:text-gray-400/50 shadow-sm"
                      ></textarea>
                    </div>
                    <div class="grid sm:grid-cols-2 gap-6">
                      <div class="space-y-2">
                        <label
                          class="block text-sm font-black text-gray-700 uppercase tracking-widest px-1"
                          for="club-benefits"
                          >Member Benefits</label
                        >
                        <textarea
                          id="club-benefits"
                          bind:value={benefits}
                          placeholder="Why join?"
                          rows="3"
                          class="w-full bg-gray-50 border-none rounded-[1.5rem] py-5 px-6 font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none placeholder:text-gray-400/50 shadow-sm"
                        ></textarea>
                      </div>
                      <div class="space-y-2">
                        <label
                          class="block text-sm font-black text-gray-700 uppercase tracking-widest px-1"
                          for="club-achievements"
                          >Achievements</label
                        >
                        <textarea
                          id="club-achievements"
                          bind:value={achievements}
                          placeholder="What have you achieved?"
                          rows="3"
                          class="w-full bg-gray-50 border-none rounded-[1.5rem] py-5 px-6 font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none placeholder:text-gray-400/50 shadow-sm"
                        ></textarea>
                      </div>
                      <div class="space-y-2">
                        <label
                          class="block text-sm font-black text-gray-700 uppercase tracking-widest px-1"
                          for="club-est-year"
                          >Est. Year</label
                        >
                        <input
                          id="club-est-year"
                          type="number"
                          bind:value={establishedYear}
                          placeholder="2024"
                          class="w-full bg-gray-50 border-none rounded-[1.5rem] py-5 px-6 font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-gray-400/50 shadow-sm"
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
                    <div class="grid sm:grid-cols-2 gap-6">
                      <div class="space-y-1">
                        <span
                          class="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1"
                          >Facebook</span
                        >
                        <input
                          bind:value={facebookUrl}
                          placeholder="facebook.com/club"
                          class="w-full bg-gray-50 border-none rounded-[1.2rem] py-4 px-6 font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-gray-400/50 shadow-sm"
                        />
                      </div>
                      <div class="space-y-1">
                        <span
                          class="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1"
                          >Instagram</span
                        >
                        <input
                          bind:value={instagramUrl}
                          placeholder="instagram.com/club"
                          class="w-full bg-gray-50 border-none rounded-[1.2rem] py-4 px-6 font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-gray-400/50 shadow-sm"
                        />
                      </div>
                      <div class="space-y-1">
                        <span
                          class="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1"
                          >LinkedIn</span
                        >
                        <input
                          bind:value={linkedinUrl}
                          placeholder="linkedin.com/club"
                          class="w-full bg-gray-50 border-none rounded-[1.2rem] py-4 px-6 font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-gray-400/50 shadow-sm"
                        />
                      </div>
                      <div class="space-y-1">
                        <span
                          class="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1"
                          >Twitter</span
                        >
                        <input
                          bind:value={twitterUrl}
                          placeholder="twitter.com/club"
                          class="w-full bg-gray-50 border-none rounded-[1.2rem] py-4 px-6 font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-gray-400/50 shadow-sm"
                        />
                      </div>
                      <div class="space-y-1">
                        <span
                          class="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1"
                          >Discord</span
                        >
                        <input
                          bind:value={discordUrl}
                          placeholder="discord.gg/invite"
                          class="w-full bg-gray-50 border-none rounded-[1.2rem] py-4 px-6 font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-gray-400/50 shadow-sm"
                        />
                      </div>
                      <div class="space-y-1">
                        <span
                          class="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1"
                          >GitHub</span
                        >
                        <input
                          bind:value={githubUrl}
                          placeholder="github.com/org"
                          class="w-full bg-gray-50 border-none rounded-[1.2rem] py-4 px-6 font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-gray-400/50 shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              {:else if currentStep === 4}
                <div
                  in:fly={{ x: 20, duration: 400, delay: 200 }}
                  out:fly={{ x: -20, duration: 400 }}
                >
                  <div class="space-y-10">
                    <div class="grid sm:grid-cols-2 gap-8">
                      <div class="space-y-2">
                        <label
                          class="block text-sm font-black text-gray-700 uppercase tracking-widest px-1"
                          for="club-website"
                          >Website</label
                        >
                        <input
                          id="club-website"
                          type="url"
                          bind:value={websiteUrl}
                          placeholder="https://yourclub.com"
                          class="w-full bg-gray-50 border-none rounded-[1.5rem] py-5 px-6 font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-gray-400/50 shadow-sm"
                        />
                      </div>
                      <div class="space-y-2">
                        <label
                          class="block text-sm font-black text-gray-700 uppercase tracking-widest px-1"
                          for="club-phone"
                          >Phone</label
                        >
                        <input
                          id="club-phone"
                          type="tel"
                          bind:value={contactPhone}
                          placeholder="+977 98..."
                          class="w-full bg-gray-50 border-none rounded-[1.5rem] py-5 px-6 font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-gray-400/50 shadow-sm"
                        />
                      </div>
                    </div>

                    <div class="space-y-6">
                      <div class="flex items-center justify-between">
                        <div
                          class="block text-sm font-black text-gray-700 uppercase tracking-widest px-1"
                        >
                          Club Logo
                        </div>
                        <div
                          class="bg-gray-100 p-1.5 rounded-2xl flex gap-1 shadow-inner"
                        >
                          <button
                            type="button"
                            class="px-5 py-2 text-xs font-black rounded-xl transition-all {logoSource ===
                            'local'
                              ? 'bg-white text-blue-600 shadow-sm'
                              : 'text-gray-400 hover:text-gray-600'}"
                            onclick={() => (logoSource = "local")}
                            >UPLOAD</button
                          >
                          <button
                            type="button"
                            class="px-5 py-2 text-xs font-black rounded-xl transition-all {logoSource ===
                            'url'
                              ? 'bg-white text-blue-600 shadow-sm'
                              : 'text-gray-400 hover:text-gray-600'}"
                            onclick={() => (logoSource = "url")}>URL</button
                          >
                        </div>
                      </div>

                      {#if logoSource === "local"}
                        <div
                          class="relative group border-[3px] border-dashed border-gray-100 rounded-[2.5rem] p-16 hover:border-blue-500/50 hover:bg-blue-50/30 transition-all duration-500 text-center cursor-pointer shadow-xs"
                        >
                          <input
                            type="file"
                            onchange={handleFileChange}
                            accept="image/*"
                            class="absolute inset-0 opacity-0 cursor-pointer z-10"
                          />
                          {#if logoPreview}
                            <img
                              src={logoPreview}
                              alt="Preview"
                              class="mx-auto h-32 w-32 object-contain rounded-3xl shadow-2xl bg-white border-4 border-white transition-transform group-hover:scale-105"
                            />
                          {:else}
                            <div
                              class="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500"
                            >
                              <svg
                                class="w-10 h-10 text-blue-500"
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
                            </div>
                            <p
                              class="text-gray-900 font-bold text-lg mb-1 tracking-tight"
                            >
                              Drop logo here
                            </p>
                            <p class="text-gray-400 font-bold text-xs">
                              High-res PNG preferred
                            </p>
                          {/if}
                        </div>
                      {:else}
                        <input
                          type="url"
                          bind:value={logoUrl}
                          placeholder="https://..."
                          class="w-full bg-gray-50 border-none rounded-[1.5rem] py-5 px-6 font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-gray-400/50 shadow-sm"
                        />
                      {/if}
                    </div>
                  </div>
                </div>
              {/if}
            </div>

            {#if error}
              <div
                class="mt-8 p-6 bg-red-50 text-red-600 border border-red-100 rounded-3xl flex items-center gap-4 font-bold text-sm shadow-sm"
                in:fade
              >
                <div
                  class="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center shrink-0"
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
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
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
                  class="px-10 py-5 text-gray-400 font-black hover:text-gray-600 transition-all active:scale-95 uppercase tracking-widest text-[10px]"
                >
                  Go Back
                </button>
              {/if}

              <div class="flex-1"></div>

              {#if currentStep < totalSteps}
                <button
                  type="button"
                  onclick={nextStep}
                  class="px-12 py-5 bg-[#0A0D14] hover:cursor-pointer text-white font-black rounded-2xl hover:bg-black shadow-2xl active:scale-95 transition-all text-sm flex items-center gap-3 uppercase tracking-widest"
                >
                  <span>Continue</span>
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    ><path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="3"
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    /></svg
                  >
                </button>
              {:else}
                <button
                  type="submit"
                  disabled={submitting}
                  class="px-12 py-5 hover:cursor-cursor bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 shadow-2xl shadow-blue-500/20 active:scale-95 transition-all text-sm uppercase tracking-widest disabled:opacity-50"
                >
                  Establish Club
                </button>
              {/if}
            </div>
          </form>
        </div>
      {/if}
    </main>
  </div>
</div>

<style>
  :global(body) {
    background-color: #f8fafc;
  }
</style>
