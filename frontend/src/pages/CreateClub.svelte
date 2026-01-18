<script lang="ts">
  import { goto, route } from "@mateothegreat/svelte5-router";
  import { authClient } from "../lib/auth-client";
  import { createClub } from "../lib/api";
  import LoadingSpinner from "../components/LoadingSpinner.svelte";
  import { fade, fly, slide } from "svelte/transition";

  const session = authClient.useSession();

  let submitting = $state(false);
  let error = $state<string | null>(null);
  let success = $state(false);

  let name = $state("");
  let email = $state("");
  let description = $state("");
  let logoUrl = $state("");

  $effect(() => {
    if (!$session.isPending && !$session.error && !$session.data?.user) {
      goto("/register?message=login_required");
    } else if (
      $session.data?.user &&
      ($session.data.user as any).role !== "admin"
    ) {
      goto("/clubs?error=unauthorized");
    }
    // Auto-fill email from session if available
    if ($session.data?.user?.email && !email) {
      email = $session.data.user.email;
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();

    if (!$session.data?.user) {
      error = "You must be logged in to create a club";
      return;
    }

    if (!name || !email) {
      error = "Name and Email are required";
      return;
    }

    submitting = true;
    error = null;

    try {
      const result = await createClub({
        name,
        email,
        description,
        logoUrl: logoUrl || undefined,
      });

      if (result.success && result.club) {
        success = true;
        setTimeout(() => {
          goto(`/clubs/${result.club!.id}`);
        }, 2000);
      } else {
        error = result.message || "Failed to create club";
      }
    } catch (err: any) {
      console.error(err);
      error = err.message || "An error occurred while creating the club";
    } finally {
      submitting = false;
    }
  }
</script>

<div class="min-h-[calc(100vh-4rem)] bg-gray-50/30 px-4 py-12 sm:px-6 lg:px-8">
  <div class="max-w-3xl mx-auto">
    <!-- Breadcrumb -->
    <nav class="flex items-center gap-2 text-sm text-gray-500 mb-8" in:fade>
      <a
        href="/clubs"
        use:route
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
      <span class="text-gray-900 font-medium">Create Club</span>
    </nav>

    <div
      class="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden"
      in:fly={{ y: 20, duration: 600 }}
    >
      <div class="p-8 sm:p-12">
        <div class="text-center mb-10">
          <div
            class="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100"
          >
            <svg
              class="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              ></path>
            </svg>
          </div>
          <h1 class="text-3xl font-black text-gray-900 mb-2 tracking-tight">
            Create a New Club
          </h1>
          <p class="text-gray-500 max-w-lg mx-auto leading-relaxed">
            Start a new community at Pulchowk Campus.
          </p>
        </div>

        <form onsubmit={handleSubmit} class="space-y-8">
          <!-- Basic Info Section -->
          <div class="space-y-6">
            <h3
              class="text-lg font-bold text-gray-900 border-b border-gray-100 pb-2 mb-4"
            >
              Basic Information
            </h3>

            <div class="grid grid-cols-1 gap-6">
              <div>
                <label
                  for="name"
                  class="block text-sm font-semibold text-gray-700 mb-2"
                  >Club Name <span class="text-red-500">*</span></label
                >
                <input
                  type="text"
                  id="name"
                  bind:value={name}
                  class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all bg-gray-50/50 focus:bg-white"
                  placeholder="e.g. Robotics Club"
                  required
                />
              </div>

              <div>
                <label
                  for="email"
                  class="block text-sm font-semibold text-gray-700 mb-2"
                  >Contact Email <span class="text-red-500">*</span></label
                >
                <input
                  type="email"
                  id="email"
                  bind:value={email}
                  class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all bg-gray-50/50 focus:bg-white"
                  placeholder="e.g. club@pcampus.edu.np"
                  required
                />
              </div>

              <div>
                <label
                  for="description"
                  class="block text-sm font-semibold text-gray-700 mb-2"
                  >Description</label
                >
                <textarea
                  id="description"
                  bind:value={description}
                  rows="4"
                  class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all bg-gray-50/50 focus:bg-white resize-none"
                  placeholder="What is your club about?"
                ></textarea>
              </div>

              <div>
                <label
                  for="logoUrl"
                  class="block text-sm font-semibold text-gray-700 mb-2"
                  >Logo URL</label
                >
                <input
                  type="url"
                  id="logoUrl"
                  bind:value={logoUrl}
                  class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all bg-gray-50/50 focus:bg-white"
                  placeholder="https://example.com/logo.png"
                />
                {#if logoUrl}
                  <div
                    class="mt-4 p-4 border rounded bg-gray-50 flex flex-col items-center"
                  >
                    <span class="text-xs text-gray-500 mb-2">Preview</span>
                    <img
                      src={logoUrl}
                      alt="Logo Preview"
                      class="h-24 w-24 object-contain rounded-full shadow-sm bg-white"
                    />
                  </div>
                {/if}
              </div>
            </div>
          </div>
          {#if success}
            <div
              class="bg-green-50 text-green-700 p-6 rounded-2xl mb-8 flex items-center gap-4 border border-green-100"
              transition:slide
            >
              <div
                class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0"
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
                  ></path>
                </svg>
              </div>
              <div>
                <p class="font-bold text-lg">Club Created Successfully!</p>
                <p class="text-green-600">Redirecting to club page...</p>
              </div>
            </div>
          {/if}
          {#if error}
            <div
              class="bg-red-50 text-red-700 p-4 rounded-xl mb-8 flex items-start gap-3 border border-red-100"
              transition:slide
            >
              <svg
                class="w-5 h-5 mt-0.5 shrink-0"
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
              <p>{error}</p>
            </div>
          {/if}

          <div
            class="pt-4 border-t border-gray-100 flex items-center justify-end gap-4"
          >
            <a
              href="/clubs"
              use:route
              class="px-6 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </a>
            <button
              type="submit"
              disabled={submitting}
              class="px-8 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {#if submitting}
                <LoadingSpinner size="sm" />
                <span>Creating...</span>
              {:else}
                <span>Create Club</span>
              {/if}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</div>
