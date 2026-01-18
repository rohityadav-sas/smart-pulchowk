<script lang="ts">
  import { route as routeAction, goto } from "@mateothegreat/svelte5-router";
  import {
    getClub,
    type Club,
    getClubAdmins,
    addClubAdmin,
    removeClubAdmin,
    getClubProfile,
    updateClubProfile,
    createClubProfile,
    type ClubProfile,
    getEventCategories,
    createEventCategory,
    updateEventCategory,
    deleteEventCategory,
    type EventCategory,
  } from "../lib/api";
  import LoadingSpinner from "../components/LoadingSpinner.svelte";
  import { fade, fly, slide } from "svelte/transition";
  import { authClient } from "../lib/auth-client";

  const { route } = $props();
  const clubId = $derived(route.result.path.params.clubId);

  const session = authClient.useSession();

  let club = $state<Club | null>(null);
  let profile = $state<ClubProfile | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Admin management state
  let admins = $state<
    { id: string; email: string; name: string; image: string }[]
  >([]);
  let newAdminEmail = $state("");
  let adminLoading = $state(false);
  let adminError = $state<string | null>(null);

  // Profile editing state
  let isEditingProfile = $state(false);
  let editedProfile = $state<Partial<ClubProfile>>({});
  let saveLoading = $state(false);

  // Event categories state (independent from actual events)
  let eventCategoriesList = $state<EventCategory[]>([]);
  let selectedCategory = $state<EventCategory | null>(null);
  let isEditingCategory = $state(false);
  let editedCategory = $state<Partial<EventCategory>>({});
  let saveCategoryLoading = $state(false);
  let showCategoryModal = $state(false);
  let loadingCategories = $state(true);

  const isClubOwner = $derived(
    $session.data?.user && club && club.authClubId === $session.data.user.id,
  );

  const isTempAdmin = $derived(
    $session.data?.user &&
      admins.some((admin) => admin.id === $session.data?.user?.id),
  );

  const userId = $derived($session.data?.user?.id);

  const canCreateEvent = $derived(isClubOwner || isTempAdmin);

  $effect(() => {
    if (clubId) {
      loadClub();
    }
  });

  $effect(() => {
    if (!$session.isPending && !$session.error && !$session.data?.user) {
      goto("/register?message=login_required");
    }
  });

  $effect(() => {
    // Load admins if user is logged in, so we can determine temporary admin status
    // distinct userId check prevents refetching on window focus when session refreshes
    if (userId && clubId) {
      loadAdmins();
    }
  });

  async function loadClub() {
    loading = true;
    error = null;
    try {
      const [clubRes, profileRes] = await Promise.all([
        getClub(parseInt(clubId)),
        getClubProfile(parseInt(clubId)),
      ]);

      if (clubRes.success && clubRes.clubData) {
        club = clubRes.clubData;
      } else {
        error = clubRes.message || "Club not found";
      }

      if (profileRes.success) {
        profile = profileRes.profile;
        if (profile) {
          editedProfile = { ...profile };
        }
      }

      // Load independent event categories
      loadCategories();
    } catch (err: any) {
      error = err.message || "An error occurred";
    } finally {
      loading = false;
    }
  }

  async function loadCategories() {
    if (!clubId) return;
    loadingCategories = true;
    try {
      const result = await getEventCategories(parseInt(clubId));
      if (result.success) {
        eventCategoriesList = result.categories;
      }
    } catch (err) {
      console.error("Failed to load event categories:", err);
    } finally {
      loadingCategories = false;
    }
  }

  const socialIcons: Record<string, string> = {
    facebook: "fab fa-facebook-f",
    instagram: "fab fa-instagram",
    twitter: "fab fa-x-twitter",
    linkedin: "fab fa-linkedin-in",
    github: "fab fa-github",
    discord: "fab fa-discord",
    youtube: "fab fa-youtube",
  };

  async function handleUpdateProfile() {
    if (!club) return;
    saveLoading = true;
    try {
      const {
        id,
        clubId: cid,
        updatedAt,
        createdAt,
        totalEventHosted,
        club: c,
        ...dataToSave
      } = editedProfile as any;

      if (dataToSave.establishedYear) {
        dataToSave.establishedYear = parseInt(
          dataToSave.establishedYear.toString(),
        );
      }

      let result;
      if (profile) {
        result = await updateClubProfile(parseInt(clubId), dataToSave);
      } else {
        result = await createClubProfile(parseInt(clubId), dataToSave);
      }

      if (result.success && result.profile) {
        profile = result.profile;
        editedProfile = JSON.parse(JSON.stringify(profile));
        isEditingProfile = false;
      } else {
        alert(result.message || "Failed to save profile");
      }
    } catch (err: any) {
      alert(err.message || "An error occurred");
    } finally {
      saveLoading = false;
    }
  }

  function startEditing() {
    const defaultSocials = {
      facebook: "",
      instagram: "",
      twitter: "",
      linkedin: "",
      github: "",
      discord: "",
    };

    if (profile) {
      editedProfile = JSON.parse(JSON.stringify(profile));
      if (!editedProfile.socialLinks) {
        editedProfile.socialLinks = defaultSocials;
      } else {
        editedProfile.socialLinks = {
          ...defaultSocials,
          ...editedProfile.socialLinks,
        };
      }
    } else {
      editedProfile = {
        aboutClub: "",
        mission: "",
        vision: "",
        achievements: "",
        benefits: "",
        contactPhone: "",
        websiteUrl: "",
        socialLinks: defaultSocials,
        establishedYear: new Date().getFullYear(),
      };
    }
    isEditingProfile = true;
  }

  async function loadAdmins() {
    if (!clubId) return;
    try {
      const result = await getClubAdmins(parseInt(clubId));
      if (result.success && result.admins) {
        admins = result.admins;
      }
    } catch (err) {
      console.error("Failed to load admins:", err);
    }
  }

  async function handleAddAdmin() {
    if (!newAdminEmail || !club?.authClubId) return;

    adminLoading = true;
    adminError = null;

    try {
      const result = await addClubAdmin(
        parseInt(clubId),
        newAdminEmail,
        club.authClubId,
      );
      if (result.success) {
        newAdminEmail = "";
        await loadAdmins();
      } else {
        adminError = result.message || "Failed to add admin";
      }
    } catch (err: any) {
      adminError = err.message || "An error occurred";
    } finally {
      adminLoading = false;
    }
  }

  async function handleRemoveAdmin(userId: string) {
    if (!club?.authClubId) return;

    if (!confirm("Are you sure you want to remove this admin?")) return;

    adminLoading = true;
    adminError = null;

    try {
      const result = await removeClubAdmin(
        parseInt(clubId),
        userId,
        club.authClubId,
      );
      if (result.success) {
        await loadAdmins();
      } else {
        adminError = result.message || "Failed to remove admin";
      }
    } catch (err: any) {
      adminError = err.message || "An error occurred";
    } finally {
      adminLoading = false;
    }
  }

  function textToPoints(text: string | null) {
    if (!text) return [];
    return text
      .split("\n")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  function openCategoryModal(category: EventCategory | null = null) {
    if (category) {
      selectedCategory = category;
      editedCategory = { ...category };
      isEditingCategory = true;
    } else {
      selectedCategory = null;
      editedCategory = {
        name: "",
        description: "",
        objectives: "",
        targetAudience: "",
        prerequisites: "",
        rules: "",
        judgingCriteria: "",
      };
      isEditingCategory = false;
    }
    showCategoryModal = true;
  }

  function closeCategoryModal() {
    showCategoryModal = false;
    selectedCategory = null;
    editedCategory = {};
  }

  async function handleSaveCategory() {
    if (!clubId) return;
    saveCategoryLoading = true;

    try {
      const {
        id,
        clubId: cid,
        createdAt,
        updatedAt,
        ...dataToSave
      } = editedCategory as any;

      let result;
      if (selectedCategory) {
        result = await updateEventCategory(selectedCategory.id, dataToSave);
      } else {
        result = await createEventCategory(parseInt(clubId), dataToSave);
      }

      if (result.success) {
        await loadCategories();
        closeCategoryModal();
      } else {
        alert(result.message || "Failed to save category");
      }
    } catch (err: any) {
      alert(err.message || "An error occurred");
    } finally {
      saveCategoryLoading = false;
    }
  }

  async function handleDeleteCategory(categoryId: number) {
    if (!confirm("Are you sure you want to delete this category?")) return;

    try {
      const result = await deleteEventCategory(categoryId);
      if (result.success) {
        await loadCategories();
      } else {
        alert(result.message || "Failed to delete category");
      }
    } catch (err: any) {
      alert(err.message || "An error occurred");
    }
  }
</script>

<div class="min-h-[calc(100vh-4rem)] bg-gray-50/30 px-4 py-8 sm:px-6 lg:px-8">
  <div class="max-w-7xl mx-auto">
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
        />
      </svg>
      <span class="text-gray-900 font-medium"
        >{club?.name || "Club Details"}</span
      >
    </nav>

    {#if loading}
      <div class="flex items-center justify-center py-20" in:fade>
        <LoadingSpinner size="lg" text="Loading club details..." />
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
            />
          </svg>
        </div>
        <p class="text-red-600 font-medium mb-4">{error}</p>
        <button
          onclick={loadClub}
          class="px-6 py-2 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors"
          >Try Again</button
        >
      </div>
    {:else if club}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Left Column: Club Info -->
        <div class="lg:col-span-2 space-y-8">
          <div
            class="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 relative overflow-hidden"
            in:fly={{ y: 20, duration: 600 }}
          >
            <div
              class="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-60"
            ></div>

            <div class="relative flex flex-col md:flex-row gap-8 items-start">
              <div class="shrink-0">
                <div
                  class="w-32 h-32 md:w-48 md:h-48 bg-linear-to-br from-blue-500 to-indigo-600 rounded-3xl shadow-xl flex items-center justify-center overflow-hidden transform rotate-3"
                >
                  {#if club.logoUrl}
                    <img
                      src={club.logoUrl}
                      alt={club.name}
                      class="w-full h-full object-cover"
                    />
                  {:else}
                    <span class="text-6xl font-bold text-white"
                      >{club.name.charAt(0)}</span
                    >
                  {/if}
                </div>
              </div>

              <div class="flex-1">
                <h1
                  class="text-4xl md:text-5xl font-black text-gray-900 mb-4 tracking-tight"
                >
                  {club.name}
                </h1>
                <div class="flex flex-wrap gap-3 mb-6">
                  <span
                    class="px-4 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-full uppercase tracking-wider border border-blue-100"
                    >Official Club</span
                  >
                  {#if club.isActive}
                    <span
                      class="px-4 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full uppercase tracking-wider border border-emerald-100"
                      >Active</span
                    >
                  {/if}
                </div>
                <p class="text-lg text-gray-600 leading-relaxed mb-8">
                  {club.description ||
                    "No description available for this club yet."}
                </p>

                <div class="flex gap-4">
                  <a
                    href="/clubs/{club.id}/events"
                    use:routeAction
                    class="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-600/20 hover:-translate-y-1 active:scale-95"
                  >
                    View Events
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
                        d="M17 8l4 4m0 0l-4 4m4-4H3"
                      />
                    </svg>
                  </a>
                  {#if canCreateEvent}
                    <a
                      href="/clubs/{club.id}/events/create"
                      use:routeAction
                      class="inline-flex items-center gap-2 px-8 py-4 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-2xl transition-all shadow-lg shadow-gray-900/20 hover:-translate-y-1 active:scale-95"
                    >
                      Create Event
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
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    </a>
                  {/if}
                </div>
              </div>
            </div>
          </div>

          <!-- Club Profile Section -->
          <div
            class="bg-white rounded-3xl shadow-xs border border-gray-100 p-8 md:p-10"
            in:fly={{ y: 20, duration: 600, delay: 200 }}
          >
            <div class="flex items-center justify-between mb-8">
              <div>
                <h2 class="text-2xl font-black text-gray-900 tracking-tight">
                  About the Club
                </h2>
                <div class="h-1.5 w-12 bg-blue-600 rounded-full mt-2"></div>
              </div>
              {#if canCreateEvent && !isEditingProfile}
                <button
                  onclick={startEditing}
                  class="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-blue-600 bg-blue-50/50 border border-blue-100 rounded-xl hover:bg-blue-600 hover:text-white transition-all duration-300 shadow-sm"
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
                      stroke-width="2.5"
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                  Edit Profile
                </button>
              {/if}
            </div>

            {#if isEditingProfile}
              <div class="space-y-10" in:slide>
                <!-- General Section -->
                <div class="space-y-6">
                  <div
                    class="flex items-center gap-3 border-b border-gray-100 pb-2"
                  >
                    <svg
                      class="w-5 h-5 text-blue-600"
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
                    <h3
                      class="text-sm font-black text-gray-900 uppercase tracking-widest"
                    >
                      General Information
                    </h3>
                  </div>

                  <div>
                    <label
                      for="aboutClub"
                      class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2"
                      >About the Club</label
                    >
                    <textarea
                      id="aboutClub"
                      bind:value={editedProfile.aboutClub}
                      class="w-full px-5 py-4 rounded-2xl border-gray-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-gray-700 bg-gray-50/50 placeholder:text-gray-400"
                      placeholder="Write a compelling introduction about your club..."
                      rows="4"
                    ></textarea>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label
                        for="achievements"
                        class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2"
                        >Achievements</label
                      >
                      <textarea
                        id="achievements"
                        bind:value={editedProfile.achievements}
                        class="w-full px-5 py-4 rounded-2xl border-gray-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-gray-700 bg-gray-50/50 placeholder:text-gray-400"
                        placeholder="List your group's major milestones (one per line)..."
                        rows="4"
                      ></textarea>
                    </div>
                    <div>
                      <label
                        for="benefits"
                        class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2"
                        >Member Benefits</label
                      >
                      <textarea
                        id="benefits"
                        bind:value={editedProfile.benefits}
                        class="w-full px-5 py-4 rounded-2xl border-gray-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-gray-700 bg-gray-50/50 placeholder:text-gray-400"
                        placeholder="What do students gain by joining? (one per line)..."
                        rows="4"
                      ></textarea>
                    </div>
                  </div>
                </div>

                <!-- Mission & Vision -->
                <div class="space-y-6">
                  <div
                    class="flex items-center gap-3 border-b border-gray-100 pb-2"
                  >
                    <svg
                      class="w-5 h-5 text-purple-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                    <h3
                      class="text-sm font-black text-gray-900 uppercase tracking-widest"
                    >
                      Purpose & Goals
                    </h3>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label
                        for="mission"
                        class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2"
                        >Our Mission</label
                      >
                      <textarea
                        id="mission"
                        bind:value={editedProfile.mission}
                        class="w-full px-5 py-4 rounded-2xl border-gray-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-gray-700 bg-gray-50/50 placeholder:text-gray-400"
                        placeholder="Define your daily goals (points split by new line)..."
                        rows="4"
                      ></textarea>
                    </div>
                    <div>
                      <label
                        for="vision"
                        class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2"
                        >Our Vision</label
                      >
                      <textarea
                        id="vision"
                        bind:value={editedProfile.vision}
                        class="w-full px-5 py-4 rounded-2xl border-gray-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-gray-700 bg-gray-50/50 placeholder:text-gray-400"
                        placeholder="Define your long-term aspirations..."
                        rows="4"
                      ></textarea>
                    </div>
                  </div>
                </div>

                <!-- Contact & Socials -->
                <div class="space-y-6">
                  <div
                    class="flex items-center gap-3 border-b border-gray-100 pb-2"
                  >
                    <svg
                      class="w-5 h-5 text-emerald-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <h3
                      class="text-sm font-black text-gray-900 uppercase tracking-widest"
                    >
                      Contact & Social Presence
                    </h3>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label
                        for="contactPhone"
                        class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2"
                        >Phone Number</label
                      >
                      <input
                        id="contactPhone"
                        type="text"
                        bind:value={editedProfile.contactPhone}
                        class="w-full px-4 py-3 rounded-xl border-gray-200 focus:ring-4 focus:ring-blue-100 bg-gray-50/50 placeholder:text-gray-400"
                        placeholder="+977 ..."
                      />
                    </div>
                    <div>
                      <label
                        for="websiteUrl"
                        class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2"
                        >Official Website</label
                      >
                      <input
                        id="websiteUrl"
                        type="url"
                        bind:value={editedProfile.websiteUrl}
                        class="w-full px-4 py-3 rounded-xl border-gray-200 focus:ring-4 focus:ring-blue-100 bg-gray-50/50 placeholder:text-gray-400"
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label
                        for="establishedYear"
                        class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2"
                        >Established Year</label
                      >
                      <input
                        id="establishedYear"
                        type="number"
                        bind:value={editedProfile.establishedYear}
                        class="w-full px-4 py-3 rounded-xl border-gray-200 focus:ring-4 focus:ring-blue-100 bg-gray-50/50"
                      />
                    </div>
                  </div>

                  <div
                    class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 pt-4"
                  >
                    {#each ["facebook", "instagram", "twitter", "linkedin", "github", "discord"] as platform}
                      <div class="flex items-center gap-4">
                        <div
                          class="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0"
                        >
                          <span
                            class="text-xs font-black uppercase text-gray-400"
                            >{platform.charAt(0)}</span
                          >
                        </div>
                        <input
                          id={platform}
                          type="text"
                          bind:value={
                            (
                              editedProfile.socialLinks as Record<
                                string,
                                string
                              >
                            )[platform]
                          }
                          class="flex-1 px-4 py-3 text-sm rounded-xl border-gray-200 bg-gray-50/50 focus:ring-4 focus:ring-blue-100"
                          placeholder="{platform} URL"
                        />
                      </div>
                    {/each}
                  </div>
                </div>

                <!-- Actions -->
                <div
                  class="flex items-center gap-4 pt-6 border-t border-gray-100"
                >
                  <button
                    onclick={handleUpdateProfile}
                    disabled={saveLoading}
                    class="flex-1 md:flex-none px-10 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-50 active:scale-95"
                  >
                    {saveLoading ? "Saving Changes..." : "Save Club Profile"}
                  </button>
                  <button
                    onclick={() => (isEditingProfile = false)}
                    class="flex-1 md:flex-none px-10 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all active:scale-95"
                  >
                    Discard
                  </button>
                </div>
              </div>
            {:else}
              <div class="space-y-8">
                <!-- Section 1: About the Club (Hero Introduction) -->
                <div
                  class="relative overflow-hidden rounded-3xl bg-linear-to-br from-slate-50 via-white to-blue-50/30 p-8 border border-gray-100/80"
                >
                  <div
                    class="absolute top-0 right-0 w-48 h-48 bg-linear-to-br from-blue-100/40 to-indigo-100/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"
                  ></div>
                  <div class="relative">
                    <div class="flex items-center gap-3 mb-5">
                      <div
                        class="flex items-center justify-center w-10 h-10 rounded-xl bg-linear-to-br from-slate-700 to-slate-900 text-white shadow-lg shadow-slate-900/20"
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
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                      </div>
                      <div>
                        <span
                          class="text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                          >Introduction</span
                        >
                        <h3 class="text-xl font-black text-gray-900 -mt-0.5">
                          About {club.name}
                        </h3>
                      </div>
                    </div>
                    {#if profile?.aboutClub}
                      {#each textToPoints(profile?.aboutClub) as point}
                        <p
                          class="text-base leading-relaxed text-gray-600 pl-13"
                        >
                          {point}
                        </p>
                      {/each}
                    {:else}
                      <p class="text-base leading-relaxed text-gray-600 pl-13">
                        Welcome to the official page of <span
                          class="font-semibold text-gray-800">{club.name}</span
                        >. Our club is a vibrant community where creativity,
                        innovation, and collaboration come together. We host
                        various events throughout the year, from workshops and
                        seminars to social gatherings and competitions.
                      </p>
                      <p
                        class="text-base leading-relaxed text-gray-600 pl-13 mt-4"
                      >
                        Members of {club.name} gain access to a network of like minded
                        individuals, hands on experience in various projects, and
                        the opportunity to lead and organize campus wide events.
                      </p>
                    {/if}

                    <!-- Quick Stats Row -->
                    {#if profile?.establishedYear || profile?.websiteUrl}
                      <div class="flex flex-wrap gap-4 mt-6 pl-13">
                        {#if profile?.establishedYear}
                          <div
                            class="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-100 shadow-sm"
                          >
                            <svg
                              class="w-4 h-4 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                            <span class="text-sm font-medium text-gray-600"
                              >Est. <span class="font-bold text-gray-900"
                                >{profile.establishedYear}</span
                              ></span
                            >
                          </div>
                        {/if}
                        {#if profile?.websiteUrl}
                          <a
                            href={profile.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-blue-200 hover:bg-blue-50/50 transition-all duration-200 group"
                          >
                            <svg
                              class="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                              />
                            </svg>
                            <span
                              class="text-sm font-medium text-gray-600 group-hover:text-blue-600 transition-colors"
                              >Visit Website</span
                            >
                            <svg
                              class="w-3 h-3 text-gray-300 group-hover:text-blue-400 transition-colors"
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
                        {/if}
                      </div>
                    {/if}
                  </div>
                </div>

                <!-- Section 2 & 3: Vision & Mission (Side by Side) -->
                {#if profile?.vision || profile?.mission}
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- Vision Card (Comes First - The WHY) -->
                    {#if profile?.vision}
                      <div
                        class="group relative overflow-hidden rounded-3xl bg-linear-to-br from-indigo-50/80 via-purple-50/50 to-violet-50/80 p-7 border border-purple-100/60 hover:border-purple-200/80 transition-all duration-300 hover:shadow-lg hover:shadow-purple-100/50"
                      >
                        <div
                          class="absolute top-0 right-0 w-32 h-32 bg-linear-to-br from-purple-200/30 to-indigo-200/30 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-500"
                        ></div>
                        <div class="relative">
                          <div class="flex items-center gap-3 mb-5">
                            <div
                              class="flex items-center justify-center w-11 h-11 rounded-xl bg-linear-to-br from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/25"
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
                                  stroke-width="2.5"
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                            </div>
                            <div>
                              <span
                                class="text-[10px] font-bold text-purple-400 uppercase tracking-widest"
                                >Long-term Aspiration</span
                              >
                              <h3
                                class="text-lg font-black text-gray-900 -mt-0.5"
                              >
                                Our Vision
                              </h3>
                            </div>
                          </div>
                          <ul class="space-y-3">
                            {#each textToPoints(profile.vision) as point, i}
                              <li
                                class="flex items-start gap-3 text-gray-600 text-sm leading-relaxed"
                              >
                                <span
                                  class="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-600 text-[10px] font-bold shrink-0 mt-0.5"
                                  >{i + 1}</span
                                >
                                <span>{point}</span>
                              </li>
                            {/each}
                          </ul>
                        </div>
                      </div>
                    {/if}

                    <!-- Mission Card (Comes Second - The WHAT) -->
                    {#if profile?.mission}
                      <div
                        class="group relative overflow-hidden rounded-3xl bg-linear-to-br from-blue-50/80 via-sky-50/50 to-cyan-50/80 p-7 border border-blue-100/60 hover:border-blue-200/80 transition-all duration-300 hover:shadow-lg hover:shadow-blue-100/50"
                      >
                        <div
                          class="absolute top-0 right-0 w-32 h-32 bg-linear-to-br from-blue-200/30 to-cyan-200/30 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-500"
                        ></div>
                        <div class="relative">
                          <div class="flex items-center gap-3 mb-5">
                            <div
                              class="flex items-center justify-center w-11 h-11 rounded-xl bg-linear-to-br from-blue-500 to-cyan-600 text-white shadow-lg shadow-blue-500/25"
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
                                  stroke-width="2.5"
                                  d="M13 10V3L4 14h7v7l9-11h-7z"
                                />
                              </svg>
                            </div>
                            <div>
                              <span
                                class="text-[10px] font-bold text-blue-400 uppercase tracking-widest"
                                >Day-to-day Purpose</span
                              >
                              <h3
                                class="text-lg font-black text-gray-900 -mt-0.5"
                              >
                                Our Mission
                              </h3>
                            </div>
                          </div>
                          <ul class="space-y-3">
                            {#each textToPoints(profile.mission) as point, i}
                              <li
                                class="flex items-start gap-3 text-gray-600 text-sm leading-relaxed"
                              >
                                <span
                                  class="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold shrink-0 mt-0.5"
                                  >{i + 1}</span
                                >
                                <span>{point}</span>
                              </li>
                            {/each}
                          </ul>
                        </div>
                      </div>
                    {/if}
                  </div>
                {/if}

                <!-- Section 4 & 5: Benefits & Achievements  -->
                {#if profile?.benefits || profile?.achievements}
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- Member Benefits Card -->
                    {#if profile?.benefits}
                      <div
                        class="group relative overflow-hidden rounded-3xl bg-linear-to-br from-emerald-50/80 via-green-50/50 to-teal-50/80 p-7 border border-emerald-100/60 hover:border-emerald-200/80 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-100/50"
                      >
                        <div
                          class="absolute top-0 right-0 w-32 h-32 bg-linear-to-br from-emerald-200/30 to-teal-200/30 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-500"
                        ></div>
                        <div class="relative">
                          <div class="flex items-center gap-3 mb-5">
                            <div
                              class="flex items-center justify-center w-11 h-11 rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25"
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
                                  stroke-width="2.5"
                                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                            </div>
                            <div>
                              <span
                                class="text-[10px] font-bold text-emerald-400 uppercase tracking-widest"
                                >What You Gain</span
                              >
                              <h3
                                class="text-lg font-black text-gray-900 -mt-0.5"
                              >
                                Member Benefits
                              </h3>
                            </div>
                          </div>
                          <ul class="space-y-3">
                            {#each textToPoints(profile.benefits) as point}
                              <li
                                class="flex items-start gap-3 text-gray-600 text-sm leading-relaxed"
                              >
                                <div
                                  class="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 shrink-0 mt-0.5"
                                >
                                  <svg
                                    class="w-3 h-3 text-emerald-600"
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
                                </div>
                                <span>{point}</span>
                              </li>
                            {/each}
                          </ul>
                        </div>
                      </div>
                    {/if}

                    <!-- Achievements Card -->
                    {#if profile?.achievements}
                      <div
                        class="group relative overflow-hidden rounded-3xl bg-linear-to-br from-amber-50/80 via-yellow-50/50 to-orange-50/80 p-7 border border-amber-100/60 hover:border-amber-200/80 transition-all duration-300 hover:shadow-lg hover:shadow-amber-100/50"
                      >
                        <div
                          class="absolute top-0 right-0 w-32 h-32 bg-linear-to-br from-amber-200/30 to-orange-200/30 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-500"
                        ></div>
                        <div class="relative">
                          <div class="flex items-center gap-3 mb-5">
                            <div
                              class="flex items-center justify-center w-11 h-11 rounded-xl bg-linear-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25"
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
                                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                                />
                              </svg>
                            </div>
                            <div>
                              <span
                                class="text-[10px] font-bold text-amber-400 uppercase tracking-widest"
                                >Our Track Record</span
                              >
                              <h3
                                class="text-lg font-black text-gray-900 -mt-0.5"
                              >
                                Achievements
                              </h3>
                            </div>
                          </div>
                          <ul class="space-y-3">
                            {#each textToPoints(profile.achievements) as point}
                              <li
                                class="flex items-start gap-3 text-gray-600 text-sm leading-relaxed"
                              >
                                <span
                                  class="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 shrink-0 mt-0.5"
                                >
                                  <svg
                                    class="w-3 h-3 text-amber-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                      stroke-width="2"
                                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                    />
                                  </svg>
                                </span>
                                <span>{point}</span>
                              </li>
                            {/each}
                          </ul>
                        </div>
                      </div>
                    {/if}
                  </div>
                {/if}

                <!-- Section 6: Contact & Social Links -->
                {#if profile?.socialLinks && Object.values(profile.socialLinks).some((v) => v)}
                  <div
                    class="relative overflow-hidden rounded-3xl bg-linear-to-br from-gray-50 via-slate-50/50 to-gray-100/50 p-8 border border-gray-200/60"
                  >
                    <div
                      class="absolute bottom-0 left-0 w-48 h-48 bg-linear-to-tr from-blue-100/30 to-indigo-100/30 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"
                    ></div>
                    <div class="relative">
                      <div class="flex items-center gap-3 mb-6">
                        <div
                          class="flex items-center justify-center w-10 h-10 rounded-xl bg-linear-to-br from-gray-700 to-gray-900 text-white shadow-lg shadow-gray-900/20"
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
                              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                        <div>
                          <span
                            class="text-[10px] font-bold text-gray-400 uppercase tracking-widest"
                            >Get in Touch</span
                          >
                          <h3 class="text-lg font-black text-gray-900 -mt-0.5">
                            Contact & Connect
                          </h3>
                        </div>
                      </div>

                      <!-- Social Links -->
                      {#if profile?.socialLinks && Object.values(profile.socialLinks).some((v) => v)}
                        <div class="pl-13">
                          <p
                            class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4"
                          >
                            Follow Us
                          </p>
                          <div class="flex flex-wrap gap-3">
                            {#each Object.entries(profile.socialLinks || {}) as [platform, url]}
                              {#if url}
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  class="group relative flex items-center justify-center w-12 h-12 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 hover:-translate-y-1 transition-all duration-300"
                                  title={platform}
                                  aria-label={platform}
                                >
                                  <i
                                    class="{socialIcons[
                                      platform
                                    ]} text-xl text-gray-500 group-hover:text-blue-600 transition-colors"
                                  ></i>
                                </a>
                              {/if}
                            {/each}
                          </div>
                        </div>
                      {/if}
                    </div>
                  </div>
                {/if}

                <!-- Empty State for No Profile Data -->
                {#if !profile?.aboutClub && !profile?.vision && !profile?.mission && !profile?.benefits && !profile?.achievements && !profile?.contactPhone && (!profile?.socialLinks || !Object.values(profile.socialLinks || {}).some((v) => v))}
                  <div class="text-center py-12">
                    <div
                      class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 text-gray-400 mb-4"
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
                          stroke-width="1.5"
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                    </div>
                    <p class="text-gray-500 font-medium">
                      No profile information available yet.
                    </p>
                    {#if canCreateEvent}
                      <p class="text-sm text-gray-400 mt-1">
                        Click "Edit Profile" to add information about your club.
                      </p>
                    {/if}
                  </div>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Event Categories Section -->
          <div
            class="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 md:p-10"
            in:fly={{ y: 20, duration: 600, delay: 300 }}
          >
            <div class="flex items-center justify-between mb-8">
              <div>
                <h2 class="text-2xl font-black text-gray-900 tracking-tight">
                  Our Organized Events
                </h2>
                <p class="text-sm text-gray-500 mt-1">
                  categories of events we organize
                </p>
                <div class="h-1.5 w-12 bg-indigo-600 rounded-full mt-3"></div>
              </div>
              {#if isClubOwner}
                <button
                  onclick={() => openCategoryModal()}
                  class="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 hover:-translate-y-0.5"
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
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add Category
                </button>
              {/if}
            </div>

            {#if loadingCategories}
              <div
                class="flex flex-col items-center justify-center py-20 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200"
              >
                <LoadingSpinner size="md" text="Loading categories..." />
              </div>
            {:else if eventCategoriesList.length > 0}
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {#each eventCategoriesList as category}
                  <div
                    class="group relative overflow-hidden rounded-2xl bg-linear-to-br from-white via-indigo-50/20 to-purple-50/30 border border-gray-100 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-100/50 transition-all duration-300 hover:-translate-y-1"
                  >
                    <!-- Action Buttons for Owners -->
                    {#if isClubOwner}
                      <div
                        class="absolute top-3 right-3 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <button
                          onclick={() => openCategoryModal(category)}
                          class="p-2 bg-white/90 backdrop-blur-sm text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg shadow-sm transition-all"
                          title="Edit Category"
                          aria-label="Edit Category"
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
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onclick={() => handleDeleteCategory(category.id)}
                          class="p-2 bg-white/90 backdrop-blur-sm text-red-600 hover:bg-red-600 hover:text-white rounded-lg shadow-sm transition-all"
                          title="Delete Category"
                          aria-label="Delete Category"
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
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    {/if}

                    <a
                      href="/clubs/{clubId}/categories/{category.id}"
                      use:routeAction
                      class="block p-6 h-full"
                    >
                      <div
                        class="w-12 h-12 bg-linear-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg shadow-indigo-200"
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
                            d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2zM14 2v4h4"
                          />
                        </svg>
                      </div>
                      <h3
                        class="text-lg font-bold text-gray-900 mb-2 group-hover:text-indigo-700 transition-colors"
                      >
                        {category.name}
                      </h3>
                      {#if category.description}
                        <p class="text-sm text-gray-500 line-clamp-2 mb-4">
                          {category.description}
                        </p>
                      {/if}
                      <div
                        class="flex items-center gap-1.5 text-indigo-600 text-sm font-semibold group-hover:gap-3 transition-all"
                      >
                        <span>Read Detail</span>
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
                            d="M17 8l4 4m0 0l-4 4m4-4H3"
                          />
                        </svg>
                      </div>
                    </a>
                  </div>
                {/each}
              </div>
            {:else}
              <div
                class="text-center py-12 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200"
              >
                <div
                  class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-400 mb-4"
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
                      stroke-width="1.5"
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </div>
                <h3 class="text-lg font-bold text-gray-900 mb-1">
                  No event categories yet
                </h3>
                <p class="text-gray-500 text-sm mb-6">
                  Create profiles for the types of events you organize.
                </p>
                {#if isClubOwner}
                  <button
                    onclick={() => openCategoryModal()}
                    class="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
                  >
                    Create First Category
                  </button>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Category Management Modal -->
          {#if showCategoryModal}
            <div
              class="fixed inset-0 z-50 flex items-center justify-center p-4"
              in:fade={{ duration: 200 }}
            >
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
                onclick={closeCategoryModal}
              ></div>
              <div
                class="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto"
                onclick={(e) => e.stopPropagation()}
                in:fly={{ y: 20, duration: 300 }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="category-modal-title"
                tabindex="-1"
                onkeydown={(e) => e.key === "Escape" && closeCategoryModal()}
              >
                <div class="flex items-center justify-between mb-8">
                  <div>
                    <h2
                      id="category-modal-title"
                      class="text-2xl font-black text-gray-900 tracking-tight"
                    >
                      {isEditingCategory ? "Edit Category" : "Add New Category"}
                    </h2>
                    <p class="text-sm text-gray-500 mt-1">
                      Describe a general type of event your club organizes
                    </p>
                  </div>
                  <button
                    onclick={closeCategoryModal}
                    class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                    aria-label="Close modal"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div class="md:col-span-2">
                    <label
                      class="block text-sm font-bold text-gray-700 uppercase tracking-wide mb-2"
                      for="cat-name"
                    >
                      Category Name
                    </label>
                    <input
                      id="cat-name"
                      type="text"
                      bind:value={editedCategory.name}
                      placeholder="e.g., Hackathon, Workshop, Seminar"
                      class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-gray-400"
                    />
                  </div>

                  <div class="md:col-span-2">
                    <label
                      class="block text-sm font-bold text-gray-700 uppercase tracking-wide mb-2"
                      for="cat-desc"
                    >
                      General Description
                    </label>
                    <textarea
                      id="cat-desc"
                      bind:value={editedCategory.description}
                      rows="3"
                      placeholder="What is this type of event in general?"
                      class="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-gray-400"
                    ></textarea>
                  </div>

                  <div>
                    <label
                      class="block text-sm font-bold text-gray-700 uppercase tracking-wide mb-2"
                      for="cat-obj"
                    >
                      Key Objectives
                    </label>
                    <textarea
                      id="cat-obj"
                      bind:value={editedCategory.objectives}
                      rows="4"
                      placeholder="Enter each objective on a new line"
                      class="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-gray-400"
                    ></textarea>
                  </div>

                  <div>
                    <label
                      class="block text-sm font-bold text-gray-700 uppercase tracking-wide mb-2"
                      for="cat-aud"
                    >
                      Target Audience
                    </label>
                    <textarea
                      id="cat-aud"
                      bind:value={editedCategory.targetAudience}
                      rows="4"
                      placeholder="Who is this for? (separate by newlines)"
                      class="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-gray-400"
                    ></textarea>
                  </div>

                  <div>
                    <label
                      class="block text-sm font-bold text-gray-700 uppercase tracking-wide mb-2"
                      for="cat-rules"
                    >
                      Rules & Guidelines
                    </label>
                    <textarea
                      id="cat-rules"
                      bind:value={editedCategory.rules}
                      rows="4"
                      placeholder="General rules (separate by newlines)"
                      class="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-gray-400"
                    ></textarea>
                  </div>

                  <div>
                    <label
                      class="block text-sm font-bold text-gray-700 uppercase tracking-wide mb-2"
                      for="cat-crit"
                    >
                      Judging Criteria
                    </label>
                    <textarea
                      id="cat-crit"
                      bind:value={editedCategory.judgingCriteria}
                      rows="4"
                      placeholder="Evaluation points (separate by newlines)"
                      class="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-gray-400"
                    ></textarea>
                  </div>

                  <div class="md:col-span-2">
                    <label
                      class="block text-sm font-bold text-gray-700 uppercase tracking-wide mb-2"
                      for="cat-pre"
                    >
                      Prerequisites
                    </label>
                    <textarea
                      id="cat-pre"
                      bind:value={editedCategory.prerequisites}
                      rows="2"
                      placeholder="Any general requirements? (separate by newlines)"
                      class="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-gray-400"
                    ></textarea>
                  </div>
                </div>

                <div
                  class="flex items-center justify-end gap-4 mt-8 pt-6 border-t border-gray-100"
                >
                  <button
                    onclick={closeCategoryModal}
                    class="px-6 py-3 text-gray-500 font-bold hover:text-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onclick={handleSaveCategory}
                    disabled={saveCategoryLoading || !editedCategory.name}
                    class="px-10 py-3 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 disabled:opacity-50 transition-all hover:-translate-y-0.5"
                  >
                    {#if saveCategoryLoading}
                      <div class="flex items-center gap-2">
                        <LoadingSpinner size="sm" />
                        Saving...
                      </div>
                    {:else}
                      {isEditingCategory ? "Save Changes" : "Create Category"}
                    {/if}
                  </button>
                </div>
              </div>
            </div>
          {/if}

          {#if isClubOwner}
            <!-- Admin Management Section -->
            <div
              class="bg-white rounded-3xl shadow-sm border border-gray-100 p-8"
              in:fly={{ y: 20, duration: 600, delay: 300 }}
            >
              <h2 class="text-2xl font-bold text-gray-900 mb-6">
                Manage Admins
              </h2>

              <div
                class="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100"
              >
                <h3
                  class="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4"
                >
                  Add New Admin
                </h3>
                <div class="flex flex-col sm:flex-row gap-3">
                  <div class="flex-1">
                    <input
                      type="email"
                      bind:value={newAdminEmail}
                      placeholder="Enter user email address"
                      class="w-full px-4 py-3 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-shadow placeholder:text-gray-400"
                    />
                  </div>
                  <button
                    onclick={handleAddAdmin}
                    disabled={adminLoading || !newAdminEmail}
                    class="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {adminLoading ? "Adding..." : "Add Admin"}
                  </button>
                </div>
                {#if adminError}
                  <p class="mt-2 text-sm text-red-600">{adminError}</p>
                {/if}
              </div>

              <div>
                <h3
                  class="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4"
                >
                  Current Admins
                </h3>
                {#if admins.length === 0}
                  <p class="text-gray-500 italic">
                    No additional admins assigned.
                  </p>
                {:else}
                  <ul class="divide-y divide-gray-100">
                    {#each admins as admin}
                      <li class="py-4 flex justify-between items-center group">
                        <div class="flex items-center gap-3">
                          {#if admin.image}
                            <img
                              src={admin.image}
                              alt={admin.name}
                              class="w-10 h-10 rounded-full"
                            />
                          {:else}
                            <div
                              class="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-medium"
                            >
                              {admin.name.charAt(0)}
                            </div>
                          {/if}
                          <div>
                            <p class="font-medium text-gray-900">
                              {admin.name}
                            </p>
                            <p class="text-sm text-gray-500">{admin.email}</p>
                          </div>
                        </div>
                        <button
                          onclick={() => handleRemoveAdmin(admin.id)}
                          class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove Admin"
                          aria-label="Remove Admin"
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
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>
            </div>
          {/if}
        </div>

        <!-- Right Column: Stats & Secondary Info -->
        <div class="space-y-8">
          <!-- Stats Card -->
          <div
            class="bg-white rounded-3xl shadow-sm border border-gray-100 p-8"
            in:fly={{ x: 20, duration: 600, delay: 400 }}
          >
            <h3 class="text-lg font-bold text-gray-900 mb-6">
              Club Statistics
            </h3>
            <div class="grid grid-cols-1 gap-6">
              <div
                class="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center gap-4"
              >
                <div
                  class="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20"
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
                    />
                  </svg>
                </div>
                <div>
                  <div class="text-2xl font-black text-blue-700">
                    {club.upcomingEvents || 0}
                  </div>
                  <div
                    class="text-xs font-bold text-blue-500 uppercase tracking-tighter"
                  >
                    Upcoming Events
                  </div>
                </div>
              </div>

              <div
                class="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-4"
              >
                <div
                  class="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-600/20"
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
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <div class="text-2xl font-black text-emerald-700">
                    {club.completedEvents || 0}
                  </div>
                  <div
                    class="text-xs font-bold text-emerald-500 uppercase tracking-tighter"
                  >
                    Completed Events
                  </div>
                </div>
              </div>

              <div
                class="p-4 bg-purple-50 rounded-2xl border border-purple-100 flex items-center gap-4"
              >
                <div
                  class="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-purple-600/20"
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
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
                <div>
                  <div class="text-2xl font-black text-purple-700">
                    {club.totalParticipants || 0}
                  </div>
                  <div
                    class="text-xs font-bold text-purple-500 uppercase tracking-tighter"
                  >
                    Total Participants
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Contact Card -->
          <div
            class="bg-white rounded-3xl shadow-sm border border-gray-100 p-8"
            in:fly={{ x: 20, duration: 600, delay: 600 }}
          >
            <h3 class="text-lg font-bold text-gray-900 mb-6">Contact Info</h3>
            <div class="space-y-4">
              <div class="flex items-center gap-3 text-gray-600">
                <svg
                  class="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span class="text-sm font-medium"
                  >{club.email || "No email provided"}</span
                >
              </div>
              <div class="flex items-center gap-3 text-gray-600">
                <svg
                  class="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
                <span class="text-sm font-medium"
                  >{profile?.contactPhone || "No Contact number provided"}</span
                >
              </div>
              <div class="flex items-center gap-3 text-gray-600">
                <svg
                  class="w-5 h-5 text-gray-400"
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
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span class="text-sm font-medium">IOE Pulchowk Campus</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
