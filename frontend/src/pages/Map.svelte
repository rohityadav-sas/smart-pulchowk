<script lang="ts">
	import {
		MapLibre,
		GeolocateControl,
		FullScreenControl,
		GeoJSONSource,
		FillLayer,
		SymbolLayer,
	} from "svelte-maplibre-gl";
	import type { FeatureCollection } from "geojson";
	import nepal from "./pulchowk.json";
	import { fade } from "svelte/transition";

	const nepalData = nepal as FeatureCollection;

	let isLoaded = $state(false);
</script>

<div class="relative w-full h-full min-h-[80vh]">
	{#if !isLoaded}
		<div
			class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gray-50 text-gray-600"
			out:fade={{ duration: 300 }}
		>
			<svg
				class="animate-spin h-8 w-8 mb-2"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
			>
				<circle
					class="opacity-25"
					cx="12"
					cy="12"
					r="10"
					stroke="currentColor"
					stroke-width="4"
				></circle>
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				></path>
			</svg>
			<p class="font-medium animate-pulse">Loading Map...</p>
		</div>
	{/if}

	<MapLibre
		zoom={15}
		center={[85.319319, 27.682102]}
		class="size-150 mx-auto"
		style="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
		onclick={(e) => {
			const latitude = e.lngLat.lat;
			const longitude = e.lngLat.lng;
			navigator.clipboard.writeText(`[${longitude}, ${latitude}]`);
		}}
		onload={() => (isLoaded = true)}
		maxBounds={[
			[85.3169503963058, 27.678307122280273],
			[85.32594099531451, 27.68641618791375],
		]}
	>
		<GeoJSONSource data={nepalData} maxzoom={22}>
			<FillLayer
				paint={{
					"fill-color": "#fff",
					"fill-opacity": 1,
					"fill-outline-color": "#333",
				}}
			/>
			<SymbolLayer
				layout={{
					"text-field": "{description}",
					"text-size": 10,
					"text-anchor": "top",
					"text-justify": "center",
					"text-max-width": 5,
				}}
				paint={{
					"text-color": "green",
				}}
			/>
		</GeoJSONSource>

		<GeolocateControl
			position="top-right"
			positionOptions={{ enableHighAccuracy: true }}
			trackUserLocation={true}
			showAccuracyCircle={true}
			fitBoundsOptions={{ zoom: 18 }}
		/>

		<FullScreenControl position="top-right" />
	</MapLibre>
</div>
