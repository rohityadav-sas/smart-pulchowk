<script lang="ts">
    import { route as routeAction, goto } from "@mateothegreat/svelte5-router";
    import {
        getBookListings,
        getBookCategories,
        type BookListing,
        type BookCategory,
        type BookFilters,
    } from "../lib/api";
    import LoadingSpinner from "../components/LoadingSpinner.svelte";
    import { fade, fly, slide } from "svelte/transition";
    import { authClient } from "../lib/auth-client";
    import { createQuery } from "@tanstack/svelte-query";

    const session = authClient.useSession();

    let searchQuery = $state("");
    let authorFilter = $state("");
    let isbnFilter = $state("");
    let selectedCategory = $state<number | undefined>(undefined);
    let selectedCondition = $state("");
    let minPrice = $state<number | undefined>(undefined);
    let maxPrice = $state<number | undefined>(undefined);
    let sortBy = $state<BookFilters["sortBy"]>("newest");
    let currentPage = $state(1);
    let showFilters = $state(false);

    type QuickFilter =
        | { label: string; value: number | undefined; type: "category" }
        | { label: string; value: number | undefined; type: "price" }
        | { label: string; value: BookFilters["sortBy"]; type: "sort" };

    const quickFilters: QuickFilter[] = [
        { label: "All", value: undefined, type: "category" },
        { label: "Insights", value: 1, type: "category" },
        { label: "Manual", value: 2, type: "category" },
        { label: "Price < 500", value: 500, type: "price" },
        { label: "Newest", value: "newest", type: "sort" },
    ];

    $effect(() => {
        if (!$session.isPending && !$session.error && !$session.data?.user) {
            goto("/register?message=login_required");
        }
    });

    const conditionLabels: Record<string, string> = {
        new: "New",
        like_new: "Like New",
        good: "Good",
        fair: "Fair",
        poor: "Poor",
    };

    const conditionColors: Record<string, string> = {
        new: "bg-emerald-100 text-emerald-700",
        like_new: "bg-blue-100 text-blue-700",
        good: "bg-amber-100 text-amber-700",
        fair: "bg-orange-100 text-orange-700",
        poor: "bg-red-100 text-red-700",
    };

    const categoriesQuery = createQuery(() => ({
        queryKey: ["book-categories"],
        queryFn: async () => {
            const result = await getBookCategories();
            if (result.success && result.data) {
                return result.data;
            }
            return [];
        },
    }));

    const listingsQuery = createQuery(() => ({
        queryKey: [
            "book-listings",
            searchQuery,
            authorFilter,
            isbnFilter,
            selectedCategory,
            selectedCondition,
            minPrice,
            maxPrice,
            sortBy,
            currentPage,
        ],
        queryFn: async () => {
            const filters: BookFilters = {
                page: currentPage,
                limit: 12,
                sortBy,
            };
            if (searchQuery) filters.search = searchQuery;
            if (authorFilter) filters.author = authorFilter;
            if (isbnFilter) filters.isbn = isbnFilter;
            if (selectedCategory) filters.categoryId = selectedCategory;
            if (selectedCondition) filters.condition = selectedCondition;
            if (minPrice !== undefined) filters.minPrice = minPrice;
            if (maxPrice !== undefined) filters.maxPrice = maxPrice;

            const result = await getBookListings(filters);
            if (result.success && result.data) {
                return result.data;
            }
            throw new Error(result.message || "Failed to load listings");
        },
    }));

    function clearFilters() {
        searchQuery = "";
        authorFilter = "";
        isbnFilter = "";
        selectedCategory = undefined;
        selectedCondition = "";
        minPrice = undefined;
        maxPrice = undefined;
        sortBy = "newest";
        currentPage = 1;
    }

    function formatPrice(price: string) {
        return `Rs. ${parseFloat(price).toLocaleString()}`;
    }

    function getTimeAgo(dateStr: string) {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days === 0) return "Today";
        if (days === 1) return "Yesterday";
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        return `${Math.floor(days / 30)} months ago`;
    }

    const activeFiltersCount = $derived(
        [
            searchQuery,
            authorFilter,
            isbnFilter,
            selectedCategory,
            selectedCondition,
            minPrice,
            maxPrice,
        ].filter((v) => v !== "" && v !== undefined).length,
    );

    function getCategoryName(id: number | undefined) {
        if (!id || !categoriesQuery.data) return "";
        return categoriesQuery.data.find((c) => c.id === id)?.name || "";
    }
</script>

<div class="min-h-[calc(100vh-4rem)] bg-gray-50/50 px-4 py-8 sm:px-6 lg:px-8">
    <div class="max-w-7xl mx-auto">
        <!-- Header -->
        <div class="text-center mb-10 animate-fade-in">
            <h1
                class="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 mb-6 tracking-tight"
            >
                Find your next <span
                    class="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600"
                    >Great Read</span
                >
            </h1>
            <p
                class="text-slate-500 text-lg max-w-2xl mx-auto mb-8 font-medium"
            >
                The most trusted marketplace for Pulchowk students to trade
                textbooks and engineering materials.
            </p>
            {#if $session.data?.user}
                <a
                    href="/books/sell"
                    use:routeAction
                    class="inline-flex items-center gap-2 px-8 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95 group"
                    in:fly={{ y: 10, duration: 400, delay: 200 }}
                >
                    <svg
                        class="w-6 h-6 group-hover:rotate-90 transition-transform duration-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2.5"
                            d="M12 4v16m8-8H4"
                        />
                    </svg>
                    Start Selling
                </a>
            {/if}
        </div>

        <!-- Search and Filters Section -->
        <div class="relative z-30 mb-8">
            <!-- Main Search Shell -->
            <div class="max-w-4xl mx-auto space-y-4">
                <div
                    class="bg-white rounded-[2.5rem] shadow-2xl shadow-blue-100/50 border border-slate-100 p-2 flex flex-col sm:flex-row items-center gap-2 group focus-within:ring-4 focus-within:ring-blue-500/10 transition-all duration-500"
                    in:fly={{ y: 20, duration: 600 }}
                >
                    <div class="relative flex-1 w-full">
                        <svg
                            class="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400 group-focus-within:text-blue-600 transition-colors"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2.5"
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                        <input
                            type="text"
                            placeholder="What book are you looking for?"
                            bind:value={searchQuery}
                            class="w-full pl-16 pr-12 py-5 bg-transparent border-none focus:ring-0 text-xl font-semibold text-slate-900 placeholder:text-slate-300"
                        />
                        {#if searchQuery}
                            <button
                                onclick={() => (searchQuery = "")}
                                aria-label="Clear search"
                                class="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-300 hover:text-slate-600 transition-colors"
                            >
                                <svg
                                    class="w-5 h-5"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                >
                                    <path
                                        d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"
                                    />
                                </svg>
                            </button>
                        {/if}
                    </div>

                    <div class="flex items-center gap-2 w-full sm:w-auto p-1">
                        <button
                            onclick={() => (showFilters = !showFilters)}
                            class="relative flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all {showFilters
                                ? 'bg-blue-600 text-white shadow-xl shadow-blue-200'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-100'}"
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
                                    d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                                />
                            </svg>
                            Filters
                            {#if activeFiltersCount > 0}
                                <span
                                    class="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white font-black animate-bounce-subtle"
                                >
                                    {activeFiltersCount}
                                </span>
                            {/if}
                        </button>
                        <button
                            onclick={() => listingsQuery.refetch()}
                            class="flex-1 sm:flex-none px-10 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200/50"
                        >
                            Search
                        </button>
                    </div>
                </div>

                <!-- Active Filter Tags -->
                {#if activeFiltersCount > 0}
                    <div
                        class="flex flex-wrap items-center gap-2 px-4"
                        transition:fade
                    >
                        <span
                            class="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2"
                            >Active:</span
                        >

                        {#if searchQuery}
                            <button
                                onclick={() => (searchQuery = "")}
                                class="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg border border-slate-200 flex items-center gap-2 hover:bg-slate-200 transition-colors"
                            >
                                Search: {searchQuery}
                                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
                            </button>
                        {/if}

                        {#if authorFilter}
                            <button
                                onclick={() => (authorFilter = "")}
                                class="px-3 py-1 bg-violet-50 text-violet-600 text-xs font-bold rounded-lg border border-violet-100 flex items-center gap-2 hover:bg-violet-100 transition-colors"
                            >
                                Author: {authorFilter}
                                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
                            </button>
                        {/if}

                        {#if isbnFilter}
                            <button
                                onclick={() => (isbnFilter = "")}
                                class="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg border border-indigo-100 flex items-center gap-2 hover:bg-indigo-100 transition-colors"
                            >
                                ISBN: {isbnFilter}
                                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
                            </button>
                        {/if}

                        {#if selectedCategory}
                            <button
                                onclick={() => (selectedCategory = undefined)}
                                class="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg border border-blue-100 flex items-center gap-2 hover:bg-blue-100 transition-colors"
                            >
                                {getCategoryName(selectedCategory)}
                                <svg
                                    class="w-3 h-3"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                    ><path
                                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                    /></svg
                                >
                            </button>
                        {/if}

                        {#if selectedCondition}
                            <button
                                onclick={() => (selectedCondition = "")}
                                class="px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-lg border border-emerald-100 flex items-center gap-2 hover:bg-emerald-100 transition-colors"
                            >
                                {conditionLabels[selectedCondition]}
                                <svg
                                    class="w-3 h-3"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                    ><path
                                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                    /></svg
                                >
                            </button>
                        {/if}

                        {#if minPrice || maxPrice}
                            <button
                                onclick={() => {
                                    minPrice = undefined;
                                    maxPrice = undefined;
                                }}
                                class="px-3 py-1 bg-amber-50 text-amber-600 text-xs font-bold rounded-lg border border-amber-100 flex items-center gap-2 hover:bg-amber-100 transition-colors"
                            >
                                {minPrice || 0} - {maxPrice || "Any"}
                                <svg
                                    class="w-3 h-3"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                    ><path
                                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                    /></svg
                                >
                            </button>
                        {/if}

                        <button
                            onclick={clearFilters}
                            class="text-[10px] font-black text-rose-500 hover:text-rose-600 underline underline-offset-4 ml-2"
                        >
                            Clear All
                        </button>
                    </div>
                {/if}
            </div>

            <!-- Enhanced Advanced Filter Panel -->
            {#if showFilters}
                <div
                    transition:slide={{ duration: 500 }}
                    class="mt-6 max-w-5xl mx-auto bg-white rounded-[3rem] border border-slate-100 shadow-2xl shadow-blue-900/5 overflow-hidden ring-1 ring-black/5"
                >
                    <div
                        class="p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
                    >
                        <!-- Metadata Group -->
                        <div class="space-y-6">
                            <div class="space-y-4">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center text-violet-600">
                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <label class="text-sm font-black text-slate-900 uppercase tracking-widest">Book Meta</label>
                                </div>
                                <div class="space-y-2">
                                    <input
                                        type="text"
                                        placeholder="Author Name"
                                        bind:value={authorFilter}
                                        class="w-full px-5 py-3 bg-slate-50 border-none rounded-xl focus:ring-4 focus:ring-violet-500/5 font-bold text-slate-700 placeholder:text-slate-300 transition-all text-sm"
                                    />
                                    <input
                                        type="text"
                                        placeholder="ISBN Code"
                                        bind:value={isbnFilter}
                                        class="w-full px-5 py-3 bg-slate-50 border-none rounded-xl focus:ring-4 focus:ring-indigo-500/5 font-bold text-slate-700 placeholder:text-slate-300 transition-all text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <!-- Category Group -->
                        <div class="space-y-4">
                            <div class="flex items-center gap-3">
                                <div
                                    class="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600"
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
                                            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                                        />
                                    </svg>
                                </div>
                                <label
                                    class="text-sm font-black text-slate-900 uppercase tracking-widest"
                                    >Library Genre</label
                                >
                            </div>
                            <div class="grid grid-cols-1 gap-2">
                                <select
                                    bind:value={selectedCategory}
                                    class="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-500/5 transition-all font-bold text-slate-700 appearance-none cursor-pointer"
                                >
                                    <option value={undefined}
                                        >All Categories</option
                                    >
                                    {#if categoriesQuery.data}
                                        {#each categoriesQuery.data as category}
                                            <option value={category.id}
                                                >{category.name}</option
                                            >
                                        {/each}
                                    {/if}
                                </select>
                            </div>
                        </div>

                        <!-- Condition Group -->
                        <div class="space-y-4">
                            <div class="flex items-center gap-3">
                                <div
                                    class="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600"
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
                                            d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                                        />
                                    </svg>
                                </div>
                                <label
                                    class="text-sm font-black text-slate-900 uppercase tracking-widest"
                                    >Quality Standard</label
                                >
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                {#each ["new", "good", "fair", "poor"] as cond}
                                    <button
                                        onclick={() =>
                                            (selectedCondition =
                                                selectedCondition === cond
                                                    ? ""
                                                    : cond)}
                                        class="px-4 py-3 rounded-2xl border-2 transition-all font-bold text-xs flex items-center justify-center gap-2
                                        {selectedCondition === cond
                                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-lg shadow-emerald-100'
                                            : 'border-slate-50 bg-slate-50 text-slate-500 hover:border-slate-200'}"
                                    >
                                        <div
                                            class="w-2 h-2 rounded-full {selectedCondition ===
                                            cond
                                                ? 'bg-emerald-500 animate-pulse'
                                                : 'bg-slate-300'}"
                                        ></div>
                                        {conditionLabels[cond]}
                                    </button>
                                {/each}
                            </div>
                        </div>

                        <!-- Price Group -->
                        <div class="space-y-4">
                            <div class="flex items-center gap-3">
                                <div
                                    class="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600"
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
                                            d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zM17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
                                        />
                                    </svg>
                                </div>
                                <label
                                    class="text-sm font-black text-slate-900 uppercase tracking-widest"
                                    >Budgeting</label
                                >
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="relative flex-1">
                                    <span
                                        class="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400"
                                        >MIN</span
                                    >
                                    <input
                                        type="number"
                                        bind:value={minPrice}
                                        class="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-amber-500/5 font-bold text-slate-700 placeholder:text-slate-300"
                                        placeholder="0"
                                    />
                                </div>
                                <div
                                    class="w-2 h-0.5 bg-slate-200 rounded-full"
                                ></div>
                                <div class="relative flex-1">
                                    <span
                                        class="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400"
                                        >MAX</span
                                    >
                                    <input
                                        type="number"
                                        bind:value={maxPrice}
                                        class="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-amber-500/5 font-bold text-slate-700 placeholder:text-slate-300"
                                        placeholder="Any"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div
                        class="bg-slate-50/80 px-10 py-6 flex items-center justify-between border-t border-slate-100"
                    >
                        <div class="flex items-center gap-8">
                            <div class="flex items-center gap-2">
                                <span
                                    class="text-xs font-black text-slate-400 uppercase tracking-widest"
                                    >Sort by:</span
                                >
                                <select
                                    bind:value={sortBy}
                                    class="bg-transparent border-none font-bold text-blue-600 focus:ring-0 text-sm cursor-pointer hover:text-blue-700 transition-colors"
                                >
                                    <option value="newest"
                                        >Recently Listed</option
                                    >
                                    <option value="oldest"
                                        >Early Listings</option
                                    >
                                    <option value="price_asc"
                                        >Price: Low to High</option
                                    >
                                    <option value="price_desc"
                                        >Price: High to Low</option
                                    >
                                </select>
                            </div>
                        </div>
                        <button
                            onclick={clearFilters}
                            class="flex items-center gap-2 text-rose-500 hover:text-rose-600 font-bold text-sm transition-colors group"
                        >
                            <svg
                                class="w-4 h-4 group-hover:rotate-12 transition-transform"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2.5"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                            </svg>
                            Reset System
                        </button>
                    </div>
                </div>
            {/if}

            <!-- Quick Filter Presets -->
            <div
                class="mt-8 flex flex-wrap justify-center items-center gap-3"
                in:fade={{ delay: 600 }}
            >
                {#each quickFilters as chip}
                    <button
                        onclick={() => {
                            if (chip.type === "category")
                                selectedCategory = chip.value;
                            else if (chip.type === "price")
                                maxPrice = chip.value;
                            else if (chip.type === "sort") sortBy = chip.value;
                        }}
                        class="px-6 py-3 bg-white border border-slate-100 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-50 hover:text-blue-600 hover:border-blue-100 hover:shadow-lg hover:shadow-blue-500/5 transition-all active:scale-95"
                    >
                        {chip.label}
                    </button>
                {/each}
            </div>
        </div>

        <!-- Results Info -->
        {#if listingsQuery.data}
            <div
                class="flex items-center justify-between mb-8 px-2"
                transition:fade
            >
                <div class="flex items-center gap-3">
                    <div
                        class="px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-full shadow-lg shadow-blue-200 uppercase tracking-widest"
                    >
                        Results
                    </div>
                    <p class="text-slate-500 font-bold">
                        {listingsQuery.data.pagination.totalCount} items discovered
                    </p>
                </div>
                {#if $session.data?.user}
                    <a
                        href="/books/my-books"
                        use:routeAction
                        class="px-5 py-2.5 bg-white text-slate-600 text-sm font-bold rounded-xl border border-slate-100 hover:bg-slate-50 flex items-center gap-2 transition-all"
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
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                        </svg>
                        Personal Dashboard
                    </a>
                {/if}
            </div>
        {/if}

        <!-- Listings Grid -->
        {#if listingsQuery.isLoading}
            <div
                class="flex flex-col items-center justify-center py-32"
                in:fade
            >
                <LoadingSpinner size="lg" text="Analyzing Marketplace..." />
                <p class="mt-4 text-slate-400 font-medium animate-pulse">
                    Syncing with Pulchowk database...
                </p>
            </div>
        {:else if listingsQuery.error}
            <div
                class="max-w-md mx-auto p-10 bg-white border border-rose-100 rounded-[3rem] shadow-2xl text-center"
                in:fly={{ y: 20, duration: 400 }}
            >
                <div
                    class="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner"
                >
                    <svg
                        class="w-10 h-10 text-rose-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2.5"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>
                </div>
                <h3 class="text-2xl font-black text-slate-900 mb-2">
                    Sync Interrupted
                </h3>
                <p class="text-slate-500 mb-8 font-medium leading-relaxed">
                    {listingsQuery.error.message}
                </p>
                <button
                    onclick={() => listingsQuery.refetch()}
                    class="w-full px-6 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                >
                    Reconnect Now
                </button>
            </div>
        {:else if !listingsQuery.data || listingsQuery.data.listings.length === 0}
            <div
                class="text-center py-32 bg-white rounded-[4rem] shadow-xl border border-slate-50 p-12 max-w-2xl mx-auto"
                in:fade
            >
                <div
                    class="w-32 h-32 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner group"
                >
                    <svg
                        class="w-16 h-16 text-slate-200 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="1.5"
                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                        />
                    </svg>
                </div>
                <h2
                    class="text-3xl font-black text-slate-900 mb-4 tracking-tight"
                >
                    No books found
                </h2>
                <p
                    class="text-slate-500 mb-10 font-medium leading-relaxed px-6"
                >
                    Be the first to list a book for sale in your
                    campus community!
                </p>
                <button
                    onclick={clearFilters}
                    class="px-10 py-5 bg-blue-600 text-white font-black rounded-[2rem] hover:bg-blue-700 transition-all shadow-2xl shadow-blue-200"
                >
                    All Books
                </button>
            </div>
        {:else}
            <div
                class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
                {#each listingsQuery.data.listings as book, i (book.id)}
                    <a
                        href="/books/{book.id}"
                        use:routeAction
                        class="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:border-blue-200 transition-all duration-300 transform hover:-translate-y-1 animate-slide-up"
                        style="animation-delay: {i * 50}ms"
                    >
                        <!-- Book Image -->
                        <div
                            class="relative h-48 bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden"
                        >
                            {#if book.images && book.images.length > 0}
                                <img
                                    src={book.images[0].imageUrl}
                                    alt={book.title}
                                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                            {:else}
                                <div
                                    class="w-full h-full flex items-center justify-center"
                                >
                                    <svg
                                        class="w-16 h-16 text-blue-200"
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

                            <!-- Condition Badge -->
                            <div class="absolute top-3 left-3">
                                <span
                                    class="px-2.5 py-1 text-xs font-semibold rounded-full {conditionColors[
                                        book.condition
                                    ]}"
                                >
                                    {conditionLabels[book.condition]}
                                </span>
                            </div>

                            <!-- Price Badge -->
                            <div class="absolute top-3 right-3">
                                <span
                                    class="px-3 py-1.5 bg-white/90 backdrop-blur-sm text-gray-900 text-sm font-bold rounded-full shadow-sm"
                                >
                                    {formatPrice(book.price)}
                                </span>
                            </div>
                        </div>

                        <!-- Book Info -->
                        <div class="p-4">
                            <h3
                                class="font-bold text-gray-900 line-clamp-1 group-hover:text-blue-600 transition-colors mb-1"
                            >
                                {book.title}
                            </h3>
                            <p class="text-sm text-gray-500 line-clamp-1 mb-3">
                                by {book.author}
                            </p>

                            {#if book.category}
                                <span
                                    class="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-md mb-3"
                                >
                                    {book.category.name}
                                </span>
                            {/if}

                            <div
                                class="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-50"
                            >
                                {#if book.seller}
                                    <div class="flex items-center gap-1.5">
                                        {#if book.seller.image}
                                            <img
                                                src={book.seller.image}
                                                alt=""
                                                class="w-5 h-5 rounded-full"
                                            />
                                        {:else}
                                            <div
                                                class="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center text-[10px] font-medium"
                                            >
                                                {book.seller.name.charAt(0)}
                                            </div>
                                        {/if}
                                        <span class="truncate max-w-[80px]"
                                            >{book.seller.name}</span
                                        >
                                    </div>
                                {/if}
                                <span>{getTimeAgo(book.createdAt)}</span>
                            </div>
                        </div>
                    </a>
                {/each}
            </div>

            <!-- Pagination -->
            {#if listingsQuery.data.pagination.totalPages > 1}
                <div class="flex items-center justify-center gap-2 mt-10">
                    <button
                        onclick={() =>
                            (currentPage = Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        class="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Previous
                    </button>
                    <span class="px-4 py-2 text-gray-600">
                        Page {currentPage} of {listingsQuery.data.pagination
                            .totalPages}
                    </span>
                    <button
                        onclick={() =>
                            (currentPage = Math.min(
                                listingsQuery.data.pagination.totalPages,
                                currentPage + 1,
                            ))}
                        disabled={currentPage ===
                            listingsQuery.data.pagination.totalPages}
                        class="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Next
                    </button>
                </div>
            {/if}
        {/if}
    </div>
</div>

<style>
    .animate-slide-up {
        animation: slideUp 0.4s ease-out forwards;
        opacity: 0;
    }

    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    @keyframes bounceSubtle {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-3px); }
    }

    .animate-bounce-subtle {
        animation: bounceSubtle 2s infinite ease-in-out;
    }

    .line-clamp-1 {
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    /* Custom Scrollbar for filter panel */
    select::-webkit-scrollbar {
        width: 8px;
    }
    select::-webkit-scrollbar-track {
        background: transparent;
    }
    select::-webkit-scrollbar-thumb {
        background: #e2e8f0;
        border-radius: 10px;
    }
</style>
