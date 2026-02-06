<script lang="ts">
    import { onMount, untrack } from "svelte";
    import { route as routeAction, goto } from "@mateothegreat/svelte5-router";
    import {
        getBookListingById,
        saveBook,
        unsaveBook,
        deleteBookListing,
        markBookAsSold,
        createPurchaseRequest,
        getPurchaseRequestStatus,
        getSellerContactInfo,
        getListingPurchaseRequests,
        respondToPurchaseRequest,
        cancelPurchaseRequest,
        deletePurchaseRequest,
        getSellerReputation,
        rateSeller,
        blockMarketplaceUser,
        unblockMarketplaceUser,
        getBlockedMarketplaceUsers,
        createMarketplaceReport,
        type BookListing,
        type PurchaseRequest,
        type SellerContactInfo,
        type MarketplaceReport,
    } from "../lib/api";
    import LoadingSpinner from "../components/LoadingSpinner.svelte";
    import { fade, fly, slide } from "svelte/transition";
    import { authClient } from "../lib/auth-client";
    import { createQuery, useQueryClient } from "@tanstack/svelte-query";

    const { route } = $props();
    const bookId = $derived(parseInt(route.result.path.params.bookId) || 0);

    const session = authClient.useSession();

    onMount(() => {
        window.scrollTo(0, 0);
    });
    const queryClient = useQueryClient();

    let savingBook = $state(false);
    let deletingBook = $state(false);
    let markingSold = $state(false);
    let currentImageIndex = $state(0);
    let isSavedState = $state(false);
    let requestingBook = $state(false);
    let respondingToRequest = $state<number | null>(null);
    let showRequestModal = $state(false);
    let requestMessage = $state("");
    let showRatingModal = $state(false);
    let ratingValue = $state(5);
    let ratingReview = $state("");
    let submittingRating = $state(false);
    let showReportModal = $state(false);
    let reportCategory = $state<MarketplaceReport["category"]>("fraud");
    let reportDescription = $state("");
    let submittingReport = $state(false);
    let isSellerBlocked = $state(false);
    let hasRedirectedToLogin = $state(false);

    $effect(() => {
        if (hasRedirectedToLogin) return;

        if (!$session.isPending && !$session.error && !$session.data?.user) {
            hasRedirectedToLogin = true;
            untrack(() => {
                goto("/register?message=login_required");
            });
        }
    });

    const query = createQuery(() => ({
        queryKey: ["book-listing", bookId],
        queryFn: async () => {
            if (!bookId) throw new Error("Invalid book ID");
            const result = await getBookListingById(bookId);
            if (result.success && result.data) {
                isSavedState = result.data.isSaved || false;
                return result.data;
            }
            throw new Error(result.message || "Failed to load book");
        },
        enabled: bookId > 0,
    }));

    const conditionLabels: Record<string, string> = {
        new: "New",
        like_new: "Like New",
        good: "Good",
        fair: "Fair",
        poor: "Poor",
    };

    const conditionColors: Record<string, string> = {
        new: "bg-emerald-100 text-emerald-700 border-emerald-200",
        like_new: "bg-blue-100 text-blue-700 border-blue-200",
        good: "bg-amber-100 text-amber-700 border-amber-200",
        fair: "bg-orange-100 text-orange-700 border-orange-200",
        poor: "bg-red-100 text-red-700 border-red-200",
    };

    function formatPrice(price: string) {
        return `Rs. ${parseFloat(price).toLocaleString()}`;
    }

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    }

    async function handleSaveBook() {
        if (!$session.data?.user || !query.data) return;

        // Optimistic update
        const previousState = isSavedState;
        isSavedState = !isSavedState;
        savingBook = true;

        try {
            if (previousState) {
                await unsaveBook(bookId);
            } else {
                await saveBook(bookId);
            }

            // Invalidate to ensure sync with server
            await queryClient.invalidateQueries({
                queryKey: ["book-listing", bookId],
            });
            await queryClient.invalidateQueries({ queryKey: ["saved-books"] });
        } catch (error) {
            console.error("Error saving book:", error);
            // Rollback on error
            isSavedState = previousState;
        } finally {
            savingBook = false;
        }
    }

    async function handleDelete() {
        if (
            !confirm(
                "Are you sure you want to delete this listing? This cannot be undone.",
            )
        )
            return;
        deletingBook = true;
        try {
            const result = await deleteBookListing(bookId);
            if (result.success) {
                goto("/books");
            }
        } catch (error) {
            console.error("Error deleting book:", error);
        } finally {
            deletingBook = false;
        }
    }

    async function handleMarkSold() {
        if (
            !confirm(
                "Mark this book as sold? It will no longer appear in the marketplace.",
            )
        )
            return;
        markingSold = true;
        try {
            const result = await markBookAsSold(bookId);
            if (result.success) {
                query.refetch();
            }
        } catch (error) {
            console.error("Error marking book as sold:", error);
        } finally {
            markingSold = false;
        }
    }

    // Purchase request queries and handlers
    const requestStatusQuery = createQuery(() => ({
        queryKey: ["purchase-request-status", bookId],
        queryFn: async () => {
            const result = await getPurchaseRequestStatus(bookId);
            return result.success ? result.data : null;
        },
        enabled: bookId > 0 && !!$session.data?.user && !query.data?.isOwner,
        refetchInterval: (query) => {
            // Only poll if the current status is 'requested' (pending)
            // TanStack Query automatically handles tab focus/offline states
            return query.state.data?.status === "requested" ? 5000 : false;
        },
    }));

    // Automatically refresh contact info when request is accepted
    $effect(() => {
        const status = requestStatusQuery.data?.status;
        if (status === "accepted") {
            queryClient.invalidateQueries({
                queryKey: ["seller-contact-info", bookId],
            });
        }
    });

    const contactInfoQuery = createQuery(() => ({
        queryKey: ["seller-contact-info", bookId],
        queryFn: async () => {
            const result = await getSellerContactInfo(bookId);
            return result;
        },
        enabled: bookId > 0 && !!$session.data?.user,
    }));

    const incomingRequestsQuery = createQuery(() => ({
        queryKey: ["listing-requests", bookId],
        queryFn: async () => {
            const result = await getListingPurchaseRequests(bookId);
            return result.success ? result.data : [];
        },
        enabled: bookId > 0 && !!query.data?.isOwner,
        refetchInterval: (query) => {
            // Poll every 5 seconds for new requests while the seller is on the page
            // TanStack Query automatically pauses when the tab is not focused
            return bookId > 0 && query.state.data ? 5000 : false;
        },
    }));

    const sellerReputationQuery = createQuery(() => ({
        queryKey: ["seller-reputation", query.data?.seller?.id],
        queryFn: async () => {
            if (!query.data?.seller?.id) return null;
            const result = await getSellerReputation(query.data.seller.id);
            return result.success ? result.data || null : null;
        },
        enabled: !!query.data?.seller?.id,
    }));

    const blockedUsersQuery = createQuery(() => ({
        queryKey: ["blocked-marketplace-users"],
        queryFn: async () => {
            const result = await getBlockedMarketplaceUsers();
            return result.success ? result.data || [] : [];
        },
        enabled: !!$session.data?.user && !query.data?.isOwner,
    }));

    $effect(() => {
        const sellerId = query.data?.seller?.id;
        if (!sellerId || !blockedUsersQuery.data) {
            isSellerBlocked = false;
            return;
        }

        isSellerBlocked = blockedUsersQuery.data.some(
            (entry) => entry.blockedUserId === sellerId,
        );
    });

    async function handleRequestToBuy() {
        if (!$session.data?.user) return;
        requestingBook = true;
        try {
            if (isSellerBlocked) {
                alert("Unblock this seller before sending a purchase request.");
                return;
            }
            const result = await createPurchaseRequest(
                bookId,
                requestMessage || undefined,
            );
            if (result.success) {
                showRequestModal = false;
                requestMessage = "";
                await queryClient.invalidateQueries({
                    queryKey: ["purchase-request-status", bookId],
                });
            } else {
                alert(result.message || "Failed to send request");
            }
        } catch (error) {
            console.error("Error requesting book:", error);
        } finally {
            requestingBook = false;
        }
    }

    async function handleSubmitRating() {
        if (!query.data?.seller?.id || !query.data?.id) return;

        submittingRating = true;
        try {
            const result = await rateSeller(query.data.seller.id, {
                listingId: query.data.id,
                rating: Number(ratingValue),
                review: ratingReview,
            });

            if (!result.success) {
                alert(result.message || "Could not submit rating.");
                return;
            }

            showRatingModal = false;
            ratingReview = "";
            await queryClient.invalidateQueries({
                queryKey: ["seller-reputation", query.data.seller.id],
            });
        } catch (error) {
            console.error("Error submitting rating:", error);
        } finally {
            submittingRating = false;
        }
    }

    async function handleToggleSellerBlock() {
        const sellerId = query.data?.seller?.id;
        if (!sellerId) return;

        const action = isSellerBlocked
            ? unblockMarketplaceUser(sellerId)
            : blockMarketplaceUser(
                  sellerId,
                  "Blocked from trust controls in book marketplace.",
              );

        const result = await action;
        if (!result.success) {
            alert(result.message || "Failed to update block status.");
            return;
        }

        await queryClient.invalidateQueries({
            queryKey: ["blocked-marketplace-users"],
        });
    }

    async function handleSubmitReport() {
        if (!query.data?.seller?.id) return;
        if (!reportDescription.trim()) {
            alert("Please provide report details.");
            return;
        }

        submittingReport = true;
        try {
            const result = await createMarketplaceReport({
                reportedUserId: query.data.seller.id,
                listingId: query.data.id,
                category: reportCategory,
                description: reportDescription,
            });

            if (!result.success) {
                alert(result.message || "Failed to submit report.");
                return;
            }

            showReportModal = false;
            reportDescription = "";
            alert("Report submitted to moderation team.");
        } catch (error) {
            console.error("Error submitting report:", error);
        } finally {
            submittingReport = false;
        }
    }

    async function handleRespondToRequest(requestId: number, accept: boolean) {
        respondingToRequest = requestId;
        try {
            const result = await respondToPurchaseRequest(requestId, accept);
            if (result.success) {
                await queryClient.invalidateQueries({
                    queryKey: ["listing-requests", bookId],
                });
            } else {
                alert(result.message || "Failed to respond");
            }
        } catch (error) {
            console.error("Error responding:", error);
        } finally {
            respondingToRequest = null;
        }
    }

    async function handleCancelRequest() {
        if (!requestStatusQuery.data) return;
        if (!confirm("Cancel your purchase request?")) return;
        try {
            const result = await cancelPurchaseRequest(
                requestStatusQuery.data.id,
            );
            if (result.success) {
                await queryClient.invalidateQueries({
                    queryKey: ["purchase-request-status", bookId],
                });
            }
        } catch (error) {
            console.error("Error cancelling:", error);
        }
    }

    async function handleDeleteRequest(requestId: number) {
        if (!confirm("Remove this request from your history?")) return;
        try {
            const result = await deletePurchaseRequest(requestId);
            if (result.success) {
                await Promise.all([
                    queryClient.invalidateQueries({
                        queryKey: ["purchase-request-status", bookId],
                    }),
                    queryClient.invalidateQueries({
                        queryKey: ["listing-requests", bookId],
                    }),
                ]);
            }
        } catch (error) {
            console.error("Error deleting request:", error);
        }
    }

    function getContactMethodIcon(method: string) {
        const icons: Record<string, string> = {
            whatsapp: "💬",
            facebook_messenger: "💙",
            telegram: "✈️",
            email: "📧",
            phone: "📞",
            other: "💭",
        };
        return icons[method] || "📱";
    }

    function getContactMethodLabel(method: string) {
        const labels: Record<string, string> = {
            whatsapp: "WhatsApp",
            facebook_messenger: "Messenger",
            telegram: "Telegram",
            email: "Email",
            phone: "Phone",
            other: "Other",
        };
        return labels[method] || method;
    }

    function getContactValue(info: SellerContactInfo) {
        if (info.whatsapp) return info.whatsapp;
        if (info.facebookMessenger) return info.facebookMessenger;
        if (info.telegramUsername) return info.telegramUsername;
        if (info.email) return info.email;
        if (info.phoneNumber) return info.phoneNumber;
        if (info.otherContactDetails) return info.otherContactDetails;
        return "";
    }
</script>

<div class="min-h-[calc(100vh-4rem)] bg-gray-50/50 px-4 py-8 sm:px-6 lg:px-8">
    <div class="max-w-5xl mx-auto">
        <!-- Back Button -->
        <a
            href="/books"
            use:routeAction
            class="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
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
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
            </svg>
            Back to Marketplace
        </a>

        {#if query.isLoading}
            <div class="flex items-center justify-center py-20" in:fade>
                <LoadingSpinner size="lg" text="Loading book details..." />
            </div>
        {:else if query.error}
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
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        ></path>
                    </svg>
                </div>
                <h3 class="text-lg font-bold text-gray-900 mb-2">
                    Book Not Found
                </h3>
                <p class="text-gray-500 mb-6">{query.error.message}</p>
                <a
                    href="/books"
                    use:routeAction
                    class="inline-block px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all"
                >
                    Browse Books
                </a>
            </div>
        {:else if query.data}
            {@const book = query.data}
            <div
                class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
                in:fly={{ y: 20, duration: 400 }}
            >
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-0">
                    <!-- Image Gallery -->
                    <div
                        class="relative bg-gradient-to-br from-blue-50 to-indigo-100 p-6 lg:p-8 flex flex-col justify-center items-center overflow-hidden"
                    >
                        {#if book.status === "sold"}
                            <div
                                class="absolute inset-0 bg-gray-900/60 z-10 flex items-center justify-center"
                            >
                                <span
                                    class="text-3xl font-bold text-white uppercase tracking-wider"
                                    >Sold</span
                                >
                            </div>
                        {/if}

                        <div
                            class="w-full max-w-md aspect-square rounded-2xl overflow-hidden bg-white shadow-lg flex items-center justify-center relative group"
                        >
                            {#if book.images && book.images.length > 0}
                                <img
                                    src={book.images[currentImageIndex]
                                        .imageUrl}
                                    alt={book.title}
                                    class="w-full h-full object-contain p-2"
                                />
                            {:else}
                                <div
                                    class="w-full h-full flex items-center justify-center bg-gray-50"
                                >
                                    <svg
                                        class="w-24 h-24 text-gray-200"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="1.5"
                                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                                        ></path>
                                    </svg>
                                </div>
                            {/if}
                        </div>

                        {#if book.images && book.images.length > 1}
                            <div class="flex gap-2 mt-4 overflow-x-auto pb-2">
                                {#each book.images as image, i}
                                    <button
                                        onclick={() => (currentImageIndex = i)}
                                        class="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all {i ===
                                        currentImageIndex
                                            ? 'border-blue-500 ring-2 ring-blue-200'
                                            : 'border-transparent opacity-70 hover:opacity-100'}"
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

                    <!-- Book Details -->
                    <div class="p-6 lg:p-8">
                        <div
                            class="flex items-start justify-between gap-4 mb-4"
                        >
                            <div>
                                <span
                                    class="inline-block px-3 py-1 text-sm font-semibold rounded-full border {conditionColors[
                                        book.condition
                                    ]} mb-3"
                                >
                                    {conditionLabels[book.condition]}
                                </span>
                                <h1
                                    class="text-2xl lg:text-3xl font-bold text-gray-900 mb-2"
                                >
                                    {book.title}
                                </h1>
                                <p class="text-lg text-gray-600">
                                    by {book.author}
                                </p>
                            </div>
                        </div>

                        <div class="text-3xl font-bold text-blue-600 mb-6">
                            {formatPrice(book.price)}
                        </div>

                        <!-- Book Metadata -->
                        <div class="grid grid-cols-2 gap-4 mb-6">
                            {#if book.edition}
                                <div>
                                    <span class="text-sm text-gray-500"
                                        >Edition</span
                                    >
                                    <p class="font-medium text-gray-900">
                                        {book.edition}
                                    </p>
                                </div>
                            {/if}
                            {#if book.publisher}
                                <div>
                                    <span class="text-sm text-gray-500"
                                        >Publisher</span
                                    >
                                    <p class="font-medium text-gray-900">
                                        {book.publisher}
                                    </p>
                                </div>
                            {/if}
                            {#if book.publicationYear}
                                <div>
                                    <span class="text-sm text-gray-500"
                                        >Year</span
                                    >
                                    <p class="font-medium text-gray-900">
                                        {book.publicationYear}
                                    </p>
                                </div>
                            {/if}
                            {#if book.isbn}
                                <div>
                                    <span class="text-sm text-gray-500"
                                        >ISBN</span
                                    >
                                    <p class="font-medium text-gray-900">
                                        {book.isbn}
                                    </p>
                                </div>
                            {/if}
                            {#if book.courseCode}
                                <div>
                                    <span class="text-sm text-gray-500"
                                        >Course</span
                                    >
                                    <p class="font-medium text-gray-900">
                                        {book.courseCode}
                                    </p>
                                </div>
                            {/if}
                            {#if book.category}
                                <div>
                                    <span class="text-sm text-gray-500"
                                        >Category</span
                                    >
                                    <p class="font-medium text-gray-900">
                                        {book.category.name}
                                    </p>
                                </div>
                            {/if}
                        </div>

                        {#if book.description}
                            <div class="mb-6">
                                <h3
                                    class="text-sm font-medium text-gray-500 mb-2"
                                >
                                    Description
                                </h3>
                                <p class="text-gray-700 whitespace-pre-line">
                                    {book.description}
                                </p>
                            </div>
                        {/if}

                        <!-- Seller Info -->
                        {#if book.seller && book.status !== "sold"}
                            <div
                                class="p-4 bg-linear-to-br from-slate-50 via-cyan-50 to-blue-50 rounded-2xl mb-6 border border-cyan-100"
                            >
                                <div
                                    class="flex flex-wrap items-center justify-between gap-2 mb-3"
                                >
                                    <h3
                                        class="text-sm font-semibold text-slate-600"
                                    >
                                        Seller Trust Profile
                                    </h3>
                                    {#if book.seller.isVerifiedSeller}
                                        <span
                                            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200"
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
                                                    stroke-width="2.5"
                                                    d="M5 13l4 4L19 7"
                                                />
                                            </svg>
                                            Verified Seller
                                        </span>
                                    {/if}
                                </div>
                                <div class="flex items-center gap-3">
                                    {#if book.seller.image}
                                        <img
                                            src={book.seller.image}
                                            alt=""
                                            class="w-12 h-12 rounded-full"
                                        />
                                    {:else}
                                        <div
                                            class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg"
                                        >
                                            {book.seller.name.charAt(0)}
                                        </div>
                                    {/if}
                                    <div class="min-w-0">
                                        <p class="font-semibold text-slate-900">
                                            {book.seller.name}
                                        </p>
                                        {#if book.seller.email}
                                            <a
                                                href="mailto:{book.seller
                                                    .email}"
                                                class="text-sm text-cyan-700 hover:underline break-all"
                                                >{book.seller.email}</a
                                            >
                                        {/if}
                                    </div>
                                </div>

                                <div class="mt-4 grid grid-cols-2 gap-3">
                                    <div
                                        class="rounded-xl bg-white p-3 border border-cyan-100"
                                    >
                                        <p
                                            class="text-xs uppercase tracking-[0.14em] text-slate-400 font-bold"
                                        >
                                            Reputation
                                        </p>
                                        <p
                                            class="text-2xl font-black text-slate-900 mt-1"
                                        >
                                            {sellerReputationQuery.data
                                                ?.averageRating || 0}
                                            <span
                                                class="text-sm font-bold text-slate-500"
                                                >/5</span
                                            >
                                        </p>
                                    </div>
                                    <div
                                        class="rounded-xl bg-white p-3 border border-cyan-100"
                                    >
                                        <p
                                            class="text-xs uppercase tracking-[0.14em] text-slate-400 font-bold"
                                        >
                                            Total Ratings
                                        </p>
                                        <p
                                            class="text-2xl font-black text-slate-900 mt-1"
                                        >
                                            {sellerReputationQuery.data
                                                ?.totalRatings || 0}
                                        </p>
                                    </div>
                                </div>

                                {#if !book.isOwner && $session.data?.user}
                                    <div class="mt-4 flex flex-wrap gap-2">
                                        <button
                                            onclick={() =>
                                                (showRatingModal = true)}
                                            class="px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-cyan-200 text-cyan-700 hover:bg-cyan-50 transition"
                                        >
                                            Rate seller
                                        </button>
                                        <button
                                            onclick={() =>
                                                (showReportModal = true)}
                                            class="px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 transition"
                                        >
                                            Report seller
                                        </button>
                                        <button
                                            onclick={handleToggleSellerBlock}
                                            class="px-3 py-2 rounded-lg text-xs font-semibold border transition {isSellerBlocked
                                                ? 'bg-rose-100 border-rose-200 text-rose-700 hover:bg-rose-200'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}"
                                        >
                                            {isSellerBlocked
                                                ? "Unblock seller"
                                                : "Block seller"}
                                        </button>
                                    </div>
                                {/if}
                            </div>
                        {/if}

                        <!-- Action Buttons -->
                        <div class="flex flex-col gap-4">
                            {#if book.isOwner}
                                <!-- Owner Actions -->
                                {#if book.status === "sold"}
                                    <div
                                        class="w-full bg-emerald-50 border border-emerald-100 rounded-2xl p-6 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-2 duration-500"
                                    >
                                        <div
                                            class="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-3"
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
                                        <h3
                                            class="text-lg font-bold text-emerald-900"
                                        >
                                            Listing Completed
                                        </h3>
                                        <p
                                            class="text-sm text-emerald-600 mb-4"
                                        >
                                            This book has been successfully
                                            marked as sold.
                                        </p>
                                        <button
                                            onclick={handleDelete}
                                            disabled={deletingBook}
                                            class="text-sm font-bold text-red-600 hover:text-red-700 transition-colors flex items-center gap-1.5 px-4 py-2 hover:bg-red-50 rounded-lg disabled:opacity-50"
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
                                            {deletingBook
                                                ? "Deleting..."
                                                : "Permanently Delete Listing"}
                                        </button>
                                    </div>
                                {:else}
                                    <div
                                        class="flex flex-col sm:flex-row gap-3"
                                    >
                                        <a
                                            href="/books/sell?edit={book.id}"
                                            use:routeAction
                                            class="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-center transition-all shadow-lg shadow-blue-500/20"
                                        >
                                            Edit Listing
                                        </a>
                                        <button
                                            onclick={handleMarkSold}
                                            disabled={markingSold}
                                            class="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                                        >
                                            {markingSold
                                                ? "Marking..."
                                                : "Mark as Sold"}
                                        </button>
                                        <button
                                            onclick={handleDelete}
                                            disabled={deletingBook}
                                            class="px-6 py-3 border border-red-200 text-red-600 hover:bg-red-50 font-medium rounded-xl transition-all disabled:opacity-50"
                                        >
                                            {deletingBook
                                                ? "Deleting..."
                                                : "Delete"}
                                        </button>
                                    </div>
                                {/if}
                            {:else if $session.data?.user && book.status === "available"}
                                <!-- Buyer Actions -->
                                {#if isSellerBlocked}
                                    <div
                                        class="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700"
                                    >
                                        You blocked this seller. Unblock to
                                        request, contact, or chat.
                                    </div>
                                {:else}
                                <div class="flex flex-col sm:flex-row gap-3">
                                    <button
                                        onclick={handleSaveBook}
                                        disabled={savingBook}
                                        class="px-6 py-3 h-fit {isSavedState
                                            ? 'bg-rose-50 text-rose-600 border-rose-200'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} font-medium rounded-xl border transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 group"
                                    >
                                        <svg
                                            class="w-5 h-5 transition-transform group-active:scale-125"
                                            fill={isSavedState
                                                ? "#e11d48"
                                                : "none"}
                                            stroke={isSavedState
                                                ? "#e11d48"
                                                : "currentColor"}
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                                stroke-width="2"
                                                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                                            />
                                        </svg>
                                        {savingBook
                                            ? "Updating..."
                                            : isSavedState
                                              ? "Saved"
                                              : "Save to Wishlist"}
                                    </button>

                                    <!-- Request Status Based Actions -->
                                    {#if requestStatusQuery.isLoading}
                                        <div
                                            class="flex-1 px-6 py-3 bg-gray-100 rounded-xl flex items-center justify-center"
                                        >
                                            <div
                                                class="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"
                                            ></div>
                                        </div>
                                    {:else if requestStatusQuery.data?.status === "requested"}
                                        <div class="flex-1 flex flex-col gap-2">
                                            <div
                                                class="px-6 py-3 bg-amber-50 border border-amber-200 text-amber-700 font-medium rounded-xl text-center flex items-center justify-center gap-2"
                                            >
                                                <span
                                                    class="w-2 h-2 bg-amber-500 rounded-full animate-pulse"
                                                ></span>
                                                Request Pending
                                            </div>
                                            <button
                                                onclick={handleCancelRequest}
                                                class="px-4 py-2 text-sm text-gray-500 hover:text-red-600 transition-colors"
                                            >
                                                Cancel Request
                                            </button>
                                        </div>
                                    {:else if requestStatusQuery.data?.status === "accepted"}
                                        <div class="flex-1">
                                            <div
                                                class="px-6 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium rounded-xl text-center flex items-center justify-center gap-2"
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
                                                        d="M5 13l4 4L19 7"
                                                    />
                                                </svg>
                                                Request Accepted!
                                            </div>
                                        </div>
                                    {:else if requestStatusQuery.data?.status === "rejected"}
                                        <div class="flex-1 flex flex-col gap-2">
                                            <div
                                                class="px-6 py-3 bg-red-50 border border-red-200 text-red-700 font-medium rounded-xl text-center"
                                            >
                                                Request Declined
                                            </div>
                                            <button
                                                onclick={() =>
                                                    handleDeleteRequest(
                                                        requestStatusQuery.data!
                                                            .id,
                                                    )}
                                                class="px-4 py-2 text-sm text-gray-500 hover:text-red-600 transition-colors"
                                            >
                                                Clear from History
                                            </button>
                                        </div>
                                    {:else}
                                        <!-- No request yet - show Request to Buy button -->
                                        <button
                                            onclick={() =>
                                                (showRequestModal = true)}
                                            disabled={requestingBook}
                                            class="flex-1 px-6 py-3 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
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
                                                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                                />
                                            </svg>
                                            Request to Buy
                                        </button>
                                    {/if}
                                </div>
                                {/if}
                            {:else if !$session.data?.user && book.status !== "sold"}
                                <a
                                    href="/register"
                                    use:routeAction
                                    class="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-center transition-all"
                                >
                                    Sign in to Contact Seller
                                </a>
                            {/if}
                        </div>

                        <!-- Contact Info Section - Below the buttons -->
                        {#if book.status !== "sold" && !isSellerBlocked && requestStatusQuery.data?.status === "accepted" && (contactInfoQuery.data?.data || book.seller?.email)}
                            <div
                                class="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 mt-4"
                                in:slide
                            >
                                <p
                                    class="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3"
                                >
                                    Seller Contact Info
                                </p>
                                <div
                                    class="grid grid-cols-1 sm:grid-cols-2 gap-3"
                                >
                                    {#if contactInfoQuery.data?.data?.whatsapp}
                                        <a
                                            href="https://wa.me/{contactInfoQuery.data.data.whatsapp.replace(
                                                /[^0-9]/g,
                                                '',
                                            )}"
                                            target="_blank"
                                            class="flex items-center gap-3 p-3 bg-white rounded-lg border border-green-100 hover:border-green-300 transition-all group overflow-hidden"
                                        >
                                            <div
                                                class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 group-hover:bg-green-500 group-hover:text-white transition-all flex-shrink-0"
                                            >
                                                <svg
                                                    class="w-5 h-5"
                                                    viewBox="0 0 24 24"
                                                    fill="currentColor"
                                                    ><path
                                                        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
                                                    /></svg
                                                >
                                            </div>
                                            <div class="min-w-0">
                                                <p
                                                    class="text-xs text-gray-500"
                                                >
                                                    WhatsApp
                                                </p>
                                                <p
                                                    class="text-sm font-medium text-gray-900 break-all"
                                                >
                                                    {contactInfoQuery.data.data
                                                        .whatsapp}
                                                </p>
                                            </div>
                                        </a>
                                    {/if}
                                    {#if contactInfoQuery.data?.data?.facebookMessenger}
                                        <a
                                            href={contactInfoQuery.data.data.facebookMessenger.startsWith(
                                                "http",
                                            )
                                                ? contactInfoQuery.data.data
                                                      .facebookMessenger
                                                : "https://m.me/" +
                                                  contactInfoQuery.data.data
                                                      .facebookMessenger}
                                            target="_blank"
                                            class="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-100 hover:border-blue-300 transition-all group overflow-hidden"
                                        >
                                            <div
                                                class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-all flex-shrink-0"
                                            >
                                                <svg
                                                    class="w-5 h-5"
                                                    viewBox="0 0 24 24"
                                                    fill="currentColor"
                                                    ><path
                                                        d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.654V24l4.088-2.242c1.092.3 2.246.464 3.443.464 6.627 0 12-4.975 12-11.111S18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.131 3.259L19.752 8l-6.561 6.963z"
                                                    /></svg
                                                >
                                            </div>
                                            <div class="min-w-0">
                                                <p
                                                    class="text-xs text-gray-500"
                                                >
                                                    Messenger
                                                </p>
                                                <p
                                                    class="text-sm font-medium text-gray-900 break-all"
                                                >
                                                    {contactInfoQuery.data.data
                                                        .facebookMessenger}
                                                </p>
                                            </div>
                                        </a>
                                    {/if}
                                    {#if contactInfoQuery.data?.data?.telegramUsername}
                                        <a
                                            href="https://t.me/{contactInfoQuery.data.data.telegramUsername.replace(
                                                '@',
                                                '',
                                            )}"
                                            target="_blank"
                                            class="flex items-center gap-3 p-3 bg-white rounded-lg border border-sky-100 hover:border-sky-300 transition-all group overflow-hidden"
                                        >
                                            <div
                                                class="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center text-sky-600 group-hover:bg-sky-500 group-hover:text-white transition-all flex-shrink-0"
                                            >
                                                <svg
                                                    class="w-5 h-5"
                                                    viewBox="0 0 24 24"
                                                    fill="currentColor"
                                                    ><path
                                                        d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"
                                                    /></svg
                                                >
                                            </div>
                                            <div class="min-w-0">
                                                <p
                                                    class="text-xs text-gray-500"
                                                >
                                                    Telegram
                                                </p>
                                                <p
                                                    class="text-sm font-medium text-gray-900 break-all"
                                                >
                                                    {contactInfoQuery.data.data
                                                        .telegramUsername}
                                                </p>
                                            </div>
                                        </a>
                                    {/if}
                                    {#if contactInfoQuery.data?.data?.email}
                                        <a
                                            href="mailto:{contactInfoQuery.data
                                                .data.email}"
                                            class="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-100 hover:border-purple-300 transition-all group overflow-hidden"
                                        >
                                            <div
                                                class="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 group-hover:bg-purple-500 group-hover:text-white transition-all flex-shrink-0"
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
                                                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                                    /></svg
                                                >
                                            </div>
                                            <div class="min-w-0">
                                                <p
                                                    class="text-xs text-gray-500"
                                                >
                                                    Email
                                                </p>
                                                <p
                                                    class="text-sm font-medium text-gray-900 break-all"
                                                >
                                                    {contactInfoQuery.data.data
                                                        .email}
                                                </p>
                                            </div>
                                        </a>
                                    {/if}
                                    {#if contactInfoQuery.data?.data?.phoneNumber}
                                        <a
                                            href="tel:{contactInfoQuery.data
                                                .data.phoneNumber}"
                                            class="flex items-center gap-3 p-3 bg-white rounded-lg border border-emerald-100 hover:border-emerald-300 transition-all group overflow-hidden"
                                        >
                                            <div
                                                class="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-all flex-shrink-0"
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
                                                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                                    /></svg
                                                >
                                            </div>
                                            <div class="min-w-0">
                                                <p
                                                    class="text-xs text-gray-500"
                                                >
                                                    Phone
                                                </p>
                                                <p
                                                    class="text-sm font-medium text-gray-900 break-all"
                                                >
                                                    {contactInfoQuery.data.data
                                                        .phoneNumber}
                                                </p>
                                            </div>
                                        </a>
                                    {/if}
                                    {#if contactInfoQuery.data?.data?.otherContactDetails}
                                        <div
                                            class="flex items-center gap-3 p-3 bg-white rounded-lg border border-orange-100 sm:col-span-2"
                                        >
                                            <div
                                                class="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 flex-shrink-0"
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
                                            </div>
                                            <div class="min-w-0">
                                                <p
                                                    class="text-xs text-gray-500"
                                                >
                                                    Other
                                                </p>
                                                <p
                                                    class="text-sm font-medium text-gray-900 break-all"
                                                >
                                                    {contactInfoQuery.data.data
                                                        .otherContactDetails}
                                                </p>
                                            </div>
                                        </div>
                                    {/if}
                                    <!-- Fallback to seller email if no contact info provided -->
                                    {#if !contactInfoQuery.data?.data && book.seller?.email}
                                        <a
                                            href="mailto:{book.seller
                                                .email}?subject=Interested in: {book.title}"
                                            class="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-100 hover:border-purple-300 transition-all group sm:col-span-2 overflow-hidden"
                                        >
                                            <div
                                                class="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 group-hover:bg-purple-500 group-hover:text-white transition-all flex-shrink-0"
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
                                                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                                    /></svg
                                                >
                                            </div>
                                            <div class="min-w-0">
                                                <p
                                                    class="text-xs text-gray-500"
                                                >
                                                    Email (from account)
                                                </p>
                                                <p
                                                    class="text-sm font-medium text-gray-900 break-all"
                                                >
                                                    {book.seller.email}
                                                </p>
                                            </div>
                                        </a>
                                    {/if}
                                </div>

                                <!-- Chat with Seller Button -->
                                <a
                                    href="/messages?listing={book.id}"
                                    class="mt-4 flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl transition-all shadow-sm hover:shadow-md"
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
                                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                        ></path>
                                    </svg>
                                    Chat with Seller
                                </a>
                            </div>
                        {/if}
                        {#if book.isOwner && book.status !== "sold" && incomingRequestsQuery.data && incomingRequestsQuery.data.length > 0}
                            <div
                                class="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100"
                                in:slide
                            >
                                <h4
                                    class="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2"
                                >
                                    <span
                                        class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"
                                    ></span>
                                    Purchase Requests ({incomingRequestsQuery
                                        .data.length})
                                </h4>
                                <div class="space-y-3">
                                    {#each incomingRequestsQuery.data as request}
                                        <div
                                            class="p-3 bg-white rounded-lg border border-blue-100 flex items-center justify-between gap-3 overflow-hidden"
                                        >
                                            <div
                                                class="flex items-center gap-3 min-w-0"
                                            >
                                                {#if request.buyer?.image}
                                                    <img
                                                        src={request.buyer
                                                            .image}
                                                        alt=""
                                                        class="w-10 h-10 rounded-full flex-shrink-0"
                                                    />
                                                {:else}
                                                    <div
                                                        class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold flex-shrink-0"
                                                    >
                                                        {request.buyer?.name?.charAt(
                                                            0,
                                                        ) || "?"}
                                                    </div>
                                                {/if}
                                                <div class="min-w-0">
                                                    <p
                                                        class="font-medium text-gray-900 text-sm truncate"
                                                        title={request.buyer
                                                            ?.name}
                                                    >
                                                        {request.buyer?.name ||
                                                            "Unknown"}
                                                    </p>
                                                    {#if request.message}
                                                        <p
                                                            class="text-xs text-gray-500 mt-0.5 break-words line-clamp-2"
                                                            title={request.message}
                                                        >
                                                            "{request.message}"
                                                        </p>
                                                    {/if}
                                                </div>
                                            </div>
                                            {#if request.status === "requested"}
                                                <div class="flex gap-2">
                                                    <button
                                                        onclick={() =>
                                                            handleRespondToRequest(
                                                                request.id,
                                                                true,
                                                            )}
                                                        disabled={respondingToRequest ===
                                                            request.id}
                                                        class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                                                    >
                                                        Accept
                                                    </button>
                                                    <button
                                                        onclick={() =>
                                                            handleRespondToRequest(
                                                                request.id,
                                                                false,
                                                            )}
                                                        disabled={respondingToRequest ===
                                                            request.id}
                                                        class="px-4 py-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium rounded-lg disabled:opacity-50"
                                                    >
                                                        Decline
                                                    </button>
                                                </div>
                                            {:else}
                                                <div
                                                    class="flex items-center gap-2"
                                                >
                                                    <span
                                                        class="px-3 py-1 text-xs font-bold rounded-full {request.status ===
                                                        'accepted'
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-red-100 text-red-700'}"
                                                    >
                                                        {request.status ===
                                                        "accepted"
                                                            ? "Accepted"
                                                            : "Declined"}
                                                    </span>
                                                    {#if request.status === "accepted"}
                                                        <a
                                                            href="/books/my-books?tab=messages&listing={book.id}"
                                                            class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
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
                                                                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                                                ></path>
                                                            </svg>
                                                            Chat
                                                        </a>
                                                    {/if}
                                                    <button
                                                        onclick={() =>
                                                            handleDeleteRequest(
                                                                request.id,
                                                            )}
                                                        class="p-2 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                                                        title="Delete from history"
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
                                                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                            /></svg
                                                        >
                                                    </button>
                                                </div>
                                            {/if}
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/if}

                        <!-- Meta Info -->
                        <div
                            class="flex items-center gap-4 mt-6 text-sm text-gray-500"
                        >
                            <span>Posted {formatDate(book.createdAt)}</span>
                            <span>•</span>
                            <span>{book.viewCount} views</span>
                        </div>
                    </div>
                </div>
            </div>
        {/if}
    </div>
</div>

<!-- Request Modal -->
{#if showRequestModal}
    <div
        class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        in:fade
    >
        <div
            class="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6"
            in:fly={{ y: 20, duration: 300 }}
        >
            <h3 class="text-lg font-bold text-gray-900 mb-4">Request to Buy</h3>
            <p class="text-sm text-gray-600 mb-4">
                Send a request to the seller. Once approved, you'll see their
                contact information.
            </p>
            <textarea
                bind:value={requestMessage}
                placeholder="Add a message (optional): e.g., 'Hi! I'm interested in this book for my CSE201 class.'"
                rows="3"
                class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none resize-none text-sm"
            ></textarea>
            <div class="flex gap-3 mt-4">
                <button
                    onclick={() => {
                        showRequestModal = false;
                        requestMessage = "";
                    }}
                    class="flex-1 px-4 py-3 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-all"
                >
                    Cancel
                </button>
                <button
                    onclick={handleRequestToBuy}
                    disabled={requestingBook}
                    class="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {#if requestingBook}
                        <div
                            class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
                        ></div>
                        Sending...
                    {:else}
                        Send Request
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}

{#if showRatingModal}
    <div
        class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        in:fade
    >
        <div
            class="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6"
            in:fly={{ y: 20, duration: 300 }}
        >
            <h3 class="text-lg font-bold text-slate-900 mb-2">Rate Seller</h3>
            <p class="text-sm text-slate-600 mb-4">
                Share your experience to help keep the marketplace trusted.
            </p>
            <label for="seller-rating" class="text-xs font-bold text-slate-500 uppercase tracking-wide"
                >Rating</label
            >
            <select
                id="seller-rating"
                bind:value={ratingValue}
                class="mt-2 w-full px-4 py-3 border border-slate-200 rounded-xl"
            >
                <option value={5}>5 - Excellent</option>
                <option value={4}>4 - Good</option>
                <option value={3}>3 - Average</option>
                <option value={2}>2 - Poor</option>
                <option value={1}>1 - Bad</option>
            </select>
            <textarea
                bind:value={ratingReview}
                placeholder="Optional note about communication, honesty, and response quality."
                rows="3"
                class="mt-3 w-full px-4 py-3 border border-slate-200 rounded-xl resize-none"
            ></textarea>
            <div class="mt-4 flex gap-3">
                <button
                    onclick={() => (showRatingModal = false)}
                    class="flex-1 px-4 py-3 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50"
                >
                    Cancel
                </button>
                <button
                    onclick={handleSubmitRating}
                    disabled={submittingRating}
                    class="flex-1 px-4 py-3 bg-cyan-600 text-white font-bold rounded-xl hover:bg-cyan-700 disabled:opacity-50"
                >
                    {submittingRating ? "Saving..." : "Submit Rating"}
                </button>
            </div>
        </div>
    </div>
{/if}

{#if showReportModal}
    <div
        class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        in:fade
    >
        <div
            class="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6"
            in:fly={{ y: 20, duration: 300 }}
        >
            <h3 class="text-lg font-bold text-slate-900 mb-2">Report Seller</h3>
            <p class="text-sm text-slate-600 mb-4">
                Reports go to the moderation queue for admin review.
            </p>
            <label for="report-category" class="text-xs font-bold text-slate-500 uppercase tracking-wide"
                >Category</label
            >
            <select
                id="report-category"
                bind:value={reportCategory}
                class="mt-2 w-full px-4 py-3 border border-slate-200 rounded-xl"
            >
                <option value="fraud">Fraud</option>
                <option value="fake_listing">Fake listing</option>
                <option value="abusive">Abusive behavior</option>
                <option value="spam">Spam</option>
                <option value="suspicious_payment">Suspicious payment</option>
                <option value="other">Other</option>
            </select>
            <textarea
                bind:value={reportDescription}
                placeholder="Describe what happened with clear details."
                rows="4"
                class="mt-3 w-full px-4 py-3 border border-slate-200 rounded-xl resize-none"
            ></textarea>
            <div class="mt-4 flex gap-3">
                <button
                    onclick={() => (showReportModal = false)}
                    class="flex-1 px-4 py-3 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50"
                >
                    Cancel
                </button>
                <button
                    onclick={handleSubmitReport}
                    disabled={submittingReport}
                    class="flex-1 px-4 py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 disabled:opacity-50"
                >
                    {submittingReport ? "Submitting..." : "Submit Report"}
                </button>
            </div>
        </div>
    </div>
{/if}
