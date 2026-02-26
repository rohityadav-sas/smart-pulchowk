<script lang="ts">
    import { route } from "@mateothegreat/svelte5-router";
    import GlobalSearch from "./GlobalSearch.svelte";
    import { onMount } from "svelte";

    interface Props {
        navUser: any;
        currentRole: string | undefined;
        unreadNotificationsCount: number;
        currentPath: string;
        isGuestRole: boolean;
        isNoticeManagerRole: boolean;
        showNavSessionLoader: boolean;
        isOpen?: boolean;
    }

    let {
        navUser,
        currentRole,
        unreadNotificationsCount,
        currentPath,
        isGuestRole,
        isNoticeManagerRole,
        showNavSessionLoader,
        isOpen = $bindable(false),
    }: Props = $props();

    let sidebarWidth = $state(260);
    let isResizing = $state(false);
    let isCollapsed = $state(false);

    function startResizing() {
        isResizing = true;
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", stopResizing);
    }

    function handleMouseMove(e: MouseEvent) {
        if (!isResizing) return;
        const newWidth = e.clientX;
        if (newWidth >= 64 && newWidth < 450) {
            if (newWidth < 120) {
                sidebarWidth = 80;
                isCollapsed = true;
            } else {
                sidebarWidth = newWidth;
                isCollapsed = false;
            }
        }
    }

    function stopResizing() {
        isResizing = false;
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", stopResizing);
    }

    function isRouteActive(href: string, exact = false) {
        const normalizePath = (p: string) => {
            const raw = (p || "").split("?")[0].split("#")[0];
            const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
            const clean = withLeadingSlash || "/";
            if (clean.length > 1 && clean.endsWith("/"))
                return clean.slice(0, -1);
            return clean;
        };
        const current = normalizePath(currentPath || "/");
        const target = normalizePath(href || "/");
        if (exact) return current === target;
        return current === target || current.startsWith(`${target}/`);
    }

    const navItemBase =
        "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative";
    const navItemActive =
        "bg-cyan-50 text-cyan-700 shadow-sm border border-cyan-100/50";
    const navItemInactive =
        "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent";

    function getNavItemClass(href: string, exact = false) {
        return `${navItemBase} ${isRouteActive(href, exact) ? navItemActive : navItemInactive}`;
    }
</script>

<!-- Mobile Overlay -->
{#if isOpen}
    <button
        class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
        onclick={() => (isOpen = false)}
        aria-label="Close sidebar"
    ></button>
{/if}

<aside
    class="fixed inset-y-0 left-0 z-50 flex flex-col bg-white/80 backdrop-blur-xl border-r border-slate-200/60 transition-transform duration-300 md:relative md:translate-x-0 group/sidebar {isOpen
        ? 'translate-x-0'
        : '-translate-x-full'}"
    style="width: {sidebarWidth}px"
>
    <!-- Resize Handle -->
    <button
        class="absolute -right-3 top-0 bottom-0 w-6 cursor-col-resize group z-50 hidden md:block opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300"
        onmousedown={startResizing}
        aria-label="Resize sidebar"
    >
        <div
            class="absolute inset-y-0 left-1/2 w-[2px] bg-slate-200 group-hover:bg-cyan-400 transition-colors"
        ></div>
    </button>

    <!-- Logo & Branding -->
    <div class="p-6">
        <div class="flex items-center gap-3 overflow-hidden">
            <a
                use:route
                href="/"
                class="flex items-center gap-3 overflow-hidden"
            >
                <img
                    src="/logo.png"
                    alt="Logo"
                    class="size-10 rounded-xl shadow-lg shadow-cyan-100/50 shrink-0"
                />
                {#if !isCollapsed}
                    <div class="min-w-0 transition-opacity duration-300">
                        <p
                            class="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-600 leading-none mb-1"
                        >
                            Pulchowk Digital
                        </p>
                        <p
                            class="text-xl font-black text-slate-900 tracking-tight whitespace-nowrap"
                        >
                            Smart Pulchowk
                        </p>
                    </div>
                {/if}
            </a>
        </div>
    </div>

    <!-- Search -->
    <div class="px-4 mb-6">
        {#if isCollapsed}
            <button
                class="w-full aspect-square flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-cyan-600 transition-colors"
                aria-label="Search"
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
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                </svg>
            </button>
        {:else}
            <GlobalSearch size="sm" />
        {/if}
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto px-4 space-y-1 custom-scrollbar">
        <div class="space-y-1">
            <a use:route href="/" class={getNavItemClass("/", true)}>
                <svg
                    class="w-5 h-5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M3 10.5L12 3l9 7.5V21h-6v-6H9v6H3V10.5z"
                    />
                </svg>
                {#if !isCollapsed}
                    <span class="font-semibold text-sm">Home</span>
                {/if}
            </a>

            <a use:route href="/clubs" class={getNavItemClass("/clubs")}>
                <svg
                    class="w-5 h-5 shrink-0"
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
                {#if !isCollapsed}
                    <span class="font-semibold text-sm">Clubs</span>
                {/if}
            </a>

            <a use:route href="/events" class={getNavItemClass("/events")}>
                <svg
                    class="w-5 h-5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8 7V3m8 4V3m-9 8h10m-13 9h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v11a2 2 0 002 2z"
                    />
                </svg>
                {#if !isCollapsed}
                    <span class="font-semibold text-sm">Events</span>
                {/if}
            </a>

            {#if !isGuestRole && !isNoticeManagerRole}
                <a use:route href="/books" class={getNavItemClass("/books")}>
                    <svg
                        class="w-5 h-5 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 6.25v13.5m0-13.5c-1.9-1.45-4.5-2.25-7.25-2.25v13.5c2.75 0 5.35.8 7.25 2.25m0-13.5c1.9-1.45 4.5-2.25 7.25-2.25v13.5c-2.75 0-5.35.8-7.25 2.25"
                        />
                    </svg>
                    {#if !isCollapsed}
                        <span class="font-semibold text-sm"
                            >Book Marketplace</span
                        >
                    {/if}
                </a>
            {/if}

            <a
                use:route
                href="/lost-found"
                class={getNavItemClass("/lost-found")}
            >
                <svg
                    class="w-5 h-5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M20 13V7a2 2 0 00-2-2h-3V3H9v2H6a2 2 0 00-2 2v6m16 0v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6m16 0H4"
                    />
                </svg>
                {#if !isCollapsed}
                    <span class="font-semibold text-sm">Lost & Found</span>
                {/if}
            </a>

            <a use:route href="/map" class={getNavItemClass("/map")}>
                <svg
                    class="w-5 h-5 shrink-0"
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
                {#if !isCollapsed}
                    <span class="font-semibold text-sm">Map</span>
                {/if}
            </a>

            <a use:route href="/notices" class={getNavItemClass("/notices")}>
                <svg
                    class="w-5 h-5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8 3h7l4 4v13a1 1 0 01-1 1H8a2 2 0 01-2-2V5a2 2 0 012-2z"
                    />
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 3v5h5M10 12h6M10 16h6"
                    />
                </svg>
                {#if !isCollapsed}
                    <span class="font-semibold text-sm">Notices</span>
                {/if}
            </a>
        </div>

        <div class="pt-6 mt-6 border-t border-slate-100">
            {#if !isCollapsed}
                <p
                    class="px-3 mb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider"
                >
                    Utilities
                </p>
            {/if}

            {#if navUser && !isGuestRole && !isNoticeManagerRole}
                <a
                    use:route
                    href="/dashboard"
                    class={getNavItemClass("/dashboard")}
                >
                    <svg
                        class="w-5 h-5 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M3 12l9-9 9 9M5 10v10h14V10"
                        />
                    </svg>
                    {#if !isCollapsed}
                        <span class="font-semibold text-sm">Dashboard</span>
                    {/if}
                </a>
            {/if}

            <a
                use:route
                href="/notifications"
                class={getNavItemClass("/notifications")}
            >
                <div class="relative">
                    <svg
                        class="w-5 h-5 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .53-.2 1.04-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                        />
                    </svg>
                    {#if unreadNotificationsCount > 0}
                        <span
                            class="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-white"
                        >
                            {Math.min(unreadNotificationsCount, 99)}
                        </span>
                    {/if}
                </div>
                {#if !isCollapsed}
                    <span class="font-semibold text-sm">Notifications</span>
                {/if}
            </a>

            {#if currentRole === "student" || currentRole === "teacher"}
                <a
                    use:route
                    href="/classroom"
                    class={getNavItemClass("/classroom")}
                >
                    <svg
                        class="w-5 h-5 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 6h16v10H4zM8 20h8"
                        />
                    </svg>
                    {#if !isCollapsed}
                        <span class="font-semibold text-sm">Classroom</span>
                    {/if}
                </a>
            {/if}

            {#if currentRole === "admin"}
                <a use:route href="/admin" class={getNavItemClass("/admin")}>
                    <svg
                        class="w-5 h-5 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 3l7 4v5c0 5-3 8-7 9-4-1-7-4-7-9V7l7-4z"
                        />
                    </svg>
                    {#if !isCollapsed}
                        <span class="font-semibold text-sm">Admin Panel</span>
                    {/if}
                </a>
            {/if}
        </div>
    </nav>

    <!-- User Profile / Footer -->
    <div class="p-4 border-t border-slate-100 bg-slate-50/50">
        {#if showNavSessionLoader}
            <div class="flex items-center gap-3 px-2 py-1">
                <div
                    class="w-8 h-8 rounded-full bg-slate-200 animate-pulse"
                ></div>
                {#if !isCollapsed}
                    <div class="flex-1 space-y-1">
                        <div
                            class="h-3 w-20 bg-slate-200 rounded animate-pulse"
                        ></div>
                        <div
                            class="h-2 w-12 bg-slate-200 rounded animate-pulse"
                        ></div>
                    </div>
                {/if}
            </div>
        {:else if navUser}
            <div class="flex items-center gap-3 px-2 py-1 overflow-hidden">
                <div
                    class="size-9 rounded-full bg-linear-to-tr from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm overflow-hidden"
                >
                    {#if navUser.image}
                        <img
                            src={navUser.image}
                            alt={navUser.name}
                            class="w-full h-full object-cover"
                        />
                    {:else}
                        {navUser.name?.charAt(0) || "U"}
                    {/if}
                </div>
                {#if !isCollapsed}
                    <div class="min-w-0 flex-1">
                        <p class="text-sm font-bold text-slate-900 truncate">
                            {navUser.name}
                        </p>
                        <p
                            class="text-[10px] text-slate-500 font-medium truncate uppercase tracking-tight"
                        >
                            {currentRole}
                        </p>
                    </div>
                    <a
                        use:route
                        href="/settings"
                        class="p-1 text-slate-400 hover:text-cyan-600 transition-colors"
                        aria-label="Settings"
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
                                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                            />
                        </svg>
                    </a>
                {/if}
            </div>
        {:else}
            <a
                use:route
                href="/register"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-linear-to-r from-cyan-600 to-blue-600 text-white font-bold text-sm shadow-md shadow-cyan-200/50 hover:shadow-lg transition-all active:scale-95 overflow-hidden"
            >
                <svg
                    class="w-5 h-5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                    />
                </svg>
                {#if !isCollapsed}
                    <span>Sign In</span>
                {/if}
            </a>
        {/if}
    </div>
</aside>

<style>
    .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #e2e8f0;
        border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #cbd5e1;
    }
</style>
