<script lang="ts">
    import { goto } from "@mateothegreat/svelte5-router";
    import { fly, fade } from "svelte/transition";
    import { getEventCategory, type EventCategory } from "../lib/api";
    import LoadingSpinner from "../components/LoadingSpinner.svelte";

    const { route } = $props();
    const categoryId = $derived(route.result.path.params.categoryId);
    const clubId = $derived(route.result.path.params.clubId);

    let category = $state<EventCategory | null>(null);
    let loading = $state(true);
    let error = $state<string | null>(null);

    $effect(() => {
        if (categoryId) {
            loadData();
        }
    });

    async function loadData() {
        loading = true;
        error = null;
        try {
            const result = await getEventCategory(parseInt(categoryId));
            if (result.success && result.category) {
                category = result.category;
            } else {
                error = result.message || "Category not found";
            }
        } catch (err: any) {
            error = err.message || "An error occurred";
        } finally {
            loading = false;
        }
    }

    function textToPoints(text: string | null): string[] {
        if (!text) return [];
        return text.split("\n").filter((p) => p.trim() !== "");
    }
</script>

<div class="min-h-screen bg-gray-50/50">
    {#if loading}
        <div class="flex items-center justify-center min-h-[60vh]">
            <LoadingSpinner size="lg" text="Loading category details..." />
        </div>
    {:else if error}
        <div class="max-w-7xl mx-auto px-4 py-12">
            <div
                class="bg-red-50 border border-red-100 rounded-2xl p-6 text-center"
            >
                <h2 class="text-red-700 font-bold text-lg mb-2">Error</h2>
                <p class="text-red-600">{error}</p>
                <button
                    onclick={() => window.history.back()}
                    class="mt-4 px-6 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all"
                >
                    Go Back
                </button>
            </div>
        </div>
    {:else if category}
        <!-- Hero Section -->
        <div class="relative h-[400px] overflow-hidden bg-gray-900">
            {#if category.bannerUrl}
                <img
                    src={category.bannerUrl}
                    alt={category.name}
                    class="absolute inset-0 w-full h-full object-cover opacity-60"
                />
            {:else}
                <div
                    class="absolute inset-0 bg-gradient-to-br from-indigo-900 via-blue-900 to-purple-900 opacity-80"
                ></div>
                <!-- Decorative elements -->
                <div class="absolute top-0 left-0 w-full h-full">
                    <div
                        class="absolute top-20 left-10 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl animate-pulse"
                    ></div>
                    <div
                        class="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse"
                        style="animation-delay: 1s;"
                    ></div>
                </div>
            {/if}

            <div
                class="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent"
            ></div>

            <div
                class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-end pb-12"
            >
                <div in:fly={{ y: 30, duration: 800 }}>
                    <button
                        onclick={() => window.history.back()}
                        class="mb-6 flex items-center gap-2 text-white/80 hover:text-white transition-colors group"
                    >
                        <div
                            class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-all"
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
                        </div>
                        <span class="font-medium">Back to Club</span>
                    </button>

                    <h1
                        class="text-5xl md:text-6xl font-black text-white tracking-tight mb-4 drop-shadow-sm"
                    >
                        {category.name}
                    </h1>

                    <div
                        class="flex flex-wrap items-center gap-4 text-white/90"
                    >
                        {#if category.club}
                            <div
                                class="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/20"
                            >
                                {#if category.club.logoUrl}
                                    <img
                                        src={category.club.logoUrl}
                                        alt={category.club.name}
                                        class="w-6 h-6 rounded-full"
                                    />
                                {/if}
                                <span class="font-bold"
                                    >{category.club.name}</span
                                >
                            </div>
                        {/if}
                        <div
                            class="px-4 py-2 bg-indigo-600/30 backdrop-blur-md rounded-xl border border-indigo-400/30"
                        >
                            <span class="font-semibold">Event Type Profile</span
                            >
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Main Content -->
        <div
            class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 pb-20 relative z-10"
        >
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <!-- Left Column: Details -->
                <div class="lg:col-span-8 space-y-8">
                    <!-- Overview Card -->
                    <div
                        class="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8 md:p-10"
                        in:fly={{ y: 20, duration: 600, delay: 200 }}
                    >
                        <h2
                            class="text-2xl font-black text-gray-900 tracking-tight mb-6 flex items-center gap-3"
                        >
                            <div
                                class="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600"
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
                                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                            </div>
                            Overview
                        </h2>
                        <p
                            class="text-gray-600 leading-relaxed text-lg whitespace-pre-wrap"
                        >
                            {category.description ||
                                "No description available."}
                        </p>
                    </div>

                    <!-- Objectives Card -->
                    {#if category.objectives}
                        <div
                            class="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8 md:p-10"
                            in:fly={{ y: 20, duration: 600, delay: 300 }}
                        >
                            <h2
                                class="text-2xl font-black text-gray-900 tracking-tight mb-6 flex items-center gap-3"
                            >
                                <div
                                    class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600"
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
                                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                </div>
                                Key Objectives
                            </h2>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {#each textToPoints(category.objectives) as point}
                                    <div
                                        class="flex items-start gap-4 p-4 bg-blue-50/50 border border-blue-100/50 rounded-2xl group hover:bg-blue-50 transition-colors"
                                    >
                                        <div
                                            class="mt-1 w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold shrink-0"
                                        >
                                            <svg
                                                class="w-3 h-3"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                />
                                            </svg>
                                        </div>
                                        <span
                                            class="text-gray-700 leading-snug font-medium group-hover:text-blue-900 transition-colors"
                                            >{point}</span
                                        >
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    <!-- Details Grid (Rules & Criteria) -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {#if category.rules}
                            <div
                                class="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8"
                                in:fly={{ y: 20, duration: 600, delay: 400 }}
                            >
                                <h3
                                    class="text-xl font-black text-gray-900 mb-6 flex items-center gap-3"
                                >
                                    <div
                                        class="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600"
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
                                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                            />
                                        </svg>
                                    </div>
                                    Rules & Guidelines
                                </h3>
                                <ul class="space-y-3">
                                    {#each textToPoints(category.rules) as point}
                                        <li
                                            class="flex items-start gap-3 text-gray-600"
                                        >
                                            <div
                                                class="mt-1.5 w-1.5 h-1.5 bg-orange-400 rounded-full shrink-0"
                                            ></div>
                                            <span class="text-sm font-medium"
                                                >{point}</span
                                            >
                                        </li>
                                    {/each}
                                </ul>
                            </div>
                        {/if}

                        {#if category.judgingCriteria}
                            <div
                                class="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8"
                                in:fly={{ y: 20, duration: 600, delay: 500 }}
                            >
                                <h3
                                    class="text-xl font-black text-gray-900 mb-6 flex items-center gap-3"
                                >
                                    <div
                                        class="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600"
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
                                                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z"
                                            />
                                        </svg>
                                    </div>
                                    Judging Criteria
                                </h3>
                                <ul class="space-y-3">
                                    {#each textToPoints(category.judgingCriteria) as point}
                                        <li
                                            class="flex items-start gap-3 text-gray-600"
                                        >
                                            <div
                                                class="mt-1.5 w-1.5 h-1.5 bg-emerald-400 rounded-full shrink-0"
                                            ></div>
                                            <span class="text-sm font-medium"
                                                >{point}</span
                                            >
                                        </li>
                                    {/each}
                                </ul>
                            </div>
                        {/if}
                    </div>
                </div>

                <!-- Right Column: Quick Info -->
                <div class="lg:col-span-4 space-y-8">
                    <!-- Audience & Prerequisites -->
                    <div
                        class="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 text-white shadow-xl shadow-indigo-200"
                        in:fly={{ x: 20, duration: 600, delay: 300 }}
                    >
                        <div class="space-y-8">
                            {#if category.targetAudience}
                                <div>
                                    <h4
                                        class="text-indigo-100 text-xs font-bold uppercase tracking-widest mb-4"
                                    >
                                        Target Audience
                                    </h4>
                                    <div class="flex flex-wrap gap-2">
                                        {#each textToPoints(category.targetAudience) as point}
                                            <span
                                                class="px-3 py-1 bg-white/10 backdrop-blur-md rounded-lg text-sm font-medium"
                                            >
                                                {point}
                                            </span>
                                        {/each}
                                    </div>
                                </div>
                            {/if}

                            {#if category.prerequisites}
                                <div class="pt-6 border-t border-white/10">
                                    <h4
                                        class="text-indigo-100 text-xs font-bold uppercase tracking-widest mb-4"
                                    >
                                        Prerequisites
                                    </h4>
                                    <div class="space-y-3">
                                        {#each textToPoints(category.prerequisites) as point}
                                            <div
                                                class="flex items-center gap-3"
                                            >
                                                <svg
                                                    class="w-4 h-4 text-indigo-300"
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
                                                <span
                                                    class="text-sm font-medium"
                                                    >{point}</span
                                                >
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        </div>
                    </div>

                    <!-- Quick Action Card -->
                    <div
                        class="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8 text-center"
                        in:fly={{ x: 20, duration: 600, delay: 400 }}
                    >
                        <h4 class="font-black text-gray-900 text-xl mb-4">
                            Interested?
                        </h4>
                        <p class="text-gray-500 text-sm mb-6 leading-relaxed">
                            Check out the club's upcoming events to find one of
                            this type!
                        </p>
                        <button
                            onclick={() => goto(`/clubs/${clubId}/events`)}
                            class="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/30 active:scale-95"
                        >
                            View All Events
                        </button>
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    :global(.whitespace-pre-wrap) {
        white-space: pre-wrap;
    }
</style>
