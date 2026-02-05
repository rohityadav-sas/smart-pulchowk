<script lang="ts">
  import { authClient } from '../lib/auth-client'
  import { fade } from 'svelte/transition'
  import {
    getNotices,
    getNoticeStats,
    createNotice,
    updateNotice,
    deleteNotice,
    uploadNoticeAttachment,
    type Notice,
    type NoticeStats,
  } from '../lib/api'
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'

  const session = authClient.useSession()
  const queryClient = useQueryClient()
  const sessionUser = $derived(
    $session.data?.user as { role?: string } | undefined,
  )
  const isNoticeManager = $derived(
    sessionUser?.role === 'notice_manager' || sessionUser?.role === 'admin',
  )

  type NoticeSection = 'results' | 'routines'
  type NoticeSubsection = 'be' | 'msc'

  // State
  let activeSection = $state<NoticeSection>('results')
  let activeSubsection = $state<NoticeSubsection>('be')
  let searchQuery = $state('')
  let expandedNoticeId = $state<number | null>(null)

  // Image preview modal
  let previewImage = $state<string | null>(null)
  let previewTitle = $state('')

  // Management modal state
  let showManageModal = $state(false)
  let editingNotice = $state<Notice | null>(null)
  let isSubmitting = $state(false)
  let formError = $state<string | null>(null)
  let isUploadingAttachment = $state(false)
  let attachmentUploadError = $state<string | null>(null)
  let attachmentFileInput = $state<HTMLInputElement | null>(null)
  let isDragActive = $state(false)

  // Form state
  let formTitle = $state('')
  let formContent = $state('')
  let formSection = $state<NoticeSection>('results')
  let formSubsection = $state<NoticeSubsection>('be')
  let formAttachmentUrl = $state('')
  let manualUrlInput = $state('')
  let formAttachmentName = $state('')
  let activeAttachmentTab = $state<'upload' | 'url'>('upload')

  // Delete confirmation
  let deleteConfirmId = $state<number | null>(null)

  // Image loading progress state
  let imagesLoaded = $state<Record<number, boolean>>({})
  let imageProgress = $state<Record<number, number | undefined>>({})
  let progressFailedUrls = new Set<string>()
  const fullyLoadedUrls = new Set<string>()

  async function loadImageWithProgress(url: string, noticeId: number) {
    // Skip if we know this URL fails to provide progress
    if (!url || progressFailedUrls.has(url)) {
      imageProgress[noticeId] = undefined
      return
    }

    // Check if we've already fully loaded this image previously in the session
    if (fullyLoadedUrls.has(url)) {
      if (!imagesLoaded[noticeId]) {
        imagesLoaded[noticeId] = true
        imageProgress[noticeId] = 100
      }
      return
    }

    // If the image is already loaded (from cache/onload firing first), don't reset
    if (imagesLoaded[noticeId]) {
      imageProgress[noticeId] = 100
      fullyLoadedUrls.add(url)
      return
    }

    imageProgress[noticeId] = 0
    imagesLoaded[noticeId] = false

    // Use XMLHttpRequest for progress tracking (better CORS support than fetch)
    const xhr = new XMLHttpRequest()
    xhr.open('GET', url, true)
    xhr.responseType = 'blob'

    xhr.onprogress = (event) => {
      if (event.lengthComputable) {
        imageProgress[noticeId] = Math.round((event.loaded / event.total) * 100)
      }
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        imageProgress[noticeId] = 100
        imagesLoaded[noticeId] = true
        fullyLoadedUrls.add(url)
      } else {
        progressFailedUrls.add(url)
        imageProgress[noticeId] = undefined
      }
    }

    xhr.onerror = () => {
      console.log('XHR progress failed, falling back', url)
      progressFailedUrls.add(url)
      imageProgress[noticeId] = undefined
    }

    xhr.send()
  }

  const noticesQuery = createQuery(() => ({
    queryKey: ['notices', activeSection, activeSubsection],
    queryFn: async () => {
      const result = await getNotices({
        section: activeSection,
        subsection: activeSubsection,
      })
      if (!result.success || !result.data) {
        throw new Error(result.message || 'Failed to load notices')
      }
      return result.data
    },
  }))

  const statsQuery = createQuery(() => ({
    queryKey: ['notice-stats'],
    queryFn: async () => {
      const result = await getNoticeStats()
      if (!result.success || !result.data) {
        throw new Error(result.message || 'Failed to load notice stats')
      }
      return result.data
    },
  }))

  // Handle section change
  function setSection(section: NoticeSection) {
    if (activeSection !== section) {
      activeSection = section
    }
  }

  // Handle subsection change
  function setSubsection(subsection: NoticeSubsection) {
    if (activeSubsection !== subsection) {
      activeSubsection = subsection
    }
  }

  // Filtered notices (client-side search)
  function getFilteredNotices() {
    let filtered = [...(noticesQuery.data || [])]
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (n) =>
          n.title.toLowerCase().includes(query) ||
          n.content.toLowerCase().includes(query),
      )
    }
    return filtered.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }

  const filteredNotices = $derived(getFilteredNotices())
  const beResults = $derived(
    statsQuery.data
      ? activeSection === 'results'
        ? statsQuery.data.beResults
        : statsQuery.data.beRoutines
      : 0,
  )
  const mscResults = $derived(
    statsQuery.data
      ? activeSection === 'results'
        ? statsQuery.data.mscResults
        : statsQuery.data.mscRoutines
      : 0,
  )
  // Calculate newCount locally from notices using the same isNoticeNew logic
  const newCount = $derived(
    filteredNotices.filter((n) => isNoticeNew(n.createdAt)).length,
  )

  function openImagePreview(url: string, title: string) {
    previewImage = url
    previewTitle = title
  }

  // Load image with progress when a notice is expanded
  $effect(() => {
    if (expandedNoticeId !== null) {
      const notice = filteredNotices.find((n) => n.id === expandedNoticeId)
      if (
        notice?.attachmentUrl &&
        getAttachmentType(notice.attachmentUrl, notice.attachmentName) ===
          'image'
      ) {
        if (
          !imagesLoaded[notice.id] &&
          imageProgress[notice.id] === undefined
        ) {
          loadImageWithProgress(notice.attachmentUrl, notice.id)
        }
      }
    }
  })

  function closeImagePreview() {
    previewImage = null
    previewTitle = ''
  }
  function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`
    if (diffDays < 7) return `${Math.floor(diffDays)}d ago`
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
  }
  function isNoticeNew(createdAt: string): boolean {
    const publishDate = new Date(createdAt)
    const now = new Date()
    const diffMs = now.getTime() - publishDate.getTime()
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    return diffMs < sevenDaysMs
  }
  function getAttachmentType(
    url: string | null,
    name: string | null,
  ): 'image' | 'pdf' {
    if (!url) return 'image'
    const lowerUrl = url.toLowerCase()
    const lowerName = name?.toLowerCase() || ''

    // Check for explicit PDF extensions
    if (lowerUrl.endsWith('.pdf') || lowerName.endsWith('.pdf')) {
      return 'pdf'
    }

    // Check for Google Drive links (usually documents)
    if (
      lowerUrl.includes('drive.google.com') ||
      lowerUrl.includes('docs.google.com')
    ) {
      return 'pdf'
    }

    // Check for explicit image extensions logic (default to pdf if not image, or maintain current behavior?)
    // Current behavior defaults to 'image'. Let's check for known image extensions.
    const imageExtensions = [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.webp',
      '.svg',
      '.bmp',
    ]
    if (
      imageExtensions.some(
        (ext) => lowerUrl.endsWith(ext) || lowerName.endsWith(ext),
      )
    ) {
      return 'image'
    }

    // If it's a raw Cloudinary upload without extension, it might be tricky.
    // But safely defaulting to PDF for unknown types might be better than broken image?
    // However, the legacy behavior was "default to image".
    // Let's stick to "default to image" IF it doesn't match the new PDF criteria?
    // No, user complaint "detects as image instead of pdf" suggests "default image" is the problem for URL links.

    // Let's assume if it's NOT a known image extension and NOT a PDF extension/domain,
    // and it IS a URL provided manually (likely what happened), we should probably treat as link (pdf mode handles links safely).

    return 'image'
  }
  function toggleExpand(id: number) {
    expandedNoticeId = expandedNoticeId === id ? null : id
  }
  function openCreateModal() {
    editingNotice = null
    formTitle = ''
    formContent = ''
    formSection = activeSection
    formSubsection = activeSubsection
    formAttachmentUrl = ''

    formAttachmentName = ''
    attachmentUploadError = null
    if (attachmentFileInput) attachmentFileInput.value = ''
    formError = null
    showManageModal = true
  }
  function openEditModal(notice: Notice) {
    editingNotice = notice
    formTitle = notice.title
    formContent = notice.content
    formSection = notice.section
    formSubsection = notice.subsection
    formAttachmentUrl = notice.attachmentUrl || ''
    manualUrlInput = ''
    activeAttachmentTab = 'upload'

    formAttachmentName = notice.attachmentName || ''
    attachmentUploadError = null
    if (attachmentFileInput) attachmentFileInput.value = ''
    formError = null
    showManageModal = true
  }
  function closeModal() {
    showManageModal = false
    editingNotice = null
    formError = null
  }
  function clearAttachment() {
    formAttachmentUrl = ''
    manualUrlInput = ''

    formAttachmentName = ''
    attachmentUploadError = null
    if (attachmentFileInput) attachmentFileInput.value = ''
  }
  async function handleAttachmentFileSelected(file: File) {
    if (isUploadingAttachment) return
    isUploadingAttachment = true
    attachmentUploadError = null
    const result = await uploadNoticeAttachment(file)
    isUploadingAttachment = false
    if (!result.success || !result.data) {
      attachmentUploadError =
        result.message || 'Failed to upload attachment. Please try again.'
      return
    }
    formAttachmentUrl = result.data.url

    formAttachmentName = result.data.name || file.name
  }
  async function handleAttachmentFileChange(event: Event) {
    const target = event.currentTarget as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return
    await handleAttachmentFileSelected(file)
    target.value = ''
  }
  function handleAttachmentDragOver(event: DragEvent) {
    event.preventDefault()
    isDragActive = true
  }
  function handleAttachmentDragLeave(event: DragEvent) {
    event.preventDefault()
    isDragActive = false
  }
  async function handleAttachmentDrop(event: DragEvent) {
    event.preventDefault()
    isDragActive = false
    const file = event.dataTransfer?.files?.[0]
    if (!file) return
    await handleAttachmentFileSelected(file)
  }
  async function handleSubmit() {
    if (!formTitle.trim() || !formContent.trim()) {
      formError = 'Title and content are required'
      return
    }
    if (isUploadingAttachment) {
      formError = 'Please wait for the attachment upload to finish'
      return
    }
    isSubmitting = true
    formError = null
    const data = {
      title: formTitle.trim(),
      content: formContent.trim(),
      section: formSection,
      subsection: formSubsection,
      attachmentUrl: formAttachmentUrl.trim() || null,

      attachmentName: formAttachmentName.trim() || null,
    } satisfies Omit<
      Notice,
      'id' | 'authorId' | 'createdAt' | 'updatedAt' | 'author'
    >
    let result
    if (editingNotice) {
      result = await updateNotice(editingNotice.id, data)
    } else {
      result = await createNotice(data)
    }
    isSubmitting = false
    if (result.success) {
      closeModal()
      await queryClient.invalidateQueries({ queryKey: ['notices'] })
      await queryClient.invalidateQueries({ queryKey: ['notice-stats'] })
    } else {
      formError = result.message || 'Failed to save notice'
    }
  }
  async function handleDelete(id: number) {
    const result = await deleteNotice(id)
    if (result.success) {
      deleteConfirmId = null
      await queryClient.invalidateQueries({ queryKey: ['notices'] })
      await queryClient.invalidateQueries({ queryKey: ['notice-stats'] })
    }
  }
</script>

<div class="min-h-[calc(100vh-4rem)] bg-gray-50/50 px-4 py-8 sm:px-6 lg:px-8">
  <div class="max-w-5xl mx-auto">
    <!-- Header -->
    <div class="text-center mb-12" in:fade>
      <h1 class="text-4xl sm:text-5xl font-black mb-4">
        <span class="text-blue-600">Notice</span>
        <span class="text-slate-800">Board</span>
      </h1>
      <p class="text-slate-600 text-lg max-w-2xl mx-auto">
        Access examination results and routines for BE and MSc programs at IOE
        Pulchowk Campus.
      </p>
    </div>

    <!-- Section Tabs -->
    <div class="flex justify-center gap-3 mb-6">
      <button
        onclick={() => setSection('results')}
        class="px-6 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 {activeSection ===
        'results'
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
          : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}"
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
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Results
      </button>
      <button
        onclick={() => setSection('routines')}
        class="px-6 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 {activeSection ===
        'routines'
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
          : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}"
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
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        Routines
      </button>
    </div>

    <!-- Program Tabs -->
    <div class="flex justify-center gap-3 mb-8">
      <button
        onclick={() => setSubsection('be')}
        class="px-5 py-2 rounded-full font-medium transition-all flex items-center gap-2 {activeSubsection ===
        'be'
          ? 'bg-slate-800 text-white'
          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}"
      >
        <span
          class="w-2 h-2 rounded-full {activeSubsection === 'be'
            ? 'bg-green-400'
            : 'bg-slate-300'}"
        ></span>
        BE Programs
        <span class="text-xs bg-white/20 px-2 py-0.5 rounded-full"
          >{beResults}</span
        >
      </button>
      <button
        onclick={() => setSubsection('msc')}
        class="px-5 py-2 rounded-full font-medium transition-all flex items-center gap-2 {activeSubsection ===
        'msc'
          ? 'bg-slate-800 text-white'
          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}"
      >
        <span
          class="w-2 h-2 rounded-full {activeSubsection === 'msc'
            ? 'bg-purple-400'
            : 'bg-slate-300'}"
        ></span>
        MSc Programs
        <span class="text-xs bg-white/20 px-2 py-0.5 rounded-full"
          >{mscResults}</span
        >
      </button>
    </div>

    <!-- Search and Management -->
    <div class="flex gap-4 mb-6">
      <div class="flex-1 relative">
        <svg
          class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
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
          placeholder="Search results..."
          bind:value={searchQuery}
          class="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {#if isNoticeManager}
        <button
          onclick={openCreateModal}
          class="px-5 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center gap-2"
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Notice
        </button>
      {/if}
    </div>

    <!-- New notices badge -->
    {#if newCount > 0}
      <div class="flex justify-center mb-6">
        <span
          class="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-full text-sm font-medium border border-amber-200"
        >
          <span class="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
          {newCount} new notices this week
        </span>
      </div>
    {/if}

    <!-- Loading State -->
    {#if noticesQuery.isLoading}
      <div class="flex items-center justify-center py-20">
        <div class="flex flex-col items-center gap-4">
          <div
            class="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"
          ></div>
          <p class="text-slate-500 font-medium">Loading notices...</p>
        </div>
      </div>
    {:else if noticesQuery.error}
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
              ? 'Try a different search term'
              : `There are no examination ${activeSection} posted for ${activeSubsection.toUpperCase()} programs yet.`}
          </p>
        </div>
      </div>
    {:else}
      <!-- Notices List -->
      <div class="space-y-4" in:fade={{ delay: 100 }}>
        {#each filteredNotices as notice (notice.id)}
          <div
            class="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all overflow-hidden"
          >
            <!-- Notice Header -->
            <button
              onclick={() => toggleExpand(notice.id)}
              class="w-full px-6 py-4 flex items-start gap-4 text-left"
            >
              <!-- Icon -->
              <div
                class="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center {activeSection ===
                'results'
                  ? 'bg-green-100 text-green-600'
                  : 'bg-blue-100 text-blue-600'}"
              >
                {#if activeSection === 'results'}
                  <svg
                    class="w-6 h-6"
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
                {:else}
                  <svg
                    class="w-6 h-6"
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
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <h3
                      class="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors"
                    >
                      {notice.title}
                    </h3>
                    <p class="text-sm text-slate-500 mt-1 line-clamp-1">
                      {notice.content}
                    </p>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    {#if isNoticeNew(notice.createdAt)}
                      <span
                        class="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full"
                        >NEW</span
                      >
                    {/if}
                    {#if notice.attachmentUrl}
                      <span
                        class="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full uppercase"
                      >
                        {getAttachmentType(
                          notice.attachmentUrl,
                          notice.attachmentName,
                        ) || 'file'}
                      </span>
                    {/if}
                  </div>
                </div>

                <div
                  class="flex items-center gap-4 mt-2 text-xs text-slate-400"
                >
                  <span>{formatDate(notice.createdAt)}</span>
                  {#if notice.author}
                    <span>by {notice.author.name}</span>
                  {/if}
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
                      {#if getAttachmentType(notice.attachmentUrl, notice.attachmentName) === 'image'}
                        <button
                          onclick={() =>
                            openImagePreview(
                              notice.attachmentUrl!,
                              notice.title,
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
                                  class="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"
                                ></div>
                              {/if}
                            </div>
                          {/if}
                          <img
                            src={notice.attachmentUrl}
                            alt={notice.attachmentName || notice.title}
                            class="max-h-64 mx-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity {imagesLoaded[
                              notice.id
                            ]
                              ? 'opacity-100'
                              : 'opacity-0'}"
                            onload={() => {
                              imagesLoaded[notice.id] = true
                              fullyLoadedUrls.add(notice.attachmentUrl!)
                            }}
                          />
                        </button>
                      {:else}
                        <a
                          href={notice.attachmentUrl}
                          download={notice.attachmentName || 'attachment.pdf'}
                          class="flex items-center gap-3 text-blue-600 hover:text-blue-700"
                        >
                          <svg
                            class="w-8 h-8"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm4 18H6V4h7v5h5v11z"
                            />
                          </svg>
                          <span class="font-medium"
                            >{notice.attachmentName || 'View PDF'}</span
                          >
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
      </div>
    {/if}
  </div>
</div>

<!-- Image Preview Modal -->
{#if previewImage}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
    onclick={closeImagePreview}
    in:fade={{ duration: 150 }}
  >
    <div class="relative max-w-4xl w-full">
      <!-- svelte-ignore a11y_consider_explicit_label -->
      <button
        onclick={closeImagePreview}
        class="absolute -top-12 right-0 text-white hover:text-slate-300"
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
      <img
        src={previewImage}
        alt={previewTitle}
        class="max-h-[80vh] mx-auto rounded-lg"
      />
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
      class="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
    >
      <div class="p-6 border-b border-slate-200">
        <h2 class="text-xl font-bold text-slate-800">
          {editingNotice ? 'Edit Notice' : 'Create Notice'}
        </h2>
      </div>

      <form
        onsubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
        class="p-6 space-y-4"
      >
        {#if formError}
          <div class="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {formError}
          </div>
        {/if}

        <div>
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="block text-sm font-medium text-slate-700 mb-1"
            >Title</label
          >
          <input
            type="text"
            bind:value={formTitle}
            class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Notice title"
          />
        </div>

        <div>
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="block text-sm font-medium text-slate-700 mb-1"
            >Content</label
          >
          <textarea
            bind:value={formContent}
            rows="5"
            class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Notice content..."
          ></textarea>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="block text-sm font-medium text-slate-700 mb-1"
              >Section</label
            >
            <select
              bind:value={formSection}
              class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="results">Results</option>
              <option value="routines">Routines</option>
            </select>
          </div>
          <div>
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="block text-sm font-medium text-slate-700 mb-1"
              >Program</label
            >
            <select
              bind:value={formSubsection}
              class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="be">BE</option>
              <option value="msc">MSc</option>
            </select>
          </div>
        </div>

        <div>
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="block text-sm font-medium text-slate-700 mb-1"
            >Attachment (optional)</label
          >
          {#if !formAttachmentUrl}
            <!-- Attachment Method Tabs -->
            <div class="flex p-1 bg-slate-100 rounded-lg mb-4">
              <button
                type="button"
                onclick={() => (activeAttachmentTab = 'upload')}
                class="flex-1 py-1.5 text-sm font-medium rounded-md transition-all {activeAttachmentTab ===
                'upload'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'}"
              >
                Upload File
              </button>
              <button
                type="button"
                onclick={() => (activeAttachmentTab = 'url')}
                class="flex-1 py-1.5 text-sm font-medium rounded-md transition-all {activeAttachmentTab ===
                'url'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'}"
              >
                Provide URL
              </button>
            </div>

            {#if activeAttachmentTab === 'upload'}
              <!-- Upload zone when no file is attached -->
              <label
                class="flex flex-col items-center justify-center gap-1 w-full h-32 rounded-xl border-2 border-dashed cursor-pointer transition-all {isDragActive
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
                  class="w-8 h-8 text-slate-400"
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
                <span class="text-slate-600 text-sm font-medium mt-2">
                  Click to upload
                  <span class="text-slate-400 font-normal">
                    or drag and drop</span
                  >
                </span>
                <span class="text-xs text-slate-400 mt-1"
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
                    class="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    disabled={!manualUrlInput.trim()}
                    onclick={() => {
                      if (manualUrlInput.trim()) {
                        formAttachmentUrl = manualUrlInput.trim()
                        formAttachmentName =
                          manualUrlInput.split('/').pop() || 'External Link'
                      }
                    }}
                    class="px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              {#if getAttachmentType(formAttachmentUrl, formAttachmentName) === 'image'}
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
                  {formAttachmentName || 'Uploaded file'}
                </p>
                <p class="text-sm text-slate-500">
                  {getAttachmentType(formAttachmentUrl, formAttachmentName) ===
                  'image'
                    ? 'Image file'
                    : 'PDF Document'}
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
                class="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"
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
            <label class="block text-sm font-medium text-slate-700 mb-1"
              >Display Name (optional)</label
            >
            <input
              type="text"
              bind:value={formAttachmentName}
              class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Custom name for the attachment"
            />
          </div>
        {/if}

        <div class="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onclick={closeModal}
            class="px-5 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isUploadingAttachment}
            class="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting
              ? 'Saving...'
              : isUploadingAttachment
                ? 'Uploading...'
                : editingNotice
                  ? 'Update'
                  : 'Create'}
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
