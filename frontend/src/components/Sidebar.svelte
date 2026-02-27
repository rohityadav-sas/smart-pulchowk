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
        sidebarWidth?: number;
        isResizing?: boolean;
        isCollapsed?: boolean;
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
        sidebarWidth = $bindable(260),
        isResizing = $bindable(false),
        isCollapsed = $bindable(false),
    }: Props = $props();

    const MIN_SIDEBAR_WIDTH = 260;
    const MAX_SIDEBAR_WIDTH = 450;
    const COLLAPSED_WIDTH = 86;

    let preCollapsedWidth = $state(260);
    let shouldFocusSearch = $state(false);

    function toggleSidebar() {
        if (isCollapsed) {
            sidebarWidth = preCollapsedWidth;
            isCollapsed = false;
        } else {
            preCollapsedWidth = sidebarWidth;
            sidebarWidth = COLLAPSED_WIDTH;
            isCollapsed = true;
        }
    }

    function startResizing(e: MouseEvent) {
        e.preventDefault();
        isResizing = true;
        document.body.classList.add("is-resizing-active");
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", stopResizing);
    }

    function handleMouseMove(e: MouseEvent) {
        if (!isResizing) return;

        const clampedWidth = Math.max(
            MIN_SIDEBAR_WIDTH,
            Math.min(e.clientX, MAX_SIDEBAR_WIDTH),
        );

        sidebarWidth = clampedWidth;
        isCollapsed = false;
    }

    function stopResizing() {
        isResizing = false;
        document.body.classList.remove("is-resizing-active");
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

    function handleLinkClick() {
        if (window.innerWidth < 768) {
            isOpen = false;
        }
    }
    function expandAndFocusSearch(e?: MouseEvent) {
        e?.stopPropagation();
        sidebarWidth = 260;
        isCollapsed = false;
        shouldFocusSearch = true;
        setTimeout(() => {
            shouldFocusSearch = false;
        }, 100);
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
    class="fixed inset-y-0 left-0 z-50 flex flex-col bg-white/80 backdrop-blur-xl border-r border-slate-200/60 {isResizing
        ? ''
        : 'transition-[width] duration-500 ease-in-out'} group/sidebar {isOpen
        ? 'translate-x-0'
        : '-translate-x-full'}"
    style="width: {sidebarWidth}px; will-change: width;"
>
    <!-- Resize Handle -->
    <div
        class="absolute -right-3 top-0 bottom-0 w-6 cursor-col-resize group/handle z-50 hidden md:flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300"
    >
        <div
            class="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-slate-200 group-hover/handle:bg-cyan-400 group-hover/handle:w-0.5 transition-all"
        ></div>

        <!-- Resize trigger overlay to make grabbing easier -->
        <div
            class="absolute inset-0 z-0"
            onmousedown={(e: MouseEvent) => startResizing(e)}
            role="presentation"
        ></div>

        <!-- Collapse Toggle Button -->
        <button
            onclick={(e) => {
                e.stopPropagation();
                toggleSidebar();
            }}
            class="relative z-10 flex size-6.5 items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-cyan-600 hover:border-cyan-200 hover:scale-110 active:scale-95 transition-all duration-200"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
            <svg
                class="size-4.5 transition-transform duration-300 {isCollapsed
                    ? ''
                    : 'rotate-180'}"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2.5"
                    d="M9 5l7 7-7 7"
                />
            </svg>
        </button>
    </div>

    <!-- Logo & Branding -->
    <div class="p-6">
        <div class="flex items-center gap-3 overflow-hidden">
            <a
                use:route
                href="/"
                class="flex items-center gap-3 overflow-hidden"
                onclick={handleLinkClick}
            >
                <img
                    src="/logo.png"
                    alt="Logo"
                    class="size-10 rounded-xl shadow-lg shadow-cyan-100/50 shrink-0"
                />
                <div
                    class="min-w-0 transition-all duration-500 ease-in-out origin-left flex flex-col justify-center"
                    class:opacity-0={isCollapsed}
                    class:scale-x-0={isCollapsed}
                    class:w-0={isCollapsed}
                    class:pointer-events-none={isCollapsed}
                >
                    <p
                        class="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-600 leading-none mb-1 whitespace-nowrap"
                    >
                        Pulchowk Digital
                    </p>
                    <p
                        class="text-xl font-black text-slate-900 tracking-tight whitespace-nowrap"
                    >
                        Smart Pulchowk
                    </p>
                </div>
            </a>
        </div>
    </div>

    <div class="px-4 mb-6 transition-all duration-500 relative z-20">
        <div class="relative w-full">
            <div
                class="transition-all duration-500 {isCollapsed
                    ? 'opacity-0 scale-95 pointer-events-none'
                    : 'opacity-100 scale-100'}"
            >
                <GlobalSearch size="sm" autofocus={shouldFocusSearch} />
            </div>

            {#if isCollapsed}
                <button
                    class="absolute inset-0 w-full aspect-square flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-cyan-600 transition-all duration-300 transform scale-110"
                    aria-label="Search"
                    onclick={(e) => expandAndFocusSearch(e)}
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
            {/if}
        </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto px-4 space-y-1 custom-scrollbar">
        <div class="space-y-1">
            <a
                use:route
                href="/"
                class={getNavItemClass("/", true)}
                onclick={handleLinkClick}
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
                        d="M3 10.5L12 3l9 7.5V21h-6v-6H9v6H3V10.5z"
                    />
                </svg>
                <span
                    class="font-semibold text-sm transition-all duration-500 whitespace-nowrap origin-left"
                    class:opacity-0={isCollapsed}
                    class:scale-x-0={isCollapsed}
                    class:w-0={isCollapsed}
                    class:ml-0={isCollapsed}
                    class:pointer-events-none={isCollapsed}>Home</span
                >
            </a>

            <a
                use:route
                href="/clubs"
                class={getNavItemClass("/clubs")}
                onclick={handleLinkClick}
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
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                </svg>
                <span
                    class="font-semibold text-sm transition-all duration-500 whitespace-nowrap origin-left"
                    class:opacity-0={isCollapsed}
                    class:scale-x-0={isCollapsed}
                    class:w-0={isCollapsed}
                    class:ml-0={isCollapsed}
                    class:pointer-events-none={isCollapsed}>Clubs</span
                >
            </a>

            <a
                use:route
                href="/events"
                class={getNavItemClass("/events")}
                onclick={handleLinkClick}
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
                        d="M8 7V3m8 4V3m-9 8h10m-13 9h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v11a2 2 0 002 2z"
                    />
                </svg>
                <span
                    class="font-semibold text-sm transition-all duration-500 whitespace-nowrap origin-left"
                    class:opacity-0={isCollapsed}
                    class:scale-x-0={isCollapsed}
                    class:w-0={isCollapsed}
                    class:ml-0={isCollapsed}
                    class:pointer-events-none={isCollapsed}>Events</span
                >
            </a>

            {#if !isGuestRole && !isNoticeManagerRole}
                <a
                    use:route
                    href="/books"
                    class={getNavItemClass("/books")}
                    onclick={handleLinkClick}
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
                            d="M12 6.25v13.5m0-13.5c-1.9-1.45-4.5-2.25-7.25-2.25v13.5c2.75 0 5.35.8 7.25 2.25m0-13.5c1.9-1.45 4.5-2.25 7.25-2.25v13.5c-2.75 0-5.35.8-7.25 2.25"
                        />
                    </svg>
                    <span
                        class="font-semibold text-sm transition-all duration-500 whitespace-nowrap origin-left"
                        class:opacity-0={isCollapsed}
                        class:scale-x-0={isCollapsed}
                        class:w-0={isCollapsed}
                        class:ml-0={isCollapsed}
                        class:pointer-events-none={isCollapsed}
                        >Book Marketplace</span
                    >
                </a>
            {/if}

            <a
                use:route
                href="/lost-found"
                class={getNavItemClass("/lost-found")}
                onclick={handleLinkClick}
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
                <span
                    class="font-semibold text-sm transition-all duration-500 whitespace-nowrap origin-left"
                    class:opacity-0={isCollapsed}
                    class:scale-x-0={isCollapsed}
                    class:w-0={isCollapsed}
                    class:ml-0={isCollapsed}
                    class:pointer-events-none={isCollapsed}>Lost & Found</span
                >
            </a>

            <a
                use:route
                href="/map"
                class={getNavItemClass("/map")}
                onclick={handleLinkClick}
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
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                </svg>
                <span
                    class="font-semibold text-sm transition-all duration-500 whitespace-nowrap origin-left"
                    class:opacity-0={isCollapsed}
                    class:scale-x-0={isCollapsed}
                    class:w-0={isCollapsed}
                    class:ml-0={isCollapsed}
                    class:pointer-events-none={isCollapsed}>Map</span
                >
            </a>

            <a
                use:route
                href="/notices"
                class={getNavItemClass("/notices")}
                onclick={handleLinkClick}
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
                        d="M8 3h7l4 4v13a1 1 0 01-1 1H8a2 2 0 01-2-2V5a2 2 0 012-2z"
                    />
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 3v5h5M10 12h6M10 16h6"
                    />
                </svg>
                <span
                    class="font-semibold text-sm transition-all duration-500 whitespace-nowrap origin-left"
                    class:opacity-0={isCollapsed}
                    class:scale-x-0={isCollapsed}
                    class:w-0={isCollapsed}
                    class:ml-0={isCollapsed}
                    class:pointer-events-none={isCollapsed}>Notices</span
                >
            </a>
        </div>

        <div class="pt-6 mt-6 border-t border-slate-100">
            <span
                class="px-3 mb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider transition-all duration-500 whitespace-nowrap block overflow-hidden origin-left"
                class:opacity-0={isCollapsed}
                class:scale-x-0={isCollapsed}
                class:h-0={isCollapsed}
                class:mb-0={isCollapsed}
                class:pointer-events-none={isCollapsed}>Utilities</span
            >

            {#if navUser && !isGuestRole && !isNoticeManagerRole}
                <a
                    use:route
                    href="/dashboard"
                    class={getNavItemClass("/dashboard")}
                    onclick={handleLinkClick}
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
                    <span
                        class="font-semibold text-sm transition-all duration-500 whitespace-nowrap origin-left"
                        class:opacity-0={isCollapsed}
                        class:scale-x-0={isCollapsed}
                        class:w-0={isCollapsed}
                        class:ml-0={isCollapsed}
                        class:pointer-events-none={isCollapsed}>Dashboard</span
                    >
                </a>
            {/if}

            <a
                use:route
                href="/notifications"
                class={getNavItemClass("/notifications")}
                onclick={handleLinkClick}
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
                <span
                    class="font-semibold text-sm transition-all duration-500 whitespace-nowrap origin-left"
                    class:opacity-0={isCollapsed}
                    class:scale-x-0={isCollapsed}
                    class:w-0={isCollapsed}
                    class:ml-0={isCollapsed}
                    class:pointer-events-none={isCollapsed}>Notifications</span
                >
            </a>

            {#if currentRole === "student" || currentRole === "teacher"}
                <a
                    use:route
                    href="/classroom"
                    class={getNavItemClass("/classroom")}
                    onclick={handleLinkClick}
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
                    <span
                        class="font-semibold text-sm transition-all duration-500 whitespace-nowrap origin-left"
                        class:opacity-0={isCollapsed}
                        class:scale-x-0={isCollapsed}
                        class:w-0={isCollapsed}
                        class:ml-0={isCollapsed}
                        class:pointer-events-none={isCollapsed}>Classroom</span
                    >
                </a>
            {/if}

            {#if currentRole === "admin"}
                <a
                    use:route
                    href="/admin"
                    class={getNavItemClass("/admin")}
                    onclick={handleLinkClick}
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
    <div class="px-4 py-2 border-t border-slate-100 bg-slate-50/50">
        {#if showNavSessionLoader}
            <div class="flex items-center gap-3 px-2 py-6">
                <div
                    class="w-9 h-9 rounded-full bg-slate-200 animate-pulse shrink-0"
                ></div>
                {#if !isCollapsed}
                    <div class="flex-1 space-y-1.5 min-w-0">
                        <div
                            class="h-3 w-28 bg-slate-200 rounded animate-pulse"
                        ></div>
                        <div
                            class="h-2 w-16 bg-slate-200 rounded animate-pulse"
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
                <div
                    class="min-w-0 flex-1 transition-all duration-500 origin-left"
                    class:opacity-0={isCollapsed}
                    class:scale-x-0={isCollapsed}
                    class:w-0={isCollapsed}
                    class:pointer-events-none={isCollapsed}
                >
                    <p class="text-sm font-bold text-slate-900 truncate">
                        {navUser.name}
                    </p>
                    <p
                        class="text-[10px] text-slate-500 font-medium truncate uppercase tracking-tight"
                    >
                        {currentRole}
                    </p>
                </div>
                <div
                    class="transition-all duration-500 origin-right"
                    class:opacity-0={isCollapsed}
                    class:scale-0={isCollapsed}
                    class:w-0={isCollapsed}
                    class:pointer-events-none={isCollapsed}
                >
                    <a
                        use:route
                        href="/settings"
                        class="p-1 text-slate-400 hover:text-cyan-600 transition-colors"
                        aria-label="Settings"
                        onclick={handleLinkClick}
                    >
                        <svg
                            class="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            viewBox="0 0 24 24"
                        >
                            <path
                                d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z"
                            />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                    </a>
                </div>
            </div>
        {:else}
            <a
                use:route
                href="/register"
                class="flex flex-row items-center justify-center {sidebarWidth <
                    200 && !isCollapsed
                    ? 'gap-1.5 px-2 py-2'
                    : 'gap-3 px-3 py-2.5'} rounded-xl bg-linear-to-r from-cyan-600 to-blue-600 text-white font-bold shadow-md shadow-cyan-200/50 hover:shadow-lg transition-all active:scale-95 overflow-hidden w-full"
                onclick={handleLinkClick}
            >
                <svg
                    class="{sidebarWidth < 200
                        ? 'w-4 h-4'
                        : 'w-5 h-5'} shrink-0"
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
                <span
                    class="transition-all duration-500 whitespace-nowrap origin-left"
                    class:opacity-0={isCollapsed}
                    class:scale-x-0={isCollapsed}
                    class:w-0={isCollapsed}
                    class:ml-0={isCollapsed}
                    class:pointer-events-none={isCollapsed}
                >
                    <span
                        class="{sidebarWidth < 200
                            ? 'text-[11px]'
                            : 'text-sm'} leading-tight"
                    >
                        Sign In
                    </span>
                </span>
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

    :global(body.is-resizing-active) {
        user-select: none !important;
        cursor: col-resize !important;
    }
</style>
