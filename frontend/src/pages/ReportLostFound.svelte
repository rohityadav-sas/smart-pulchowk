<script lang="ts">
  import { goto, route } from "@mateothegreat/svelte5-router";
  import { onMount } from "svelte";
  import { useQueryClient } from "@tanstack/svelte-query";
  import {
    createLostFoundItem,
    uploadLostFoundImage,
    type LostFoundCategory,
    type LostFoundItemType,
  } from "../lib/api";
  import { authClient } from "../lib/auth-client";

  const queryClient = useQueryClient();
  const session = authClient.useSession();
  const role = $derived(
    ($session.data?.user as any)?.role as string | undefined,
  );
  const isGuest = $derived(role === "guest");
  const canCreate = $derived(!!$session.data?.user && !isGuest);

  let itemType = $state<LostFoundItemType>("lost");
  let title = $state("");
  let description = $state("");
  let category = $state<LostFoundCategory>("other");
  let lostFoundDate = $state(new Date().toISOString().slice(0, 10));
  let locationText = $state("");
  let contactNote = $state("");
  let rewardText = $state("");
  let files = $state<File[]>([]);
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);

  const categories: Array<{ value: LostFoundCategory; label: string }> = [
    { value: "documents", label: "Documents" },
    { value: "electronics", label: "Electronics" },
    { value: "accessories", label: "Accessories" },
    { value: "ids_cards", label: "ID Cards" },
    { value: "keys", label: "Keys" },
    { value: "bags", label: "Bags" },
    { value: "other", label: "Other" },
  ];

  function handleFilesChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    files = [...input.files].slice(0, 5);
  }

  function clearSelectedFiles() {
    files = [];
    const input = document.getElementById(
      "lost-found-files",
    ) as HTMLInputElement | null;
    if (input) input.value = "";
  }

  function resetFormState() {
    title = "";
    description = "";
    locationText = "";
    contactNote = "";
    rewardText = "";
    files = [];
    error = null;
    lostFoundDate = new Date().toISOString().slice(0, 10);
    const input = document.getElementById(
      "lost-found-files",
    ) as HTMLInputElement | null;
    if (input) input.value = "";
  }

  async function submitForm() {
    if (!canCreate) return;

    if (!title.trim() || !description.trim() || !locationText.trim()) {
      error = "Title, description, and location are required.";
      return;
    }

    isSubmitting = true;
    error = null;

    const createResult = await createLostFoundItem({
      itemType,
      title: title.trim(),
      description: description.trim(),
      category,
      lostFoundDate,
      locationText: locationText.trim(),
      contactNote: contactNote.trim() || null,
      rewardText: rewardText.trim() || null,
    });

    if (!createResult.success || !createResult.data) {
      error = createResult.message || "Failed to create post.";
      isSubmitting = false;
      return;
    }

    if (files.length > 0) {
      for (const file of files) {
        const upload = await uploadLostFoundImage(createResult.data.id, file);
        if (!upload.success) {
          error = upload.message || "Item created, but image upload failed.";
          break;
        }
      }
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["lost-found"] }),
      queryClient.invalidateQueries({ queryKey: ["my-lost-found-items"] }),
      queryClient.invalidateQueries({ queryKey: ["global-search"] }),
    ]);

    isSubmitting = false;
    goto(`/lost-found/${createResult.data.id}`);
  }

  onMount(() => {
    resetFormState();
  });
</script>

<div class="min-h-[calc(100vh-4rem)] px-4 py-5 sm:px-6 lg:px-8">
  <div class="mx-auto max-w-3xl space-y-4">
    <section
      class="rounded-3xl border border-cyan-100 bg-white/80 p-4 shadow-sm backdrop-blur-sm sm:p-5"
    >
      <a
        use:route
        href="/lost-found"
        class="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-cyan-800"
      >
        <svg
          class="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Lost &amp; Found
      </a>

      <h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900">
        Report Lost/Found Item
      </h1>
      <p class="mt-1 text-sm text-slate-600">
        Use concise details. Better details mean faster item matching.
      </p>
    </section>

    {#if !canCreate}
      <div
        class="rounded-3xl border border-cyan-200 bg-cyan-50 p-4 text-cyan-800"
      >
        Sign in with a non-guest account to post lost/found items.
      </div>
    {:else}
      <section
        class="space-y-3.5 rounded-3xl border border-cyan-100 bg-white/85 p-4 shadow-sm backdrop-blur-sm"
      >
        {#if error}
          <div
            class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {error}
          </div>
        {/if}

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="text-xs font-semibold text-slate-500" for="lf-type"
              >Type</label
            >
            <select
              id="lf-type"
              bind:value={itemType}
              class="mt-1 h-10 w-full rounded-xl border border-cyan-100 bg-white px-3 text-sm text-slate-700 focus:border-cyan-300 focus:outline-hidden focus:ring-2 focus:ring-cyan-100"
            >
              <option value="lost">Lost</option>
              <option value="found">Found</option>
            </select>
          </div>

          <div>
            <label
              class="text-xs font-semibold text-slate-500"
              for="lf-category">Category</label
            >
            <select
              id="lf-category"
              bind:value={category}
              class="mt-1 h-10 w-full rounded-xl border border-cyan-100 bg-white px-3 text-sm text-slate-700 focus:border-cyan-300 focus:outline-hidden focus:ring-2 focus:ring-cyan-100"
            >
              {#each categories as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </div>
        </div>

        <div>
          <label class="text-xs font-semibold text-slate-500" for="lf-title"
            >Title</label
          >
          <input
            id="lf-title"
            bind:value={title}
            autocomplete="off"
            class="mt-1 h-10 w-full rounded-xl border border-cyan-100 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-cyan-300 focus:outline-hidden focus:ring-2 focus:ring-cyan-100"
            placeholder="Black wallet with TU ID card"
          />
        </div>

        <div>
          <label
            class="text-xs font-semibold text-slate-500"
            for="lf-description">Description</label
          >
          <textarea
            id="lf-description"
            bind:value={description}
            rows="4"
            autocomplete="off"
            class="mt-1 w-full rounded-xl border border-cyan-100 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-cyan-300 focus:outline-hidden focus:ring-2 focus:ring-cyan-100"
            placeholder="Key details that can verify ownership..."
          ></textarea>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="text-xs font-semibold text-slate-500" for="lf-date"
              >Date</label
            >
            <input
              id="lf-date"
              type="date"
              bind:value={lostFoundDate}
              autocomplete="off"
              class="mt-1 h-10 w-full rounded-xl border border-cyan-100 bg-white px-3 text-sm text-slate-700 focus:border-cyan-300 focus:outline-hidden focus:ring-2 focus:ring-cyan-100"
            />
          </div>

          <div>
            <label
              class="text-xs font-semibold text-slate-500"
              for="lf-location">Location</label
            >
            <input
              id="lf-location"
              bind:value={locationText}
              autocomplete="off"
              class="mt-1 h-10 w-full rounded-xl border border-cyan-100 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-cyan-300 focus:outline-hidden focus:ring-2 focus:ring-cyan-100"
              placeholder="Near library entrance"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="text-xs font-semibold text-slate-500" for="lf-contact"
              >Contact Note (optional)</label
            >
            <input
              id="lf-contact"
              bind:value={contactNote}
              autocomplete="off"
              class="mt-1 h-10 w-full rounded-xl border border-cyan-100 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-cyan-300 focus:outline-hidden focus:ring-2 focus:ring-cyan-100"
              placeholder="Meet at dept office 11am-2pm"
            />
          </div>

          <div>
            <label class="text-xs font-semibold text-slate-500" for="lf-reward"
              >Reward (optional)</label
            >
            <input
              id="lf-reward"
              bind:value={rewardText}
              autocomplete="off"
              class="mt-1 h-10 w-full rounded-xl border border-cyan-100 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-cyan-300 focus:outline-hidden focus:ring-2 focus:ring-cyan-100"
              placeholder="Reward available"
            />
          </div>
        </div>

        <div>
          <label
            class="text-xs font-semibold text-slate-500"
            for="lost-found-files">Images (up to 5)</label
          >
          <input
            id="lost-found-files"
            type="file"
            accept="image/*"
            multiple
            onchange={handleFilesChange}
            class="hidden"
          />

          <div class="mt-1 flex flex-wrap items-center gap-2">
            <label
              for="lost-found-files"
              class="inline-flex h-10 items-center rounded-lg border border-cyan-200 bg-cyan-50 px-3.5 text-sm font-semibold text-cyan-800 transition hover:border-cyan-300 hover:bg-cyan-100"
            >
              Choose Files
            </label>

            <span class="text-sm text-slate-500">
              {#if files.length === 0}
                No file chosen
              {:else if files.length === 1}
                {files[0].name}
              {:else}
                {files.length} files selected
              {/if}
            </span>

            {#if files.length > 0}
              <button
                type="button"
                class="rounded-md border border-cyan-200 px-2.5 py-1 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-50"
                onclick={clearSelectedFiles}
              >
                Clear
              </button>
            {/if}
          </div>
        </div>

        <button
          class="inline-flex w-fit items-center gap-1.5 rounded-xl bg-linear-to-r from-cyan-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-cyan-500 hover:to-blue-500 disabled:opacity-60"
          onclick={submitForm}
          disabled={isSubmitting}
        >
          <svg
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 5v14m-7-7h14"
            />
          </svg>
          {isSubmitting ? "Submitting..." : "Submit Report"}
        </button>
      </section>
    {/if}
  </div>
</div>
