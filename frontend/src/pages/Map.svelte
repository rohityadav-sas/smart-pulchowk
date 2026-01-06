<script lang="ts">
	import {
		MapLibre,
		GeolocateControl,
		FullScreenControl,
		GeoJSONSource,
		FillLayer,
		SymbolLayer,
		RasterLayer,
	} from "svelte-maplibre-gl";
	import type { FeatureCollection } from "geojson";
	import pulchowk from "./pulchowk.json";
	import { fade, fly } from "svelte/transition";
	import LoadingSpinner from "../components/LoadingSpinner.svelte";

	const SATELLITE_STYLE: any = {
		version: 8,
		sources: {
			"arcgis-world-imagery": {
				type: "raster",
				tiles: [
					"https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
				],
				tileSize: 256,
				attribution:
					"Source: Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community",
			},
		},
		layers: [
			{
				id: "arcgis-world-imagery",
				type: "raster",
				source: "arcgis-world-imagery",
				minzoom: 0,
				maxzoom: 22,
			},
		],
	};

	const VECTOR_STYLE =
		"https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

	const pulchowkData = pulchowk as FeatureCollection;

	// Assign icons based on description
	pulchowkData.features.forEach((feature) => {
		if (!feature.properties) feature.properties = {};

		// Skip features without a description (like the boundary mask)
		if (!feature.properties.description) return;

		const desc = feature.properties.description.toLowerCase();

		if (desc.includes("bank") || desc.includes("atm")) {
			feature.properties.icon = "bank-icon";
		} else if (
			desc.includes("mess") ||
			desc.includes("canteen") ||
			desc.includes("food")
		) {
			feature.properties.icon = "food-icon";
		} else if (desc.includes("library")) {
			feature.properties.icon = "library-icon";
		} else if (desc.includes("department")) {
			feature.properties.icon = "dept-icon";
		} else if (desc.includes("mandir")) {
			feature.properties.icon = "temple-icon";
		} else if (desc.includes("gym") || desc.includes("sport")) {
			feature.properties.icon = "gym-icon";
		} else if (desc.includes("football")) {
			feature.properties.icon = "football-icon";
		} else if (desc.includes("cricket")) {
			feature.properties.icon = "cricket-icon";
		} else if (desc.includes("basketball") || desc.includes("volleyball")) {
			feature.properties.icon = "volleyball-icon";
		} else if (desc.includes("hostel")) {
			feature.properties.icon = "hostel-icon";
		} else if (desc.includes("lab")) {
			feature.properties.icon = "lab-icon";
		} else if (desc.includes("helicopter") || desc.includes("helicoptor")) {
			feature.properties.icon = "helipad-icon";
		} else if (desc.includes("parking")) {
			feature.properties.icon = "parking-icon";
		} else if (desc.includes("electrical club")) {
			feature.properties.icon = "electrical-icon";
		} else if (desc.includes("music club")) {
			feature.properties.icon = "music-icon";
		} else if (desc.includes("center for energy studies")) {
			feature.properties.icon = "energy-icon";
		} else if (desc.includes("the helm of ioe pulchowk")) {
			feature.properties.icon = "helm-icon";
		} else if (desc.includes("pi chautari")) {
			feature.properties.icon = "garden-icon";
		} else if (desc.includes("store") || desc.includes("bookshop")) {
			feature.properties.icon = "store-icon";
		} else if (desc.includes("quarter")) {
			feature.properties.icon = "quarter-icon";
		} else if (desc.includes("robotics club")) {
			feature.properties.icon = "robotics-icon";
		} else if (desc.includes("clinic") || desc.includes("health")) {
			feature.properties.icon = "clinic-icon";
		} else if (desc.includes("badminton")) {
			feature.properties.icon = "badminton-icon";
		} else {
			feature.properties.icon = "custom-marker";
		}
	});

	const labels = pulchowkData.features.slice(1);

	let search = $state("");
	let showSuggestions = $state(false);
	let selectedIndex = $state(-1);
	let isSatellite = $state(false);
	let mapCenter = $state<[number, number]>([
		85.32121137093469, 27.68222689200303,
	]);
	let map: any = $state();

	let isLoaded = $state(false);

	const loadIcons = async () => {
		if (!map) return;
		const icons = [
			{
				name: "custom-marker",
				url: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
				width: 15, // Resizing to 15px width results in ~25px height, matching others
			},
			{
				name: "bank-icon",
				url: "https://png.pngtree.com/png-clipart/20230805/original/pngtree-bank-location-icon-from-business-bicolor-set-money-business-company-vector-picture-image_9698988.png",
				width: 15,
			},
			{
				name: "food-icon",
				url: "https://cdn-icons-png.freepik.com/512/11167/11167112.png",
			},
			{
				name: "library-icon",
				url: "https://cdn-icons-png.freepik.com/512/7985/7985904.png",
			},
			{
				name: "dept-icon",
				url: "https://cdn-icons-png.flaticon.com/512/7906/7906888.png",
			},
			{
				name: "temple-icon",
				url: "https://cdn-icons-png.flaticon.com/512/1183/1183391.png",
			},
			{
				name: "gym-icon",
				url: "https://cdn-icons-png.flaticon.com/512/11020/11020519.png",
			},
			{
				name: "football-icon",
				url: "https://cdn-icons-png.freepik.com/512/8893/8893610.png",
			},
			{
				name: "cricket-icon",
				url: "https://i.postimg.cc/cLb6QFC1/download.png",
				width: 15,
			},
			{
				name: "hostel-icon",
				url: "https://cdn-icons-png.flaticon.com/512/7804/7804352.png",
			},
			{
				name: "volleyball-icon",
				url: "https://i.postimg.cc/mDW05pSw-/volleyball.png",
				width: 25,
			},
			{
				name: "lab-icon",
				url: "https://cdn-icons-png.flaticon.com/256/12348/12348567.png",
			},
			{
				name: "parking-icon",
				url: "https://cdn.iconscout.com/icon/premium/png-256-thumb/parking-place-icon-svg-download-png-897308.png",
			},
			{
				name: "helipad-icon",
				url: "https://cdn-icons-png.flaticon.com/512/5695/5695654.png",
			},
			{
				name: "electrical-icon",
				url: "https://cdn-icons-png.flaticon.com/512/9922/9922144.png",
			},
			{
				name: "music-icon",
				url: "https://cdn-icons-png.flaticon.com/512/5905/5905923.png",
			},
			{
				name: "energy-icon",
				url: "https://cdn-icons-png.flaticon.com/512/10053/10053795.png",
			},
			{
				name: "helm-icon",
				url: "https://png.pngtree.com/png-vector/20221130/ourmid/pngtree-airport-location-pin-in-light-blue-color-png-image_6485369.png",
			},
			{
				name: "garden-icon",
				url: "https://cdn-icons-png.flaticon.com/512/15359/15359437.png",
			},
			{
				name: "store-icon",
				url: "https://cdn-icons-png.flaticon.com/512/3448/3448673.png",
			},
			{
				name: "quarter-icon",
				url: "https://static.thenounproject.com/png/331579-200.png",
			},
			{
				name: "robotics-icon",
				url: "https://cdn-icons-png.flaticon.com/512/10681/10681183.png",
			},
			{
				name: "clinic-icon",
				url: "https://cdn-icons-png.flaticon.com/512/10714/10714002.png",
			},
			{
				name: "badminton-icon",
				url: "https://static.thenounproject.com/png/198230-200.png",
			},
		];

		await Promise.all(
			icons.map(async ({ name, url, width }) => {
				const image = await map.loadImage(url);
				if (!map.hasImage(name))
					map.addImage(name, resizeImage(image.data, width), {
						pixelRatio: 1,
					});
			}),
		);
		isLoaded = true;
	};

	function resizeImage(image: ImageBitmap | HTMLImageElement, width = 25) {
		const targetWidth = width;
		const targetHeight = Math.round(
			targetWidth * (image.height / image.width),
		);

		const canvas = document.createElement("canvas");
		canvas.width = targetWidth;
		canvas.height = targetHeight;

		const ctx = canvas.getContext("2d");
		if (ctx) {
			ctx.imageSmoothingEnabled = true;
			ctx.imageSmoothingQuality = "high";
			ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
			const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
			return imageData;
		}
		return image;
	}

	const filteredSuggestions = $derived(
		search.trim()
			? labels
					.filter((label) =>
						label.properties?.description
							?.toLowerCase()
							.includes(search.toLowerCase()),
					)
					.slice(0, 8)
			: [],
	);

	function selectSuggestion(description: string) {
		search = description;
		showSuggestions = false;
		selectedIndex = -1;

		const selectedLocation = labels.find(
			(label) => label.properties?.description === description,
		);

		if (selectedLocation?.geometry?.type === "Polygon") {
			const coordinates = selectedLocation.geometry.coordinates[0];
			const centroid = coordinates.reduce(
				(acc, coord) => {
					acc[0] += coord[0];
					acc[1] += coord[1];
					return acc;
				},
				[0, 0],
			);
			centroid[0] /= coordinates.length;
			centroid[1] /= coordinates.length;
			if (map) {
				map.flyTo({
					center: [centroid[0], centroid[1]],
					zoom: 20,
					speed: 1.2,
					curve: 1.42,
					essential: true,
				});
			}
		} else if (selectedLocation?.geometry?.type === "Point") {
			const coords = selectedLocation.geometry.coordinates;
			if (map) {
				map.flyTo({
					center: [coords[0], coords[1]],
					zoom: 20,
					speed: 1.2,
					curve: 1.42,
					essential: true,
				});
			}
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!filteredSuggestions.length) return;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			selectedIndex = Math.min(
				selectedIndex + 1,
				filteredSuggestions.length - 1,
			);
			scrollToSelected();
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			selectedIndex = Math.max(selectedIndex - 1, -1);
			scrollToSelected();
		} else if (e.key === "Enter" && selectedIndex >= 0) {
			e.preventDefault();
			const selectedProperties =
				filteredSuggestions[selectedIndex].properties;
			if (selectedProperties?.description)
				selectSuggestion(selectedProperties.description);
		} else if (e.key === "Escape") {
			showSuggestions = false;
			selectedIndex = -1;
		}
	}

	function scrollToSelected() {
		setTimeout(() => {
			const selectedElement = document.querySelector(
				`[data-suggestion-index="${selectedIndex}"]`,
			);
			if (selectedElement) {
				selectedElement.scrollIntoView({
					behavior: "smooth",
					block: "nearest",
				});
			}
		}, 0);
	}
</script>

<div class="relative w-full h-[calc(100vh-4rem)] bg-gray-50">
	<!-- Search Container -->
	<div
		class="absolute top-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-4"
	>
		<div class="relative group">
			<!-- Search Icon -->
			<div
				class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-blue-600 z-10"
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
					></path>
				</svg>
			</div>

			<input
				bind:value={search}
				type="text"
				placeholder="Search classrooms, departments..."
				class="w-full pl-12 pr-12 py-4 rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white/90 backdrop-blur-xl text-gray-800 placeholder-gray-400 transition-all text-base font-medium"
				onfocus={() => (showSuggestions = true)}
				oninput={() => (showSuggestions = true)}
				onblur={() => setTimeout(() => (showSuggestions = false), 200)}
				onkeydown={handleKeydown}
			/>

			{#if search}
				<button
					aria-label="Clear search"
					onclick={() => {
						search = "";
						showSuggestions = false;
						selectedIndex = -1;
					}}
					class="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
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
			{/if}

			<!-- Autocomplete Suggestions Dropdown -->
			{#if showSuggestions && filteredSuggestions.length > 0}
				<div
					class="absolute top-full mt-3 w-full bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden"
					transition:fly={{ y: 10, duration: 200 }}
				>
					<ul class="max-h-[60vh] overflow-y-auto py-2">
						{#each filteredSuggestions as suggestion, index}
							<li>
								<button
									data-suggestion-index={index}
									onclick={() =>
										suggestion.properties?.description &&
										selectSuggestion(
											suggestion.properties.description,
										)}
									class="w-full px-5 py-3.5 text-left hover:bg-blue-50/80 transition-colors flex items-center gap-4 {index ===
									selectedIndex
										? 'bg-blue-50 text-blue-700'
										: 'text-gray-700'}"
								>
									<div
										class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 {index ===
										selectedIndex
											? 'bg-blue-200 text-blue-700'
											: 'text-blue-500'}"
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
												d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
											></path>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
											></path>
										</svg>
									</div>
									<div class="flex-1 min-w-0">
										<p class="font-medium truncate">
											{suggestion.properties?.description}
										</p>
										<p
											class="text-xs text-gray-500 truncate mt-0.5"
										>
											Pulchowk Campus
										</p>
									</div>
									{#if index === selectedIndex}
										<svg
											class="w-5 h-5 text-blue-600"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M9 5l7 7-7 7"
											></path>
										</svg>
									{/if}
								</button>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<!-- No Results Message -->
			{#if showSuggestions && search.trim() && filteredSuggestions.length === 0}
				<div
					class="absolute top-full mt-3 w-full bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-100 p-6 text-center"
					transition:fly={{ y: 10, duration: 200 }}
				>
					<div
						class="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400"
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
								d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							></path>
						</svg>
					</div>
					<p class="text-gray-900 font-medium">No locations found</p>
					<p class="text-sm text-gray-500 mt-1">
						Try searching for a different building or department
					</p>
				</div>
			{/if}
		</div>
	</div>

	{#if !isLoaded}
		<div
			class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gray-50/80 backdrop-blur-sm"
			out:fade={{ duration: 300 }}
		>
			<LoadingSpinner size="lg" text="Loading Campus Map..." />
		</div>
	{/if}

	<div
		class="absolute bottom-6 left-6 z-10 bg-white/90 backdrop-blur rounded-lg shadow-lg border border-gray-100 p-1 flex gap-1"
	>
		<button
			class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors {isSatellite
				? 'text-gray-600 hover:bg-gray-100'
				: 'bg-blue-50 text-blue-700'}"
			onclick={() => (isSatellite = false)}
		>
			Map
		</button>
		<button
			class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors {isSatellite
				? 'bg-blue-50 text-blue-700'
				: 'text-gray-600 hover:bg-gray-100'}"
			onclick={() => (isSatellite = true)}
		>
			Satellite
		</button>
	</div>

	<MapLibre
		bind:map
		zoom={16}
		maxZoom={isSatellite ? 18.4 : 22}
		center={mapCenter}
		class="w-full h-full"
		style={isSatellite ? SATELLITE_STYLE : VECTOR_STYLE}
		onclick={(e) => {
			const latitude = e.lngLat.lat;
			const longitude = e.lngLat.lng;
			navigator.clipboard.writeText(`[${longitude}, ${latitude}]`);
		}}
		onload={loadIcons}
		maxBounds={[
			[85.31217093201366, 27.678215308346253],
			[85.329947502668, 27.686583278518555],
		]}
	>
		<GeoJSONSource data={pulchowkData} maxzoom={22}>
			<FillLayer
				paint={{
					"fill-color": "#fff",
					"fill-opacity": 1,
					"fill-outline-color": "#333",
				}}
			/>
			<SymbolLayer
				layout={{
					"icon-image": ["get", "icon"],
					"icon-size": 1,
					"text-field": "{description}",
					"text-size": 10,
					"text-anchor": "top",
					"text-offset": [0, 1.4],
					"text-justify": "center",
					"text-max-width": 5,
				}}
				paint={{
					"text-color": isSatellite ? "#ffffff" : "green",
				}}
				filter={["has", "description"]}
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
