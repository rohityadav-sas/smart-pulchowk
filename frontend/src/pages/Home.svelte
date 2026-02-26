<script lang="ts">
  import { route } from "@mateothegreat/svelte5-router";
  import { authClient } from "../lib/auth-client";
  import { fade, fly } from "svelte/transition";

  const session = authClient.useSession();
</script>

<div
  class="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] py-16 text-center"
>
  <!-- Hero Section -->
  <div class="max-w-3xl mx-auto space-y-8" in:fly={{ y: 20, duration: 600 }}>
    <!-- Badge -->
    <div
      class="inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full shadow-sm text-xs font-semibold text-slate-600"
    >
      <span class="relative flex h-2 w-2">
        <span
          class="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"
        ></span>
        <span class="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"
        ></span>
      </span>
      Smart Pulchowk v2.0
    </div>

    <!-- Main Title -->
    <h1
      class="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-[1.1]"
    >
      Your Campus.<br />
      <span
        class="text-transparent bg-clip-text bg-linear-to-r from-cyan-600 via-blue-600 to-indigo-600"
        >Unified.</span
      >
    </h1>

    <p class="text-lg text-slate-600 max-w-xl mx-auto font-medium">
      Everything you need for Pulchowk Campus, organized in one beautiful
      interface.
    </p>
  </div>

  <!-- Primary Navigation (Compact & Responsive) -->
  <div
    class="mt-12 w-full max-w-2xl px-4 mx-auto"
    in:fly={{ y: 20, duration: 600, delay: 200 }}
  >
    <div
      class="grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-center gap-2.5 sm:gap-3"
    >
      {#if !$session.data?.user}
        <a
          href="/register"
          class="col-span-2 sm:col-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-md shadow-slate-900/10"
        >
          Get Started
          <svg
            class="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            /></svg
          >
        </a>
      {:else}
        <a
          use:route
          href="/dashboard"
          class="col-span-2 sm:col-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-bold hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-all shadow-sm hover:shadow-md"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Dashboard
        </a>
      {/if}

      <!-- Feature Buttons -->
      <a
        use:route
        href="/map"
        class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:border-cyan-300 hover:text-cyan-700 hover:bg-cyan-50 transition-all shadow-sm hover:shadow-md"
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
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          /><path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          /></svg
        >
        Map
      </a>

      <a
        use:route
        href="/books"
        class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:border-cyan-300 hover:text-cyan-700 hover:bg-cyan-50 transition-all shadow-sm hover:shadow-md"
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
            d="M12 6.25v13.5m0-13.5c-1.9-1.45-4.5-2.25-7.25-2.25v13.5c2.75 0 5.35.8 7.25 2.25m0-13.5c1.9-1.45 4.5-2.25 7.25-2.25v13.5c-2.75 0-5.35.8-7.25 2.25"
          /></svg
        >
        Books
      </a>

      <a
        use:route
        href="/events"
        class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:border-cyan-300 hover:text-cyan-700 hover:bg-cyan-50 transition-all shadow-sm hover:shadow-md"
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
            d="M8 7V3m8 4V3m-9 8h10m-13 9h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v11a2 2 0 002 2z"
          /></svg
        >
        Events
      </a>

      <a
        use:route
        href="/clubs"
        class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:border-cyan-300 hover:text-cyan-700 hover:bg-cyan-50 transition-all shadow-sm hover:shadow-md"
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
            d="M17 20h5v-2a4 4 0 00-5-3.87M17 20H7m10 0v-2c0-.65-.12-1.28-.34-1.87M7 20H2v-2a4 4 0 015-3.87M7 20v-2c0-.65.12-1.28.34-1.87M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          /></svg
        >
        Clubs
      </a>
    </div>
  </div>
</div>
