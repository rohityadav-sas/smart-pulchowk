<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { route as routeAction, goto } from "@mateothegreat/svelte5-router";
  import {
    getBookListingById,
    saveBook,
    unsaveBook,
    deleteBookListing,
    markBookAsSold,
    getSellerReputation,
    rateSeller,
    createMarketplaceReport,
    blockMarketplaceUser,
    unblockMarketplaceUser,
    getBlockedMarketplaceUsers,
    createPurchaseRequest,
    getPurchaseRequestStatus,
    cancelPurchaseRequest,
    getSellerContactInfo,
    type BookListing,
    type MarketplaceReport,
  } from "../lib/api";
  import LoadingSpinner from "../components/LoadingSpinner.svelte";
  import { fade, fly } from "svelte/transition";
  import { authClient } from "../lib/auth-client";
  import { createQuery, useQueryClient } from "@tanstack/svelte-query";

  const { route } = $props();
  const bookId = $derived(parseInt(route.result.path.params.bookId) || 0);

  const session = authClient.useSession();
  const queryClient = useQueryClient();

  let hasRedirectedToLogin = $state(false);
  let activeImageIndex = $state(0);
  let saving = $state(false);
  let deleting = $state(false);
  let markingSold = $state(false);
  let savedState = $state(false);
  let ratingValue = $state(5);
  let ratingReview = $state("");
  let ratingSubmitting = $state(false);
  let reportCategory = $state<MarketplaceReport["category"]>("other");
  let reportDescription = $state("");
  let reportSubmitting = $state(false);
  let blockReason = $state("");
  let blockSubmitting = $state(false);
  let unblockSubmitting = $state(false);
  let trustFeedback = $state<string | null>(null);
  let trustError = $state<string | null>(null);

  // Purchase Request State
  let requestToBuyModalOpen = $state(false);
  let reviewsModalOpen = $state(false);
  let requestMessage = $state("");
  let requestSubmitting = $state(false);
  let cancellingRequest = $state(false);

  onMount(() => {
    window.scrollTo(0, 0);
  });

  $effect(() => {
    if (hasRedirectedToLogin) return;

    if (!$session.isPending && !$session.error && !$session.data?.user) {
      hasRedirectedToLogin = true;
      untrack(() => {
        goto("/register?message=login_required");
      });
    }
  });

  const bookQuery = createQuery(() => ({
    queryKey: ["book-listing", bookId],
    queryFn: async () => {
      if (!bookId) throw new Error("Invalid book ID");
      const result = await getBookListingById(bookId);
      if (result.success && result.data) {
        savedState = result.data.isSaved || false;
        return result.data;
      }
      throw new Error(result.message || "Failed to load listing");
    },
    enabled: bookId > 0,
  }));

  const sellerReputationQuery = createQuery(() => ({
    queryKey: ["seller-reputation", bookQuery.data?.sellerId],
    queryFn: async () => {
      const sellerId = bookQuery.data?.sellerId;
      if (!sellerId) throw new Error("Missing seller");
      const result = await getSellerReputation(sellerId);
      if (result.success && result.data) return result.data;
      throw new Error(result.message || "Could not load seller rating");
    },
    enabled: !!bookQuery.data?.sellerId && !!$session.data?.user,
  }));

  const blockedUsersQuery = createQuery(() => ({
    queryKey: ["blocked-marketplace-users"],
    queryFn: async () => {
      const result = await getBlockedMarketplaceUsers();
      if (result.success && result.data) return result.data;
      throw new Error(result.message || "Could not load blocked users");
    },
    enabled: !!$session.data?.user,
  }));

  const purchaseRequestQuery = createQuery(() => ({
    queryKey: ["purchase-request", bookId],
    queryFn: async () => {
      if (!bookId || !$session.data?.user) return null;
      const result = await getPurchaseRequestStatus(bookId);
      if (result.success) return result.data;
      return null;
    },
    enabled: bookId > 0 && !!$session.data?.user,
  }));

  const sellerContactQuery = createQuery(() => ({
    queryKey: ["seller-contact", bookId],
    queryFn: async () => {
      if (!bookId || !$session.data?.user) return null;
      const result = await getSellerContactInfo(bookId);
      if (result.success) return result.data;
      return null;
    },
    enabled:
      bookId > 0 &&
      !!$session.data?.user &&
      (purchaseRequestQuery.data?.status === "accepted" ||
        bookQuery.data?.isOwner),
  }));

  $effect(() => {
    const total = bookQuery.data?.images?.length || 0;
    if (total === 0) {
      activeImageIndex = 0;
      return;
    }
    if (activeImageIndex > total - 1) activeImageIndex = 0;
  });

  const conditionLabel: Record<BookListing["condition"], string> = {
    new: "New",
    like_new: "Like New",
    good: "Good",
    fair: "Fair",
    poor: "Poor",
  };

  const conditionTone: Record<BookListing["condition"], string> = {
    new: "bg-emerald-100 text-emerald-700 border-emerald-200",
    like_new: "bg-blue-100 text-blue-700 border-blue-200",
    good: "bg-amber-100 text-amber-700 border-amber-200",
    fair: "bg-orange-100 text-orange-700 border-orange-200",
    poor: "bg-rose-100 text-rose-700 border-rose-200",
  };

  function formatPrice(price: string) {
    return `Rs. ${parseFloat(price).toLocaleString()}`;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function clearTrustMessages() {
    trustFeedback = null;
    trustError = null;
  }

  async function handleSaveToggle() {
    if (!bookQuery.data || !$session.data?.user || saving) return;

    const previous = savedState;
    savedState = !savedState;
    saving = true;

    try {
      if (previous) await unsaveBook(bookId);
      else await saveBook(bookId);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["book-listing", bookId] }),
        queryClient.invalidateQueries({ queryKey: ["saved-books"] }),
      ]);
    } catch (error) {
      console.error("Failed to toggle saved state:", error);
      savedState = previous;
    } finally {
      saving = false;
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this listing permanently?")) return;

    deleting = true;
    try {
      const result = await deleteBookListing(bookId);
      if (result.success) {
        goto("/books");
      } else {
        alert(result.message || "Could not delete listing.");
      }
    } catch (error) {
      console.error("Failed to delete listing:", error);
    } finally {
      deleting = false;
    }
  }

  async function handleMarkSold() {
    if (!confirm("Mark this listing as sold?")) return;

    markingSold = true;
    try {
      const result = await markBookAsSold(bookId);
      if (result.success) {
        await queryClient.invalidateQueries({
          queryKey: ["book-listing", bookId],
        });
        await bookQuery.refetch();
      } else {
        alert(result.message || "Could not mark as sold.");
      }
    } catch (error) {
      console.error("Failed to mark sold:", error);
    } finally {
      markingSold = false;
    }
  }

  async function handleRateSeller(book: BookListing) {
    if (!book.sellerId || ratingSubmitting) return;
    if (ratingValue < 1 || ratingValue > 5) {
      trustError = "Please choose a rating between 1 and 5.";
      return;
    }

    clearTrustMessages();
    ratingSubmitting = true;
    try {
      const result = await rateSeller(book.sellerId, {
        listingId: book.id,
        rating: ratingValue,
        review: ratingReview.trim() || undefined,
      });
      if (!result.success) {
        trustError = result.message || "Could not submit rating.";
        return;
      }

      ratingReview = "";
      trustFeedback = "Rating submitted.";
      await queryClient.invalidateQueries({
        queryKey: ["seller-reputation", book.sellerId],
      });
      await sellerReputationQuery.refetch();
    } catch (error) {
      console.error("Failed to rate seller:", error);
      trustError = "Could not submit rating.";
    } finally {
      ratingSubmitting = false;
    }
  }

  async function handleReportSeller(book: BookListing) {
    if (!book.sellerId || reportSubmitting) return;
    if (!reportDescription.trim()) {
      trustError = "Please add a short description for the report.";
      return;
    }

    clearTrustMessages();
    reportSubmitting = true;
    try {
      const result = await createMarketplaceReport({
        reportedUserId: book.sellerId,
        listingId: book.id,
        category: reportCategory,
        description: reportDescription.trim(),
      });
      if (!result.success) {
        trustError = result.message || "Could not submit report.";
        return;
      }

      reportDescription = "";
      reportCategory = "other";
      trustFeedback = "Report submitted. Admins will review it.";
    } catch (error) {
      console.error("Failed to report seller:", error);
      trustError = "Could not submit report.";
    } finally {
      reportSubmitting = false;
    }
  }

  async function handleBlockSeller(book: BookListing) {
    if (!book.sellerId || blockSubmitting) return;
    if (
      !confirm(
        "Block this seller? You will not see their marketplace activity.",
      )
    )
      return;

    clearTrustMessages();
    blockSubmitting = true;
    try {
      const result = await blockMarketplaceUser(
        book.sellerId,
        blockReason.trim() || undefined,
      );
      if (!result.success) {
        trustError = result.message || "Could not block seller.";
        return;
      }

      blockReason = "";
      trustFeedback = "Seller blocked.";
      await blockedUsersQuery.refetch();
    } catch (error) {
      console.error("Failed to block seller:", error);
      trustError = "Could not block seller.";
    } finally {
      blockSubmitting = false;
    }
  }

  async function handleRequestToBuy() {
    if (!bookId || requestSubmitting) return;
    requestSubmitting = true;
    try {
      const result = await createPurchaseRequest(
        bookId,
        requestMessage.trim() || undefined,
      );
      if (result.success) {
        requestToBuyModalOpen = false;
        requestMessage = "";
        await purchaseRequestQuery.refetch();
      } else {
        trustError = result.message || "Failed to send request.";
      }
    } catch (error) {
      console.error("Failed to send purchase request:", error);
      trustError = "An error occurred while sending the request.";
    } finally {
      requestSubmitting = false;
    }
  }

  async function handleCancelRequest() {
    const request = purchaseRequestQuery.data;
    if (!request || cancellingRequest) return;
    if (!confirm("Cancel your request to buy this book?")) return;

    cancellingRequest = true;
    try {
      const result = await cancelPurchaseRequest(request.id);
      if (result.success) {
        await purchaseRequestQuery.refetch();
      } else {
        trustError = result.message || "Failed to cancel request.";
      }
    } catch (error) {
      console.error("Failed to cancel purchase request:", error);
      trustError = "An error occurred while cancelling the request.";
    } finally {
      cancellingRequest = false;
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case "requested":
        return "Pending";
      case "accepted":
        return "Accepted";
      case "rejected":
        return "Rejected";
      case "completed":
        return "Completed";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  }

  function getStatusColorClass(status: string) {
    switch (status) {
      case "requested":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "accepted":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "rejected":
        return "bg-rose-100 text-rose-700 border-rose-200";
      case "completed":
        return "bg-blue-100 text-blue-700 border-blue-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  }

  async function handleUnblockSeller(book: BookListing) {
    if (!book.sellerId || unblockSubmitting) return;

    clearTrustMessages();
    unblockSubmitting = true;
    try {
      const result = await unblockMarketplaceUser(book.sellerId);
      if (!result.success) {
        trustError = result.message || "Could not unblock seller.";
        return;
      }

      trustFeedback = "Seller unblocked.";
      await blockedUsersQuery.refetch();
    } catch (error) {
      console.error("Failed to unblock seller:", error);
      trustError = "Could not unblock seller.";
    } finally {
      unblockSubmitting = false;
    }
  }
</script>

<div class="min-h-[calc(100vh-4rem)] bg-gray-50/50 px-4 py-5 sm:px-6 lg:px-8">
  <div class="max-w-6xl mx-auto">
    <a
      href="/books"
      use:routeAction
      class="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
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
          d="M10 19l-7-7m0 0l7-7m-7 7h18"
        />
      </svg>
      Back to Marketplace
    </a>

    {#if bookQuery.isLoading}
      <div class="py-20 flex items-center justify-center" in:fade>
        <LoadingSpinner size="lg" text="Loading listing..." />
      </div>
    {:else if bookQuery.error}
      <div
        class="mt-5 max-w-md mx-auto rounded-2xl bg-white border border-red-100 shadow-sm p-6 text-center"
        in:fly={{ y: 16, duration: 260 }}
      >
        <div
          class="w-12 h-12 mx-auto rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-3"
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
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 class="text-lg font-bold text-gray-900">Book not found</h2>
        <p class="text-sm text-gray-500 mt-1">{bookQuery.error.message}</p>
      </div>
    {:else if bookQuery.data}
      {@const book = bookQuery.data}
      {@const hasImages = !!book.images && book.images.length > 0}
      {@const activeImage = hasImages ? book.images![activeImageIndex] : null}

      <section
        class="mt-4 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
        in:fly={{ y: 12, duration: 260 }}
      >
        <div class="grid grid-cols-1 lg:grid-cols-2">
          <div
            class="bg-linear-to-br from-slate-50 to-blue-50 p-4 sm:p-5 border-b lg:border-b-0 lg:border-r border-gray-100"
          >
            <div
              class="h-80 sm:h-96 lg:h-112 w-full bg-white rounded-xl border border-gray-100 overflow-hidden flex items-center justify-center"
            >
              {#if activeImage}
                <img
                  src={activeImage.imageUrl}
                  alt={book.title}
                  class="w-full h-full object-contain p-2"
                />
              {:else}
                <div class="text-center text-gray-300">
                  <svg
                    class="w-14 h-14 mx-auto"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.6"
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                  <p class="text-xs mt-2">No image uploaded</p>
                </div>
              {/if}
            </div>

            {#if hasImages && book.images!.length > 1}
              <div class="mt-3 grid grid-cols-5 sm:grid-cols-6 gap-2">
                {#each book.images as image, index (image.id)}
                  <button
                    onclick={() => (activeImageIndex = index)}
                    class="aspect-square rounded-lg overflow-hidden border transition {index ===
                    activeImageIndex
                      ? 'border-blue-500 ring-2 ring-blue-100'
                      : 'border-gray-200 hover:border-gray-300'}"
                    aria-label={`Open image ${index + 1}`}
                  >
                    <img
                      src={image.imageUrl}
                      alt=""
                      class="w-full h-full object-cover"
                    />
                  </button>
                {/each}
              </div>
            {/if}
          </div>

          <div class="p-5 sm:p-6">
            <div class="flex items-start justify-between gap-3">
              <div>
                <span
                  class="inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold {conditionTone[
                    book.condition
                  ]}"
                >
                  {conditionLabel[book.condition]}
                </span>
                <h1
                  class="mt-2 text-2xl font-extrabold text-gray-900 leading-tight"
                >
                  {book.title}
                </h1>
                <p class="mt-1 text-sm text-gray-600">by {book.author}</p>
              </div>

              {#if book.status === "sold"}
                <span
                  class="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200"
                >
                  Sold
                </span>
              {/if}
            </div>

            <div class="mt-4 text-2xl font-black text-blue-700">
              {formatPrice(book.price)}
            </div>

            <div class="mt-5 grid grid-cols-2 gap-3 text-sm">
              {#if book.edition}
                <div class="rounded-lg bg-gray-50 border border-gray-100 p-2.5">
                  <p class="text-[11px] uppercase tracking-wide text-gray-500">
                    Edition
                  </p>
                  <p class="font-semibold text-gray-900 mt-0.5">
                    {book.edition}
                  </p>
                </div>
              {/if}
              {#if book.publisher}
                <div class="rounded-lg bg-gray-50 border border-gray-100 p-2.5">
                  <p class="text-[11px] uppercase tracking-wide text-gray-500">
                    Publisher
                  </p>
                  <p class="font-semibold text-gray-900 mt-0.5">
                    {book.publisher}
                  </p>
                </div>
              {/if}
              {#if book.publicationYear}
                <div class="rounded-lg bg-gray-50 border border-gray-100 p-2.5">
                  <p class="text-[11px] uppercase tracking-wide text-gray-500">
                    Year
                  </p>
                  <p class="font-semibold text-gray-900 mt-0.5">
                    {book.publicationYear}
                  </p>
                </div>
              {/if}
              {#if book.category}
                <div class="rounded-lg bg-gray-50 border border-gray-100 p-2.5">
                  <p class="text-[11px] uppercase tracking-wide text-gray-500">
                    Category
                  </p>
                  <p class="font-semibold text-gray-900 mt-0.5">
                    {book.category.name}
                  </p>
                </div>
              {/if}
              {#if book.isbn}
                <div
                  class="rounded-lg bg-gray-50 border border-gray-100 p-2.5 col-span-2"
                >
                  <p class="text-[11px] uppercase tracking-wide text-gray-500">
                    ISBN
                  </p>
                  <p class="font-semibold text-gray-900 mt-0.5 break-all">
                    {book.isbn}
                  </p>
                </div>
              {/if}
              {#if book.courseCode}
                <div
                  class="rounded-lg bg-gray-50 border border-gray-100 p-2.5 col-span-2"
                >
                  <p class="text-[11px] uppercase tracking-wide text-gray-500">
                    Course
                  </p>
                  <p class="font-semibold text-gray-900 mt-0.5">
                    {book.courseCode}
                  </p>
                </div>
              {/if}
            </div>

            {#if book.description}
              <div class="mt-5">
                <h2
                  class="text-xs font-bold uppercase tracking-wide text-gray-500"
                >
                  Description
                </h2>
                <p class="text-sm text-gray-700 mt-1 whitespace-pre-line">
                  {book.description}
                </p>
              </div>
            {/if}

            {#if book.seller}
              <div
                class="mt-5 rounded-xl border border-gray-100 bg-slate-50 p-3.5"
              >
                <p
                  class="text-xs font-bold uppercase tracking-wide text-gray-500"
                >
                  Seller
                </p>
                <div class="mt-2 flex items-center gap-3">
                  {#if book.seller.image}
                    <img
                      src={book.seller.image}
                      alt=""
                      class="w-10 h-10 rounded-full"
                    />
                  {:else}
                    <div
                      class="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center"
                    >
                      {book.seller.name.charAt(0).toUpperCase()}
                    </div>
                  {/if}
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-gray-900 truncate">
                      {book.seller.name}
                    </p>
                    {#if book.seller.email}
                      <a
                        href="mailto:{book.seller.email}"
                        class="text-xs text-blue-700 hover:underline break-all"
                      >
                        {book.seller.email}
                      </a>
                    {/if}
                  </div>
                  {#if book.seller.isVerifiedSeller}
                    <span
                      class="ml-auto shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200"
                    >
                      Verified
                    </span>
                  {/if}
                </div>
              </div>
            {/if}

            {#if book.seller && !book.isOwner && $session.data?.user}
              {@const sellerBlocked = !!blockedUsersQuery.data?.some(
                (entry) => entry.blockedUserId === book.sellerId,
              )}
              <div
                class="mt-4 rounded-xl border border-gray-200 bg-white p-3.5"
              >
                <p
                  class="text-xs font-bold uppercase tracking-wide text-gray-500"
                >
                  Seller Trust
                </p>

                <div
                  class="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-3"
                >
                  <div class="flex items-center justify-between gap-2">
                    <p class="text-xs font-semibold text-gray-700">Rating</p>
                    {#if sellerReputationQuery.isLoading}
                      <span class="text-xs text-gray-500">Loading...</span>
                    {:else if sellerReputationQuery.data}
                      <span class="text-xs font-semibold text-gray-700">
                        {sellerReputationQuery.data.averageRating.toFixed(1)} / 5
                        ({sellerReputationQuery.data.totalRatings})
                        <button
                          onclick={() => (reviewsModalOpen = true)}
                          class="ml-2 text-blue-600 hover:underline text-[10px] font-bold"
                        >
                          See Reviews
                        </button>
                      </span>
                    {:else}
                      <span class="text-xs text-gray-500">No ratings yet</span>
                    {/if}
                  </div>

                  <div class="mt-2 flex items-center gap-2">
                    <label for="ratingValue" class="text-xs text-gray-600"
                      >Your rating</label
                    >
                    <div class="relative inline-flex">
                      <select
                        id="ratingValue"
                        bind:value={ratingValue}
                        class="appearance-none bg-none rounded-lg border border-gray-200 bg-white pl-3 pr-8 py-1.5 text-sm text-gray-700 leading-none focus:border-blue-400 focus:outline-none"
                      >
                        <option value={5}>5</option>
                        <option value={4}>4</option>
                        <option value={3}>3</option>
                        <option value={2}>2</option>
                        <option value={1}>1</option>
                      </select>
                      <svg
                        class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                  <textarea
                    bind:value={ratingReview}
                    rows="2"
                    placeholder="Optional review"
                    class="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
                  ></textarea>
                  <button
                    onclick={() => handleRateSeller(book)}
                    disabled={ratingSubmitting}
                    class="mt-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {ratingSubmitting ? "Submitting..." : "Submit Rating"}
                  </button>
                </div>

                <div
                  class="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3"
                >
                  <p class="text-xs font-semibold text-gray-700">
                    Report Seller
                  </p>
                  <div
                    class="mt-2 grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-2"
                  >
                    <select
                      bind:value={reportCategory}
                      class="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700"
                    >
                      <option value="spam">Spam</option>
                      <option value="fraud">Fraud</option>
                      <option value="abusive">Abusive</option>
                      <option value="fake_listing">Fake listing</option>
                      <option value="suspicious_payment"
                        >Suspicious payment</option
                      >
                      <option value="other">Other</option>
                    </select>
                    <textarea
                      bind:value={reportDescription}
                      rows="2"
                      placeholder="What happened?"
                      class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
                    ></textarea>
                  </div>
                  <button
                    onclick={() => handleReportSeller(book)}
                    disabled={reportSubmitting}
                    class="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                  >
                    {reportSubmitting ? "Submitting..." : "Submit Report"}
                  </button>
                </div>

                <div
                  class="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3"
                >
                  <p class="text-xs font-semibold text-gray-700">
                    Block Seller
                  </p>
                  {#if !sellerBlocked}
                    <textarea
                      bind:value={blockReason}
                      rows="2"
                      placeholder="Optional reason"
                      class="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
                    ></textarea>
                    <button
                      onclick={() => handleBlockSeller(book)}
                      disabled={blockSubmitting}
                      class="mt-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                    >
                      {blockSubmitting ? "Blocking..." : "Block Seller"}
                    </button>
                  {:else}
                    <p class="mt-1 text-xs text-gray-600">
                      You have blocked this seller.
                    </p>
                    <button
                      onclick={() => handleUnblockSeller(book)}
                      disabled={unblockSubmitting}
                      class="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                    >
                      {unblockSubmitting ? "Updating..." : "Unblock Seller"}
                    </button>
                  {/if}
                </div>

                {#if trustFeedback}
                  <p class="mt-2 text-xs font-medium text-emerald-700">
                    {trustFeedback}
                  </p>
                {/if}
                {#if trustError}
                  <p class="mt-2 text-xs font-medium text-rose-700">
                    {trustError}
                  </p>
                {/if}
              </div>
            {/if}

            <div class="mt-5 flex flex-wrap gap-2.5">
              {#if book.isOwner}
                {#if book.status === "available"}
                  <a
                    href="/books/sell?edit={book.id}"
                    use:routeAction
                    class="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
                  >
                    Edit Listing
                  </a>
                  <button
                    onclick={handleMarkSold}
                    disabled={markingSold}
                    class="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {markingSold ? "Marking..." : "Mark as Sold"}
                  </button>
                {/if}
                <button
                  onclick={handleDelete}
                  disabled={deleting}
                  class="px-4 py-2 rounded-xl border border-rose-200 text-rose-700 text-sm font-semibold hover:bg-rose-50 transition-colors disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              {:else if $session.data?.user && book.status === "available"}
                <button
                  onclick={handleSaveToggle}
                  disabled={saving}
                  class="px-4 py-2 rounded-xl border text-sm font-semibold transition-colors disabled:opacity-50 {savedState
                    ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
                >
                  {saving ? "Updating..." : savedState ? "Saved" : "Save"}
                </button>

                {#if purchaseRequestQuery.data}
                  <div class="flex items-center gap-2">
                    <span
                      class="px-3 py-2 rounded-xl border text-sm font-bold {getStatusColorClass(
                        purchaseRequestQuery.data.status,
                      )}"
                    >
                      Request {getStatusLabel(purchaseRequestQuery.data.status)}
                    </span>

                    {#if purchaseRequestQuery.data.status === "requested"}
                      <button
                        onclick={handleCancelRequest}
                        disabled={cancellingRequest}
                        class="px-4 py-2 rounded-xl border border-rose-200 text-rose-700 text-sm font-semibold hover:bg-rose-50 transition-colors disabled:opacity-50"
                      >
                        {cancellingRequest ? "Cancelling..." : "Cancel"}
                      </button>
                    {:else if purchaseRequestQuery.data.status === "accepted"}
                      <a
                        href="/messages?listing={book.id}"
                        class="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                      >
                        Chat with Seller
                      </a>
                      {#if sellerContactQuery.data?.email}
                        <a
                          href="mailto:{sellerContactQuery.data.email}"
                          class="px-4 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 transition-colors"
                        >
                          Email Seller
                        </a>
                      {/if}
                    {/if}
                  </div>
                {:else}
                  <button
                    onclick={() => (requestToBuyModalOpen = true)}
                    class="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                  >
                    Request to Buy
                  </button>
                {/if}
              {:else if !$session.data?.user && book.status === "available"}
                <a
                  href="/register"
                  use:routeAction
                  class="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                  Sign in to interact
                </a>
              {/if}
            </div>

            <div class="mt-5 text-xs text-gray-500 flex items-center gap-2">
              <span>Posted {formatDate(book.createdAt)}</span>
              <span>•</span>
              <span>{book.viewCount} views</span>
            </div>
          </div>
        </div>
      </section>
    {/if}
  </div>
</div>

{#if requestToBuyModalOpen}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    transition:fade={{ duration: 200 }}
  >
    <!-- Backdrop -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      onclick={() => (requestToBuyModalOpen = false)}
    ></div>

    <!-- Modal Content -->
    <div
      class="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-cyan-100/50"
      transition:fly={{ y: 20, duration: 400 }}
    >
      <div class="p-6 sm:p-8">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xl font-black text-slate-900 tracking-tight">
            Request to Buy
          </h3>
          <button
            onclick={() => (requestToBuyModalOpen = false)}
            class="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <svg
              class="w-5 h-5 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l18 18"
              />
            </svg>
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <label
              for="requestMessage"
              class="block text-sm font-bold text-slate-700 mb-1.5"
            >
              Message to Seller
            </label>
            <textarea
              id="requestMessage"
              bind:value={requestMessage}
              placeholder="e.g., I'm interested in this book. When can we meet?"
              class="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all resize-none h-32 text-sm"
            ></textarea>
            <p class="mt-2 text-xs text-slate-500">
              The seller will be notified of your interest. You can chat
              directly once they accept your request.
            </p>
          </div>

          <div class="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onclick={handleRequestToBuy}
              disabled={requestSubmitting}
              class="flex-1 px-6 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-200 active:scale-95"
            >
              {requestSubmitting ? "Sending..." : "Send Request"}
            </button>
            <button
              onclick={() => (requestToBuyModalOpen = false)}
              class="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if reviewsModalOpen && sellerReputationQuery.data}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    transition:fade={{ duration: 200 }}
  >
    <!-- Backdrop -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      onclick={() => (reviewsModalOpen = false)}
    ></div>

    <!-- Modal Content -->
    <div
      class="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-cyan-100/50"
      transition:fly={{ y: 20, duration: 400 }}
    >
      <div class="p-6 sm:p-8">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xl font-black text-slate-900 tracking-tight">
            Seller Reviews
          </h3>
          <button
            onclick={() => (reviewsModalOpen = false)}
            class="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <svg
              class="w-5 h-5 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div class="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          <div class="space-y-4">
            {#each sellerReputationQuery.data.recentRatings as rating}
              <div
                class="p-4 rounded-2xl bg-slate-50/80 border border-slate-100"
              >
                <div class="flex items-center justify-between mb-2">
                  <div class="flex text-amber-400">
                    {#each Array(5) as _, i}
                      <svg
                        class="w-3.5 h-3.5"
                        fill={i < rating.rating ? "currentColor" : "none"}
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                        />
                      </svg>
                    {/each}
                  </div>
                  <span
                    class="text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                  >
                    {formatDate(rating.createdAt)}
                  </span>
                </div>
                <p class="text-sm text-slate-700 italic leading-relaxed">
                  "{rating.review || "No comment provided."}"
                </p>
                <div
                  class="mt-3 pt-3 border-t border-slate-200/50 flex items-center gap-2"
                >
                  <div
                    class="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center text-[10px] font-bold text-violet-600"
                  >
                    {rating.rater?.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <span class="text-[11px] font-black text-slate-900">
                    {rating.rater?.name || "Anonymous User"}
                  </span>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <button
          onclick={() => (reviewsModalOpen = false)}
          class="w-full mt-6 py-4 rounded-2xl bg-slate-900 text-white font-black text-sm hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if}
