<script lang="ts">
  import {
    Router,
    type RouteConfig,
    type RouterInstance,
    query,
    goto,
    route,
  } from "@mateothegreat/svelte5-router";
  import { QueryClientProvider } from "@tanstack/svelte-query";
  import { queryClient } from "./lib/query-client";
  import { authClient } from "./lib/auth-client";
  import ErrorToast from "./components/ErrorToast.svelte";
  import Home from "./pages/Home.svelte";
  import Register from "./pages/Register.svelte";
  import Dashboard from "./pages/Dashboard.svelte";
  import Classroom from "./pages/Classroom.svelte";
  import Clubs from "./pages/Clubs.svelte";
  import ClubDetails from "./pages/ClubDetails.svelte";
  import ClubEvents from "./pages/ClubEvents.svelte";
  import AllEvents from "./pages/AllEvents.svelte";
  import EventDetails from "./pages/EventDetails.svelte";
  import EventCategoryDetails from "./pages/EventCategoryDetails.svelte";
  import CreateEvent from "./pages/CreateEvent.svelte";
  import CreateClub from "./pages/CreateClub.svelte";
  import MapPlaceholder from "./pages/MapPlaceholder.svelte";
  import BookMarketplace from "./pages/BookMarketplace.svelte";
  import BookDetails from "./pages/BookDetails.svelte";
  import SellBook from "./pages/SellBook.svelte";
  import MyBooks from "./pages/MyBooks.svelte";
  import Messages from "./pages/Messages.svelte";
  import Notices from "./pages/Notices.svelte";
  import Search from "./pages/Search.svelte";
  import Admin from "./pages/Admin.svelte";
  import Settings from "./pages/Settings.svelte";
  import Notifications from "./pages/Notifications.svelte";
  import GlobalSearch from "./components/GlobalSearch.svelte";
  import { onMount, type Component } from "svelte";
  import { getUnreadNotificationsCount } from "./lib/api";

  let MapComponent: Component | any = $state(null);

  onMount(() => {
    const loadMap = () => {
      import("./pages/Map.svelte").then((module) => {
        MapComponent = module.default;
      });
    };

    if (document.readyState === "complete") loadMap();
    else
      window.addEventListener("load", loadMap, {
        once: true,
      });
  });

  let instance: RouterInstance = $state()!;

  function normalizePath(path: string) {
    const clean = path.split("?")[0].split("#")[0];
    if (clean.length > 1 && clean.endsWith("/")) return clean.slice(0, -1);
    return clean;
  }

  function tryNormalizePath(path?: string | null) {
    if (!path) return null;
    return normalizePath(path);
  }

  let activePath = $state("/");

  function syncActivePathFromWindow() {
    if (typeof window === "undefined") return;
    activePath = normalizePath(window.location.pathname);
  }

  onMount(() => {
    syncActivePathFromWindow();
    window.addEventListener("pushState", syncActivePathFromWindow);
    window.addEventListener("replaceState", syncActivePathFromWindow);
    window.addEventListener("popstate", syncActivePathFromWindow);

    return () => {
      window.removeEventListener("pushState", syncActivePathFromWindow);
      window.removeEventListener("replaceState", syncActivePathFromWindow);
      window.removeEventListener("popstate", syncActivePathFromWindow);
    };
  });

  onMount(() => {
    const handleUnreadCountUpdate = (event: Event) => {
      const custom = event as CustomEvent<{ count?: number }>;
      unreadNotificationsCount = Math.max(0, custom.detail?.count ?? 0);
    };

    window.addEventListener(
      "notifications:unread-count",
      handleUnreadCountUpdate,
    );
    return () =>
      window.removeEventListener(
        "notifications:unread-count",
        handleUnreadCountUpdate,
      );
  });

  $effect(() => {
    const routerPath = tryNormalizePath(
      instance?.current?.result?.path?.original,
    );
    if (routerPath && routerPath !== activePath) {
      activePath = routerPath;
    }
  });

  const currentPath = $derived(activePath);

  const isMapRoute = $derived(currentPath === "/map");

  const session = authClient.useSession();
  let navUserCache = $state<any | null>(null);
  let navAuthResolved = $state(false);

  $effect(() => {
    const liveUser = ($session.data?.user as any) ?? null;

    if (!$session.isPending) {
      navAuthResolved = true;
    }

    if (liveUser) {
      navUserCache = liveUser;
      return;
    }

    // Clear cache only after initial auth has resolved and session settles as signed-out.
    if (navAuthResolved && !$session.isPending) {
      navUserCache = null;
    }
  });

  const navUser = $derived(($session.data?.user as any) ?? navUserCache);
  const showNavSessionLoader = $derived(!navAuthResolved && $session.isPending);
  const currentRole = $derived((navUser as any)?.role as string | undefined);
  const isGuestRole = $derived(currentRole === "guest");
  const isNoticeManagerRole = $derived(currentRole === "notice_manager");

  let unreadNotificationsCount = $state(0);
  let unreadNotificationsPoller: ReturnType<typeof setInterval> | null = null;

  async function refreshUnreadNotificationsCount() {
    if (!navUser) {
      unreadNotificationsCount = 0;
      return;
    }

    const result = await getUnreadNotificationsCount();
    unreadNotificationsCount = result.success ? result.count || 0 : 0;
  }

  $effect(() => {
    if (!navUser) {
      unreadNotificationsCount = 0;
      if (unreadNotificationsPoller) {
        clearInterval(unreadNotificationsPoller);
        unreadNotificationsPoller = null;
      }
      return;
    }

    refreshUnreadNotificationsCount();

    if (unreadNotificationsPoller) clearInterval(unreadNotificationsPoller);
    unreadNotificationsPoller = setInterval(
      refreshUnreadNotificationsCount,
      20000,
    );

    return () => {
      if (unreadNotificationsPoller) {
        clearInterval(unreadNotificationsPoller);
        unreadNotificationsPoller = null;
      }
    };
  });

  const error = query("message");
  let showError = $state(error === "unauthorized_domain");

  if (error === "unauthorized_domain") goto("/");

  const embed = query("embed");
  const isEmbedded = $derived(embed === "true");

  const navPillBase =
    "inline-flex h-10 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition-colors whitespace-nowrap";
  const navPillDefault =
    "border border-slate-200 bg-white text-slate-700 hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700";
  const navPillActive = "border border-cyan-200 bg-cyan-50 text-cyan-700";

  const utilityPillBase =
    "inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs sm:text-sm font-semibold transition-colors";
  const utilityPillDefault = "border border-slate-200 bg-white text-slate-700";

  function isRouteActive(href: string, exact = false) {
    const current = normalizePath(currentPath || "/");
    const target = normalizePath(href || "/");
    if (exact) return current === target;
    return current === target || current.startsWith(`${target}/`);
  }

  function navPillClass(href: string, exact = false) {
    return `${navPillBase} ${isRouteActive(href, exact) ? navPillActive : navPillDefault}`;
  }

  function utilityPillClass(href: string) {
    return `${utilityPillBase} ${isRouteActive(href) ? navPillActive : utilityPillDefault}`;
  }

  function isGuestAllowedPath(path: string) {
    const normalized = normalizePath(path || "/");
    if (normalized === "/dashboard" || normalized.startsWith("/dashboard/"))
      return false;
    if (normalized === "/classroom" || normalized.startsWith("/classroom/"))
      return false;
    if (normalized === "/books" || normalized.startsWith("/books/"))
      return false;
    if (normalized === "/messages" || normalized.startsWith("/messages/"))
      return false;
    if (normalized === "/admin" || normalized.startsWith("/admin/"))
      return false;
    if (normalized === "/settings" || normalized.startsWith("/settings/"))
      return false;
    if (normalized === "/create-club" || normalized.startsWith("/create-club/"))
      return false;
    if (/^\/clubs\/\d+\/events\/create(?:\/|$)/.test(normalized)) return false;
    return true;
  }

  function isNoticeManagerAllowedPath(path: string) {
    const normalized = normalizePath(path || "/");
    if (normalized === "/dashboard" || normalized.startsWith("/dashboard/"))
      return false;
    if (normalized === "/classroom" || normalized.startsWith("/classroom/"))
      return false;
    if (normalized === "/books" || normalized.startsWith("/books/"))
      return false;
    if (normalized === "/messages" || normalized.startsWith("/messages/"))
      return false;
    if (normalized === "/admin" || normalized.startsWith("/admin/"))
      return false;
    if (normalized === "/settings" || normalized.startsWith("/settings/"))
      return false;
    if (normalized === "/create-club" || normalized.startsWith("/create-club/"))
      return false;
    if (/^\/clubs\/\d+\/events\/create(?:\/|$)/.test(normalized)) return false;
    return true;
  }

  $effect(() => {
    if (!isGuestRole) return;
    if (isGuestAllowedPath(currentPath || "/")) return;
    goto("/");
  });

  $effect(() => {
    if (!isNoticeManagerRole) return;
    if (isNoticeManagerAllowedPath(currentPath || "/")) return;
    goto("/notices");
  });

  const routes: RouteConfig[] = [
    {
      component: Home,
    },
    {
      path: "register",
      component: Register,
    },
    {
      path: "dashboard",
      component: Dashboard,
    },
    {
      path: "classroom",
      component: Classroom,
    },
    {
      path: "create-club",
      component: CreateClub,
    },
    {
      path: "map",
      component: MapPlaceholder,
    },
    {
      path: /^\/events\/?$/,
      component: AllEvents,
    },
    {
      path: /^\/clubs\/(?<clubId>\d+)\/events\/create\/?$/,
      component: CreateEvent,
    },
    {
      path: /^\/clubs\/(?<clubId>\d+)\/events\/(?<eventId>\d+)\/?$/,
      component: EventDetails,
    },
    {
      path: /^\/clubs\/(?<clubId>\d+)\/categories\/(?<categoryId>\d+)\/?$/,
      component: EventCategoryDetails,
    },
    {
      path: /^\/clubs\/(?<clubId>\d+)\/events\/?$/,
      component: ClubEvents,
    },
    {
      path: /^\/clubs\/(?<clubId>\d+)\/?$/,
      component: ClubDetails,
    },
    {
      path: /^\/clubs\/?$/,
      component: Clubs,
    },
    {
      path: /^\/books\/?$/,
      component: BookMarketplace,
    },
    {
      path: /^\/books\/sell\/?$/,
      component: SellBook,
    },
    {
      path: /^\/books\/my-books\/?$/,
      component: MyBooks,
    },
    {
      path: /^\/books\/(?<bookId>\d+)\/?$/,
      component: BookDetails,
    },
    {
      path: /^\/messages\/?$/,
      component: Messages,
    },
    {
      path: /^\/notices\/?$/,
      component: Notices,
    },
    {
      path: /^\/search\/?$/,
      component: Search,
    },
    {
      path: /^\/admin\/?$/,
      component: Admin,
    },
    {
      path: /^\/notifications\/?$/,
      component: Notifications,
    },
    {
      path: /^\/settings\/?$/,
      component: Settings,
    },
  ];
</script>

<QueryClientProvider client={queryClient}>
  <div
    class="bg-[radial-gradient(circle_at_12%_0%,#dff9ff_0%,#f8fafc_40%,#eef2ff_100%)]"
  >
    {#if !isEmbedded}
      <header class="border-b border-cyan-100/70 bg-transparent">
        <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div class="rounded-2xl bg-transparent p-3 sm:p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <a use:route href="/" class="flex items-center gap-3 min-w-0">
                <img
                  src="/logo.png"
                  alt="Logo"
                  class="size-9 rounded-xl shadow-sm shadow-cyan-100/70 shrink-0"
                />
                <div class="min-w-0">
                  <p
                    class="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-600"
                  >
                    Pulchowk Digital
                  </p>
                  <p
                    class="text-lg sm:text-xl font-black text-slate-900 tracking-tight truncate"
                  >
                    Smart Pulchowk
                  </p>
                </div>
              </a>

              <div class="flex flex-wrap items-center gap-2 justify-end">
                {#if showNavSessionLoader}
                  <div
                    class="inline-flex h-10 items-center px-3 rounded-xl bg-white border border-slate-200"
                  >
                    <div
                      class="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin"
                    ></div>
                  </div>
                {:else if navUser}
                  {#if !isGuestRole && !isNoticeManagerRole}
                    <a
                      use:route
                      href="/dashboard"
                      class={`${utilityPillClass("/dashboard")} hover:bg-emerald-50 hover:text-emerald-700`}
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
                          d="M3 12l9-9 9 9M5 10v10h14V10"
                        />
                      </svg>
                      Dashboard
                    </a>
                  {/if}
                  <a
                    use:route
                    href="/notifications"
                    class={`${utilityPillClass("/notifications")} hover:bg-cyan-50 hover:text-cyan-700 relative`}
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
                        d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .53-.2 1.04-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      />
                    </svg>
                    Notifications
                    {#if unreadNotificationsCount > 0}
                      <span
                        class="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold"
                      >
                        {Math.min(unreadNotificationsCount, 99)}
                      </span>
                    {/if}
                  </a>
                  <a
                    use:route
                    href="/settings"
                    class={`${utilityPillClass("/settings")} hover:bg-slate-50 hover:text-slate-700`}
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
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    Settings
                  </a>
                  {#if currentRole === "student" || currentRole === "teacher"}
                    <a
                      use:route
                      href="/classroom"
                      class={`${utilityPillClass("/classroom")} hover:bg-emerald-50 hover:text-emerald-700`}
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
                          d="M4 6h16v10H4zM8 20h8"
                        />
                      </svg>
                      Classroom
                    </a>
                  {/if}
                  {#if currentRole === "admin"}
                    <a
                      use:route
                      href="/admin"
                      class="inline-flex h-10 items-center gap-2 px-3.5 text-xs sm:text-sm font-semibold rounded-xl transition-colors {isRouteActive(
                        '/admin',
                      )
                        ? 'text-white bg-linear-to-r from-slate-900 to-slate-700'
                        : 'text-slate-700 bg-white border border-slate-200 hover:bg-slate-50'}"
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
                          d="M12 3l7 4v5c0 5-3 8-7 9-4-1-7-4-7-9V7l7-4z"
                        />
                      </svg>
                      Admin
                    </a>
                  {/if}
                {:else}
                  <a
                    use:route
                    href="/register"
                    class="inline-flex h-10 items-center gap-2 px-4 text-sm font-semibold text-white bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 rounded-xl transition-colors active:scale-95"
                  >
                    Sign In
                  </a>
                {/if}
              </div>
            </div>

            <div
              class="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center"
            >
              <div class="min-w-0">
                <GlobalSearch />
              </div>

              <div class="flex items-center gap-2 overflow-x-auto pb-1 xl:pb-0">
                <a use:route href="/" class={navPillClass("/", true)}>
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
                      d="M3 10.5L12 3l9 7.5V21h-6v-6H9v6H3V10.5z"
                    />
                  </svg>
                  Home
                </a>
                <a use:route href="/clubs" class={navPillClass("/clubs")}>
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
                      d="M17 20h5v-2a4 4 0 00-5-3.87M17 20H7m10 0v-2c0-.65-.12-1.28-.34-1.87M7 20H2v-2a4 4 0 015-3.87M7 20v-2c0-.65.12-1.28.34-1.87M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  Clubs
                </a>
                <a use:route href="/events" class={navPillClass("/events")}>
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
                      d="M8 7V3m8 4V3m-9 8h10m-13 9h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v11a2 2 0 002 2z"
                    />
                  </svg>
                  Events
                </a>
                {#if !isGuestRole && !isNoticeManagerRole}
                  <a use:route href="/books" class={navPillClass("/books")}>
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
                        d="M12 6.25v13.5m0-13.5c-1.9-1.45-4.5-2.25-7.25-2.25v13.5c2.75 0 5.35.8 7.25 2.25m0-13.5c1.9-1.45 4.5-2.25 7.25-2.25v13.5c-2.75 0-5.35.8-7.25 2.25"
                      />
                    </svg>
                    Books
                  </a>
                {/if}
                <a use:route href="/map" class={navPillClass("/map")}>
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
                      d="M17.7 8.3A5.7 5.7 0 116.3 8.3c0 4.9 5.7 10.7 5.7 10.7s5.7-5.8 5.7-10.7z"
                    />
                    <circle cx="12" cy="8.3" r="2.2"></circle>
                  </svg>
                  Map
                </a>
                <a use:route href="/notices" class={navPillClass("/notices")}>
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
                      d="M8 3h7l4 4v13a1 1 0 01-1 1H8a2 2 0 01-2-2V5a2 2 0 012-2z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 3v5h5M10 12h6M10 16h6"
                    />
                  </svg>
                  Notices
                </a>
              </div>
            </div>
          </div>
        </nav>
      </header>
    {/if}

    <!-- Error Toast -->
    <ErrorToast bind:show={showError} title="Access Denied">
      Please use your <span class="font-medium text-gray-900"
        >@pcampus.edu.np</span
      >
      email address to sign in.
    </ErrorToast>

    <main
      class="{isEmbedded ? 'h-screen' : 'min-h-[calc(100vh-4rem)]'} relative"
    >
      {#if !isMapRoute}
        <div
          class="pointer-events-none absolute inset-0 z-0 opacity-35 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-size-[42px_42px]"
        ></div>
      {/if}
      {#if MapComponent}
        <div
          class="absolute inset-0 z-0 transition-opacity duration-300 {isMapRoute
            ? 'opacity-100 visible'
            : 'opacity-0 invisible pointer-events-none'}"
        >
          <MapComponent />
        </div>
      {/if}
      <div class={isMapRoute ? "hidden" : "contents"}>
        <Router bind:instance {routes} />
      </div>
    </main>
  </div>
</QueryClientProvider>
