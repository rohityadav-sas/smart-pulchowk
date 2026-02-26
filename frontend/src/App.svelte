<script lang="ts">
  import {
    Router,
    type RouteConfig,
    type RouterInstance,
    query,
    goto,
    replace,
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
  import LostFound from "./pages/LostFound.svelte";
  import LostFoundDetails from "./pages/LostFoundDetails.svelte";
  import ReportLostFound from "./pages/ReportLostFound.svelte";
  import MyLostFound from "./pages/MyLostFound.svelte";
  import Notices from "./pages/Notices.svelte";
  import Search from "./pages/Search.svelte";
  import Admin from "./pages/Admin.svelte";
  import Settings from "./pages/Settings.svelte";
  import Notifications from "./pages/Notifications.svelte";
  import Sidebar from "./components/Sidebar.svelte";
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
    const raw = (path || "").split("?")[0].split("#")[0];
    const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
    const clean = withLeadingSlash || "/";
    if (clean.length > 1 && clean.endsWith("/")) return clean.slice(0, -1);
    return clean;
  }

  let activePath = $state("/");

  function syncActivePathFromWindow() {
    if (typeof window === "undefined") return;
    const nextPath = normalizePath(window.location.pathname);
    if (nextPath !== activePath) {
      activePath = nextPath;
    }
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

  const currentPath = $derived(activePath);

  const isMapRoute = $derived(currentPath === "/map");

  const session = authClient.useSession();
  let navUserCache = $state<any | null>(null);
  let navUserCacheId = $state<string | null>(null);
  let navAuthResolved = $state(false);

  $effect(() => {
    const liveUser = ($session.data?.user as any) ?? null;

    if (!$session.isPending && !navAuthResolved) {
      navAuthResolved = true;
    }

    if (liveUser) {
      const liveUserId =
        typeof liveUser?.id === "string" ? (liveUser.id as string) : null;
      if (liveUserId !== navUserCacheId) {
        navUserCache = liveUser;
        navUserCacheId = liveUserId;
      }
      return;
    }

    // Clear cache only after initial auth has resolved and session settles as signed-out.
    if (navAuthResolved && !$session.isPending && navUserCacheId !== null) {
      navUserCache = null;
      navUserCacheId = null;
    }
  });

  const navUser = $derived(($session.data?.user as any) ?? navUserCache);
  const showNavSessionLoader = $derived(!navAuthResolved && $session.isPending);
  const currentRole = $derived((navUser as any)?.role as string | undefined);
  const isGuestRole = $derived(currentRole === "guest");
  const isNoticeManagerRole = $derived(currentRole === "notice_manager");
  let redirectInFlight = $state<string | null>(null);

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

  const messageQuery = query("message");
  const authErrorQuery = query("error");
  let showDomainInfo = $state(messageQuery === "unauthorized_domain");
  let showAuthError = $state(!!authErrorQuery);

  function humanizeErrorCode(code: string) {
    return code
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function mapAuthError(code: string | null | undefined) {
    if (!code) return null;
    switch (code) {
      case "internal_server_error":
        return {
          title: "Sign-In Failed",
          message:
            "A server error occurred while creating your session. Please try signing in again.",
        };
      case "access_denied":
        return {
          title: "Access Denied",
          message:
            "Your sign-in request was denied by the identity provider. Please try again.",
        };
      case "callback_failed":
        return {
          title: "Sign-In Callback Failed",
          message:
            "The login callback could not be completed. Please retry sign-in.",
        };
      default:
        return {
          title: "Authentication Error",
          message: `Sign-in failed: ${humanizeErrorCode(code)}.`,
        };
    }
  }

  const authErrorDetails = $derived(mapAuthError(authErrorQuery));

  $effect(() => {
    if (messageQuery !== "unauthorized_domain") return;
    showDomainInfo = true;
    if (normalizePath(currentPath || "/") !== "/") replace("/");
  });

  $effect(() => {
    showAuthError = !!authErrorDetails;
  });

  const embed = query("embed");
  let isSidebarOpen = $state(false);
  const isEmbedded = $derived(embed === "true");

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
    if (normalized === "/create-club" || normalized.startsWith("/create-club/"))
      return false;
    if (/^\/clubs\/\d+\/events\/create(?:\/|$)/.test(normalized)) return false;
    if (
      normalized === "/lost-found/report" ||
      normalized.startsWith("/lost-found/report/")
    )
      return false;
    if (
      normalized === "/lost-found/my" ||
      normalized.startsWith("/lost-found/my/")
    )
      return false;
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
    if (normalized === "/create-club" || normalized.startsWith("/create-club/"))
      return false;
    if (/^\/clubs\/\d+\/events\/create(?:\/|$)/.test(normalized)) return false;
    return true;
  }

  $effect(() => {
    const normalizedCurrent = normalizePath(currentPath || "/");

    if (redirectInFlight && normalizedCurrent === redirectInFlight) {
      redirectInFlight = null;
    }

    if (!isGuestRole) return;
    if (isGuestAllowedPath(normalizedCurrent)) return;

    const target = "/";
    if (normalizedCurrent === target || redirectInFlight === target) return;

    redirectInFlight = target;
    goto(target);
  });

  $effect(() => {
    const normalizedCurrent = normalizePath(currentPath || "/");

    if (redirectInFlight && normalizedCurrent === redirectInFlight) {
      redirectInFlight = null;
    }

    if (!isNoticeManagerRole) return;
    if (isNoticeManagerAllowedPath(normalizedCurrent)) return;

    const target = "/notices";
    if (normalizedCurrent === target || redirectInFlight === target) return;

    redirectInFlight = target;
    goto(target);
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
      path: /^\/lost-found\/report\/?$/,
      component: ReportLostFound,
    },
    {
      path: /^\/lost-found\/my\/?$/,
      component: MyLostFound,
    },
    {
      path: /^\/lost-found\/(?<id>\d+)\/?$/,
      component: LostFoundDetails,
    },
    {
      path: /^\/lost-found\/?$/,
      component: LostFound,
    },
    {
      path: /^\/notices\/(?<category>results|application_forms|exam_centers|exam_routines|general)\/?$/,
      component: Notices,
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
    class="flex min-h-screen bg-[radial-gradient(circle_at_12%_0%,#dff9ff_0%,#f8fafc_40%,#eef2ff_100%)]"
  >
    {#if !isEmbedded}
      <Sidebar
        {navUser}
        {currentRole}
        {unreadNotificationsCount}
        {currentPath}
        {isGuestRole}
        {isNoticeManagerRole}
        {showNavSessionLoader}
        bind:isOpen={isSidebarOpen}
      />
    {/if}

    <div class="flex-1 flex flex-col min-w-0">
      {#if !isEmbedded}
        <!-- Mobile Header -->
        <header
          class="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-cyan-100/70 bg-white/50 backdrop-blur-xl px-4 md:hidden shrink-0"
        >
          <div class="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" class="size-8 rounded-lg" />
            <span class="font-black text-slate-900">Smart Pulchowk</span>
          </div>
          <button
            class="p-2 text-slate-600 hover:text-cyan-600 transition-colors"
            onclick={() => (isSidebarOpen = true)}
            aria-label="Open sidebar"
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
                d="M4 6h16M4 12h16m-7 6h7"
              />
            </svg>
          </button>
        </header>
      {/if}

      <!-- Error Toast -->
      <ErrorToast bind:show={showDomainInfo} title="Sign-In Info">
        Valid student-format <span class="font-medium text-gray-900"
          >@pcampus.edu.np</span
        >
        emails get student access. Other emails can continue with guest access.
      </ErrorToast>
      <ErrorToast
        bind:show={showAuthError}
        title={authErrorDetails?.title || "Authentication Error"}
      >
        {authErrorDetails?.message ||
          "Something went wrong during sign-in. Please try again."}
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
  </div>
</QueryClientProvider>
