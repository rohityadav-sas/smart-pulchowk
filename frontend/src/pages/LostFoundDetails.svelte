<script lang="ts">
  import { createQuery, useQueryClient } from "@tanstack/svelte-query";
  import {
    query as routeQuery,
    route as routeAction,
  } from "@mateothegreat/svelte5-router";
  import {
    createLostFoundClaim,
    getLostFoundItem,
    getLostFoundItemClaims,
    updateLostFoundClaimStatus,
    updateLostFoundItemStatus,
  } from "../lib/api";
  import { authClient } from "../lib/auth-client";
  import LoadingSpinner from "../components/LoadingSpinner.svelte";

  const { route } = $props();
  const queryClient = useQueryClient();

  const itemId = $derived(Number(route.result.path.params.id || 0));
  const highlight = $derived(routeQuery("highlight") === "item");

  const session = authClient.useSession();
  const role = $derived(
    ($session.data?.user as any)?.role as string | undefined,
  );
  const userId = $derived(
    ($session.data?.user as any)?.id as string | undefined,
  );
  const isGuest = $derived(role === "guest");

  let submittingClaim = $state(false);
  let claimActionPending = $state<{
    claimId: number;
    status: "accepted" | "rejected";
  } | null>(null);
  let statusPending = $state(false);
  let claimMessage = $state("");
  let activeImageIndex = $state(0);
  let feedback = $state<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const isClaiming = $derived(submittingClaim);

  const itemQuery = createQuery(() => ({
    queryKey: ["lost-found-item", itemId, userId],
    enabled: itemId > 0,
    queryFn: async () => {
      const result = await getLostFoundItem(itemId);
      if (!result.success || !result.data) {
        throw new Error(result.message || "Failed to load item.");
      }
      return result.data;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  }));

  const item = $derived(itemQuery.data ?? null);
  const isOwner = $derived(!!item && !!userId && item.ownerId === userId);

  const claimsQuery = createQuery(() => ({
    queryKey: ["lost-found-item-claims", itemId, userId],
    enabled: itemId > 0 && isOwner,
    queryFn: async () => {
      const result = await getLostFoundItemClaims(itemId);
      if (!result.success || !result.data) {
        throw new Error(result.message || "Failed to load claims.");
      }
      return result.data;
    },
    staleTime: 15_000,
    gcTime: 5 * 60_000,
  }));

  const ownerClaims = $derived(claimsQuery.data ?? []);

  const canClaim = $derived(
    !!item &&
      !!userId &&
      !isOwner &&
      !isGuest &&
      (item.status === "open" || item.status === "claimed") &&
      !item.viewerClaim,
  );
  const requestTerm = $derived(item?.itemType === "lost" ? "report" : "claim");
  const requestTitle = $derived(
    item?.itemType === "lost" ? "Report found item" : "Claim this item",
  );
  const requestHint = $derived(
    item?.itemType === "lost"
      ? "Share when and where you found it so the owner can verify."
      : "Explain details that help verify ownership.",
  );
  const requestPlaceholder = $derived(
    item?.itemType === "lost"
      ? "I found this item at... and can verify by..."
      : "I can identify the item by...",
  );
  const requestSubmitLabel = $derived(
    item?.itemType === "lost" ? "Submit Report" : "Submit Claim",
  );

  $effect(() => {
    const imageCount = item?.images?.length ?? 0;
    if (imageCount === 0) {
      activeImageIndex = 0;
      return;
    }
    if (activeImageIndex >= imageCount) {
      activeImageIndex = 0;
    }
  });

  async function refetchDetail() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["lost-found-item", itemId] }),
      queryClient.invalidateQueries({
        queryKey: ["lost-found-item-claims", itemId],
      }),
      queryClient.invalidateQueries({ queryKey: ["lost-found"] }),
      queryClient.invalidateQueries({ queryKey: ["my-lost-found-items"] }),
      queryClient.invalidateQueries({ queryKey: ["my-lost-found-claims"] }),
    ]);
  }

  async function submitClaim() {
    if (!canClaim || !claimMessage.trim()) return;
    submittingClaim = true;
    feedback = null;
    const result = await createLostFoundClaim(itemId, claimMessage.trim());
    submittingClaim = false;

    if (!result.success) {
      feedback = {
        type: "error",
        message: result.message || "Failed to submit request.",
      };
      return;
    }

    feedback = {
      type: "success",
      message:
        item?.itemType === "lost"
          ? "Report submitted successfully."
          : "Claim submitted successfully.",
    };
    claimMessage = "";
    await refetchDetail();
  }

  async function updateClaim(claimId: number, status: "accepted" | "rejected") {
    if (!isOwner) return;
    claimActionPending = { claimId, status };
    feedback = null;
    const result = await updateLostFoundClaimStatus(itemId, claimId, status);
    claimActionPending = null;
    if (!result.success) {
      feedback = {
        type: "error",
        message: result.message || "Failed to update claim status.",
      };
      return;
    }
    feedback = {
      type: "success",
      message:
        status === "accepted"
          ? item?.itemType === "lost"
            ? "Report accepted."
            : "Claim accepted."
          : item?.itemType === "lost"
            ? "Report rejected."
            : "Claim rejected.",
    };
    await refetchDetail();
  }

  async function setStatus(status: "open" | "claimed" | "resolved" | "closed") {
    if (!isOwner) return;
    statusPending = true;
    feedback = null;
    const result = await updateLostFoundItemStatus(itemId, status);
    statusPending = false;
    if (!result.success) {
      feedback = {
        type: "error",
        message: result.message || "Failed to update item status.",
      };
      return;
    }
    feedback = { type: "success", message: "Item status updated." };
    await refetchDetail();
  }
</script>

<div class="min-h-[calc(100vh-4rem)] px-4 py-5 sm:px-6 lg:px-8">
  <div class="mx-auto max-w-5xl space-y-4">
    <a
      use:routeAction
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
    {#if feedback}
      <div
        class="rounded-xl border px-3 py-2 text-sm {feedback.type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-rose-200 bg-rose-50 text-rose-700'}"
        role="status"
        aria-live="polite"
      >
        {feedback.message}
      </div>
    {/if}

    {#if itemQuery.isLoading}
      <div
        class="rounded-3xl border border-cyan-100 bg-white/80 p-8 shadow-sm backdrop-blur-sm"
      >
        <LoadingSpinner text="Loading item details..." />
      </div>
    {:else if itemQuery.error || !item}
      <div
        class="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-rose-700"
      >
        <p class="font-semibold">Failed to load item</p>
        <p class="mt-1 text-sm">
          {itemQuery.error?.message || "Item not found."}
        </p>
      </div>
    {:else}
      <article
        class="rounded-3xl border bg-white/85 p-4 shadow-sm backdrop-blur-sm {highlight
          ? 'border-cyan-400 ring-4 ring-cyan-100'
          : 'border-cyan-100'}"
      >
        <div class="flex flex-wrap items-start justify-between gap-2.5">
          <div>
            <h1 class="text-2xl font-black tracking-tight text-slate-900">
              {item.title}
            </h1>
            <div class="mt-2 flex flex-wrap gap-1.5 text-[11px]">
              <span
                class="rounded-full bg-cyan-50 px-2.5 py-1 font-semibold text-cyan-800"
                >{item.itemType}</span
              >
              <span
                class="rounded-full bg-cyan-50 px-2.5 py-1 font-semibold text-cyan-800"
                >{item.category.replace("_", " ")}</span
              >
              <span
                class="rounded-full bg-blue-100 px-2.5 py-1 font-semibold text-blue-700"
                >{item.status}</span
              >
            </div>
          </div>

          {#if isOwner}
            <div class="flex flex-wrap gap-2">
              {#if item.status !== "resolved"}
                <button
                  class="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                  onclick={() => setStatus("resolved")}
                  disabled={statusPending}
                >
                  <svg
                    class="h-3.5 w-3.5"
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
                  Mark Resolved
                </button>
              {/if}
              <button
                class="inline-flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800"
                onclick={() => setStatus("closed")}
                disabled={statusPending}
              >
                <svg
                  class="h-3.5 w-3.5"
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
                Close
              </button>
            </div>
          {/if}
        </div>

        <p class="mt-3 text-sm text-slate-700">{item.description}</p>

        <div class="mt-3 grid gap-1.5 text-sm text-slate-600 sm:grid-cols-2">
          <p class="inline-flex items-center gap-1.5">
            <svg
              class="h-4 w-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 7V3m8 4V3m-9 8h10m-13 9h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v11a2 2 0 002 2z"
              /></svg
            ><span
              ><span class="font-semibold text-slate-800">Date:</span>
              {new Date(item.lostFoundDate).toLocaleDateString()}</span
            >
          </p>
          <p class="inline-flex items-center gap-1.5">
            <svg
              class="h-4 w-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17.7 8.3A5.7 5.7 0 116.3 8.3c0 4.9 5.7 10.7 5.7 10.7s5.7-5.8 5.7-10.7z"
              /><circle cx="12" cy="8.3" r="2.2" /></svg
            ><span
              ><span class="font-semibold text-slate-800">Location:</span>
              {item.locationText}</span
            >
          </p>
          {#if item.contactNote}
            <p class="inline-flex items-center gap-1.5">
              <svg
                class="h-4 w-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.95.68l1.5 4.5a1 1 0 01-.24 1.02l-1.8 1.8a16 16 0 006.36 6.36l1.8-1.8a1 1 0 011.02-.24l4.5 1.5a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C10.85 21 3 13.15 3 3V5z"
                /></svg
              ><span
                ><span class="font-semibold text-slate-800">Contact note:</span>
                {item.contactNote}</span
              >
            </p>
          {/if}
          {#if item.rewardText}
            <p class="inline-flex items-center gap-1.5">
              <svg
                class="h-4 w-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 3v18m4-13c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.8 3 4 3 4 1.3 4 3-1.8 3-4 3-4-1.3-4-3"
                /></svg
              ><span
                ><span class="font-semibold text-slate-800">Reward:</span>
                {item.rewardText}</span
              >
            </p>
          {/if}
          {#if item.owner?.name}
            <p class="inline-flex items-center gap-1.5">
              <svg
                class="h-4 w-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5.1 19a8 8 0 0113.8 0M12 11a4 4 0 100-8 4 4 0 000 8z"
                /></svg
              ><span
                ><span class="font-semibold text-slate-800">Posted by:</span>
                {item.owner.name}</span
              >
            </p>
          {/if}
        </div>

        {#if item.images && item.images.length > 0}
          <div class="mt-4">
            <div
              class="overflow-hidden rounded-xl border border-cyan-100 bg-cyan-50"
            >
              <img
                src={item.images[activeImageIndex]?.imageUrl}
                alt={item.title}
                class="max-h-85 w-full object-contain bg-white"
              />
            </div>

            {#if item.images.length > 1}
              <div class="mt-2 flex flex-wrap gap-2">
                {#each item.images as image, index}
                  <button
                    class="h-12 w-12 overflow-hidden rounded-lg border transition {index ===
                    activeImageIndex
                      ? 'border-cyan-400 ring-2 ring-cyan-100'
                      : 'border-cyan-100 hover:border-cyan-300'}"
                    onclick={() => (activeImageIndex = index)}
                  >
                    <img
                      src={image.imageUrl}
                      alt={item.title}
                      class="h-full w-full object-cover"
                    />
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </article>

      {#if canClaim}
        <section
          class="rounded-3xl border border-cyan-100 bg-white/85 p-4 shadow-sm backdrop-blur-sm"
        >
          <h2 class="text-base font-bold text-slate-900">{requestTitle}</h2>
          <p class="mt-1 text-sm text-slate-500">
            {requestHint}
          </p>
          <textarea
            bind:value={claimMessage}
            rows="4"
            class="mt-3 w-full rounded-xl border border-cyan-100 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-cyan-300 focus:outline-hidden focus:ring-2 focus:ring-cyan-100"
            placeholder={requestPlaceholder}
          ></textarea>
          <button
            class="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-cyan-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-cyan-500 hover:to-blue-500 disabled:opacity-60"
            onclick={submitClaim}
            disabled={isClaiming || !claimMessage.trim()}
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
                d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.94 9.94 0 01-4.255-.949L3 20l1.245-3.113A7.927 7.927 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            {isClaiming
              ? item?.itemType === "lost"
                ? "Submitting report..."
                : "Claiming..."
              : requestSubmitLabel}
          </button>
        </section>
      {:else if !isOwner && item.viewerClaim}
        <div
          class="rounded-3xl border border-cyan-100 bg-white/85 p-4 text-sm text-slate-700 shadow-sm backdrop-blur-sm"
        >
          Your {requestTerm} status: <span class="font-semibold"
            >{item.viewerClaim.status}</span
          >
        </div>
      {:else if isGuest}
        <div
          class="rounded-3xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-800"
        >
          Sign in with a non-guest account to submit requests.
        </div>
      {/if}

      {#if isOwner}
        <section
          class="rounded-3xl border border-cyan-100 bg-white/85 p-4 shadow-sm backdrop-blur-sm"
        >
          <h2 class="text-base font-bold text-slate-900">
            {item.itemType === "lost" ? "Found Reports" : "Claims"}
          </h2>
          {#if claimsQuery.isLoading}
            <div class="mt-3">
              <LoadingSpinner
                text={item.itemType === "lost"
                  ? "Loading reports..."
                  : "Loading claims..."}
              />
            </div>
          {:else if claimsQuery.error}
            <p class="mt-2 text-sm text-rose-600">
              {claimsQuery.error.message}
            </p>
          {:else if ownerClaims.length === 0}
            <p class="mt-2 text-sm text-slate-500">
              {item.itemType === "lost" ? "No reports yet." : "No claims yet."}
            </p>
          {:else}
            <div class="mt-3 space-y-2">
              {#each ownerClaims as claim}
                {@const isAcceptingThisClaim =
                  claimActionPending?.claimId === claim.id &&
                  claimActionPending.status === "accepted"}
                {@const isRejectingThisClaim =
                  claimActionPending?.claimId === claim.id &&
                  claimActionPending.status === "rejected"}
                <div class="rounded-xl border border-cyan-100 bg-white p-3">
                  <div
                    class="flex flex-wrap items-center justify-between gap-2"
                  >
                    <p class="text-sm font-semibold text-slate-800">
                      {claim.requester?.name || claim.requesterId}
                    </p>
                    <span
                      class="rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-800"
                    >
                      {claim.status}
                    </span>
                  </div>
                  <p class="mt-1 text-sm text-slate-600">{claim.message}</p>

                  {#if claim.status === "pending"}
                    <div class="mt-2 flex gap-2">
                      <button
                        class="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                        onclick={() => updateClaim(claim.id, "accepted")}
                        disabled={isAcceptingThisClaim}
                      >
                        {isAcceptingThisClaim ? "Accepting..." : "Accept"}
                      </button>
                      <button
                        class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                        onclick={() => updateClaim(claim.id, "rejected")}
                        disabled={isRejectingThisClaim}
                      >
                        {isRejectingThisClaim ? "Rejecting..." : "Reject"}
                      </button>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </section>
      {/if}
    {/if}
  </div>
</div>
