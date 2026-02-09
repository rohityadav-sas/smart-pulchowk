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

  // Modal States
  let requestToBuyModalOpen = $state(false);
  let reviewsModalOpen = $state(false);
  let rateModalOpen = $state(false);
  let reportModalOpen = $state(false);
  let blockModalOpen = $state(false);

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
            class="bg-slate-50/50 p-4 sm:p-6 border-b lg:border-b-0 lg:border-r border-slate-100"
          >
            <div
              class="group relative h-80 sm:h-96 lg:h-128 w-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex items-center justify-center transition-all hover:shadow-md"
            >
              {#if activeImage}
                <img
                  src={activeImage.imageUrl}
                  alt={book.title}
                  class="w-full h-full object-contain p-4 transition-transform duration-500 group-hover:scale-[1.02]"
                />

                {#if hasImages && book.images!.length > 1}
                  <div
                    class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/10 backdrop-blur-md border border-white/20"
                  >
                    {#each book.images as _, i}
                      <div
                        class="h-1.5 rounded-full transition-all duration-300 {i ===
                        activeImageIndex
                          ? 'w-4 bg-slate-900'
                          : 'w-1.5 bg-slate-400'}"
                      ></div>
                    {/each}
                  </div>
                {/if}
              {:else}
                <div class="text-center text-slate-300">
                  <svg
                    class="w-16 h-16 mx-auto opacity-20"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p class="text-xs mt-3 font-medium tracking-wide">
                    NO IMAGES AVAILABLE
                  </p>
                </div>
              {/if}
            </div>

            {#if hasImages && book.images!.length > 1}
              <div class="mt-4 grid grid-cols-5 sm:grid-cols-6 gap-3">
                {#each book.images as image, index (image.id)}
                  <button
                    onclick={() => (activeImageIndex = index)}
                    class="aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200 {index ===
                    activeImageIndex
                      ? 'border-blue-500 shadow-lg shadow-blue-100 scale-105'
                      : 'border-transparent hover:border-slate-300 opacity-60 hover:opacity-100'}"
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

            <div class="mt-6 grid grid-cols-2 gap-4">
              {#if book.condition}
                <div
                  class="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 transition-colors hover:bg-white hover:shadow-sm"
                >
                  <span
                    class="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                  >
                    <svg
                      class="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2.5"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      /></svg
                    >
                    Condition
                  </span>
                  <p class="mt-1 font-black text-slate-900">
                    {conditionLabel[book.condition]}
                  </p>
                </div>
              {/if}
              {#if book.edition}
                <div
                  class="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 transition-colors hover:bg-white hover:shadow-sm"
                >
                  <span
                    class="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                  >
                    <svg
                      class="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2.5"
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      /></svg
                    >
                    Edition
                  </span>
                  <p class="mt-1 font-black text-slate-900">{book.edition}</p>
                </div>
              {/if}
              {#if book.publisher}
                <div
                  class="col-span-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 transition-colors hover:bg-white hover:shadow-sm"
                >
                  <span
                    class="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                  >
                    <svg
                      class="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2.5"
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      /></svg
                    >
                    Publisher
                  </span>
                  <p class="mt-1 font-black text-slate-900">{book.publisher}</p>
                </div>
              {/if}
              {#if book.publicationYear}
                <div
                  class="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 transition-colors hover:bg-white hover:shadow-sm"
                >
                  <span
                    class="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                  >
                    <svg
                      class="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2.5"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      /></svg
                    >
                    Year
                  </span>
                  <p class="mt-1 font-black text-slate-900">
                    {book.publicationYear}
                  </p>
                </div>
              {/if}
              {#if book.category}
                <div
                  class="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 transition-colors hover:bg-white hover:shadow-sm"
                >
                  <span
                    class="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                  >
                    <svg
                      class="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2.5"
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      /></svg
                    >
                    Category
                  </span>
                  <p class="mt-1 font-black text-slate-900 text-sm truncate">
                    {book.category.name}
                  </p>
                </div>
              {/if}
              {#if book.isbn}
                <div
                  class="col-span-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 transition-colors hover:bg-white hover:shadow-sm"
                >
                  <span
                    class="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                  >
                    <svg
                      class="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2.5"
                        d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                      /></svg
                    >
                    ISBN
                  </span>
                  <p class="mt-1 font-black text-slate-900 break-all">
                    {book.isbn}
                  </p>
                </div>
              {/if}
              {#if book.courseCode}
                <div
                  class="col-span-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 transition-colors hover:bg-white hover:shadow-sm"
                >
                  <span
                    class="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                  >
                    <svg
                      class="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2.5"
                        d="M12 6.03L12 12m0 0l3.586-3.586a2 2 0 112.828 2.828L12 17.657l-6.414-6.415a2 2 0 112.828-2.828L12 12z"
                      /></svg
                    >
                    Course
                  </span>
                  <p class="mt-1 font-black text-slate-900">
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
                class="mt-8 relative group overflow-hidden rounded-[2rem] bg-slate-900 p-8 shadow-2xl transition-all hover:scale-[1.01]"
              >
                <!-- Background decorative elements -->
                <div
                  class="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl"
                ></div>
                <div
                  class="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-cyan-500/10 blur-3xl"
                ></div>

                <div
                  class="relative flex flex-col sm:flex-row items-start sm:items-center gap-6"
                >
                  <div class="flex-1">
                    <span
                      class="inline-flex items-center px-3 py-1 rounded-full bg-white/10 border border-white/10 text-[10px] font-black text-blue-300 uppercase tracking-[0.2em] mb-4"
                    >
                      Seller Reputation
                    </span>
                    <h3 class="text-2xl font-black text-white tracking-tight">
                      Trust Profile
                    </h3>
                    <p class="mt-1 text-slate-400 text-sm font-medium">
                      Verified marketplace participant
                    </p>
                  </div>

                  <div
                    class="flex items-center gap-4 bg-white/5 backdrop-blur-md rounded-[1.5rem] p-4 border border-white/10 shadow-inner"
                  >
                    <div
                      class="text-center px-4 border-r border-white/10 group/stat"
                    >
                      <p
                        class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1"
                      >
                        Rating
                      </p>
                      <button
                        onclick={() => (reviewsModalOpen = true)}
                        class="flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
                      >
                        <span
                          class="text-2xl font-black text-white group-hover/stat:text-blue-400 transition-colors"
                        >
                          {sellerReputationQuery.data?.averageRating.toFixed(
                            1,
                          ) || "0.0"}
                        </span>
                        <svg
                          class="w-5 h-5 text-amber-400 group-hover/stat:drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] transition-all"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                          />
                        </svg>
                      </button>
                    </div>
                    <div class="text-center px-4 group/stat">
                      <p
                        class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1"
                      >
                        Reviews
                      </p>
                      <button
                        onclick={() => (reviewsModalOpen = true)}
                        class="text-2xl font-black text-white hover:text-blue-400 transition-all hover:scale-105 active:scale-95"
                      >
                        {sellerReputationQuery.data?.totalRatings || 0}
                      </button>
                    </div>
                  </div>
                </div>

                <div class="mt-8 grid grid-cols-3 gap-3">
                  <button
                    onclick={() => (rateModalOpen = true)}
                    class="group/btn flex flex-col items-center justify-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5 transition-all hover:bg-white/10 hover:border-white/20 active:scale-95"
                  >
                    <div
                      class="p-3 rounded-xl bg-blue-500/20 text-blue-400 group-hover/btn:scale-110 transition-transform"
                    >
                      <svg
                        class="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        ><path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2.5"
                          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                        /></svg
                      >
                    </div>
                    <span
                      class="text-[11px] font-black text-slate-300 uppercase tracking-widest"
                      >Rate</span
                    >
                  </button>

                  <button
                    onclick={() => (reportModalOpen = true)}
                    class="group/btn flex flex-col items-center justify-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5 transition-all hover:bg-rose-500/20 hover:border-rose-500/30 active:scale-95"
                  >
                    <div
                      class="p-3 rounded-xl bg-rose-500/20 text-rose-400 group-hover/btn:scale-110 transition-transform"
                    >
                      <svg
                        class="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        ><path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2.5"
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        /></svg
                      >
                    </div>
                    <span
                      class="text-[11px] font-black text-slate-300 uppercase tracking-widest"
                      >Report</span
                    >
                  </button>

                  <button
                    onclick={() => (blockModalOpen = true)}
                    class="group/btn flex flex-col items-center justify-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5 transition-all hover:bg-slate-500/20 hover:border-slate-500/30 active:scale-95"
                  >
                    <div
                      class="p-3 rounded-xl bg-slate-500/20 text-slate-400 group-hover/btn:scale-110 transition-transform"
                    >
                      {#if sellerBlocked}
                        <svg
                          class="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          ><path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2.5"
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                          /></svg
                        >
                      {:else}
                        <svg
                          class="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          ><path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2.5"
                            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                          /></svg
                        >
                      {/if}
                    </div>
                    <span
                      class="text-[11px] font-black text-slate-300 uppercase tracking-widest text-center"
                    >
                      {sellerBlocked ? "Unblock" : "Block"}
                    </span>
                  </button>
                </div>

                {#if trustFeedback}
                  <div
                    class="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold text-center"
                    in:fade
                  >
                    {trustFeedback}
                  </div>
                {/if}
                {#if trustError}
                  <div
                    class="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold text-center"
                    in:fade
                  >
                    {trustError}
                  </div>
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
    <div
      class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      onclick={() => (requestToBuyModalOpen = false)}
      onkeydown={(e) => e.key === "Escape" && (requestToBuyModalOpen = false)}
      role="button"
      tabindex="-1"
      aria-label="Close modal"
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
            aria-label="Close modal"
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
    <div
      class="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
      onclick={() => (reviewsModalOpen = false)}
      onkeydown={(e) => e.key === "Escape" && (reviewsModalOpen = false)}
      role="button"
      tabindex="-1"
      aria-label="Close reviews"
    ></div>

    <div
      class="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200"
      transition:fly={{ y: 20, duration: 400 }}
    >
      <div class="p-8 sm:p-10 flex flex-col max-h-[85vh]">
        <div class="flex items-center justify-between mb-8">
          <div>
            <h3 class="text-2xl font-black text-slate-900 tracking-tight">
              Seller Reviews
            </h3>
            <p class="text-slate-500 text-sm font-medium mt-1">
              Based on {sellerReputationQuery.data.totalRatings} transactions
            </p>
          </div>
          <button
            onclick={() => (reviewsModalOpen = false)}
            class="p-3 hover:bg-slate-100 rounded-2xl transition-colors"
            aria-label="Close reviews"
          >
            <svg
              class="w-6 h-6 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M6 18L18 6M6 6l12 12"
              /></svg
            >
          </button>
        </div>

        <div class="overflow-y-auto pr-2 custom-scrollbar space-y-4">
          {#each sellerReputationQuery.data.recentRatings as rating}
            <div
              class="p-6 rounded-3xl bg-slate-50 border border-slate-100 transition-all hover:shadow-sm"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="flex items-center gap-3">
                  <div class="relative">
                    {#if rating.rater?.image}
                      <img
                        src={rating.rater.image}
                        alt=""
                        class="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                      />
                    {:else}
                      <div
                        class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-xs font-black text-blue-600 border-2 border-white shadow-sm"
                      >
                        {rating.rater?.name?.charAt(0).toUpperCase() || "U"}
                      </div>
                    {/if}
                  </div>
                  <div>
                    <p class="text-sm font-black text-slate-900">
                      {rating.rater?.name || "Anonymous User"}
                    </p>
                    <div class="flex items-center gap-1 mt-0.5">
                      {#each Array(5) as _, i}
                        <svg
                          class="w-3 h-3 {i < rating.rating
                            ? 'text-amber-400'
                            : 'text-slate-200'}"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                          />
                        </svg>
                      {/each}
                    </div>
                  </div>
                </div>
                <span
                  class="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap"
                >
                  {formatDate(rating.createdAt)}
                </span>
              </div>

              {#if rating.review}
                <div class="mt-4 relative">
                  <svg
                    class="absolute -left-1 -top-1 w-6 h-6 text-slate-200 opacity-50"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    ><path
                      d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C20.1216 16 21.017 16.8954 21.017 18V21C21.017 22.1046 20.1216 23 19.017 23H16.017C14.9124 23 14.017 22.1046 14.017 21ZM5.017 21V18C5.017 16.8954 5.91243 16 7.017 16H10.017C11.1216 16 12.017 16.8954 12.017 18V21C12.017 22.1046 11.1216 23 10.017 23H7.017C5.91243 23 5.017 22.1046 5.017 21ZM19.017 13H16.017C13.8079 13 12.017 14.7909 12.017 17V18.1046C12.017 18.5442 11.6596 18.9016 11.22 18.9016H10.017C8.91243 18.9016 8.017 18.0062 8.017 16.9016V16.017C8.017 13.8079 9.80786 12.017 12.017 12.017V10C12.017 8.89543 11.1216 8 10.017 8H7.017C4.80786 8 3.017 9.80786 3.017 12V21M21.017 13C21.017 10.7909 19.2261 9 17.017 9H16.017C13.8079 9 12.017 10.7909 12.017 13V21"
                    /></svg
                  >
                  <p
                    class="text-slate-700 text-sm font-medium leading-relaxed pl-6 relative z-10"
                  >
                    "{rating.review}"
                  </p>
                </div>
              {/if}
            </div>
          {/each}

          {#if sellerReputationQuery.data.recentRatings.length === 0}
            <div class="py-12 text-center">
              <div
                class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100"
              >
                <svg
                  class="w-8 h-8 text-slate-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                  /></svg
                >
              </div>
              <p
                class="text-slate-400 text-sm font-bold uppercase tracking-widest"
              >
                No reviews yet
              </p>
            </div>
          {/if}
        </div>

        <button
          onclick={() => (reviewsModalOpen = false)}
          class="w-full mt-8 py-5 rounded-2xl bg-slate-900 text-white font-black text-sm hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-[0.98]"
        >
          DONE
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Rate Seller Modal -->
{#if rateModalOpen && bookQuery.data}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    transition:fade={{ duration: 200 }}
  >
    <div
      class="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
      onclick={() => (rateModalOpen = false)}
      onkeydown={(e) => e.key === "Escape" && (rateModalOpen = false)}
      role="button"
      tabindex="-1"
      aria-label="Close rating modal"
    ></div>
    <div
      class="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200"
      transition:fly={{ y: 20, duration: 400 }}
    >
      <div class="p-8 sm:p-10">
        <div class="text-center mb-8">
          <div
            class="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-200"
          >
            <svg
              class="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
              /></svg
            >
          </div>
          <h3 class="text-2xl font-black text-slate-900 tracking-tight">
            Rate Seller
          </h3>
          <p class="text-slate-500 text-sm font-medium mt-1">
            How was your experience with {bookQuery.data.seller?.name}?
          </p>
        </div>

        <div class="flex justify-center gap-2 mb-8">
          {#each Array(5) as _, i}
            {@const starVal = i + 1}
            <button
              onclick={() => (ratingValue = starVal)}
              class="p-2 transition-transform hover:scale-110 active:scale-90"
            >
              <svg
                class="w-10 h-10 {starVal <= ratingValue
                  ? 'text-amber-400'
                  : 'text-slate-200'}"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                />
              </svg>
            </button>
          {/each}
        </div>

        <textarea
          bind:value={ratingReview}
          rows="4"
          placeholder="Share more details about the transaction... (optional)"
          class="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium resize-none shadow-inner"
        ></textarea>

        <div class="mt-8 flex gap-4">
          <button
            onclick={() => (rateModalOpen = false)}
            class="flex-1 py-4 bg-slate-100 text-slate-600 font-black text-sm rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
          >
            CANCEL
          </button>
          <button
            onclick={async () => {
              await handleRateSeller(bookQuery.data!);
              if (!trustError) rateModalOpen = false;
            }}
            disabled={ratingSubmitting}
            class="flex-1 py-4 bg-blue-600 text-white font-black text-sm rounded-2xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-xl shadow-blue-200 active:scale-95"
          >
            {ratingSubmitting ? "SUBMITTING..." : "SUBMIT RATING"}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Report Seller Modal -->
{#if reportModalOpen && bookQuery.data}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    transition:fade={{ duration: 200 }}
  >
    <div
      class="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
      onclick={() => (reportModalOpen = false)}
      onkeydown={(e) => e.key === "Escape" && (reportModalOpen = false)}
      role="button"
      tabindex="-1"
      aria-label="Close report modal"
    ></div>
    <div
      class="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200"
      transition:fly={{ y: 20, duration: 400 }}
    >
      <div class="p-8 sm:p-10">
        <div class="text-center mb-8">
          <div
            class="w-16 h-16 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-200"
          >
            <svg
              class="w-8 h-8 text-rose-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              /></svg
            >
          </div>
          <h3 class="text-2xl font-black text-slate-900 tracking-tight">
            Report Seller
          </h3>
          <p class="text-slate-500 text-sm font-medium mt-1">
            Is there something wrong with this listing?
          </p>
        </div>

        <select
          bind:value={reportCategory}
          class="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all text-sm font-bold mb-4 appearance-none shadow-inner"
        >
          <option value="spam">Spam</option>
          <option value="fraud">Fraud</option>
          <option value="abusive">Abusive</option>
          <option value="fake_listing">Fake listing</option>
          <option value="suspicious_payment">Suspicious payment</option>
          <option value="other">Other</option>
        </select>

        <textarea
          bind:value={reportDescription}
          rows="4"
          placeholder="Please describe the issue in detail..."
          class="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all text-sm font-medium resize-none shadow-inner"
        ></textarea>

        <div class="mt-8 flex gap-4">
          <button
            onclick={() => (reportModalOpen = false)}
            class="flex-1 py-4 bg-slate-100 text-slate-600 font-black text-sm rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
          >
            CANCEL
          </button>
          <button
            onclick={async () => {
              await handleReportSeller(bookQuery.data!);
              if (!trustError) reportModalOpen = false;
            }}
            disabled={reportSubmitting}
            class="flex-1 py-4 bg-rose-600 text-white font-black text-sm rounded-2xl hover:bg-rose-700 disabled:opacity-50 transition-all shadow-xl shadow-rose-200 active:scale-95"
          >
            {reportSubmitting ? "SUBMITTING..." : "SEND REPORT"}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Block Seller Modal -->
{#if blockModalOpen && bookQuery.data}
  {@const sellerBlocked = !!blockedUsersQuery.data?.some(
    (entry) => entry.blockedUserId === bookQuery.data!.sellerId,
  )}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    transition:fade={{ duration: 200 }}
  >
    <div
      class="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
      onclick={() => (blockModalOpen = false)}
      onkeydown={(e) => e.key === "Escape" && (blockModalOpen = false)}
      role="button"
      tabindex="-1"
      aria-label="Close block modal"
    ></div>
    <div
      class="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200"
      transition:fly={{ y: 20, duration: 400 }}
    >
      <div class="p-8 sm:p-10">
        <div class="text-center mb-8">
          <div
            class="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-200"
          >
            <svg
              class="w-8 h-8 text-slate-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              /></svg
            >
          </div>
          <h3 class="text-2xl font-black text-slate-900 tracking-tight">
            {#if sellerBlocked}Unblock{:else}Block{/if}
            {bookQuery.data.seller?.name}
          </h3>
          <p class="text-slate-500 text-sm font-medium mt-1">
            {#if sellerBlocked}
              Are you sure you want to unblock this user?
            {:else}
              You will no longer see any listings or messages from this user.
            {/if}
          </p>
        </div>

        {#if !sellerBlocked}
          <textarea
            bind:value={blockReason}
            rows="3"
            placeholder="Reason for blocking (optional)"
            class="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 transition-all text-sm font-medium resize-none shadow-inner"
          ></textarea>
        {/if}

        <div class="mt-8 flex gap-4">
          <button
            onclick={() => (blockModalOpen = false)}
            class="flex-1 py-4 bg-slate-100 text-slate-600 font-black text-sm rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
          >
            CANCEL
          </button>
          <button
            onclick={async () => {
              if (sellerBlocked) await handleUnblockSeller(bookQuery.data!);
              else await handleBlockSeller(bookQuery.data!);
              if (!trustError) blockModalOpen = false;
            }}
            disabled={blockSubmitting || unblockSubmitting}
            class="flex-1 py-4 bg-slate-900 text-white font-black text-sm rounded-2xl hover:bg-slate-800 disabled:opacity-50 transition-all shadow-xl shadow-slate-200 active:scale-95"
          >
            {#if sellerBlocked}
              {unblockSubmitting ? "UNBLOCKING..." : "CONFIRM UNBLOCK"}
            {:else}
              {blockSubmitting ? "BLOCKING..." : "CONFIRM BLOCK"}
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
