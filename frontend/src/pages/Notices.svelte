<script lang="ts">
  import { goto, query as routeQuery } from "@mateothegreat/svelte5-router";
  import { onMount } from "svelte";
  import { authClient } from "../lib/auth-client";
  import { fade } from "svelte/transition";
  import {
    getNotices,
    getNoticeStats,
    createNotice,
    updateNotice,
    deleteNotice,
    uploadNoticeAttachment,
    type Notice,
    type NoticeStats,
    type NoticeWritePayload,
  } from "../lib/api";
  import { createQuery, useQueryClient } from "@tanstack/svelte-query";
  import { optimizeCloudinaryUrl } from "../lib/api-client";

  const { route } = $props();
  const session = authClient.useSession();
  const queryClient = useQueryClient();
  const sessionUser = $derived(
    $session.data?.user as { role?: string } | undefined,
  );
  const isNoticeManager = $derived(sessionUser?.role === "notice_manager");

  type NoticeCategory =
    | "results"
    | "application_forms"
    | "exam_centers"
    | "exam_routines"
    | "general";

  function asNoticeCategory(
    value: string | null | undefined,
  ): NoticeCategory | null {
    const normalized = (value || "").trim();
    if (
      normalized === "results" ||
      normalized === "application_forms" ||
      normalized === "exam_centers" ||
      normalized === "exam_routines" ||
      normalized === "general"
    ) {
      return normalized;
    }
    return null;
  }

  function getCategoryFromPathname(pathname: string): NoticeCategory | null {
    const match = pathname.match(
      /^\/notices\/(results|application_forms|exam_centers|exam_routines|general)\/?$/i,
    );
    return asNoticeCategory(match?.[1] || null);
  }

  function getInitialActiveCategory(): NoticeCategory {
    if (typeof window !== "undefined") {
      const fromPath = getCategoryFromPathname(window.location.pathname);
      if (fromPath) return fromPath;
    }
    const fromRoute = asNoticeCategory(
      (route?.result?.path?.params?.category as string | undefined) || null,
    );
    if (fromRoute) return fromRoute;
    const fromQuery = asNoticeCategory(routeQuery("category"));
    if (fromQuery) return fromQuery;
    return "results";
  }

  // State
  const PAGE_SIZE = 5;
  let activeCategory = $state<NoticeCategory>(getInitialActiveCategory());
  let searchQuery = $state("");
  let debouncedSearchQuery = $state("");
  let noticesOffset = $state(0);
  let newCountSnapshot = $state(0);
  let loadedNotices = $state<Notice[]>([]);
  let totalNotices = $state(0);
  let isAppendingNotices = $state(false);
  let lastAppliedNoticesToken = $state<string | null>(null);
  let lastNoticesDatasetKey = $state<string | null>(null);
  let expandedNoticeId = $state<number | null>(null);
  let highlightedNoticeId = $state<number | null>(null);
  let hasAppliedNoticeHighlight = $state(false);

  // Image preview modal
  let previewImage = $state<string | null>(null);
  let previewTitle = $state("");
  let previewPlaceholderSrc = $state("");
  let fullscreenBlobUrl = $state<string | null>(null);
  let fullscreenProgress = $state<number | undefined>(undefined);
  let fullscreenLoaded = $state(false);
  let fullscreenAbortController: AbortController | null = null;
  const fullscreenBlobCache = new Map<string, string>();

  // Management modal state
  let showManageModal = $state(false);
  let editingNotice = $state<Notice | null>(null);
  let isSubmitting = $state(false);
  let formError = $state<string | null>(null);
  let isUploadingAttachment = $state(false);
  let attachmentUploadError = $state<string | null>(null);
  let attachmentFileInput = $state<HTMLInputElement | null>(null);
  let isDragActive = $state(false);

  // Form state
  let formTitle = $state("");
  let formContent = $state("");
  let formCategory = $state<NoticeCategory>("results");
  let formAttachmentUrl = $state("");
  let manualUrlInput = $state("");
  let formAttachmentName = $state("");
  let activeAttachmentTab = $state<"upload" | "url">("upload");

  // Delete confirmation
  let deleteConfirmId = $state<number | null>(null);

  // Image loading progress state
  let imagesLoaded = $state<Record<number, boolean>>({});
  let imageProgress = $state<Record<number, number | undefined>>({});
  let imageBlobUrls = $state<Record<number, string>>({});
  let progressFailedUrls = new Set<string>();
  const fullyLoadedUrls = new Set<string>();

  function getNoticeCardImageUrl(url: string): string {
    return optimizeCloudinaryUrl(url, 800);
  }

  async function loadWithProgress(url: string, noticeId: number) {
    // Skip if we know this URL fails to provide progress (CORS/No-Content-Length)
    if (!url || progressFailedUrls.has(url)) {
      imageProgress[noticeId] = undefined;
      return;
    }

    // Check if we've already fully loaded this image previously in the session
    if (fullyLoadedUrls.has(url)) {
      if (!imagesLoaded[noticeId]) {
        imagesLoaded[noticeId] = true;
        imageProgress[noticeId] = 100;
      }
      return;
    }

    // If the image is already loaded (from cache/onload firing first), don't reset
    if (imagesLoaded[noticeId]) {
      imageProgress[noticeId] = 100;
      fullyLoadedUrls.add(url);
      return;
    }

    imageProgress[noticeId] = 0;
    imagesLoaded[noticeId] = false;

    try {
      const response = await fetch(url);

      if (!response.ok) throw new Error("Network response was not ok");

      // If served from cache, it might pass quickly, but we mark it as loaded at the end.
      const contentLength = response.headers.get("content-length");
      if (!contentLength) {
        throw new Error("Content-Length missing");
      }

      const contentType = response.headers.get("content-type") || "image/webp";
      const total = parseInt(contentLength, 10);
      let loaded = 0;

      const reader = response.body?.getReader();
      if (!reader) throw new Error("ReadableStream not supported");

      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loaded += value.length;
        imageProgress[noticeId] = Math.round((loaded / total) * 100);
      }

      imageProgress[noticeId] = 100;
      // Create blob URL so <img> uses already-downloaded data instantly
      imageBlobUrls[noticeId] = URL.createObjectURL(
        new Blob(chunks as any[], { type: contentType }),
      );
    } catch (error) {
      console.log("Fetch progress failed, falling back", url);
      progressFailedUrls.add(url);
      imageProgress[noticeId] = undefined;
    }
  }

  const noticesQuery = createQuery(() => ({
    queryKey: ["notices", activeCategory, debouncedSearchQuery, noticesOffset],
    queryFn: async () => {
      const result = await getNotices({
        category: activeCategory,
        search: debouncedSearchQuery || undefined,
        limit: PAGE_SIZE,
        offset: noticesOffset,
      });
      if (!result.success || !result.data) {
        throw new Error(result.message || "Failed to load notices");
      }
      return {
        items: result.data,
        total: result.meta?.total ?? result.data.length,
      };
    },
    staleTime: 20 * 1000,
  }));

  const statsQuery = createQuery(() => ({
    queryKey: ["notice-stats"],
    queryFn: async () => {
      const result = await getNoticeStats();
      if (!result.success || !result.data) {
        throw new Error(result.message || "Failed to load notice stats");
      }
      return result.data;
    },
    staleTime: 5 * 60 * 1000,
  }));

  function setCategory(category: NoticeCategory) {
    const targetPath = `/notices/${category}`;
    const currentPath =
      typeof window !== "undefined" ? window.location.pathname : "";

    if (activeCategory !== category) {
      activeCategory = category;
    }

    if (currentPath !== targetPath) {
      goto(targetPath);
    }
  }

  const canLoadMoreNotices = $derived(loadedNotices.length < totalNotices);

  function loadMoreNotices() {
    if (!canLoadMoreNotices || noticesQuery.isFetching) return;
    isAppendingNotices = true;
    noticesOffset = loadedNotices.length;
  }
  function getNoticeSortTime(notice: Notice) {
    const publishedRaw = notice.publishedDate?.trim();
    if (publishedRaw) {
      const parsedPublished = new Date(publishedRaw);
      if (!Number.isNaN(parsedPublished.getTime())) {
        return parsedPublished.getTime();
      }
    }
    const created = new Date(notice.createdAt || "");
    if (!Number.isNaN(created.getTime())) return created.getTime();
    return 0;
  }

  function sortNoticesLatestFirst(list: Notice[]) {
    return [...list].sort(
      (a, b) => getNoticeSortTime(b) - getNoticeSortTime(a),
    );
  }

  const filteredNotices = $derived(sortNoticesLatestFirst(loadedNotices));

  $effect(() => {
    const timeout = window.setTimeout(() => {
      const nextSearch = searchQuery.trim();
      if (debouncedSearchQuery !== nextSearch) {
        debouncedSearchQuery = nextSearch;
      }
    }, 300);
    return () => window.clearTimeout(timeout);
  });

  $effect(() => {
    const datasetKey = `${activeCategory}|${debouncedSearchQuery}`;
    if (lastNoticesDatasetKey === datasetKey) return;

    lastNoticesDatasetKey = datasetKey;
    noticesOffset = 0;
    newCountSnapshot = 0;
    loadedNotices = [];
    totalNotices = 0;
    isAppendingNotices = false;
    lastAppliedNoticesToken = null;
  });

  $effect(() => {
    const page = noticesQuery.data;
    if (!page) return;

    const pageToken = `${activeCategory}:${debouncedSearchQuery}:${noticesOffset}:${noticesQuery.dataUpdatedAt}`;
    if (lastAppliedNoticesToken === pageToken) return;
    lastAppliedNoticesToken = pageToken;

    let nextLoadedNotices: Notice[] = [];
    if (noticesOffset === 0) {
      nextLoadedNotices = page.items;
      loadedNotices = nextLoadedNotices;
      newCountSnapshot = nextLoadedNotices.filter((n) =>
        isNoticeNew(n.publishedDate, n.createdAt),
      ).length;
    } else {
      const existingIds = new Set(loadedNotices.map((n) => n.id));
      const merged = [...loadedNotices];
      for (const item of page.items) {
        if (!existingIds.has(item.id)) merged.push(item);
      }
      nextLoadedNotices = merged;
      loadedNotices = nextLoadedNotices;
    }
    totalNotices = page.total;
    isAppendingNotices = false;
  });

  const categoryCounts = $derived({
    results: statsQuery.data?.results ?? 0,
    application_forms: statsQuery.data?.applicationForms ?? 0,
    exam_centers: statsQuery.data?.examCenters ?? 0,
    exam_routines: statsQuery.data?.examRoutines ?? 0,
    general: statsQuery.data?.general ?? 0,
  });
  const newCount = $derived(newCountSnapshot);

  const routeCategoryFromPath = $derived(
    asNoticeCategory(
      (route?.result?.path?.params?.category as string | undefined) || null,
    ),
  );

  function syncNoticesRouteState() {
    const categoryFromPathname =
      typeof window !== "undefined"
        ? getCategoryFromPathname(window.location.pathname)
        : null;
    const categoryFromQuery = asNoticeCategory(routeQuery("category"));
    const resolvedCategory =
      categoryFromPathname ||
      routeCategoryFromPath ||
      categoryFromQuery ||
      activeCategory;
    if (activeCategory !== resolvedCategory) {
      activeCategory = resolvedCategory;
    }

    const noticeIdParam = Number(routeQuery("noticeId") || 0);
    if (noticeIdParam > 0 && highlightedNoticeId !== noticeIdParam) {
      highlightedNoticeId = noticeIdParam;
      hasAppliedNoticeHighlight = false;
    }
  }

  onMount(() => {
    syncNoticesRouteState();
    window.addEventListener("pushState", syncNoticesRouteState);
    window.addEventListener("replaceState", syncNoticesRouteState);
    window.addEventListener("popstate", syncNoticesRouteState);

    return () => {
      window.removeEventListener("pushState", syncNoticesRouteState);
      window.removeEventListener("replaceState", syncNoticesRouteState);
      window.removeEventListener("popstate", syncNoticesRouteState);
    };
  });

  $effect(() => {
    syncNoticesRouteState();
  });

  function openImagePreview(url: string, title: string, noticeId?: number) {
    previewImage = url;
    previewTitle = title;

    // Use the already-loaded blob URL from the card image as placeholder,
    // or fall back to the optimized 800px URL (which should be cached)
    if (noticeId !== undefined && imageBlobUrls[noticeId]) {
      previewPlaceholderSrc = imageBlobUrls[noticeId];
    } else {
      previewPlaceholderSrc = optimizeCloudinaryUrl(url, 800);
    }

    // Check if this HQ image is already cached
    const cachedBlob = fullscreenBlobCache.get(url);
    if (cachedBlob) {
      fullscreenBlobUrl = cachedBlob;
      fullscreenProgress = 100;
      fullscreenLoaded = true;
      return;
    }

    // Not cached — reset and load fresh
    fullscreenLoaded = false;
    fullscreenProgress = undefined;
    fullscreenBlobUrl = null;
    loadFullscreenImage(url);
  }

  async function loadFullscreenImage(rawUrl: string) {
    const hqUrl = optimizeCloudinaryUrl(rawUrl, 1600);
    fullscreenProgress = 0;

    const controller = new AbortController();
    fullscreenAbortController = controller;

    try {
      const response = await fetch(hqUrl, { signal: controller.signal });

      if (!response.ok) throw new Error("Network response was not ok");

      const contentLength = response.headers.get("content-length");
      if (!contentLength) {
        throw new Error("Content-Length missing");
      }

      const total = parseInt(contentLength, 10);
      let loaded = 0;

      const reader = response.body?.getReader();
      if (!reader) throw new Error("ReadableStream not supported");

      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loaded += value.length;
        fullscreenProgress = Math.round((loaded / total) * 100);
      }

      fullscreenProgress = 100;
      const blobUrl = URL.createObjectURL(new Blob(chunks as any[]));
      fullscreenBlobCache.set(rawUrl, blobUrl);
      fullscreenBlobUrl = blobUrl;
    } catch (error) {
      if ((error as any)?.name !== "AbortError") {
        // Fallback: let the img load via network
        fullscreenProgress = undefined;
      }
    } finally {
      fullscreenAbortController = null;
    }
  }

  function closeImagePreview() {
    previewImage = null;
    previewTitle = "";
    // Abort any in-flight HQ download
    if (fullscreenAbortController) {
      fullscreenAbortController.abort();
      fullscreenAbortController = null;
    }
    // Keep blob URL in cache (don't revoke) so re-opening is instant
    fullscreenBlobUrl = null;
    fullscreenProgress = undefined;
    fullscreenLoaded = false;
    previewPlaceholderSrc = "";
  }

  // Load image with progress when a notice is expanded
  $effect(() => {
    if (expandedNoticeId !== null) {
      const notice = filteredNotices.find((n) => n.id === expandedNoticeId);
      if (
        notice?.attachmentUrl &&
        getAttachmentType(notice.attachmentUrl) === "image"
      ) {
        const currentUrl = getNoticeCardImageUrl(notice.attachmentUrl);
        loadWithProgress(currentUrl, notice.id);
      }
    }
  });

  $effect(() => {
    if (hasAppliedNoticeHighlight || !highlightedNoticeId) return;
    if (!filteredNotices.length) return;

    const target = filteredNotices.find((n) => n.id === highlightedNoticeId);
    if (!target) return;

    hasAppliedNoticeHighlight = true;
    expandedNoticeId = target.id;

    requestAnimationFrame(() => {
      const element = document.getElementById(`notice-${target.id}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  });

  function formatDate(publishedDate?: string | null, createdAt?: string) {
    if (publishedDate?.trim()) {
      const parsedPublished = new Date(publishedDate);
      if (!Number.isNaN(parsedPublished.getTime())) {
        const now = new Date();
        const hasExplicitTime = /T\d{1,2}:\d{2}|\b\d{1,2}:\d{2}\b/.test(
          publishedDate,
        );
        if (!hasExplicitTime) {
          const sameDay =
            parsedPublished.getFullYear() === now.getFullYear() &&
            parsedPublished.getMonth() === now.getMonth() &&
            parsedPublished.getDate() === now.getDate();
          if (sameDay) return "Today";
        }
        const diffMs = now.getTime() - parsedPublished.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffHours < 1) return "Just now";
        if (diffHours < 24) return "Today";
        if (diffDays < 7) return `${Math.floor(diffDays)}d ago`;
        return parsedPublished.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year:
            parsedPublished.getFullYear() !== now.getFullYear()
              ? "numeric"
              : undefined,
        });
      }
      // If backend gives a non-ISO publish date string, show it directly.
      return publishedDate;
    }

    const date = new Date(createdAt || "");
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
    if (diffDays < 7) return `${Math.floor(diffDays)}d ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
  function isNoticeNew(
    publishedDate?: string | null,
    createdAt?: string,
  ): boolean {
    const sourceDate = publishedDate?.trim() || createdAt;
    if (!sourceDate) return false;
    const publishDate = new Date(sourceDate);
    if (Number.isNaN(publishDate.getTime())) return false;
    const now = new Date();
    const diffMs = now.getTime() - publishDate.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return diffMs < sevenDaysMs;
  }
  function getAttachmentType(
    url: string | null,
    name?: string | null,
  ): "image" | "pdf" | "link" {
    if (!url) return "link";
    const lowerUrl = url.toLowerCase();
    const lowerName = name?.toLowerCase() || "";

    // Check for explicit PDF extensions
    if (lowerUrl.endsWith(".pdf") || lowerName.endsWith(".pdf")) {
      return "pdf";
    }

    // Check for Google Drive links (usually documents)
    if (
      lowerUrl.includes("drive.google.com") ||
      lowerUrl.includes("docs.google.com")
    ) {
      return "pdf";
    }

    // Check for explicit image extensions logic (default to pdf if not image, or maintain current behavior?)
    // Current behavior defaults to 'image'. Let's check for known image extensions.
    const imageExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".svg",
      ".bmp",
    ];
    if (
      imageExtensions.some(
        (ext) => lowerUrl.endsWith(ext) || lowerName.endsWith(ext),
      )
    ) {
      return "image";
    }

    return "link";
  }
  function getAttachmentChipLabel(url: string | null, name?: string | null) {
    const type = getAttachmentType(url, name);
    if (type === "image") return "IMG";
    if (type === "pdf") return "PDF";
    return "LNK";
  }
  function toggleExpand(id: number) {
    expandedNoticeId = expandedNoticeId === id ? null : id;
  }
  function getAttachmentDisplayName(url: string | null, fallback: string) {
    if (!url) return fallback;
    try {
      const parsed = new URL(url);
      const lastSegment = parsed.pathname.split("/").filter(Boolean).pop();
      return lastSegment ? decodeURIComponent(lastSegment) : fallback;
    } catch {
      return fallback;
    }
  }
  function getCategoryLabel(category: NoticeCategory) {
    if (category === "application_forms") return "application forms";
    if (category === "exam_centers") return "exam centers";
    if (category === "exam_routines") return "exam routines";
    if (category === "general") return "general";
    return "results";
  }
  function openCreateModal() {
    editingNotice = null;
    formTitle = "";
    formContent = "";
    formCategory = activeCategory;
    formAttachmentUrl = "";

    formAttachmentName = "";
    attachmentUploadError = null;
    if (attachmentFileInput) attachmentFileInput.value = "";
    formError = null;
    showManageModal = true;
  }
  function openEditModal(notice: Notice) {
    editingNotice = notice;
    formTitle = notice.title;
    formContent = notice.content || "";
    formCategory = (notice.category || "results") as NoticeCategory;
    formAttachmentUrl = notice.attachmentUrl || "";
    manualUrlInput = "";
    activeAttachmentTab = "upload";

    formAttachmentName = "";
    attachmentUploadError = null;
    if (attachmentFileInput) attachmentFileInput.value = "";
    formError = null;
    showManageModal = true;
  }
  function closeModal() {
    showManageModal = false;
    editingNotice = null;
    formError = null;
  }
  function clearAttachment() {
    formAttachmentUrl = "";
    manualUrlInput = "";

    formAttachmentName = "";
    attachmentUploadError = null;
    if (attachmentFileInput) attachmentFileInput.value = "";
  }
  async function handleAttachmentFileSelected(file: File) {
    if (isUploadingAttachment) return;
    isUploadingAttachment = true;
    attachmentUploadError = null;
    const result = await uploadNoticeAttachment(file);
    isUploadingAttachment = false;
    if (!result.success || !result.data) {
      attachmentUploadError =
        result.message || "Failed to upload attachment. Please try again.";
      return;
    }
    formAttachmentUrl = result.data.url;

    formAttachmentName = result.data.name || file.name;
  }
  async function handleAttachmentFileChange(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    await handleAttachmentFileSelected(file);
    target.value = "";
  }
  function handleAttachmentDragOver(event: DragEvent) {
    event.preventDefault();
    isDragActive = true;
  }
  function handleAttachmentDragLeave(event: DragEvent) {
    event.preventDefault();
    isDragActive = false;
  }
  async function handleAttachmentDrop(event: DragEvent) {
    event.preventDefault();
    isDragActive = false;
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    await handleAttachmentFileSelected(file);
  }
  async function handleSubmit() {
    if (!formTitle.trim() || !formContent.trim()) {
      formError = "Title and content are required";
      return;
    }
    if (isUploadingAttachment) {
      formError = "Please wait for the attachment upload to finish";
      return;
    }
    isSubmitting = true;
    formError = null;
    const data = {
      title: formTitle.trim(),
      content: formContent.trim(),
      category: formCategory,
      attachmentUrl: formAttachmentUrl.trim() || null,
    } satisfies NoticeWritePayload;
    let result;
    if (editingNotice) {
      result = await updateNotice(editingNotice.id, data);
    } else {
      result = await createNotice(data);
    }
    isSubmitting = false;
    if (result.success) {
      closeModal();
      await queryClient.invalidateQueries({ queryKey: ["notices"] });
      await queryClient.invalidateQueries({ queryKey: ["notice-stats"] });
    } else {
      formError = result.message || "Failed to save notice";
    }
  }
  async function handleDelete(id: number) {
    const result = await deleteNotice(id);
    if (result.success) {
      deleteConfirmId = null;
      await queryClient.invalidateQueries({ queryKey: ["notices"] });
      await queryClient.invalidateQueries({ queryKey: ["notice-stats"] });
    }
  }
</script>

<div class="min-h-[calc(100vh-4rem)] bg-gray-50/50 px-4 py-8 sm:px-6 lg:px-8">
  <div class="max-w-5xl mx-auto">
    <!-- Category Tabs -->
    <div class="flex flex-wrap justify-center gap-2 mb-5">
      <button
        onclick={() => setCategory("results")}
        class="px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-1.5 {activeCategory ===
        'results'
          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
          : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}"
      >
        <svg
          class="w-4 h-4 {activeCategory === 'results'
            ? 'text-white'
            : 'text-green-600'}"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Results
        <span
          class="inline-flex items-center justify-center min-w-5 h-5 text-[10px] leading-none px-1.5 rounded-full {activeCategory ===
          'results'
            ? 'bg-white/20 text-white'
            : 'bg-slate-100 text-slate-700'}">{categoryCounts.results}</span
        >
      </button>
      <button
        onclick={() => setCategory("application_forms")}
        class="px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-1.5 {activeCategory ===
        'application_forms'
          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
          : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}"
      >
        <svg
          class="w-4 h-4 {activeCategory === 'application_forms'
            ? 'text-white'
            : 'text-violet-600'}"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12h6m-6 4h6M8 7h8m2 14H6a2 2 0 01-2-2V5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2z"
          />
        </svg>
        Application Forms
        <span
          class="inline-flex items-center justify-center min-w-5 h-5 text-[10px] leading-none px-1.5 rounded-full {activeCategory ===
          'application_forms'
            ? 'bg-white/20 text-white'
            : 'bg-slate-100 text-slate-700'}"
          >{categoryCounts.application_forms}</span
        >
      </button>
      <button
        onclick={() => setCategory("exam_centers")}
        class="px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-1.5 {activeCategory ===
        'exam_centers'
          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
          : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}"
      >
        <svg
          class="w-4 h-4 {activeCategory === 'exam_centers'
            ? 'text-white'
            : 'text-amber-600'}"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0L6.343 16.657a8 8 0 1111.314 0z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        Exam Centers
        <span
          class="inline-flex items-center justify-center min-w-5 h-5 text-[10px] leading-none px-1.5 rounded-full {activeCategory ===
          'exam_centers'
            ? 'bg-white/20 text-white'
            : 'bg-slate-100 text-slate-700'}"
          >{categoryCounts.exam_centers}</span
        >
      </button>
      <button
        onclick={() => setCategory("exam_routines")}
        class="px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-1.5 {activeCategory ===
        'exam_routines'
          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
          : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}"
      >
        <svg
          class="w-4 h-4 {activeCategory === 'exam_routines'
            ? 'text-white'
            : 'text-teal-600'}"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Exam Routines
        <span
          class="inline-flex items-center justify-center min-w-5 h-5 text-[10px] leading-none px-1.5 rounded-full {activeCategory ===
          'exam_routines'
            ? 'bg-white/20 text-white'
            : 'bg-slate-100 text-slate-700'}"
          >{categoryCounts.exam_routines}</span
        >
      </button>
      <button
        onclick={() => setCategory("general")}
        class="px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-1.5 {activeCategory ===
        'general'
          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
          : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}"
      >
        <svg
          class="w-4 h-4 {activeCategory === 'general'
            ? 'text-white'
            : 'text-blue-600'}"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        General
        <span
          class="inline-flex items-center justify-center min-w-5 h-5 text-[10px] leading-none px-1.5 rounded-full {activeCategory ===
          'general'
            ? 'bg-white/20 text-white'
            : 'bg-slate-100 text-slate-700'}">{categoryCounts.general}</span
        >
      </button>
    </div>

    <!-- Search and Management -->
    <div class="flex gap-3 mb-4">
      <div class="flex-1 relative">
        <svg
          class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search notices..."
          bind:value={searchQuery}
          class="w-full pl-9 pr-3 py-3 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {#if isNoticeManager}
        <button
          onclick={openCreateModal}
          class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-1.5"
        >
          <svg
            class="size-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Notice
        </button>
      {/if}
    </div>

    <!-- New notices badge -->
    {#if newCount > 0}
      <div class="flex justify-center mb-4">
        <span
          class="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium border border-amber-200"
        >
          <span class="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"
          ></span>
          {newCount} new notices this week
        </span>
      </div>
    {/if}

    <!-- Loading State -->
    {#if noticesQuery.isLoading && loadedNotices.length === 0}
      <div class="flex items-center justify-center py-20">
        <div class="flex flex-col items-center gap-4">
          <div
            class="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"
          ></div>
          <p class="text-slate-500 font-medium">Loading notices...</p>
        </div>
      </div>
    {:else if noticesQuery.error && filteredNotices.length === 0}
      <div class="flex items-center justify-center py-20">
        <div class="flex flex-col items-center gap-4 text-center">
          <div
            class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center"
          >
            <svg
              class="w-8 h-8 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <p class="text-slate-700 font-semibold">Failed to load notices</p>
          <p class="text-slate-500 text-sm">{noticesQuery.error.message}</p>
          <button
            onclick={() => noticesQuery.refetch()}
            class="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    {:else if filteredNotices.length === 0}
      <div class="flex items-center justify-center py-20">
        <div class="flex flex-col items-center gap-4 text-center">
          <div
            class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center"
          >
            <svg
              class="w-8 h-8 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p class="text-slate-700 font-semibold">No notices found</p>
          <p class="text-slate-500 text-sm">
            {searchQuery
              ? "Try a different search term"
              : `There are no ${getCategoryLabel(activeCategory)} notices posted yet.`}
          </p>
        </div>
      </div>
    {:else}
      <!-- Notices List -->
      <div class="space-y-2.5" in:fade={{ delay: 100 }}>
        {#each filteredNotices as notice (notice.id)}
          <div
            id={"notice-" + notice.id}
            class="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all overflow-hidden {highlightedNoticeId ===
            notice.id
              ? 'ring-2 ring-cyan-400 ring-offset-2 border-cyan-300 bg-cyan-50/30 notif-highlight-blink'
              : ''}"
          >
            <!-- Notice Header -->
            <button
              onclick={() => toggleExpand(notice.id)}
              class="w-full px-4 py-3 flex items-start gap-3 text-left"
            >
              <!-- Icon -->
              <div
                class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center {activeCategory ===
                'results'
                  ? 'bg-green-100 text-green-600'
                  : activeCategory === 'application_forms'
                    ? 'bg-violet-100 text-violet-600'
                    : activeCategory === 'exam_centers'
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-blue-100 text-blue-600'}"
              >
                {#if activeCategory === "results"}
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                {:else if activeCategory === "application_forms"}
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12h6m-6 4h6M8 7h8m2 14H6a2 2 0 01-2-2V5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2z"
                    />
                  </svg>
                {:else if activeCategory === "exam_centers"}
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0L6.343 16.657a8 8 0 1111.314 0z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                {:else}
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                {/if}
              </div>

              <!-- Content -->
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <h3
                      class="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors"
                    >
                      {notice.title}
                    </h3>
                    <p class="text-xs text-slate-500 mt-0.5 line-clamp-1">
                      {notice.content}
                    </p>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    {#if isNoticeNew(notice.publishedDate, notice.createdAt)}
                      <span
                        class="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded-full"
                        >NEW</span
                      >
                    {/if}
                    {#if notice.attachmentUrl}
                      <span
                        class="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-semibold rounded-full uppercase"
                      >
                        {getAttachmentChipLabel(notice.attachmentUrl)}
                      </span>
                    {/if}
                  </div>
                </div>

                <div
                  class="flex items-center gap-3 mt-1 text-[10px] text-slate-400"
                >
                  <span
                    >{formatDate(notice.publishedDate, notice.createdAt)}</span
                  >
                  <span>By Exam Controller Division</span>
                </div>
              </div>

              <!-- Expand icon -->
              <svg
                class="w-5 h-5 text-slate-400 transition-transform {expandedNoticeId ===
                notice.id
                  ? 'rotate-180'
                  : ''}"
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
            </button>

            <!-- Expanded Content -->
            {#if expandedNoticeId === notice.id}
              <div
                class="px-6 pb-4 border-t border-slate-100"
                in:fade={{ duration: 150 }}
              >
                <div class="pt-4">
                  <p class="text-slate-600 whitespace-pre-wrap">
                    {notice.content}
                  </p>

                  {#if notice.attachmentUrl}
                    <div class="mt-4 p-4 bg-slate-50 rounded-xl">
                      {#if getAttachmentType(notice.attachmentUrl) === "image"}
                        <button
                          onclick={() =>
                            openImagePreview(
                              notice.attachmentUrl!,
                              notice.title,
                              notice.id,
                            )}
                          class="block w-full relative min-h-64"
                        >
                          <!-- Loading progress indicator -->
                          {#if !imagesLoaded[notice.id]}
                            <div
                              class="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-lg"
                            >
                              {#if imageProgress[notice.id] !== undefined}
                                <div class="flex flex-col items-center gap-2">
                                  <div
                                    class="text-sm text-slate-500 font-medium"
                                  >
                                    {imageProgress[notice.id]}%
                                  </div>
                                  <div
                                    class="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden"
                                  >
                                    <div
                                      class="h-full bg-blue-500 transition-all duration-200"
                                      style="width: {imageProgress[notice.id]}%"
                                    ></div>
                                  </div>
                                </div>
                              {:else}
                                <div
                                  class="w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"
                                ></div>
                              {/if}
                            </div>
                          {/if}
                          <img
                            src={imageBlobUrls[notice.id] ||
                              getNoticeCardImageUrl(notice.attachmentUrl)}
                            alt={notice.title}
                            class="max-h-64 mx-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity {imagesLoaded[
                              notice.id
                            ]
                              ? 'opacity-100'
                              : 'opacity-0'}"
                            onload={() => {
                              imagesLoaded[notice.id] = true;
                              fullyLoadedUrls.add(
                                getNoticeCardImageUrl(notice.attachmentUrl!),
                              );
                            }}
                          />
                        </button>
                      {:else if getAttachmentType(notice.attachmentUrl) === "pdf"}
                        <a
                          href={notice.attachmentUrl}
                          download={getAttachmentDisplayName(
                            notice.attachmentUrl,
                            "attachment.pdf",
                          )}
                          class="flex items-center gap-3 text-blue-600 hover:text-blue-700"
                        >
                          <img
                            src="https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg"
                            alt="PDF file"
                            class="size-7 shrink-0"
                            loading="lazy"
                          />
                          <span class="font-medium">View PDF</span>
                        </a>
                      {:else}
                        <a
                          href={notice.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="flex items-center gap-3 text-blue-600 hover:text-blue-700"
                        >
                          <svg
                            class="size-7 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M13.828 10.172a4 4 0 00-5.656 0l-2 2a4 4 0 105.656 5.656l1-1m-1.828-2.828a4 4 0 005.656 0l2-2a4 4 0 00-5.656-5.656l-1 1"
                            />
                          </svg>
                          <span class="font-medium">View Notice</span>
                        </a>
                      {/if}
                    </div>
                  {/if}

                  {#if isNoticeManager}
                    <div class="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                      <button
                        onclick={() => openEditModal(notice)}
                        class="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-medium hover:bg-blue-200 transition-colors"
                      >
                        Edit
                      </button>
                      {#if deleteConfirmId === notice.id}
                        <button
                          onclick={() => handleDelete(notice.id)}
                          class="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                        >
                          Confirm Delete
                        </button>
                        <button
                          onclick={() => (deleteConfirmId = null)}
                          class="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors"
                        >
                          Cancel
                        </button>
                      {:else}
                        <button
                          onclick={() => (deleteConfirmId = notice.id)}
                          class="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors"
                        >
                          Delete
                        </button>
                      {/if}
                    </div>
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        {/each}

        {#if canLoadMoreNotices}
          <div class="pt-2 flex justify-center">
            <button
              onclick={loadMoreNotices}
              disabled={isAppendingNotices || noticesQuery.isFetching}
              class="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {#if isAppendingNotices || noticesQuery.isFetching}
                Loading...
              {:else}
                Load more
              {/if}
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<!-- Image Preview Modal -->
{#if previewImage}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
    onclick={closeImagePreview}
    in:fade={{ duration: 150 }}
  >
    <div class="relative max-w-4xl w-full" onclick={(e) => e.stopPropagation()}>
      <!-- svelte-ignore a11y_consider_explicit_label -->
      <button
        onclick={closeImagePreview}
        class="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
      >
        <svg
          class="w-8 h-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      <div class="relative overflow-hidden rounded-lg">
        <!-- Layer 1: Placeholder (already-loaded 800px image) -->
        {#if previewPlaceholderSrc}
          <img
            src={previewPlaceholderSrc}
            alt={previewTitle}
            class="max-h-[80vh] mx-auto rounded-lg transition-all duration-300 {fullscreenLoaded
              ? 'opacity-0 absolute inset-0'
              : 'opacity-100'}"
          />
        {/if}

        <!-- Layer 2: HQ image (loaded via blob URL, fades in on top) -->
        <img
          src={fullscreenBlobUrl || optimizeCloudinaryUrl(previewImage, 1600)}
          alt={previewTitle}
          class="max-h-[80vh] mx-auto rounded-lg transition-opacity duration-300 {fullscreenLoaded
            ? 'opacity-100'
            : 'opacity-0 absolute inset-0'}"
          onload={() => {
            fullscreenLoaded = true;
          }}
        />
      </div>

      <!-- Progress indicator (below image) -->
      {#if !fullscreenLoaded && fullscreenProgress !== undefined && fullscreenProgress < 100}
        <div class="mt-3 flex flex-col items-center gap-2">
          <div class="flex items-center gap-2">
            <svg
              class="w-3.5 h-3.5 text-white/70 animate-pulse"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z"
              />
            </svg>
            <span class="text-[12px] text-white/70 font-medium tracking-wide">
              Loading High Quality · {fullscreenProgress}%
            </span>
          </div>
          <div class="w-48 h-0.75 bg-white/15 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-300 ease-out"
              style="width: {fullscreenProgress}%; background: linear-gradient(90deg, rgba(255,255,255,0.4), rgba(255,255,255,0.8)); box-shadow: 0 0 6px rgba(255,255,255,0.25)"
            ></div>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- Create/Edit Modal -->
{#if showManageModal}
  <div
    class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
    in:fade={{ duration: 150 }}
  >
    <div
      class="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
    >
      <div class="p-4 border-b border-slate-200">
        <h2 class="text-lg font-bold text-slate-800">
          {editingNotice ? "Edit Notice" : "Create Notice"}
        </h2>
      </div>

      <form
        onsubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        class="p-4 space-y-3"
      >
        {#if formError}
          <div class="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {formError}
          </div>
        {/if}

        <div>
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="block text-xs font-semibold text-slate-700 mb-1"
            >Title</label
          >
          <input
            type="text"
            bind:value={formTitle}
            class="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-xs placeholder:text-slate-400"
            placeholder="Notice title"
          />
        </div>

        <div>
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="block text-xs font-semibold text-slate-700 mb-1"
            >Content</label
          >
          <textarea
            bind:value={formContent}
            rows="5"
            class="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-xs placeholder:text-slate-400"
            placeholder="Notice content..."
          ></textarea>
        </div>

        <div>
          <div>
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="block text-xs font-semibold text-slate-700 mb-1"
              >Category</label
            >
            <select
              bind:value={formCategory}
              class="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="results">Results</option>
              <option value="application_forms">Application Forms</option>
              <option value="exam_centers">Exam Centers</option>
              <option value="exam_routines">Exam Routines</option>
              <option value="general">General</option>
            </select>
          </div>
        </div>

        <div>
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="block text-xs font-semibold text-slate-700 mb-1"
            >Attachment (optional)</label
          >
          {#if !formAttachmentUrl}
            <!-- Attachment Method Tabs -->
            <div class="flex p-0.5 bg-slate-100 rounded-lg mb-3">
              <button
                type="button"
                onclick={() => (activeAttachmentTab = "upload")}
                class="flex-1 py-1 text-xs font-medium rounded-md transition-all {activeAttachmentTab ===
                'upload'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'}"
              >
                Upload File
              </button>
              <button
                type="button"
                onclick={() => (activeAttachmentTab = "url")}
                class="flex-1 py-1 text-xs font-medium rounded-md transition-all {activeAttachmentTab ===
                'url'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'}"
              >
                Provide URL
              </button>
            </div>

            {#if activeAttachmentTab === "upload"}
              <!-- Upload zone when no file is attached -->
              <label
                class="flex flex-col items-center justify-center gap-1 w-full h-24 rounded-xl border-2 border-dashed cursor-pointer transition-all {isDragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 bg-white hover:border-blue-400'}"
                ondragover={handleAttachmentDragOver}
                ondragleave={handleAttachmentDragLeave}
                ondrop={handleAttachmentDrop}
              >
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  bind:this={attachmentFileInput}
                  onchange={handleAttachmentFileChange}
                  class="sr-only"
                />
                <svg
                  class="w-6 h-6 text-slate-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M7 16a4 4 0 01.88-7.903A5 5 0 1118 12h-1m-5-6v12m0 0l-3-3m3 3l3-3"
                  />
                </svg>
                <span class="text-slate-600 text-xs font-medium mt-1">
                  Click to upload
                  <span class="text-slate-400 font-normal">
                    or drag and drop</span
                  >
                </span>
                <span class="text-[10px] text-slate-400 mt-0.5"
                  >PNG, JPG or PDF (max 10MB)</span
                >
              </label>
            {:else}
              <!-- URL Input Mode -->
              <div class="space-y-3">
                <div class="flex gap-2">
                  <input
                    type="url"
                    bind:value={manualUrlInput}
                    placeholder="https://example.com/document.pdf"
                    class="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-xs placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    disabled={!manualUrlInput.trim()}
                    onclick={() => {
                      if (manualUrlInput.trim()) {
                        formAttachmentUrl = manualUrlInput.trim();
                        formAttachmentName =
                          manualUrlInput.split("/").pop() || "External Link";
                      }
                    }}
                    class="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
                <p class="text-xs text-slate-500">
                  Provide a direct link to an image or PDF file.
                </p>
              </div>
            {/if}
          {:else}
            <!-- Uploaded file preview -->
            <div
              class="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl"
            >
              {#if getAttachmentType(formAttachmentUrl, formAttachmentName) === "image"}
                <div
                  class="shrink-0 w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center"
                >
                  <svg
                    class="w-6 h-6 text-purple-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              {:else}
                <div
                  class="shrink-0 w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center"
                >
                  <svg
                    class="w-6 h-6 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              {/if}
              <div class="flex-1 min-w-0">
                <p class="font-medium text-slate-800 truncate">
                  {formAttachmentName || "Uploaded file"}
                </p>
                <p class="text-sm text-slate-500">
                  {getAttachmentType(formAttachmentUrl, formAttachmentName) ===
                  "image"
                    ? "Image file"
                    : getAttachmentType(
                          formAttachmentUrl,
                          formAttachmentName,
                        ) === "pdf"
                      ? "PDF Document"
                      : "External link"}
                </p>
              </div>
              <button
                type="button"
                onclick={clearAttachment}
                class="shrink-0 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Remove attachment"
              >
                <svg
                  class="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          {/if}
          {#if isUploadingAttachment}
            <div class="flex items-center gap-2 mt-2">
              <div
                class="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"
              ></div>
              <p class="text-sm text-slate-500">Uploading...</p>
            </div>
          {/if}
          {#if attachmentUploadError}
            <p class="text-sm text-red-600 mt-2">{attachmentUploadError}</p>
          {/if}
        </div>

        <!-- Display name (optional, only shown when file is attached) -->
        {#if formAttachmentUrl}
          <div>
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="block text-xs font-semibold text-slate-700 mb-1"
              >Display Name (optional)</label
            >
            <input
              type="text"
              bind:value={formAttachmentName}
              class="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-xs placeholder:text-slate-400"
              placeholder="Custom name for the attachment"
            />
          </div>
        {/if}

        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onclick={closeModal}
            class="px-4 py-1.5 bg-slate-100 text-slate-700 text-sm rounded-lg font-medium hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isUploadingAttachment}
            class="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting
              ? "Saving..."
              : isUploadingAttachment
                ? "Uploading..."
                : editingNotice
                  ? "Update"
                  : "Create"}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .line-clamp-1 {
    display: -webkit-box;
    line-clamp: 1;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
