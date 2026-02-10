<script lang="ts">
  import { onMount, untrack } from "svelte";
  import {
    route as routeAction,
    goto,
    query as routeQuery,
  } from "@mateothegreat/svelte5-router";
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
    getListingPurchaseRequests,
    respondToPurchaseRequest,
    cancelPurchaseRequest,
    getSellerContactInfo,
    getBookListings,
    type BookListing,
    type MarketplaceReport,
    type PurchaseRequest,
  } from "../lib/api";
  import LoadingSpinner from "../components/LoadingSpinner.svelte";
  import { fade, fly } from "svelte/transition";
  import { quintOut } from "svelte/easing";
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
  let toastTimeout: any;
  let highlightListing = $state(routeQuery("highlight") === "listing");

  // Modal States
  let requestToBuyModalOpen = $state(false);
  let reviewsModalOpen = $state(false);
  let rateModalOpen = $state(false);
  let reportModalOpen = $state(false);
  let blockModalOpen = $state(false);
  let profileModalOpen = $state(false);
  let sellerMenuOpen = $state(false);

  let requestMessage = $state("");
  let requestSubmitting = $state(false);
  let cancellingRequest = $state(false);
  let respondingToRequest = $state<number | null>(null);

  let showStickyBar = $state(false);
  let ctaRef: HTMLElement | undefined = $state(undefined);
  let profileTab = $state<"listings" | "reviews">("listings");
  let ratingTags = $state<string[]>([]);

  const availableRatingTags = [
    "Fast Response",
    "Accurate Description",
    "Great Condition",
    "Fair Price",
    "Professional",
  ];

  function toggleRatingTag(tag: string) {
    if (ratingTags.includes(tag)) {
      ratingTags = ratingTags.filter((t) => t !== tag);
    } else {
      ratingTags = [...ratingTags, tag];
    }
  }

  function showSuccess(message: string) {
    if (toastTimeout) clearTimeout(toastTimeout);
    trustFeedback = message;
    trustError = null;
    toastTimeout = setTimeout(() => {
      trustFeedback = null;
    }, 2000);
  }

  function showError(message: string) {
    if (toastTimeout) clearTimeout(toastTimeout);
    trustError = message;
    trustFeedback = null;
    toastTimeout = setTimeout(() => {
      trustError = null;
    }, 2000);
  }

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showSuccess("Link copied to clipboard!");
    } catch (error: any) {
      showError(error.message);
    }
  }

  onMount(() => {
    window.scrollTo(0, 0);
  });

  $effect(() => {
    if (!ctaRef) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        showStickyBar = !entry.isIntersecting;
      },
      { threshold: 0 },
    );
    observer.observe(ctaRef);
    return () => observer.disconnect();
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

  $effect(() => {
    if (!sellerMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".seller-menu-container")) {
        sellerMenuOpen = false;
      }
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
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

  const sellerListingsQuery = createQuery(() => ({
    queryKey: ["seller-listings", bookQuery.data?.sellerId, bookId],
    queryFn: async () => {
      const sellerId = bookQuery.data?.sellerId;
      if (!sellerId) return null;
      const result = await getBookListings({ sellerId });
      if (!result.success || !result.data)
        return { listings: [], totalCount: 0 };

      const listings = (result.data?.listings || []).filter(
        (l) => l.id !== bookId,
      );

      return {
        listings,
        totalCount: listings.length,
      };
    },
    enabled: !!bookQuery.data?.sellerId && profileModalOpen,
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
    queryKey: ["purchase-request", bookId, bookQuery.data?.isOwner],
    queryFn: async () => {
      if (!bookId || !$session.data?.user) return null;
      if (bookQuery.data?.isOwner) {
        const result = await getListingPurchaseRequests(bookId);
        return result.success ? result.data : [];
      }
      const result = await getPurchaseRequestStatus(bookId);
      return result.success ? result.data : null;
    },
    enabled: bookId > 0 && !!$session.data?.user && !!bookQuery.data,
  }));

  const buyerPurchaseRequest = $derived(
    !bookQuery.data?.isOwner && !Array.isArray(purchaseRequestQuery.data)
      ? (purchaseRequestQuery.data as PurchaseRequest | null)
      : null,
  );

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
      (buyerPurchaseRequest?.status === "accepted" || bookQuery.data?.isOwner),
  }));

  const hasSellerContactInfo = $derived(
    !!sellerContactQuery.data &&
      (!!sellerContactQuery.data.whatsapp ||
        !!sellerContactQuery.data.telegramUsername ||
        !!sellerContactQuery.data.facebookMessenger ||
        !!sellerContactQuery.data.email ||
        !!sellerContactQuery.data.phoneNumber ||
        !!sellerContactQuery.data.otherContactDetails),
  );

  $effect(() => {
    const total = bookQuery.data?.images?.length || 0;
    if (total === 0) {
      activeImageIndex = 0;
      return;
    }
    if (activeImageIndex > total - 1) activeImageIndex = 0;
  });

  const book = $derived(bookQuery.data);

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
    if (toastTimeout) clearTimeout(toastTimeout);
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
        await Promise.all([
          bookQuery.refetch(),
          purchaseRequestQuery.refetch(),
        ]);
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
      showError("Please choose a rating between 1 and 5.");
      return;
    }

    clearTrustMessages();
    ratingSubmitting = true;
    try {
      const combinedReview = [
        ratingTags.length > 0 ? `${ratingTags.join(", ")}` : "",
        ratingReview.trim(),
      ]
        .filter(Boolean)
        .join(" - ");

      const result = await rateSeller(book.sellerId, {
        listingId: book.id,
        rating: ratingValue,
        review: combinedReview || undefined,
      });
      if (!result.success) {
        showError(result.message || "Could not submit rating.");
        return;
      }

      ratingReview = "";
      showSuccess("Rating submitted.");
      await queryClient.invalidateQueries({
        queryKey: ["seller-reputation", book.sellerId],
      });
      await sellerReputationQuery.refetch();
    } catch (error) {
      console.error("Failed to rate seller:", error);
      showError("Could not submit rating.");
    } finally {
      ratingSubmitting = false;
    }
  }

  async function handleReportSeller(book: BookListing) {
    if (!book.sellerId || reportSubmitting) return;
    if (!reportDescription.trim()) {
      showError("Please add a short description for the report.");
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
        showError(result.message || "Could not submit report.");
        return;
      }

      reportDescription = "";
      reportCategory = "other";
      showSuccess("Report submitted. Admins will review it.");
    } catch (error) {
      console.error("Failed to report seller:", error);
      showError("Could not submit report.");
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
        showError(result.message || "Could not block seller.");
        return;
      }

      blockReason = "";
      showSuccess("Seller blocked.");
      await blockedUsersQuery.refetch();
    } catch (error) {
      console.error("Failed to block seller:", error);
      showError("Could not block seller.");
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
        showError(result.message || "Failed to send request.");
      }
    } catch (error) {
      console.error("Failed to send purchase request:", error);
      showError("An error occurred while sending the request.");
    } finally {
      requestSubmitting = false;
    }
  }

  async function handleCancelRequest() {
    const data = purchaseRequestQuery.data;
    if (!data || Array.isArray(data) || cancellingRequest) return;
    const request = data;
    if (!confirm("Cancel your request to buy this book?")) return;

    cancellingRequest = true;
    try {
      const result = await cancelPurchaseRequest(request.id);
      if (result.success) {
        await purchaseRequestQuery.refetch();
      } else {
        showError(result.message || "Failed to cancel request.");
      }
    } catch (error) {
      console.error("Failed to cancel purchase request:", error);
      showError("An error occurred while cancelling the request.");
    } finally {
      cancellingRequest = false;
    }
  }

  async function handleRespondToRequest(requestId: number, accept: boolean) {
    if (respondingToRequest) return;
    respondingToRequest = requestId;
    try {
      const result = await respondToPurchaseRequest(requestId, accept);
      if (result.success) {
        await purchaseRequestQuery.refetch();
        showSuccess(accept ? "Request accepted!" : "Request declined.");
      } else {
        showError(result.message || "Failed to respond to request.");
      }
    } catch (err) {
      console.error("Failed to respond to request:", err);
      showError("An error occurred.");
    } finally {
      respondingToRequest = null;
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
        showError(result.message || "Could not unblock seller.");
        return;
      }

      showSuccess("Seller unblocked.");
      await blockedUsersQuery.refetch();
    } catch (error) {
      console.error("Failed to unblock seller:", error);
      showError("Could not unblock seller.");
    } finally {
      unblockSubmitting = false;
    }
  }

  async function copyAllContactInfo() {
    const contact = sellerContactQuery.data;
    if (!contact) return;

    const lines = [];
    if (contact.email) lines.push(`Email: ${contact.email}`);
    if (contact.phoneNumber) lines.push(`Phone: ${contact.phoneNumber}`);
    if (contact.whatsapp) lines.push(`WhatsApp: ${contact.whatsapp}`);
    if (contact.telegramUsername)
      lines.push(`Telegram: @${contact.telegramUsername}`);
    if (contact.facebookMessenger)
      lines.push(`Messenger: ${contact.facebookMessenger}`);
    if (contact.otherContactDetails)
      lines.push(`Other: ${contact.otherContactDetails}`);

    if (lines.length === 0) return;

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      showSuccess("All contact info copied!");
    } catch (err) {
      showError("Failed to copy contact info");
    }
  }
</script>

<div
  class="min-h-[calc(100vh-4rem)] bg-gray-50/50 px-4 py-5 sm:px-6 lg:px-8 {highlightListing
    ? 'ring-2 ring-cyan-400 ring-offset-2 bg-cyan-50/20 notif-highlight-blink'
    : ''}"
>
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
    {:else if book}
      {@const hasImages = !!book.images && book.images.length > 0}
      {@const activeImage = hasImages ? book.images![activeImageIndex] : null}

      <section
        class="mt-4 bg-white border border-gray-100 rounded-2xl shadow-sm"
        in:fly={{ y: 12, duration: 260 }}
      >
        <div class="grid grid-cols-1 lg:grid-cols-2">
          <div
            class="bg-slate-50/50 p-4 sm:p-6 border-b lg:border-b-0 lg:border-r border-slate-100"
          >
            <div
              class="group relative h-80 sm:h-96 lg:h-[32rem] w-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex items-center justify-center transition-all hover:shadow-md"
            >
              {#if book.edition}
                <span
                  class="absolute top-4 right-4 z-10 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200"
                >
                  {book.edition} Edition
                </span>
              {/if}

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
                    Book Image
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

            <!-- Compact Seller Card -->
            {#if book.seller && !book.isOwner}
              <div
                class="mt-4 flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100"
              >
                {#if book.seller.image}
                  <img
                    src={book.seller.image}
                    alt=""
                    class="w-10 h-10 rounded-full object-cover"
                  />
                {:else}
                  <div
                    class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm"
                  >
                    {book.seller.name.charAt(0).toUpperCase()}{book.seller.name
                      .split(" ")[1]
                      ?.charAt(0)
                      .toUpperCase() || ""}
                  </div>
                {/if}
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold text-gray-900 truncate">
                    {book.seller.name}
                  </p>
                  {#if book.seller.isVerifiedSeller}
                    <p class="text-xs text-gray-500">Verified Seller</p>
                  {/if}
                </div>
                <button
                  onclick={() => {
                    profileModalOpen = true;
                    profileTab = "listings";
                  }}
                  class="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors whitespace-nowrap"
                >
                  View Profile →
                </button>
                <div class="relative seller-menu-container">
                  <button
                    onclick={() => (sellerMenuOpen = !sellerMenuOpen)}
                    class="p-1.5 hover:bg-slate-100 rounded-lg transition-colors {sellerMenuOpen
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-400'}"
                    aria-label="More options"
                  >
                    <svg
                      class="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
                      />
                    </svg>
                  </button>

                  {#if sellerMenuOpen}
                    <div
                      transition:fly={{ y: 8, duration: 200 }}
                      class="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-20"
                    >
                      <button
                        onclick={() => {
                          reportModalOpen = true;
                          sellerMenuOpen = false;
                        }}
                        class="w-full px-4 py-2.5 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-colors"
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
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        Report Seller
                      </button>
                      <button
                        onclick={() => {
                          blockModalOpen = true;
                          sellerMenuOpen = false;
                        }}
                        class="w-full px-4 py-2.5 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-colors"
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
                            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                          />
                        </svg>
                        Block Seller
                      </button>
                    </div>
                  {/if}
                </div>
              </div>
            {/if}
          </div>

          <div class="p-5 sm:p-6 lg:p-8">
            <!-- Title -->
            <h1
              class="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight"
            >
              {book.title}
            </h1>

            <!-- Price -->
            <div class="mt-3 flex items-baseline gap-3">
              <span class="text-3xl font-black text-emerald-600"
                >Rs. {parseFloat(book.price).toLocaleString()}</span
              >
              {#if book.price && parseFloat(book.price) > parseFloat(book.price)}
                <span class="text-lg text-gray-400 line-through"
                  >Rs. {parseFloat(book.price).toLocaleString()}</span
                >
              {/if}
              {#if book.status === "sold"}
                <span
                  class="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200"
                  >Sold</span
                >
              {/if}
            </div>

            <!-- Author -->
            <p class="mt-2 text-sm text-gray-500">by {book.author}</p>

            <!-- Metadata Grid -->
            <div class="mt-5 grid grid-cols-2 gap-3">
              <div
                class="p-4 rounded-2xl bg-slate-50 border border-slate-100 transition-all hover:bg-white hover:shadow-sm"
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

              {#if book.category}
                <div
                  class="p-4 rounded-2xl bg-slate-50 border border-slate-100 transition-all hover:bg-white hover:shadow-sm"
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
                  <p class="mt-1 font-black text-slate-900 truncate">
                    {book.category.name}
                  </p>
                </div>
              {/if}

              {#if book.courseCode}
                <div
                  class="p-4 rounded-2xl bg-slate-50 border border-slate-100 transition-all hover:bg-white hover:shadow-sm"
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

              <div
                class="p-4 rounded-2xl bg-slate-50 border border-slate-100 transition-all hover:bg-white hover:shadow-sm"
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
                      d="M5 13l4 4L19 7"
                    /></svg
                  >
                  Availability
                </span>
                <p
                  class="mt-1 font-black {book.status === 'available'
                    ? 'text-emerald-600'
                    : 'text-rose-600'}"
                >
                  {#if book.status === "available"}Available{:else if book.status === "sold"}Sold
                    Out{:else}{book.status}{/if}
                </p>
              </div>
            </div>

            {#if book.isOwner && Array.isArray(purchaseRequestQuery.data) && purchaseRequestQuery.data.length > 0}
              <div class="mt-8 pt-8 border-t border-slate-100">
                <div class="flex items-center justify-between mb-6">
                  <h2 class="text-xl font-black text-gray-900">
                    Purchase Requests
                  </h2>
                  <span
                    class="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold border border-indigo-100"
                  >
                    {purchaseRequestQuery.data.filter(
                      (r) => r.status === "requested",
                    ).length} Pending
                  </span>
                </div>

                <div class="space-y-4">
                  {#each purchaseRequestQuery.data as request}
                    <div
                      class="p-5 rounded-2xl border {request.status ===
                      'requested'
                        ? 'border-indigo-100 bg-indigo-50/30'
                        : 'border-slate-100 bg-slate-50/30'} flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-white hover:shadow-md"
                    >
                      <div class="flex items-center gap-4">
                        <div class="relative">
                          {#if request.buyer?.image}
                            <img
                              src={request.buyer.image}
                              alt=""
                              class="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                            />
                          {:else}
                            <div
                              class="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-black text-indigo-600 border-2 border-white shadow-sm"
                            >
                              {request.buyer?.name?.charAt(0) || "U"}
                            </div>
                          {/if}
                          <div
                            class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-sm"
                          >
                            <div
                              class="w-3 h-3 rounded-full {request.status ===
                              'requested'
                                ? 'bg-amber-400 animate-pulse'
                                : request.status === 'accepted'
                                  ? 'bg-emerald-500'
                                  : 'bg-rose-500'}"
                            ></div>
                          </div>
                        </div>
                        <div>
                          <p class="font-bold text-gray-900">
                            {request.buyer?.name}
                          </p>
                          <p class="text-xs text-gray-500 font-medium">
                            {formatDate(request.createdAt)}
                          </p>
                          {#if request.message}
                            <p
                              class="mt-1 text-sm text-gray-600 italic line-clamp-1"
                            >
                              "{request.message}"
                            </p>
                          {/if}
                        </div>
                      </div>

                      <div class="flex items-center gap-2">
                        {#if request.status === "requested"}
                          <button
                            onclick={() =>
                              handleRespondToRequest(request.id, true)}
                            disabled={respondingToRequest === request.id}
                            class="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                          >
                            {respondingToRequest === request.id
                              ? "..."
                              : "Accept"}
                          </button>
                          <button
                            onclick={() =>
                              handleRespondToRequest(request.id, false)}
                            disabled={respondingToRequest === request.id}
                            class="px-4 py-2 rounded-xl bg-white border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-50 transition-all active:scale-95 disabled:opacity-50"
                          >
                            Decline
                          </button>
                        {:else}
                          <span
                            class="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border {request.status ===
                            'accepted'
                              ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                              : request.status === 'completed'
                                ? 'bg-blue-50 border-blue-100 text-blue-600'
                                : 'bg-rose-50 border-rose-100 text-rose-600'}"
                          >
                            {request.status}
                          </span>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Description -->
            {#if book.description}
              <div
                class="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-100"
              >
                <h2
                  class="flex items-center gap-2 text-sm font-bold text-gray-700"
                >
                  <svg
                    class="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    ><path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    /></svg
                  >
                  Description
                </h2>
                <p class="mt-2 text-sm text-gray-600 whitespace-pre-line">
                  {book.description}
                </p>
              </div>
            {/if}

            <!-- BUYER-SIDE ACTIONS -->
            {#if !book.isOwner && $session.data?.user}
              {@const reqStatus = buyerPurchaseRequest?.status}

              {#if !buyerPurchaseRequest}
                <div bind:this={ctaRef}>
                  <button
                    onclick={() => (requestToBuyModalOpen = true)}
                    class="mt-6 w-full py-3.5 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-indigo-200"
                    style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);"
                    disabled={book.status !== "available"}
                  >
                    <svg
                      class="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
                      /></svg
                    >
                    Request to Buy
                  </button>
                </div>
                <div class="mt-3 grid grid-cols-2 gap-3">
                  <button
                    onclick={handleSaveToggle}
                    disabled={saving}
                    class="py-2.5 rounded-xl border text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 {savedState
                      ? 'border-rose-200 bg-rose-50 text-rose-600'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
                  >
                    <svg
                      class="w-4 h-4"
                      fill={savedState ? "currentColor" : "none"}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      /></svg
                    >
                    {saving ? "Saving..." : savedState ? "Saved" : "Save"}
                  </button>
                  <button
                    onclick={handleShare}
                    class="py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                      /></svg
                    >
                    Share
                  </button>
                </div>
                <div
                  class="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-100"
                >
                  <p
                    class="flex items-center gap-2 text-sm font-bold text-blue-700"
                  >
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      /></svg
                    >
                    How it works
                  </p>
                  <p class="mt-1 text-sm text-blue-600">
                    Send a request to the seller. If accepted, you can message
                    them to arrange payment and pickup.
                  </p>
                </div>
              {:else if reqStatus === "requested"}
                <div
                  class="mt-6 p-5 rounded-xl border-2 border-amber-100 bg-amber-50/50"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex items-center gap-3">
                      <div
                        class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center"
                      >
                        <svg
                          class="w-5 h-5 text-amber-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          ><path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          /></svg
                        >
                      </div>
                      <div>
                        <h3 class="font-bold text-gray-900">Request Sent</h3>
                        <p class="text-sm text-gray-500">
                          Waiting for seller's response
                        </p>
                      </div>
                    </div>
                    <span
                      class="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200"
                      >● Pending</span
                    >
                  </div>
                  <p class="mt-4 text-sm text-gray-500">
                    Sellers usually respond within 2-4 hours. You'll be notified
                    when they accept or decline.
                  </p>
                </div>
                <button
                  bind:this={ctaRef}
                  onclick={handleCancelRequest}
                  disabled={cancellingRequest}
                  class="mt-3 w-full py-3 rounded-xl border-2 border-rose-200 text-rose-600 font-bold text-sm hover:bg-rose-50 transition-colors disabled:opacity-50"
                  >{cancellingRequest
                    ? "Cancelling..."
                    : "Cancel Request"}</button
                >
                <div class="mt-3 grid grid-cols-2 gap-3">
                  <button
                    onclick={handleSaveToggle}
                    disabled={saving}
                    class="py-2.5 rounded-xl border text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 {savedState
                      ? 'border-rose-200 bg-rose-50 text-rose-600'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
                    ><svg
                      class="w-4 h-4"
                      fill={savedState ? "currentColor" : "none"}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      /></svg
                    >{saving
                      ? "Saving..."
                      : savedState
                        ? "Saved"
                        : "Save"}</button
                  >
                  <button
                    onclick={handleShare}
                    class="py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                    ><svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                      /></svg
                    >Share</button
                  >
                </div>
              {:else if reqStatus === "accepted"}
                <div
                  id="contact-info-block"
                  class="mt-6 p-6 rounded-4xl border border-emerald-100 bg-emerald-50/30 space-y-6"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-4">
                      <div
                        class="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200 shadow-sm"
                      >
                        <svg
                          class="w-6 h-6 text-emerald-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2.5"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 class="text-xl font-black text-gray-900">
                          {book.status === "sold"
                            ? "Transaction Completed! 🎉"
                            : "Request Accepted! 🎉"}
                        </h3>
                        <p class="text-sm text-gray-600 font-medium">
                          {book.status === "sold"
                            ? `You purchased this book from ${book.seller?.name || "the seller"}.`
                            : `${book.seller?.name || "The seller"} has accepted your request.`}
                        </p>
                      </div>
                    </div>
                    <span
                      class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider border border-emerald-200"
                    >
                      Active
                    </span>
                  </div>

                  <!-- Contact Seller Card -->
                  {#if hasSellerContactInfo}
                    <div
                      class="bg-white rounded-3xl p-5 border border-emerald-100 shadow-sm space-y-4"
                    >
                      <div
                        class="flex items-center gap-3 pb-2 border-b border-slate-50"
                      >
                        <div
                          class="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center"
                        >
                          <svg
                            class="w-5 h-5 text-indigo-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                            />
                          </svg>
                        </div>
                        <div>
                          <h4 class="text-sm font-bold text-gray-900">
                            Contact Seller
                          </h4>
                          <p class="text-[10px] text-gray-400 font-medium">
                            Choose your preferred method
                          </p>
                        </div>
                      </div>

                      <div class="grid gap-2.5">
                        {#if sellerContactQuery.data}
                          {@const c = sellerContactQuery.data}

                          {#if c.telegramUsername}
                            <a
                              href="https://t.me/{c.telegramUsername}"
                              target="_blank"
                              class="group flex items-center justify-between p-3 rounded-2xl bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100/50 transition-all active:scale-[0.98]"
                            >
                              <div class="flex items-center gap-3">
                                <div
                                  class="w-10 h-10 rounded-xl bg-blue-500 shadow-lg shadow-blue-200 flex items-center justify-center text-white"
                                >
                                  <svg
                                    class="w-6 h-6"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                    ><path
                                      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.53-1.39.52-.45-.01-1.33-.26-1.98-.47-.8-.26-1.42-.4-1.37-.85.03-.23.35-.47.97-.73 3.79-1.65 6.32-2.73 7.57-3.25 3.62-1.48 4.37-1.74 4.86-1.75.11 0 .35.03.5.16.13.13.17.3.18.43z"
                                    /></svg
                                  >
                                </div>
                                <div>
                                  <p
                                    class="text-[13px] font-black text-gray-900"
                                  >
                                    Telegram
                                  </p>
                                  <p class="text-[11px] text-gray-500">
                                    @{c.telegramUsername}
                                  </p>
                                </div>
                              </div>
                              <svg
                                class="w-4 h-4 text-indigo-300 group-hover:text-indigo-500 transition-colors"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                ><path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2.5"
                                  d="M9 5l7 7-7 7"
                                /></svg
                              >
                            </a>
                          {/if}

                          {#if c.whatsapp}
                            <a
                              href="https://wa.me/{c.whatsapp.replace(
                                /[^0-9]/g,
                                '',
                              )}"
                              target="_blank"
                              class="group flex items-center justify-between p-3 rounded-2xl bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-100/50 transition-all active:scale-[0.98]"
                            >
                              <div class="flex items-center gap-3">
                                <div
                                  class="w-10 h-10 rounded-xl bg-emerald-500 shadow-lg shadow-emerald-200 flex items-center justify-center text-white"
                                >
                                  <svg
                                    class="w-6 h-6"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                    ><path
                                      d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zM6.07 17.1l-.33-.52c-.76-1.21-1.16-2.61-1.16-4.05 0-4.32 3.51-7.84 7.84-7.84 2.09 0 4.07.81 5.55 2.29a7.71 7.71 0 012.29 5.55c0 4.32-3.51 7.84-7.84 7.84-1.39 0-2.75-.37-3.95-1.07l-.42-.24-2.93.77.77-2.86zM15.22 13c-.18-.09-1.09-.54-1.26-.6-.17-.06-.29-.09-.41.09s-.47.6-.58.72c-.11.12-.22.13-.4.04-.18-.09-.77-.28-1.46-.9-.54-.48-.9-.67-.3-.67s.17-.04.26-.13c.09-.09.04-.18-.01-.27-.05-.09-.41-1-.56-1.37-.15-.35-.29-.3-.41-.31h-.35c-.12 0-.32.04-.49.22-.17.18-.64.63-.64 1.53s.66 1.77.75 1.89c.09.12 1.29 1.97 3.13 2.76.44.19.78.3 1.05.39.44.14.84.12 1.15.07.35-.05 1.09-.45 1.24-.88s.15-.79.1-.88c-.05-.08-.18-.12-.36-.21z"
                                    /></svg
                                  >
                                </div>
                                <div>
                                  <p
                                    class="text-[13px] font-black text-gray-900"
                                  >
                                    WhatsApp
                                  </p>
                                  <p class="text-[11px] text-gray-500">
                                    {c.whatsapp}
                                  </p>
                                </div>
                              </div>
                              <svg
                                class="w-4 h-4 text-emerald-300 group-hover:text-emerald-500 transition-colors"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                ><path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2.5"
                                  d="M9 5l7 7-7 7"
                                /></svg
                              >
                            </a>
                          {/if}

                          {#if c.facebookMessenger}
                            <a
                              href="https://m.me/{c.facebookMessenger}"
                              target="_blank"
                              class="group flex items-center justify-between p-3 rounded-2xl bg-purple-50/50 hover:bg-purple-50 border border-purple-100/50 transition-all active:scale-[0.98]"
                            >
                              <div class="flex items-center gap-3">
                                <div
                                  class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-200 flex items-center justify-center text-white"
                                >
                                  <svg
                                    class="w-6 h-6"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                    ><path
                                      d="M12 2C6.48 2 2 6.134 2 11.235c0 2.908 1.387 5.503 3.546 7.222.186.148.293.377.293.62v1.921c0 .487.525.8.966.577l2.148-1.085a.837.837 0 01.374-.089c.218 0 .43.04.63.111C10.634 20.846 11.31 21 12 21c5.523 0 10-4.134 10-9.235S17.523 2 12 2zm.8 11.727l-2.03-2.162-3.954 2.162 4.349-4.615 2.03 2.162 3.954-2.162-4.349 4.615z"
                                    /></svg
                                  >
                                </div>
                                <div>
                                  <p
                                    class="text-[13px] font-black text-gray-900"
                                  >
                                    Messenger
                                  </p>
                                  <p class="text-[11px] text-gray-500">
                                    {c.facebookMessenger}
                                  </p>
                                </div>
                              </div>
                              <svg
                                class="w-4 h-4 text-purple-300 group-hover:text-purple-500 transition-colors"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                ><path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2.5"
                                  d="M9 5l7 7-7 7"
                                /></svg
                              >
                            </a>
                          {/if}

                          {#if c.email}
                            <a
                              href="mailto:{c.email}"
                              class="group flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 hover:bg-slate-50 border border-slate-100 transition-all active:scale-[0.98]"
                            >
                              <div class="flex items-center gap-3">
                                <div
                                  class="w-10 h-10 rounded-xl bg-slate-700 shadow-lg shadow-slate-200 flex items-center justify-center text-white"
                                >
                                  <svg
                                    class="w-6 h-6"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    ><path
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                      stroke-width="2"
                                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                    /></svg
                                  >
                                </div>
                                <div>
                                  <p
                                    class="text-[13px] font-black text-gray-900"
                                  >
                                    Email
                                  </p>
                                  <p
                                    class="text-[11px] text-gray-500 truncate max-w-[180px]"
                                  >
                                    {c.email}
                                  </p>
                                </div>
                              </div>
                              <svg
                                class="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                ><path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2.5"
                                  d="M9 5l7 7-7 7"
                                /></svg
                              >
                            </a>
                          {/if}

                          {#if c.phoneNumber}
                            <a
                              href="tel:{c.phoneNumber}"
                              class="group flex items-center justify-between p-3 rounded-2xl bg-blue-50/50 hover:bg-blue-50 border border-blue-100 transition-all active:scale-[0.98]"
                            >
                              <div class="flex items-center gap-3">
                                <div
                                  class="w-10 h-10 rounded-xl bg-blue-600 shadow-lg shadow-blue-200 flex items-center justify-center text-white"
                                >
                                  <svg
                                    class="w-6 h-6"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    ><path
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                      stroke-width="2"
                                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                    /></svg
                                  >
                                </div>
                                <div>
                                  <p
                                    class="text-[13px] font-black text-gray-900"
                                  >
                                    Phone Call
                                  </p>
                                  <p class="text-[11px] text-gray-500">
                                    {c.phoneNumber}
                                  </p>
                                </div>
                              </div>
                              <svg
                                class="w-4 h-4 text-blue-300 group-hover:text-blue-500 transition-colors"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                ><path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2.5"
                                  d="M9 5l7 7-7 7"
                                /></svg
                              >
                            </a>
                          {/if}
                        {:else if sellerContactQuery.isLoading}
                          <div
                            class="py-10 flex flex-col items-center justify-center gap-3"
                          >
                            <LoadingSpinner size="sm" />
                            <p
                              class="text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                            >
                              Fetching contact info...
                            </p>
                          </div>
                        {/if}
                      </div>

                      <button
                        onclick={copyAllContactInfo}
                        class="w-full mt-2 py-3 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs transition-all flex items-center justify-center gap-2 border border-slate-100"
                      >
                        <svg
                          class="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          ><path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                          /></svg
                        >
                        Copy All Contact Info
                      </button>
                    </div>
                  {/if}

                  <div class="flex flex-col gap-4">
                    <div
                      class="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm"
                    >
                      <h4 class="text-sm font-bold text-gray-900 mb-3">
                        Next Steps:
                      </h4>
                      <div class="space-y-3">
                        <div class="flex items-center gap-3">
                          <span
                            class="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 text-[13px] font-black flex items-center justify-center border border-blue-100"
                            >1</span
                          >
                          <p class="text-[13px] text-gray-600 font-medium">
                            Contact seller using any method above to arrange
                            meetup
                          </p>
                        </div>
                        <div class="flex items-center gap-3">
                          <span
                            class="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 text-[13px] font-black flex items-center justify-center border border-blue-100"
                            >2</span
                          >
                          <p class="text-[13px] text-gray-600 font-medium">
                            Inspect the book before payment
                          </p>
                        </div>
                        <div class="flex items-center gap-3">
                          <span
                            class="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 text-[13px] font-black flex items-center justify-center border border-blue-100"
                            >3</span
                          >
                          <p class="text-[13px] text-gray-600 font-medium">
                            Mark as complete and rate your experience
                          </p>
                        </div>
                      </div>
                    </div>

                    <div
                      class="bg-amber-50/50 rounded-3xl p-5 border border-amber-200"
                    >
                      <div class="flex items-center gap-2 mb-2">
                        <svg
                          class="w-4 h-4 text-amber-600"
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
                        <h4
                          class="text-sm font-bold text-amber-900 uppercase tracking-widest"
                        >
                          Safety Tips
                        </h4>
                      </div>
                      <ul class="space-y-1.5 list-disc pl-4">
                        <li class="text-xs text-amber-800 font-medium">
                          Meet in safe, public places (campus library,
                          cafeteria)
                        </li>
                        <li class="text-xs text-amber-800 font-medium">
                          Inspect the book thoroughly before paying
                        </li>
                        <li class="text-xs text-amber-800 font-medium">
                          Never share financial information via messaging apps
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {#if book.status === "sold"}
                  <button
                    bind:this={ctaRef}
                    onclick={() => (rateModalOpen = true)}
                    class="mt-3 w-full py-3.5 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-indigo-200"
                    style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);"
                  >
                    <svg
                      class="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                      /></svg
                    >
                    Rate Your Experience
                  </button>
                  <div class="mt-3 flex gap-3">
                    <a
                      href="/messages?listing={book.id}"
                      class="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm bg-white hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        ><path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        /></svg
                      >
                      Message Seller
                    </a>
                    <button
                      onclick={() => (reportModalOpen = true)}
                      class="flex-1 py-3 rounded-xl border border-rose-100 text-rose-600 font-bold text-sm bg-rose-50/30 hover:bg-rose-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        ><path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        /></svg
                      >
                      Report Issue
                    </button>
                  </div>
                {:else}
                  <a
                    bind:this={ctaRef}
                    href="/messages?listing={book.id}"
                    class="mt-3 w-full py-3.5 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-indigo-200"
                    style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);"
                  >
                    <svg
                      class="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      /></svg
                    >
                    Message Seller
                  </a>
                {/if}
              {:else if reqStatus === "completed"}
                <div
                  class="mt-6 p-5 rounded-xl border-2 border-emerald-100 bg-emerald-50/50"
                >
                  <div class="flex items-center gap-3">
                    <div
                      class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center"
                    >
                      <svg
                        class="w-6 h-6 text-emerald-600"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        ><path
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        /></svg
                      >
                    </div>
                    <div>
                      <h3 class="font-bold text-gray-900">
                        Transaction Completed! 🎉
                      </h3>
                      <p class="text-sm text-gray-500">
                        You purchased this book on {formatDate(
                          new Date().toISOString(),
                        )}
                      </p>
                    </div>
                  </div>
                  <div class="mt-3">
                    <p class="text-sm font-bold text-gray-900">
                      How was your experience?
                    </p>
                    <p class="text-xs text-emerald-600 mt-0.5">
                      Your review helps other students make informed decisions
                    </p>
                  </div>
                </div>
                <button
                  bind:this={ctaRef}
                  onclick={() => (rateModalOpen = true)}
                  class="mt-3 w-full py-3.5 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-indigo-200"
                  style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);"
                >
                  <svg
                    class="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    ><path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                    /></svg
                  >
                  Rate Your Experience
                </button>
                <div class="mt-2 grid grid-cols-2 gap-3">
                  <a
                    href="/messages?listing={book.id}"
                    class="py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                    ><svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      /></svg
                    >Message Seller</a
                  >
                  <button
                    onclick={() => (reportModalOpen = true)}
                    class="py-2.5 rounded-xl border border-rose-200 text-rose-600 text-sm font-semibold hover:bg-rose-50 transition-colors flex items-center justify-center gap-2"
                    ><svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      /></svg
                    >Report Issue</button
                  >
                </div>
              {:else if reqStatus === "rejected"}
                <div
                  bind:this={ctaRef}
                  class="mt-6 p-5 rounded-xl border-2 border-rose-100 bg-rose-50/50"
                >
                  <div class="flex items-center gap-3">
                    <div
                      class="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center"
                    >
                      <svg
                        class="w-5 h-5 text-rose-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        ><path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M6 18L18 6M6 6l12 12"
                        /></svg
                      >
                    </div>
                    <div>
                      <h3 class="font-bold text-gray-900">Request Declined</h3>
                      <p class="text-sm text-gray-500">
                        The seller has declined your request.
                      </p>
                    </div>
                  </div>
                </div>
                <a
                  href="/books"
                  use:routeAction
                  class="mt-3 w-full py-3.5 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-indigo-200"
                  style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);"
                  >Browse Similar Books</a
                >
              {/if}
            {:else if book.isOwner}
              <div class="mt-5 flex flex-wrap gap-2.5">
                {#if book.status === "available"}
                  <a
                    href="/books/sell?edit={book.id}"
                    use:routeAction
                    class="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
                    >Edit Listing</a
                  >
                  <button
                    onclick={handleMarkSold}
                    disabled={markingSold}
                    class="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >{markingSold ? "Marking..." : "Mark as Sold"}</button
                  >
                {/if}
                <button
                  onclick={handleDelete}
                  disabled={deleting}
                  class="px-4 py-2 rounded-xl border border-rose-200 text-rose-700 text-sm font-semibold hover:bg-rose-50 transition-colors disabled:opacity-50"
                  >{deleting ? "Deleting..." : "Delete"}</button
                >
              </div>
            {:else if !$session.data?.user && book.status === "available"}
              <a
                href="/register"
                use:routeAction
                class="mt-6 w-full inline-block text-center py-3.5 rounded-xl text-white font-bold text-base transition-all"
                style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);"
                >Sign in to interact</a
              >
            {/if}

            <div class="mt-5 text-xs text-gray-400 flex items-center gap-2">
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
      class="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200"
      transition:fly={{ y: 20, duration: 400 }}
    >
      <div class="px-8 pt-8 pb-10">
        <div class="flex items-center justify-between mb-8">
          <h3 class="text-2xl font-black text-[#1e293b] tracking-tight">
            Rate Your Experience
          </h3>
          <button
            onclick={() => (rateModalOpen = false)}
            class="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <svg
              class="w-6 h-6 text-slate-400"
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

        <div class="mb-8">
          <p class="text-[#64748b] text-base font-medium mb-6">
            How was your experience with {bookQuery.data.seller?.name}?
          </p>

          <div class="flex justify-center gap-3 mb-8">
            {#each Array(5) as _, i}
              {@const starVal = i + 1}
              <!-- svelte-ignore a11y_consider_explicit_label -->
              <button
                onclick={() => (ratingValue = starVal)}
                class="transition-transform hover:scale-110 active:scale-95"
              >
                <svg
                  class="w-10 h-10 {starVal <= ratingValue
                    ? 'text-amber-400 fill-current'
                    : 'text-slate-200 fill-current'}"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  />
                </svg>
              </button>
            {/each}
          </div>

          <div class="mb-6">
            <label class="block text-sm font-bold text-[#1e293b] mb-3">
              Share your experience (optional)
            </label>
            <textarea
              bind:value={ratingReview}
              rows="4"
              placeholder="Tell others about your experience with this seller..."
              class="w-full px-5 py-4 rounded-2xl bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-medium resize-none placeholder:text-slate-400"
            ></textarea>
            <p class="mt-2 text-xs text-slate-400">
              Your review will help other buyers make informed decisions
            </p>
          </div>

          <div class="mt-8">
            <label class="block text-sm font-bold text-[#1e293b] mb-4">
              What stood out? (optional)
            </label>
            <div class="flex flex-wrap gap-2.5">
              {#each availableRatingTags as tag}
                <button
                  onclick={() => toggleRatingTag(tag)}
                  class="px-5 py-2.5 rounded-full text-xs font-bold border transition-all {ratingTags.includes(
                    tag,
                  )
                    ? 'bg-white border-indigo-600 text-indigo-600'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}"
                >
                  {tag}
                </button>
              {/each}
            </div>
          </div>
        </div>

        <div class="flex gap-4">
          <button
            onclick={() => (rateModalOpen = false)}
            class="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-bold text-sm rounded-2xl hover:bg-slate-50 transition-all active:scale-95"
          >
            Cancel
          </button>
          <button
            onclick={async () => {
              await handleRateSeller(bookQuery.data!);
              if (!trustError) rateModalOpen = false;
            }}
            disabled={ratingSubmitting}
            class="flex-1 py-4 bg-indigo-600 text-white font-bold text-sm rounded-2xl hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95"
            style="background: #6366f1;"
          >
            {ratingSubmitting ? "Submitting..." : "Submit Review"}
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

{#if profileModalOpen && book?.seller}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    transition:fade={{ duration: 200 }}
  >
    <div
      class="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
      onclick={() => (profileModalOpen = false)}
      role="button"
      tabindex="-1"
    ></div>
    <div
      class="relative w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl"
      in:fly={{ y: 20, duration: 400 }}
    >
      <!-- Header -->
      <div
        class="relative h-32 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500"
      >
        <button
          onclick={() => (profileModalOpen = false)}
          class="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            /></svg
          >
        </button>
      </div>

      <!-- Content -->
      <div class="relative px-6 pb-8">
        <!-- Avatar -->
        <div class="absolute -top-12 left-6">
          <div class="p-1.5 bg-white rounded-full shadow-xl">
            {#if book?.seller?.image}
              <img
                src={book.seller.image}
                alt=""
                class="w-24 h-24 rounded-full object-cover"
              />
            {:else}
              <div
                class="w-24 h-24 rounded-full bg-indigo-100 text-indigo-700 text-3xl font-black flex items-center justify-center"
              >
                {book?.seller?.name?.charAt(0) || "U"}
              </div>
            {/if}
          </div>
        </div>

        <div
          class="pt-16 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h2 class="text-2xl font-black text-gray-900">
              {book?.seller?.name || "Anonymous"}
            </h2>
            <p class="text-sm text-gray-500">{book?.seller?.email || ""}</p>
            <div class="mt-2 flex flex-wrap gap-2">
              {#if book?.seller?.isVerifiedSeller}
                <span
                  class="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold border border-blue-100 uppercase tracking-wider"
                  >Verified Seller</span
                >
              {/if}
              <span
                class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200 uppercase tracking-wider"
                >Active Member</span
              >
            </div>
          </div>
        </div>

        <!-- Stats -->
        <div class="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            class="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center"
          >
            <p
              class="text-xs font-bold text-gray-400 uppercase tracking-widest"
            >
              Listed
            </p>
            <p class="mt-1 text-xl font-black text-gray-900">
              {sellerListingsQuery.data?.totalCount || 0}
            </p>
          </div>
          <div
            class="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center"
          >
            <p
              class="text-xs font-bold text-gray-400 uppercase tracking-widest"
            >
              Sold
            </p>
            <p class="mt-1 text-xl font-black text-emerald-600">
              {sellerReputationQuery.data?.soldCount || 0}
            </p>
          </div>
          <div
            class="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center"
          >
            <p
              class="text-xs font-bold text-gray-400 uppercase tracking-widest"
            >
              Rating
            </p>
            <div class="mt-1 flex items-center justify-center gap-1">
              <span class="text-xl font-black text-amber-500"
                >{sellerReputationQuery.data?.averageRating?.toFixed(1) ||
                  "0.0"}</span
              >
              <svg
                class="w-4 h-4 text-amber-500 fill-current"
                viewBox="0 0 20 20"
                ><path
                  d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                /></svg
              >
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="mt-8">
          <div class="flex border-b border-slate-100 px-2">
            {#each ["listings", "reviews"] as tab}
              <button
                onclick={() => (profileTab = tab as any)}
                class="px-6 py-3 text-sm font-bold capitalize transition-all relative {profileTab ===
                tab
                  ? 'text-indigo-600'
                  : 'text-gray-400 hover:text-gray-600'}"
              >
                {tab}
                {#if profileTab === tab}
                  <div
                    class="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full"
                    in:fade
                  ></div>
                {/if}
              </button>
            {/each}
          </div>

          <div class="mt-6">
            {#if profileTab === "listings"}
              {#if sellerListingsQuery.data?.listings && sellerListingsQuery.data.listings.length > 0}
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {#each sellerListingsQuery.data.listings as item}
                    <a
                      href="/books/{item.id}"
                      class="group bg-slate-50/50 p-3 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all"
                    >
                      <div class="flex gap-3">
                        <div
                          class="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0"
                        >
                          {#if item.images?.[0]}
                            <img
                              src={item.images[0].imageUrl}
                              alt={item.title}
                              class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          {:else}
                            <div
                              class="w-full h-full flex items-center justify-center text-slate-300"
                            >
                              <svg
                                class="w-8 h-8"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                ><path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="1.5"
                                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                /></svg
                              >
                            </div>
                          {/if}
                        </div>
                        <div class="min-w-0 flex flex-col justify-center">
                          <p class="text-sm font-bold text-gray-900 truncate">
                            {item.title}
                          </p>
                          <p class="text-[10px] text-gray-500 truncate">
                            {item.author}
                          </p>
                          <div class="mt-1 flex items-center gap-2">
                            <span class="text-xs font-black text-indigo-600"
                              >Rs. {parseFloat(
                                item.price || "0",
                              ).toLocaleString()}</span
                            >
                            <span
                              class="text-[9px] px-1.5 py-0.5 rounded-full bg-white border border-slate-100 text-slate-500 font-bold uppercase tracking-tighter"
                              >{item.status}</span
                            >
                          </div>
                        </div>
                      </div>
                    </a>
                  {/each}
                </div>
              {:else}
                <div class="text-center py-12">
                  <p class="text-sm text-gray-500">No other listings found</p>
                </div>
              {/if}
            {:else if profileTab === "reviews"}
              {#if sellerReputationQuery.data?.recentRatings && sellerReputationQuery.data.recentRatings.length > 0}
                <div class="space-y-4">
                  {#each sellerReputationQuery.data.recentRatings as review}
                    <div
                      class="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 hover:bg-white transition-colors"
                    >
                      <div class="flex items-start justify-between gap-4">
                        <div class="flex items-center gap-3">
                          {#if review.rater?.image}
                            <img
                              src={review.rater.image}
                              alt=""
                              class="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                            />
                          {:else}
                            <div
                              class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs border-2 border-white shadow-sm"
                            >
                              {review.rater?.name?.charAt(0) || "U"}
                            </div>
                          {/if}
                          <div>
                            <p class="text-sm font-bold text-gray-900">
                              {review.rater?.name || "Anonymous"}
                            </p>
                            <p class="text-[10px] text-gray-400 font-medium">
                              {new Date(review.createdAt).toLocaleDateString(
                                undefined,
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                },
                              )}
                            </p>
                          </div>
                        </div>
                        <div
                          class="flex items-center gap-1 px-2 py-1 bg-amber-50 rounded-lg border border-amber-100"
                        >
                          <span class="text-xs font-black text-amber-600"
                            >{review.rating}</span
                          >
                          <svg
                            class="w-3 h-3 text-amber-500 fill-current"
                            viewBox="0 0 20 20"
                            ><path
                              d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                            /></svg
                          >
                        </div>
                      </div>
                      {#if review.review}
                        <div class="mt-3 pl-13">
                          <p
                            class="text-sm text-gray-600 leading-relaxed italic"
                          >
                            "{review.review}"
                          </p>
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {:else}
                <div class="text-center py-12 px-4">
                  <div
                    class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4"
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
                        d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      /></svg
                    >
                  </div>
                  <p class="text-sm font-bold text-gray-900">No reviews yet</p>
                  <p class="text-xs text-gray-400 mt-1 max-w-[200px] mx-auto">
                    Be the first to rate this seller after a successful
                    transaction!
                  </p>
                </div>
              {/if}
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if showStickyBar && bookQuery.data}
  <div
    class="fixed bottom-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-t border-slate-200 p-4 shadow-2xl transition-all duration-500 transform {showStickyBar
      ? 'translate-y-0'
      : 'translate-y-full'}"
    transition:fly={{ y: 100, duration: 500 }}
  >
    <div class="max-w-7xl mx-auto flex items-center justify-between gap-4">
      <div class="flex items-center gap-3 min-w-0">
        {#if book?.images?.[0]}
          <img
            src={book?.images[0].imageUrl}
            alt=""
            class="w-12 h-12 rounded-lg object-cover border border-slate-100"
          />
        {/if}
        <div class="min-w-0">
          <p class="text-sm font-bold text-gray-900 truncate">{book?.title}</p>
          <div class="flex items-center gap-2">
            <span class="text-emerald-600 font-bold text-sm"
              >Rs. {parseFloat(book?.price || "0").toLocaleString()}</span
            >
            <span
              class="px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-tight"
              >{book?.status}</span
            >
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        {#if !book?.isOwner && $session.data?.user}
          {@const reqStatus = buyerPurchaseRequest?.status}
          {#if !purchaseRequestQuery.data}
            <button
              onclick={() => (requestToBuyModalOpen = true)}
              class="px-6 py-2.5 rounded-xl text-white text-sm font-bold shadow-lg shadow-indigo-100 whitespace-nowrap"
              style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);"
            >
              Request to Buy
            </button>
          {:else if reqStatus === "requested"}
            <button
              onclick={handleCancelRequest}
              class="px-6 py-2.5 rounded-xl border border-rose-200 text-rose-600 text-sm font-bold"
              >Cancel</button
            >
          {:else if reqStatus === "accepted"}
            <div
              class="px-2.5 py-1.5 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-black uppercase tracking-wider border border-emerald-100 flex items-center gap-1.5"
            >
              <svg
                class="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="3"
                  d="M5 13l4 4L19 7"
                /></svg
              >
              Accepted
            </div>
            {#if hasSellerContactInfo}
              <button
                onclick={() => {
                  const el = document.getElementById("contact-info-block");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                class="px-5 py-2.5 rounded-xl text-white text-sm font-black flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-indigo-100"
                style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);"
              >
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  /></svg
                >
                View Contact Info
              </button>
            {:else}
              <a
                href="/messages?listing={book?.id}"
                class="px-6 py-2.5 rounded-xl text-white text-sm font-black flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-indigo-100"
                style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);"
              >
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  /></svg
                >
                Message
              </a>
            {/if}
          {:else if reqStatus === "completed"}
            <button
              onclick={() => (rateModalOpen = true)}
              class="px-6 py-2.5 rounded-xl text-white text-sm font-bold"
              style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);"
              >Rate</button
            >
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}

{#if trustFeedback}
  <div
    class="fixed {showStickyBar
      ? 'bottom-24 sm:bottom-28'
      : 'bottom-6 sm:bottom-8'} left-1/2 -translate-x-1/2 z-[60] px-5 py-3.5 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/10 text-white font-semibold text-[13px] shadow-2xl flex items-center gap-3.5 transition-all duration-500 w-[92%] max-w-sm sm:w-auto"
    transition:fly={{ y: 32, duration: 600, easing: quintOut }}
  >
    <div
      class="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20"
    >
      <svg
        class="w-5 h-5 text-emerald-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2.5"
          d="M5 13l4 4L19 7"
        />
      </svg>
    </div>
    <span class="flex-1 opacity-90">{trustFeedback}</span>
    <button
      onclick={() => (trustFeedback = null)}
      class="p-2 hover:bg-white/10 rounded-xl transition-all active:scale-90"
      aria-label="Close"
    >
      <svg
        class="w-4 h-4 text-white/40"
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
{/if}

{#if trustError}
  <div
    class="fixed {showStickyBar
      ? 'bottom-24 sm:bottom-28'
      : 'bottom-6 sm:bottom-8'} left-1/2 -translate-x-1/2 z-[60] px-5 py-3.5 rounded-2xl bg-white/95 backdrop-blur-xl border border-rose-100 text-rose-600 font-semibold text-[13px] shadow-2xl flex items-center gap-3.5 transition-all duration-500 w-[92%] max-w-sm sm:w-auto"
    transition:fly={{ y: 32, duration: 600, easing: quintOut }}
  >
    <div
      class="flex-shrink-0 w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center border border-rose-100"
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
          d="M12 8v4m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    </div>
    <span class="flex-1">{trustError}</span>
    <button
      onclick={() => (trustError = null)}
      class="p-2 hover:bg-rose-50 rounded-xl transition-all active:scale-90"
      aria-label="Close"
    >
      <svg
        class="w-4 h-4 text-rose-300"
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
{/if}
