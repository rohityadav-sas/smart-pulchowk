<script lang="ts">
	import {
		MapLibre,
		GeolocateControl,
		FullScreenControl,
		GeoJSONSource,
		FillLayer,
		SymbolLayer,
		Popup,
		LineLayer,
		CircleLayer,
	} from "svelte-maplibre-gl";
	import type { FeatureCollection, Feature } from "geojson";
	import pulchowk from "./pulchowk.json";
	import { fade, fly, slide } from "svelte/transition";
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

	const PULCHOWK_BOUNDS = [
		[85.31217093201366, 27.678215308346253],
		[85.329947502668, 27.686583278518555],
	];

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
		} else if (desc.includes("helicopter")) {
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
		} else if (desc.includes("pi chautari") || desc.includes("park")) {
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
		} else if (desc.includes("entrance")) {
			feature.properties.icon = "entrance-icon";
		} else if (
			desc.includes("office") ||
			desc.includes("ntbns") ||
			desc.includes("seds") ||
			desc.includes("cids")
		) {
			feature.properties.icon = "office-icon";
		} else if (desc.includes("building")) {
			feature.properties.icon = "building-icon";
		} else if (desc.includes("block") || desc.includes("embark")) {
			feature.properties.icon = "block-icon";
		} else if (desc.includes("cave")) {
			feature.properties.icon = "cave-icon";
		} else if (desc.includes("fountain")) {
			feature.properties.icon = "fountain-icon";
		} else if (
			desc.includes("water vending machine") ||
			desc.includes("water")
		) {
			feature.properties.icon = "water-vending-machine-icon";
		} else if (desc.includes("workshop")) {
			feature.properties.icon = "workshop-icon";
		} else if (desc.includes("toilet") || desc.includes("washroom")) {
			feature.properties.icon = "toilet-icon";
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
	let popupOpen = $state(false);
	let popupLngLat = $state<[number, number] | { lng: number; lat: number }>({
		lng: 0,
		lat: 0,
	});
	let popupData = $state<{
		title: string;
		description: string;
		image?: string | string[];
	}>({ title: "", description: "" });
	let imagesLoaded = $state<Record<number, boolean>>({});
	let imageProgress = $state<Record<number, number | undefined>>({});
	let progressFailedUrls = new Set<string>();

	async function loadWithProgress(url: string, index: number) {
		// Skip if we know this URL fails to provide progress (CORS/No-Content-Length)
		if (!url || progressFailedUrls.has(url)) {
			imageProgress[index] = undefined;
			return;
		}

		imageProgress[index] = 0;
		imagesLoaded[index] = false;

		try {
			const response = await fetch(url);

			if (!response.ok) throw new Error("Network response was not ok");

			const contentLength = response.headers.get("content-length");
			if (!contentLength) {
				throw new Error("Content-Length missing");
			}

			const total = parseInt(contentLength, 10);
			let loaded = 0;

			const reader = response.body?.getReader();
			if (!reader) throw new Error("ReadableStream not supported");

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				loaded += value.length;
				imageProgress[index] = Math.round((loaded / total) * 100);
			}

			imageProgress[index] = 100;
		} catch (error) {
			console.log("Fetch progress failed, falling back", url);
			progressFailedUrls.add(url);
			imageProgress[index] = undefined;
		}
	}

	const prefetchedUrls = new Set<string>();

	function prefetchImage(url: string) {
		if (!url || prefetchedUrls.has(url)) return;
		const img = new Image();
		img.src = url;
		prefetchedUrls.add(url);
	}

	$effect(() => {
		if (popupOpen && popupData.image) {
			const currentUrl = Array.isArray(popupData.image)
				? popupData.image[currentImageIndex]
				: popupData.image;

			if (currentUrl) {
				loadWithProgress(currentUrl, 0);
			}

			if (Array.isArray(popupData.image)) {
				// Prefetch next image
				const nextIndex =
					(currentImageIndex + 1) % popupData.image.length;
				prefetchImage(popupData.image[nextIndex]);

				// Prefetch previous image (for smoother backward navigation)
				const prevIndex =
					(currentImageIndex - 1 + popupData.image.length) %
					popupData.image.length;
				prefetchImage(popupData.image[prevIndex]);
			}
		}
	});

	let currentImageIndex = $state(0);
	let showOutsideMessage = $state(false);
	let geolocateControl: any = $state();
	let userLocation = $state<[number, number] | null>(null);

	// Navigation State
	let isNavigating = $state(false);
	let isCalculatingRoute = $state(false);
	let startPoint = $state<{
		coords: [number, number];
		name: string;
		feature?: any;
	} | null>(null);
	let endPoint = $state<{
		coords: [number, number];
		name: string;
		feature?: any;
	} | null>(null);
	let routeGeoJSON = $state<any>(null);
	let routeDistance = $state<string>("");
	let routeDuration = $state<string>("");
	let isDirectFallback = $state(false);

	let isNavMinimized = $state(false);
	// Navigation Search State
	let navStartSearch = $state("");
	let navEndSearch = $state("");
	let showNavStartSuggestions = $state(false);
	let showNavEndSuggestions = $state(false);
	let waitingForLocation = $state(false);
	let focusedInput = $state<"start" | "end">("end");

	function handleGeolocate(e: any) {
		console.log("Geolocate event:", e);
		if (!e?.coords) return;

		const { coords } = e;
		const { longitude, latitude } = coords;
		userLocation = [longitude, latitude];

		if (waitingForLocation) {
			useUserLocation();
			waitingForLocation = false;
		}

		const [sw, ne] = PULCHOWK_BOUNDS;
		const [minLng, minLat] = sw;
		const [maxLng, maxLat] = ne;

		if (
			longitude < minLng ||
			longitude > maxLng ||
			latitude < minLat ||
			latitude > maxLat
		) {
			showOutsideMessage = true;

			if (geolocateControl) geolocateControl.trigger();

			setTimeout(() => {
				showOutsideMessage = false;
			}, 4000);
		}
	}

	function getCentroid(feature: any): [number, number] {
		if (feature.geometry.type === "Point") {
			return feature.geometry.coordinates as [number, number];
		} else if (feature.geometry.type === "Polygon") {
			const coordinates = feature.geometry.coordinates[0];
			const centroid = coordinates.reduce(
				(acc: any, coord: any) => {
					acc[0] += coord[0];
					acc[1] += coord[1];
					return acc;
				},
				[0, 0],
			);
			centroid[0] /= coordinates.length;
			centroid[1] /= coordinates.length;
			return centroid as [number, number];
		}
		return [0, 0];
	}

	function getHaversineDistance(
		coord1: [number, number],
		coord2: [number, number],
	) {
		const R = 6371e3; // metres
		const φ1 = (coord1[1] * Math.PI) / 180; // φ, λ in radians
		const φ2 = (coord2[1] * Math.PI) / 180;
		const Δφ = ((coord2[1] - coord1[1]) * Math.PI) / 180;
		const Δλ = ((coord2[0] - coord1[0]) * Math.PI) / 180;

		const a =
			Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
			Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

		return R * c;
	}

	function createStraightLineRoute(
		start: [number, number],
		end: [number, number],
		distance: number,
	) {
		isDirectFallback = true;
		routeGeoJSON = {
			type: "Feature",
			geometry: {
				type: "LineString",
				coordinates: [start, end],
			},
		};

		const walkingSpeed = 1.2; // m/s
		const totalSeconds = distance / walkingSpeed;

		if (totalSeconds < 60) {
			routeDuration = `${Math.round(totalSeconds)} sec`;
		} else {
			routeDuration = `${Math.round(totalSeconds / 60)} min`;
		}
		routeDistance =
			distance < 1000
				? `${Math.round(distance)} m`
				: `${(distance / 1000).toFixed(1)} km`;

		fitBoundsToRoute([start, end]);
	}

	function fitBoundsToRoute(coords: number[][]) {
		if (map) {
			let minLng = coords[0][0],
				minLat = coords[0][1],
				maxLng = coords[0][0],
				maxLat = coords[0][1];
			for (const c of coords) {
				if (c[0] < minLng) minLng = c[0];
				if (c[0] > maxLng) maxLng = c[0];
				if (c[1] < minLat) minLat = c[1];
				if (c[1] > maxLat) maxLat = c[1];
			}

			map.fitBounds(
				[
					[minLng, minLat],
					[maxLng, maxLat],
				],
				{ padding: 100 },
			);
		}
	}

	function getNearestVertex(
		feature: any,
		target: [number, number],
	): [number, number] {
		if (!feature || feature.geometry.type !== "Polygon")
			return feature?.geometry?.coordinates || target;

		const coords = feature.geometry.coordinates[0];
		let minDist = Infinity;
		let bestCoord = coords[0];

		for (const coord of coords) {
			const dist =
				Math.pow(coord[0] - target[0], 2) +
				Math.pow(coord[1] - target[1], 2);
			if (dist < minDist) {
				minDist = dist;
				bestCoord = coord;
			}
		}
		return bestCoord as [number, number];
	}

	function startNavigation(destinationFeature: any) {
		isNavigating = true;
		popupOpen = false;

		const destName =
			destinationFeature.properties?.description || "Destination";
		const destCoords = getCentroid(destinationFeature);

		// Store feature to optimize routing point later
		endPoint = {
			coords: destCoords,
			name: destName,
			feature: destinationFeature,
		};
		navEndSearch = destName;

		if (userLocation) {
			startPoint = {
				coords: userLocation,
				name: "Your Location",
				feature: null,
			};
			navStartSearch = "Your Location";
			getDirections();
		} else {
			startPoint = null;
			navStartSearch = "";
		}
	}

	async function getDirections() {
		if (!startPoint || !endPoint) return;

		// Optimize connection points by picking vertices closest to each other
		// This prevents "snapping" to roads outside the campus if the centroid is closer to the wall
		const startCoords = startPoint.feature
			? getNearestVertex(startPoint.feature, endPoint.coords)
			: startPoint.coords;
		const endCoords = endPoint.feature
			? getNearestVertex(endPoint.feature, startCoords)
			: endPoint.coords;

		const straightDistance = getHaversineDistance(startCoords, endCoords);

		// If significantly close, just show straight line to avoid routing overhead/errors
		if (straightDistance < 20) {
			createStraightLineRoute(startCoords, endCoords, straightDistance);
			return;
		}

		const query = `${startCoords[0]},${startCoords[1]};${endCoords[0]},${endCoords[1]}`;
		// Use radiuses=200 to allow snapping to roads that are slightly further away
		const url = `https://router.project-osrm.org/route/v1/foot/${query}?overview=full&geometries=geojson&radiuses=200;200`;

		isCalculatingRoute = true;
		routeDuration = "";

		try {
			const res = await fetch(url);
			const data = await res.json();

			if (data.routes && data.routes.length > 0) {
				const route = data.routes[0];

				// Check if route goes significantly outside campus bounds
				const bounds = PULCHOWK_BOUNDS;
				const isOutside = route.geometry.coordinates.some(
					(c: number[]) =>
						c[0] < bounds[0][0] - 0.001 || // Add slight buffer
						c[0] > bounds[1][0] + 0.001 ||
						c[1] < bounds[0][1] - 0.001 ||
						c[1] > bounds[1][1] + 0.001,
				);

				// REVISED FALLBACK LOGIC:
				// 1. If route is extremely long (> 2km) inside a campus -> Fallback (likely wrong)
				// 2. If route goes OUTSIDE and is a detour (> 3x straight) -> Fallback
				// 3. Otherwise -> Use route
				if (
					route.distance > 2000 ||
					(isOutside &&
						route.distance > straightDistance * 3 &&
						route.distance > 500)
				) {
					console.log(
						"OSRM route rejected (Detour/Outside). Fallback to straight line.",
					);
					createStraightLineRoute(
						startCoords,
						endCoords,
						straightDistance,
					);
					isCalculatingRoute = false;
					return;
				}

				isDirectFallback = false;

				// Connect the actual start/end points to the route (fill the gap from snapping)
				const fullGeometry = {
					...route.geometry,
					coordinates: [
						startCoords,
						...route.geometry.coordinates,
						endCoords,
					],
				};

				routeGeoJSON = {
					type: "Feature",
					geometry: fullGeometry,
				};

				const totalSeconds = route.distance / 1.2;

				if (totalSeconds < 60) {
					routeDuration = `${Math.round(totalSeconds)} sec`;
				} else {
					routeDuration = `${Math.round(totalSeconds / 60)} min`;
				}

				const distance =
					route.distance < 1000
						? `${Math.round(route.distance)} m`
						: `${(route.distance / 1000).toFixed(1)} km`;
				routeDistance = distance;

				fitBoundsToRoute(route.geometry.coordinates);
				isCalculatingRoute = false;
			} else {
				// No route found, fallback
				createStraightLineRoute(
					startCoords,
					endCoords,
					straightDistance,
				);
				isCalculatingRoute = false;
			}
		} catch (e) {
			console.error("Error fetching directions:", e);
			// Fallback on error
			createStraightLineRoute(startCoords, endCoords, straightDistance);
			isCalculatingRoute = false;
		}
	}

	function exitNavigation() {
		isNavigating = false;
		routeGeoJSON = null;
		startPoint = null;
		endPoint = null;
		routeDuration = "";
		routeDistance = "";
	}

	const filteredNavStartSuggestions = $derived(
		navStartSearch.trim() && navStartSearch !== "Your Location"
			? labels
					.filter((label) =>
						label.properties?.description
							?.toLowerCase()
							.includes(navStartSearch.toLowerCase()),
					)
					.slice(0, 5)
			: [],
	);

	const filteredNavEndSuggestions = $derived(
		navEndSearch.trim()
			? labels
					.filter((label) =>
						label.properties?.description
							?.toLowerCase()
							.includes(navEndSearch.toLowerCase()),
					)
					.slice(0, 5)
			: [],
	);

	function selectNavStart(suggestion: any) {
		const coords = getCentroid(suggestion);
		startPoint = {
			coords,
			name: suggestion.properties.description,
			feature: suggestion,
		};
		navStartSearch = suggestion.properties.description;
		showNavStartSuggestions = false;
		getDirections();
	}

	function selectNavEnd(suggestion: any) {
		const coords = getCentroid(suggestion);
		endPoint = {
			coords,
			name: suggestion.properties.description,
			feature: suggestion,
		};
		navEndSearch = suggestion.properties.description;
		showNavEndSuggestions = false;
		getDirections();
	}

	function useUserLocation() {
		if (userLocation) {
			startPoint = {
				coords: userLocation,
				name: "Your Location",
				feature: null,
			};
			navStartSearch = "Your Location";
			showNavStartSuggestions = false;
			getDirections();
		} else {
			waitingForLocation = true;
			if (geolocateControl) {
				geolocateControl.trigger();
			} else {
				alert("Geolocation control not ready");
				waitingForLocation = false;
			}
		}
	}

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
		{
			name: "entrance-icon",
			url: "https://i.postimg.cc/jjLDcb6p/image-removebg-preview.png",
		},
		{
			name: "office-icon",
			url: "https://cdn-icons-png.flaticon.com/512/3846/3846807.png",
		},
		{
			name: "building-icon",
			url: "https://cdn-icons-png.flaticon.com/512/5193/5193760.png",
		},
		{
			name: "block-icon",
			url: "https://cdn-icons-png.flaticon.com/512/3311/3311565.png",
		},
		{
			name: "cave-icon",
			url: "https://cdn-icons-png.flaticon.com/512/210/210567.png",
		},
		{
			name: "fountain-icon",
			url: "https://cdn.iconscout.com/icon/free/png-256/free-fountain-icon-svg-download-png-449881.png",
		},
		{
			name: "water-vending-machine-icon",
			url: "https://static.vecteezy.com/system/resources/thumbnails/044/570/540/small_2x/single-water-drop-on-transparent-background-free-png.png",
		},
		{
			name: "workshop-icon",
			url: "https://cdn-icons-png.flaticon.com/512/7258/7258548.png",
		},
		{
			name: "toilet-icon",
			url: "https://png.pngtree.com/png-clipart/20240426/ourmid/pngtree-yellow-male-sign-for-toilet-washroom-png-image_12330179.png",
		},
	];

	function getIconUrl(iconName: string) {
		const icon = icons.find((i) => i.name === iconName);
		return icon ? icon.url : icons[0].url;
	}

	const loadIcons = async () => {
		if (!map) return;

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

	let touchStartX = 0;
	let touchEndX = 0;

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.changedTouches[0].screenX;
	}

	function handleTouchEnd(e: TouchEvent) {
		touchEndX = e.changedTouches[0].screenX;
		handleSwipe();
	}

	function handleSwipe() {
		if (!Array.isArray(popupData.image) || popupData.image.length <= 1)
			return;

		const SWIPE_THRESHOLD = 50;

		if (touchEndX < touchStartX - SWIPE_THRESHOLD) {
			// Swipe Left -> Next Image
			currentImageIndex =
				(currentImageIndex + 1) % popupData.image.length;
		}

		if (touchEndX > touchStartX + SWIPE_THRESHOLD) {
			// Swipe Right -> Previous Image
			currentImageIndex =
				(currentImageIndex - 1 + popupData.image.length) %
				popupData.image.length;
		}
	}
</script>

<div class="relative w-full h-[calc(100vh-4rem)] bg-gray-50">
	{#if !isNavigating}
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
					onblur={() =>
						setTimeout(() => (showSuggestions = false), 200)}
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
								{@const iconName = suggestion.properties?.icon}
								{@const iconUrl = icons.find(
									(i) => i.name === iconName,
								)?.url}
								<li>
									<button
										data-suggestion-index={index}
										onmousedown={(e) => e.preventDefault()}
										onclick={() =>
											suggestion.properties
												?.description &&
											selectSuggestion(
												suggestion.properties
													.description,
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
											{#if iconUrl}
												<img
													src={iconUrl}
													alt=""
													class="w-5 h-5 object-contain"
												/>
											{:else}
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
											{/if}
										</div>
										<div class="flex-1 min-w-0">
											<p class="font-medium truncate">
												{suggestion.properties
													?.description}
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
						<p class="text-gray-900 font-medium">
							No locations found
						</p>
						<p class="text-sm text-gray-500 mt-1">
							Try searching for a different building or department
						</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if isNavigating}
		<div
			class="absolute top-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4 pointer-events-auto"
			transition:fade={{ duration: 200 }}
		>
			<div
				class="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-4"
			>
				<div class="flex items-center justify-between mb-4">
					<div class="flex items-center gap-3">
						<button
							aria-label="Exit navigation"
							class="p-2 hover:bg-gray-100 rounded-full transition-colors"
							onclick={exitNavigation}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-6 w-6 text-gray-600"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M10 19l-7-7m0 0l7-7m-7 7h18"
								/>
							</svg>
						</button>
						<h2 class="font-semibold text-lg text-gray-800">
							Directions
						</h2>
					</div>
					<button
						aria-label={isNavMinimized ? "Expand" : "Minimize"}
						class="p-2 hover:bg-gray-100 rounded-full transition-colors"
						onclick={() => (isNavMinimized = !isNavMinimized)}
					>
						{#if isNavMinimized}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-5 w-5 text-gray-600"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 9l-7 7-7-7"
								/>
							</svg>
						{:else}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-5 w-5 text-gray-600"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M5 15l7-7 7 7"
								/>
							</svg>
						{/if}
					</button>
				</div>

				{#if !isNavMinimized}
					<div class="flex flex-col gap-3 relative" transition:slide>
						<!-- Start Input -->
						<div class="relative group">
							<div
								class="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-gray-400"
							></div>
							<input
								bind:value={navStartSearch}
								type="text"
								placeholder="Choose starting point"
								class="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
								onfocus={() => {
									showNavStartSuggestions = true;
									focusedInput = "start";
								}}
								oninput={() => (showNavStartSuggestions = true)}
							/>
							{#if showNavStartSuggestions}
								<div
									class="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-20 max-h-60 overflow-y-auto"
								>
									<button
										class="w-full px-4 py-3 text-left hover:bg-blue-50 text-blue-600 font-medium flex items-center gap-2"
										onclick={useUserLocation}
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
											/>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
											/>
										</svg>
										Your Location
										{#if waitingForLocation}
											<span
												class="text-xs text-gray-400 font-normal"
												>(Locating...)</span
											>
										{/if}
									</button>
									{#each filteredNavStartSuggestions as suggestion}
										<button
											class="w-full px-4 py-3 text-left hover:bg-gray-50 text-gray-700 text-sm border-t border-gray-50 flex items-center gap-3"
											onclick={() =>
												selectNavStart(suggestion)}
										>
											<img
												src={getIconUrl(
													suggestion.properties?.icon,
												)}
												alt=""
												class="w-5 h-5 object-contain"
											/>
											<span class="truncate"
												>{suggestion.properties
													?.description}</span
											>
										</button>
									{/each}
								</div>
							{/if}
						</div>

						<!-- Connecting Line -->
						<div
							class="absolute left-4.5 top-10 bottom-10 w-0.5 bg-gray-300 border-l border-dashed border-gray-300 pointer-events-none"
						></div>

						<!-- End Input -->
						<div class="relative group">
							<div
								class="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-red-500"
							></div>
							<input
								bind:value={navEndSearch}
								type="text"
								placeholder="Choose destination"
								class="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border-gray-200 text-gray-800 font-medium text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
								onfocus={() => {
									showNavEndSuggestions = true;
									focusedInput = "end";
								}}
								oninput={() => (showNavEndSuggestions = true)}
							/>
							{#if showNavEndSuggestions}
								<div
									class="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-20 max-h-60 overflow-y-auto"
								>
									{#each filteredNavEndSuggestions as suggestion}
										<button
											class="w-full px-4 py-3 text-left hover:bg-gray-50 text-gray-700 text-sm border-t border-gray-50 flex items-center gap-3"
											onclick={() =>
												selectNavEnd(suggestion)}
										>
											<img
												src={getIconUrl(
													suggestion.properties?.icon,
												)}
												alt=""
												class="w-5 h-5 object-contain"
											/>
											<span class="truncate"
												>{suggestion.properties
													?.description}</span
											>
										</button>
									{/each}
								</div>
							{/if}
						</div>
					</div>

					{#if isCalculatingRoute}
						<div
							class="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between"
							transition:slide
						>
							<div class="flex flex-col gap-2">
								<div
									class="h-7 w-24 bg-gray-200 rounded animate-pulse"
								></div>
								<div
									class="h-3 w-32 bg-gray-100 rounded animate-pulse"
								></div>
							</div>
							<div
								class="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center"
							>
								<LoadingSpinner size="sm" />
							</div>
						</div>
					{/if}

					{#if routeDuration}
						<div
							class="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between"
							transition:slide
						>
							<div>
								<div class="flex items-baseline gap-2">
									<span
										class="text-2xl font-bold text-blue-600"
										>{routeDuration}</span
									>
									<span
										class="text-sm text-gray-500 font-medium"
										>({routeDistance})</span
									>
								</div>
								<div class="text-xs text-gray-400 mt-0.5">
									{isDirectFallback
										? "Straight line (Internal paths not mapped)"
										: "Walking via campus paths"}
								</div>
							</div>
							<div
								class="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-600/30"
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
										d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
									/>
								</svg>
							</div>
						</div>
					{/if}
				{:else if routeDuration}
					<div
						class="pt-2 border-t border-gray-100 flex items-center justify-between"
						transition:slide
					>
						<div>
							<div class="flex items-baseline gap-2">
								<span class="text-xl font-bold text-blue-600"
									>{routeDuration}</span
								>
								<span class="text-sm text-gray-500 font-medium"
									>({routeDistance})</span
								>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if showOutsideMessage}
		<div
			class="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap"
			transition:fly={{ y: -20, duration: 300 }}
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
			You are outside the Pulchowk Campus area
		</div>
	{/if}

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
		style={isSatellite
			? SATELLITE_STYLE
			: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json?"}
		onclick={(e) => {
			const latitude = e.lngLat.lat;
			const longitude = e.lngLat.lng;
			navigator.clipboard.writeText(`[${longitude}, ${latitude}]`);
		}}
		onload={loadIcons}
		maxBounds={PULCHOWK_BOUNDS as any}
	>
		<GeoJSONSource data={pulchowkData} maxzoom={22}>
			<FillLayer
				paint={{
					"fill-color": "#fff",
					"fill-opacity": 1,
					"fill-outline-color": "#333",
				}}
			/>
			{#if isLoaded}
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
					onclick={(e: any) => {
						console.log("Symbol clicked", e);
						if (e.features && e.features[0]) {
							const feature = e.features[0];
							const props = feature.properties || {};

							// Calculate center based on geometry type to snap popup to the icon/feature location
							let centerLngLat = e.lngLat;

							if (feature.geometry.type === "Point") {
								const coords = feature.geometry.coordinates;
								centerLngLat = {
									lng: coords[0],
									lat: coords[1],
								};
							} else if (feature.geometry.type === "Polygon") {
								const coordinates =
									feature.geometry.coordinates[0];
								const centroid = coordinates.reduce(
									(acc: any, coord: any) => {
										acc[0] += coord[0];
										acc[1] += coord[1];
										return acc;
									},
									[0, 0],
								);
								centroid[0] /= coordinates.length;
								centroid[1] /= coordinates.length;
								centerLngLat = {
									lng: centroid[0],
									lat: centroid[1],
								};
							}

							if (isNavigating) {
								const name = props.description || "Location";
								const point = {
									coords: [
										centerLngLat.lng,
										centerLngLat.lat,
									],
									name: name,
									feature: feature,
								};

								if (focusedInput === "start") {
									startPoint = point as any;
									navStartSearch = name;
									showNavStartSuggestions = false;
								} else {
									endPoint = point as any;
									navEndSearch = name;
									showNavEndSuggestions = false;
								}

								// Unfocus input to hide keyboard on mobile / remove cursor
								if (
									document.activeElement instanceof
									HTMLElement
								) {
									document.activeElement.blur();
								}

								getDirections();
								return;
							}

							popupLngLat = centerLngLat;

							let image = props.image;
							if (
								typeof image === "string" &&
								image.startsWith("[") &&
								image.endsWith("]")
							) {
								try {
									image = JSON.parse(image);
								} catch (e) {
									console.error(
										"Failed to parse image array",
										e,
									);
								}
							}

							popupData = {
								title:
									props.title ||
									props.description ||
									"Unknown Location",
								description: props.about || "",
								image: image || undefined,
							};
							currentImageIndex = 0;
							imagesLoaded = {};
							popupOpen = true;
						}
					}}
					onmouseenter={(e: any) => {
						map.getCanvas().style.cursor = "pointer";

						// Prefetch image on hover
						if (e.features && e.features[0]) {
							const props = e.features[0].properties || {};
							let image = props.image;

							if (
								typeof image === "string" &&
								image.startsWith("[") &&
								image.endsWith("]")
							) {
								try {
									image = JSON.parse(image);
								} catch (e) {
									// ignore parse error
								}
							}

							if (Array.isArray(image) && image.length > 0) {
								prefetchImage(image[0]);
							} else if (typeof image === "string" && image) {
								prefetchImage(image);
							}
						}
					}}
					onmouseleave={() => (map.getCanvas().style.cursor = "")}
				/>
			{/if}
		</GeoJSONSource>

		{#if routeGeoJSON}
			<GeoJSONSource data={routeGeoJSON} maxzoom={24}>
				<LineLayer
					layout={{
						"line-join": "round",
						"line-cap": "round",
					}}
					paint={{
						"line-color": "#2563eb",
						"line-width": 6,
						"line-opacity": 0.8,
					}}
				/>
				<LineLayer
					paint={{
						"line-color": "#ffffff",
						"line-width": 2,
						"line-opacity": 0.5,
						"line-dasharray": [2, 1],
					}}
				/>
			</GeoJSONSource>

			<GeoJSONSource
				data={{
					type: "FeatureCollection",
					features: [
						startPoint
							? {
									type: "Feature",
									geometry: {
										type: "Point",
										coordinates: startPoint.coords,
									},
									properties: { icon: "start-marker" },
								}
							: null,
						endPoint
							? {
									type: "Feature",
									geometry: {
										type: "Point",
										coordinates: endPoint.coords,
									},
									properties: { icon: "end-marker" },
								}
							: null,
					].filter((f) => f !== null) as Feature[],
				}}
				maxzoom={24}
			>
				<CircleLayer
					paint={{
						"circle-radius": 8,
						"circle-color": [
							"match",
							["get", "icon"],
							"start-marker",
							"#3b82f6",
							"end-marker",
							"#ef4444",
							"#000",
						],
						"circle-stroke-width": 3,
						"circle-stroke-color": "#fff",
					}}
				/>
			</GeoJSONSource>
		{/if}

		<Popup
			bind:open={popupOpen}
			lnglat={popupLngLat}
			closeButton={true}
			closeOnClick={true}
		>
			{#key popupData.title}
				<div class="max-w-xs popup-content">
					{#if popupData.image}
						<div
							class="overflow-hidden rounded-t-lg mb-2 relative group h-32"
							ontouchstart={handleTouchStart}
							ontouchend={handleTouchEnd}
						>
							{#if Array.isArray(popupData.image)}
								{#each popupData.image as img, i}
									{#if !imagesLoaded[i]}
										<div
											class="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-gray-100 transition-transform duration-300 ease-in-out"
											style="transform: translateX({(i -
												currentImageIndex) *
												100}%)"
										>
											<div
												class="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"
											></div>
										</div>
									{/if}
									<img
										src={img}
										alt={popupData.title}
										loading="lazy"
										onload={() => (imagesLoaded[i] = true)}
										class="absolute top-0 left-0 w-full h-full object-cover transition-transform duration-300 ease-in-out {imagesLoaded[
											i
										]
											? 'opacity-100'
											: 'opacity-0'}"
										style="transform: translateX({(i -
											currentImageIndex) *
											100}%)"
									/>
								{/each}

								{#if popupData.image.length > 1}
									<button
										aria-label="Previous Image"
										class="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
										onclick={(e) => {
											e.stopPropagation();
											if (
												Array.isArray(popupData.image)
											) {
												currentImageIndex =
													(currentImageIndex -
														1 +
														popupData.image
															.length) %
													popupData.image.length;
											}
										}}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
											stroke-width="2"
											stroke="currentColor"
											class="w-4 h-4"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M15.75 19.5L8.25 12l7.5-7.5"
											/>
										</svg>
									</button>

									<button
										aria-label="Next Image"
										class="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
										onclick={(e) => {
											e.stopPropagation();
											if (
												Array.isArray(popupData.image)
											) {
												currentImageIndex =
													(currentImageIndex + 1) %
													popupData.image.length;
											}
										}}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
											stroke-width="2"
											stroke="currentColor"
											class="w-4 h-4"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M8.25 4.5l7.5 7.5-7.5 7.5"
											/>
										</svg>
									</button>

									<div
										class="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-1 z-10"
									>
										{#each popupData.image as _, i}
											<div
												class="w-1.5 h-1.5 rounded-full transition-colors {i ===
												currentImageIndex
													? 'bg-white'
													: 'bg-white/50'}"
											></div>
										{/each}
									</div>
								{/if}
							{:else}
								{#if !imagesLoaded[0]}
									<div
										class="absolute inset-0 flex items-center justify-center bg-gray-100"
									>
										{#if imageProgress[0] !== undefined}
											<div
												class="flex flex-col items-center gap-2"
											>
												<div
													class="text-xs text-gray-500 font-medium"
												>
													{imageProgress[0]}%
												</div>
												<div
													class="w-16 h-1 bg-gray-200 rounded-full overflow-hidden"
												>
													<div
														class="h-full bg-blue-500 transition-all duration-200"
														style="width: {imageProgress[0]}%"
													></div>
												</div>
											</div>
										{:else}
											<div
												class="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"
											></div>
										{/if}
									</div>
								{/if}
								<img
									src={popupData.image}
									alt={popupData.title}
									loading="lazy"
									onload={() => (imagesLoaded[0] = true)}
									class="w-full h-32 object-cover transition-transform duration-700 group-hover:scale-110 {imagesLoaded[0]
										? 'opacity-100'
										: 'opacity-0'}"
								/>
							{/if}
							<div
								class="absolute inset-0 bg-linear-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
							></div>
						</div>
					{/if}
					<div class="px-2 pb-2">
						<h3 class="font-bold text-lg mb-1 text-gray-800">
							{popupData.title}
						</h3>
						<p class="text-sm text-gray-600 leading-relaxed">
							{popupData.description}
						</p>
						<button
							class="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
							onclick={() =>
								startNavigation({
									properties: {
										description: popupData.title,
									},
									geometry: {
										type: "Point",
										coordinates: Array.isArray(popupLngLat)
											? popupLngLat
											: [
													popupLngLat.lng,
													popupLngLat.lat,
												],
									},
								})}
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
								/>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
								/>
							</svg>
							Directions
						</button>
					</div>
				</div>
			{/key}
		</Popup>

		<GeolocateControl
			bind:control={geolocateControl}
			position="top-right"
			positionOptions={{ enableHighAccuracy: true }}
			trackUserLocation={true}
			showAccuracyCircle={true}
			fitBoundsOptions={{ zoom: 18 }}
			ongeolocate={handleGeolocate}
			onoutofmaxbounds={handleGeolocate}
			onerror={(e) => console.error("Geolocate error:", e)}
		/>

		<FullScreenControl position="top-right" />
	</MapLibre>
</div>

<style>
	:global(.maplibregl-popup-content) {
		padding: 0;
		border-radius: 0.5rem;
		box-shadow:
			0 10px 15px -3px rgb(0 0 0 / 0.1),
			0 4px 6px -2px rgb(0 0 0 / 0.1);
		overflow: hidden;
	}

	:global(.maplibregl-popup-close-button) {
		font-size: 1.5rem;
		color: white;
		text-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
		z-index: 10;
		padding: 0 8px;
		right: 0;
		top: 0;
	}

	:global(.maplibregl-popup-close-button:hover) {
		background-color: transparent;
		color: #ef4444;
	}

	.popup-content {
		animation: pop-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
		opacity: 0;
	}

	@keyframes pop-in {
		0% {
			opacity: 0;
			transform: translateY(10px) scale(0.95);
		}
		100% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
</style>
