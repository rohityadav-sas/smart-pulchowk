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
  import LoadingSpinner from "./components/LoadingSpinner.svelte";
  import ErrorToast from "./components/ErrorToast.svelte";
  import Home from "./pages/Home.svelte";
  import Register from "./pages/Register.svelte";
  import Dashboard from "./pages/Dashboard.svelte";
  import Clubs from "./pages/Clubs.svelte";
  import ClubDetails from "./pages/ClubDetails.svelte";
  import ClubEvents from "./pages/ClubEvents.svelte";
  import AllEvents from "./pages/AllEvents.svelte";
  import EventDetails from "./pages/EventDetails.svelte";
  import EventCategoryDetails from "./pages/EventCategoryDetails.svelte";
  import CreateEvent from "./pages/CreateEvent.svelte";
  import CreateClub from "./pages/CreateClub.svelte";
  import MapPlaceholder from "./pages/MapPlaceholder.svelte";
  import { onMount, type Component } from "svelte";

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

  const isMapRoute = $derived(instance?.current?.route?.path === "/map");

  const session = authClient.useSession();

  const error = query("message");
  let showError = $state(error === "unauthorized_domain");

  $effect(() => {
    if (error === "unauthorized_domain") {
      goto("/");
    }
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
  ];
</script>

<QueryClientProvider client={queryClient}>
  <nav
    class="bg-white/80 border-b border-gray-200 sticky top-0 z-50 backdrop-blur-md"
  >
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <a href="/" class="flex items-center gap-2.5 group">
          <div
            class="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20 transition-transform group-hover:scale-105"
          >
            <span class="text-white font-bold text-lg">P</span>
          </div>
          <span
            class="text-xl font-bold text-gray-900 tracking-tight group-hover:text-blue-600 transition-colors"
            >PulchowkX</span
          >
        </a>
        <div class="flex items-center gap-1 sm:gap-2">
          <a
            use:route
            href="/"
            class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all"
            >Home</a
          >
          <a
            use:route
            href="/clubs"
            class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all"
            >Clubs</a
          >
          <a
            use:route
            href="/events"
            class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all"
            >Events</a
          >
          <a
            use:route
            href="/map"
            class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all"
            >Map</a
          >
          {#if $session.isPending}
            <div class="px-4 py-2 flex items-center justify-center min-w-22.5">
              <div
                class="w-4 h-4 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin"
              ></div>
            </div>
          {:else if $session.data?.user}
            <a
              use:route
              href="/dashboard"
              class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all"
              >Dashboard</a
            >
          {:else}
            <a
              href="/register"
              class="ml-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95"
              >Sign In</a
            >
          {/if}
        </div>
      </div>
    </div>
  </nav>

  <!-- Error Toast -->
  <ErrorToast bind:show={showError} title="Access Denied">
    Please use your <span class="font-medium text-gray-900"
      >@pcampus.edu.np</span
    >
    email address to sign in.
  </ErrorToast>

  <main class="min-h-[calc(100vh-4rem)] bg-gray-50 relative">
    {#if MapComponent}
      <div
        class="absolute inset-0 z-0 transition-opacity duration-300 {isMapRoute
          ? 'opacity-100 visible'
          : 'opacity-0 invisible pointer-events-none'}"
      >
        <MapComponent />
      </div>
    {/if}
    {#if instance?.navigating}
      <div
        class="fixed inset-0 z-40 bg-white/80 backdrop-blur-sm flex items-center justify-center"
      >
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    {/if}
    <div class={isMapRoute ? "hidden" : "contents"}>
      <Router bind:instance {routes} />
    </div>
  </main>

  {#if instance?.current?.route?.path !== "/map"}
    <footer class="bg-white border-t border-gray-200 py-8 mt-auto">
      <div
        class="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4"
      >
        <p class="text-gray-500 text-sm">
          © 2026 PulchowkX. Built for IOE Pulchowk Campus.
        </p>
        <div class="flex items-center gap-6">
          <!-- svelte-ignore a11y_invalid_attribute -->
          <a
            href="#"
            class="text-gray-400 hover:text-gray-600 transition-colors"
            >Privacy</a
          >
          <!-- svelte-ignore a11y_invalid_attribute -->
          <a
            href="#"
            class="text-gray-400 hover:text-gray-600 transition-colors">Terms</a
          >
          <!-- svelte-ignore a11y_invalid_attribute -->
          <a
            href="#"
            class="text-gray-400 hover:text-gray-600 transition-colors"
            >Contact</a
          >
        </div>
      </div>
    </footer>
  {/if}
</QueryClientProvider>
