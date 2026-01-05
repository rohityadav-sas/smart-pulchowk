<script lang="ts">
	import {
		Router,
		type RouteConfig,
		type RouterInstance,
		query,
		goto,
		route,
	} from "@mateothegreat/svelte5-router";
	import { authClient } from "./lib/auth-client";
	import LoadingSpinner from "./components/LoadingSpinner.svelte";
	import Home from "./pages/Home.svelte";
	import Register from "./pages/Register.svelte";
	import Dashboard from "./pages/Dashboard.svelte";

	let instance: RouterInstance = $state()!;

	const session = authClient.useSession();

	const error = query("error");
	let showError = $state(error === "unauthorized_domain");

	if (error) goto("/");

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
			path: "map",
			component: async () => await import("./pages/Map.svelte"),
		},
	];
</script>

<nav
	class="bg-white border-b border-gray-200 sticky top-0 z-50 backdrop-blur-sm"
>
	<div class="max-w-7xl mx-auto px-6 py-4">
		<div class="flex items-center justify-between">
			<a href="/" class="flex items-center gap-2 group">
				<div
					class="w-8 h-8 bg-linear-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
				>
					<span class="text-white font-bold text-sm">P</span>
				</div>
				<span
					class="text-xl font-bold bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
					>PulchowkX</span
				>
			</a>
			<div class="flex items-center gap-6">
				<a
					use:route
					href="/"
					class="text-gray-600 hover:text-gray-900 font-medium transition-colors"
					>Home</a
				>
				{#if $session.isPending}
					<div
						class="h-10 w-24 bg-gray-200 rounded-lg animate-pulse"
					></div>
				{:else if $session.data?.user}
					<a
						use:route
						href="/dashboard"
						class="text-gray-600 hover:text-gray-900 font-medium transition-colors"
						>Dashboard</a
					>
					<a
						use:route
						href="/map"
						class="text-gray-600 hover:text-gray-900 font-medium transition-colors"
						>Map</a
					>
				{:else}
					<a
						href="/register"
						class="bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-2 rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
						>Sign In</a
					>
				{/if}
			</div>
		</div>
	</div>
</nav>

<!-- Error Toast -->
{#if showError}
	<div
		class="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300"
	>
		<div
			class="bg-red-50 border border-red-200 rounded-lg px-6 py-4 shadow-lg flex items-center gap-3"
		>
			<svg
				class="w-5 h-5 text-red-500 shrink-0"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				></path>
			</svg>
			<div>
				<p class="text-red-800 font-medium">
					Unauthorized Email Domain
				</p>
				<p class="text-red-600 text-sm">
					Only <span class="font-semibold">@pcampus.edu.np</span> emails
					are allowed.
				</p>
			</div>
			<button
				aria-label="Close error message"
				onclick={() => (showError = false)}
				class="ml-4 text-red-400 hover:text-red-600 transition-colors"
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
						d="M6 18L18 6M6 6l12 12"
					></path>
				</svg>
			</button>
		</div>
	</div>
{/if}

<main class="min-h-screen bg-blue-200">
	{#if instance?.navigating}
		<div
			class="fixed inset-0 z-40 bg-white/80 backdrop-blur-sm flex items-center justify-center"
		>
			<LoadingSpinner size="lg" text="Loading..." />
		</div>
	{/if}
	<Router bind:instance {routes} />
</main>

<footer class="bg-white border-t border-gray-200 py-8">
	<div class="max-w-7xl mx-auto px-6 text-center">
		<p class="text-gray-600 text-sm">
			© 2026 PulchowkX. All rights reserved.
		</p>
	</div>
</footer>
