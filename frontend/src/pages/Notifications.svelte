<script lang="ts">
  import {
    createMutation,
    createQuery,
    useQueryClient,
  } from '@tanstack/svelte-query'
  import {
    getInAppNotifications,
    getUnreadNotificationsCount,
    markAllInAppNotificationsRead,
    markInAppNotificationRead,
    type InAppNotification,
  } from '../lib/api'
  import LoadingSpinner from '../components/LoadingSpinner.svelte'
  import { route } from '@mateothegreat/svelte5-router'
  import { optimizeCloudinaryThumbnailUrl } from '../lib/api-client'

  const queryClient = useQueryClient()
  const PAGE_SIZE = 5
  let showUnreadOnly = $state(false)
  let paginationOffset = $state(0)
  let loadedNotifications = $state<InAppNotification[]>([])
  let totalNotifications = $state(0)
  let isAppendingPage = $state(false)
  let lastAppliedPageToken = $state<string | null>(null)

  function publishUnreadCount(count: number) {
    window.dispatchEvent(
      new CustomEvent('notifications:unread-count', {
        detail: { count: Math.max(0, count) },
      }),
    )
  }

  function resetPagination() {
    paginationOffset = 0
    loadedNotifications = []
    totalNotifications = 0
    isAppendingPage = false
    lastAppliedPageToken = null
  }

  const canLoadMore = $derived(loadedNotifications.length < totalNotifications)

  function toggleUnreadOnly() {
    showUnreadOnly = !showUnreadOnly
    resetPagination()
  }

  function loadMoreNotifications() {
    if (!canLoadMore || notificationsQuery.isFetching) return
    isAppendingPage = true
    paginationOffset = loadedNotifications.length
  }

  const notificationsQuery = createQuery(() => ({
    queryKey: ['in-app-notifications', showUnreadOnly, paginationOffset],
    queryFn: async () => {
      const result = await getInAppNotifications({
        limit: PAGE_SIZE,
        offset: paginationOffset,
        unreadOnly: showUnreadOnly,
      })
      if (!result.success)
        throw new Error(result.message || 'Failed to load notifications')
      return {
        items: result.data || [],
        total: result.meta?.total ?? result.data?.length ?? 0,
      }
    },
    staleTime: 10 * 1000,
    refetchInterval: 20 * 1000,
  }))

  $effect(() => {
    const page = notificationsQuery.data
    if (!page) return
    const pageToken = `${showUnreadOnly}:${paginationOffset}:${notificationsQuery.dataUpdatedAt}`
    if (lastAppliedPageToken === pageToken) return
    lastAppliedPageToken = pageToken

    if (paginationOffset === 0) {
      loadedNotifications = page.items
    } else {
      const existingIds = new Set(loadedNotifications.map((item) => item.id))
      const merged = [...loadedNotifications]
      for (const item of page.items) {
        if (!existingIds.has(item.id)) merged.push(item)
      }
      loadedNotifications = merged
    }

    totalNotifications = page.total
    isAppendingPage = false
  })

  const unreadCountQuery = createQuery(() => ({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const result = await getUnreadNotificationsCount()
      return result.success ? result.count || 0 : 0
    },
    staleTime: 10 * 1000,
    refetchInterval: 20 * 1000,
  }))

  const markReadMutation = createMutation(() => ({
    mutationFn: async (notificationId: number) => {
      const result = await markInAppNotificationRead(notificationId)
      if (!result.success) {
        throw new Error(result.message || 'Failed to mark notification as read')
      }
      return result
    },
    onMutate: async (notificationId: number) => {
      const prevLoadedNotifications = loadedNotifications
      const prevTotalNotifications = totalNotifications
      const prevUnreadCount =
        queryClient.getQueryData<number>(['notifications-unread-count']) ?? 0
      const target = loadedNotifications.find((n) => n.id === notificationId)
      const wasUnread = !!target && !target.isRead

      if (target && wasUnread) {
        loadedNotifications = loadedNotifications.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                isRead: true,
                readAt: new Date().toISOString(),
              }
            : notification,
        )

        if (showUnreadOnly) {
          loadedNotifications = loadedNotifications.filter(
            (notification) => notification.id !== notificationId,
          )
          totalNotifications = Math.max(0, totalNotifications - 1)
        }

        const nextUnread = Math.max(0, prevUnreadCount - 1)
        queryClient.setQueryData(['notifications-unread-count'], nextUnread)
        publishUnreadCount(nextUnread)
      }

      return {
        prevLoadedNotifications,
        prevTotalNotifications,
        prevUnreadCount,
        wasUnread,
      }
    },
    onError: (_error, _notificationId, context) => {
      if (!context) return
      loadedNotifications = context.prevLoadedNotifications
      totalNotifications = context.prevTotalNotifications
      queryClient.setQueryData(
        ['notifications-unread-count'],
        context.prevUnreadCount,
      )
      publishUnreadCount(context.prevUnreadCount)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['in-app-notifications'] })
      queryClient.invalidateQueries({
        queryKey: ['notifications-unread-count'],
      })
    },
  }))

  const markAllMutation = createMutation(() => ({
    mutationFn: async () => {
      const result = await markAllInAppNotificationsRead()
      if (!result.success) {
        throw new Error(
          result.message || 'Failed to mark all notifications as read',
        )
      }
      return result
    },
    onMutate: async () => {
      const prevLoadedNotifications = loadedNotifications
      const prevTotalNotifications = totalNotifications
      const prevUnreadCount =
        queryClient.getQueryData<number>(['notifications-unread-count']) ?? 0
      const nowIso = new Date().toISOString()
      loadedNotifications = showUnreadOnly
        ? []
        : loadedNotifications.map((notification) => ({
            ...notification,
            isRead: true,
            readAt: notification.readAt || nowIso,
          }))
      if (showUnreadOnly) totalNotifications = 0

      queryClient.setQueryData(['notifications-unread-count'], 0)
      publishUnreadCount(0)
      return {
        prevLoadedNotifications,
        prevTotalNotifications,
        prevUnreadCount,
      }
    },
    onError: (_error, _variables, context) => {
      if (!context) return
      loadedNotifications = context.prevLoadedNotifications
      totalNotifications = context.prevTotalNotifications
      queryClient.setQueryData(
        ['notifications-unread-count'],
        context.prevUnreadCount,
      )
      publishUnreadCount(context.prevUnreadCount)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['in-app-notifications'] })
      queryClient.invalidateQueries({
        queryKey: ['notifications-unread-count'],
      })
    },
  }))

  function getNotificationHref(notification: InAppNotification) {
    const data = notification.data || {}
    const eventId = Number(data.eventId || 0)
    const clubId = Number(data.clubId || 0)
    const listingId = Number(data.listingId || data.bookId || 0)
    const requestId = Number(data.requestId || 0)
    const conversationId = Number(data.conversationId || 0)
    const noticeId = Number(data.noticeId || 0)
    const lostFoundItemId = Number(data.itemId || 0)
    const noticeCategoryRaw =
      typeof data.category === 'string' ? data.category.trim() : ''
    const noticeCategory =
      noticeCategoryRaw === 'results' ||
      noticeCategoryRaw === 'application_forms' ||
      noticeCategoryRaw === 'exam_centers' ||
      noticeCategoryRaw === 'general'
        ? noticeCategoryRaw
        : ''

    const buildHref = (path: string, params: URLSearchParams) => {
      const query = params.toString()
      return query ? `${path}?${query}` : path
    }

    if (notification.type === 'purchase_request') {
      const params = new URLSearchParams()
      params.set('fromNotification', '1')
      params.set('notificationId', String(notification.id))
      params.set('tab', 'listings')
      params.set('highlightTab', 'listings')
      if (listingId > 0) params.set('listingId', String(listingId))
      if (listingId > 0) params.set('highlightListingId', String(listingId))
      if (requestId > 0) params.set('requestId', String(requestId))
      if (requestId > 0) params.set('highlightRequestId', String(requestId))
      return buildHref('/books/my-books', params)
    }

    if (
      notification.type === 'purchase_request_cancelled' ||
      notification.type === 'purchase_request_removed'
    ) {
      const params = new URLSearchParams()
      params.set('fromNotification', '1')
      params.set('notificationId', String(notification.id))
      params.set('tab', 'listings')
      params.set('highlightTab', 'listings')
      if (listingId > 0) params.set('listingId', String(listingId))
      if (listingId > 0) params.set('highlightListingId', String(listingId))
      if (requestId > 0) params.set('requestId', String(requestId))
      if (requestId > 0) params.set('highlightRequestId', String(requestId))
      return buildHref('/books/my-books', params)
    }

    if (notification.type === 'request_response') {
      const params = new URLSearchParams()
      params.set('fromNotification', '1')
      params.set('notificationId', String(notification.id))
      params.set('tab', 'requests')
      params.set('highlightTab', 'requests')
      if (listingId > 0) params.set('listingId', String(listingId))
      if (listingId > 0) params.set('highlightListingId', String(listingId))
      if (requestId > 0) params.set('requestId', String(requestId))
      if (requestId > 0) params.set('highlightRequestId', String(requestId))
      return buildHref('/books/my-books', params)
    }

    if (conversationId > 0) {
      const params = new URLSearchParams()
      params.set('fromNotification', '1')
      params.set('notificationId', String(notification.id))
      params.set('conversation', String(conversationId))
      params.set('highlightConversationId', String(conversationId))
      return buildHref('/messages', params)
    }

    if (listingId > 0) {
      const params = new URLSearchParams()
      params.set('fromNotification', '1')
      params.set('notificationId', String(notification.id))
      params.set('highlight', 'listing')
      params.set('listingId', String(listingId))
      return buildHref(`/books/${listingId}`, params)
    }

    if (clubId > 0 && eventId > 0) {
      const params = new URLSearchParams()
      params.set('fromNotification', '1')
      params.set('notificationId', String(notification.id))
      params.set('highlight', 'event')
      params.set('eventId', String(eventId))
      return buildHref(`/clubs/${clubId}/events/${eventId}`, params)
    }

    if (eventId > 0) {
      const params = new URLSearchParams()
      params.set('fromNotification', '1')
      params.set('notificationId', String(notification.id))
      params.set('highlightEventId', String(eventId))
      return buildHref('/events', params)
    }

    if (noticeId > 0 || notification.type.startsWith('notice_')) {
      const params = new URLSearchParams()
      params.set('fromNotification', '1')
      params.set('notificationId', String(notification.id))
      if (noticeId > 0) params.set('noticeId', String(noticeId))
      if (noticeCategory) params.set('category', noticeCategory)
      const path = noticeCategory ? `/notices/${noticeCategory}` : '/notices'
      return buildHref(path, params)
    }

    if (lostFoundItemId > 0 || notification.type.startsWith('lost_found_')) {
      const params = new URLSearchParams()
      params.set('fromNotification', '1')
      params.set('notificationId', String(notification.id))
      params.set('highlight', 'item')
      return buildHref(
        lostFoundItemId > 0 ? `/lost-found/${lostFoundItemId}` : '/lost-found',
        params,
      )
    }

    if (
      notification.type.includes('assignment') ||
      notification.type.includes('grading')
    ) {
      const params = new URLSearchParams()
      params.set('fromNotification', '1')
      params.set('notificationId', String(notification.id))
      params.set('highlightSection', 'assignments')
      if (
        typeof data.assignmentId === 'string' ||
        typeof data.assignmentId === 'number'
      ) {
        params.set('assignmentId', String(data.assignmentId))
      }
      return buildHref('/classroom', params)
    }

    if (
      notification.type === 'role_changed' ||
      notification.type === 'security_alert'
    ) {
      const params = new URLSearchParams()
      params.set('fromNotification', '1')
      params.set('notificationId', String(notification.id))
      params.set('highlightSection', 'security')
      return buildHref('/settings', params)
    }

    if (
      notification.type === 'admin_moderation_update' ||
      notification.type === 'system_announcement'
    ) {
      const params = new URLSearchParams()
      params.set('fromNotification', '1')
      params.set('notificationId', String(notification.id))
      params.set('highlightSection', 'overview')
      return buildHref('/dashboard', params)
    }

    const fallbackParams = new URLSearchParams()
    fallbackParams.set('fromNotification', '1')
    fallbackParams.set('notificationId', String(notification.id))
    fallbackParams.set('highlightSection', 'overview')
    return buildHref('/dashboard', fallbackParams)
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr)
    return date.toLocaleString()
  }

  function getImageUrl(notification: InAppNotification) {
    const data = (notification.data || {}) as Record<
      string,
      string | number | boolean | null
    >
    const value =
      (data.thumbnailUrl as string | undefined) ||
      (data.bannerUrl as string | undefined) ||
      (data.attachmentUrl as string | undefined)
    if (typeof value !== 'string' || value.trim().length === 0) return null
    return optimizeCloudinaryThumbnailUrl(value, 280, 280)
  }

  function isPdfUrl(url: string | null) {
    if (!url) return false
    const normalized = url.toLowerCase()
    return (
      normalized.endsWith('.pdf') ||
      normalized.includes('drive.google.com') ||
      normalized.includes('docs.google.com')
    )
  }

  function isImageUrl(url: string | null) {
    if (!url) return false
    const normalized = url.toLowerCase()
    return (
      normalized.endsWith('.jpg') ||
      normalized.endsWith('.jpeg') ||
      normalized.endsWith('.png') ||
      normalized.endsWith('.webp') ||
      normalized.endsWith('.gif') ||
      normalized.endsWith('.svg')
    )
  }

  function getActorAvatarUrl(notification: InAppNotification) {
    const data = (notification.data || {}) as Record<
      string,
      string | number | boolean | null
    >
    const value =
      (data.actorAvatarUrl as string | undefined) ||
      (data.requestedByAvatarUrl as string | undefined) ||
      (data.requesterAvatarUrl as string | undefined)
    return typeof value === 'string' && value.trim().length > 0 ? value : null
  }

  function getBookThumbUrl(notification: InAppNotification) {
    const data = (notification.data || {}) as Record<
      string,
      string | number | boolean | null
    >
    const value =
      (data.thumbnailUrl as string | undefined) ||
      (data.imageUrl as string | undefined) ||
      (data.bannerUrl as string | undefined)
    if (typeof value !== 'string' || value.trim().length === 0) return null
    return optimizeCloudinaryThumbnailUrl(value, 140, 140)
  }

  function getLostFoundThumbUrl(notification: InAppNotification) {
    const data = (notification.data || {}) as Record<
      string,
      string | number | boolean | null
    >
    const value =
      (data.thumbnailUrl as string | undefined) ||
      (data.imageUrl as string | undefined)
    if (typeof value !== 'string' || value.trim().length === 0) return null
    return optimizeCloudinaryThumbnailUrl(value, 140, 140)
  }

  function getActorName(notification: InAppNotification) {
    const data = (notification.data || {}) as Record<
      string,
      string | number | boolean | null
    >
    const actor =
      (data.buyerName as string | undefined) ||
      (data.actorName as string | undefined) ||
      (data.requesterName as string | undefined) ||
      (data.requestedByName as string | undefined)
    return typeof actor === 'string' && actor.trim().length > 0
      ? actor.trim()
      : null
  }

  function getLostFoundTitle(notification: InAppNotification) {
    const data = (notification.data || {}) as Record<
      string,
      string | number | boolean | null
    >
    const itemTitle =
      typeof data.itemTitle === 'string' ? data.itemTitle.trim() : ''
    if (itemTitle) return itemTitle

    const bodyTitle = extractQuotedText(notification.body)
    if (bodyTitle) return bodyTitle

    const marker = ' item:'
    const idx = notification.body.toLowerCase().indexOf(marker)
    if (idx >= 0) {
      const raw = notification.body.slice(idx + marker.length).trim()
      if (raw) return raw.replace(/\.$/, '')
    }
    return null
  }

  function getLostFoundItemType(notification: InAppNotification) {
    const data = (notification.data || {}) as Record<
      string,
      string | number | boolean | null
    >
    const itemTypeRaw =
      typeof data.itemType === 'string'
        ? data.itemType.trim().toLowerCase()
        : ''
    if (itemTypeRaw === 'lost' || itemTypeRaw === 'found') return itemTypeRaw
    if (notification.body.toLowerCase().includes(' your lost item'))
      return 'lost'
    if (notification.body.toLowerCase().includes(' your found item'))
      return 'found'
    return null
  }

  function getSenderName(notification: InAppNotification) {
    const data = (notification.data || {}) as Record<
      string,
      string | number | boolean | null
    >
    const sender = data.senderName as string | undefined
    return typeof sender === 'string' && sender.trim().length > 0
      ? sender.trim()
      : null
  }

  function getBodyText(notification: InAppNotification) {
    if (notification.type === 'purchase_request') {
      const data = (notification.data || {}) as Record<
        string,
        string | number | boolean | null
      >
      const actor = getActorName(notification) || 'Someone'
      const listingTitle =
        typeof data.listingTitle === 'string' ? data.listingTitle.trim() : ''
      if (listingTitle.length > 0) {
        return `${actor} is interested in your book: ${listingTitle}.`
      }
      return `${actor} is interested in your book.`
    }
    return notification.body
  }

  function getListingTitle(notification: InAppNotification) {
    const data = (notification.data || {}) as Record<
      string,
      string | number | boolean | null
    >
    const listingTitle =
      typeof data.listingTitle === 'string' ? data.listingTitle.trim() : ''
    return listingTitle.length > 0 ? listingTitle : null
  }

  function getEventTitle(notification: InAppNotification) {
    const data = (notification.data || {}) as Record<
      string,
      string | number | boolean | null
    >
    const title =
      typeof data.eventTitle === 'string' ? data.eventTitle.trim() : ''
    if (title) return title
    if (notification.type === 'event_published') {
      const marker = ' is now'
      const idx = notification.body.indexOf(marker)
      if (idx > 0) return notification.body.slice(0, idx).trim()
    }
    return null
  }

  function getNoticeTitle(notification: InAppNotification) {
    const data = (notification.data || {}) as Record<
      string,
      string | number | boolean | null
    >
    const title =
      typeof data.noticeTitle === 'string' ? data.noticeTitle.trim() : ''
    if (title) return title
    if (notification.type.startsWith('notice_')) return notification.body
    return null
  }

  function extractQuotedText(text: string) {
    const match = text.match(/"([^"]+)"/)
    return match?.[1]?.trim() || null
  }

  function getAssignmentTitle(notification: InAppNotification) {
    const data = (notification.data || {}) as Record<
      string,
      string | number | boolean | null
    >
    const direct =
      typeof data.assignmentTitle === 'string'
        ? data.assignmentTitle.trim()
        : ''
    if (direct) return direct
    const quoted = extractQuotedText(notification.body)
    if (quoted) return quoted
    if (notification.type === 'new_assignment') {
      const parts = notification.body.split(':')
      if (parts.length > 1) return parts.slice(1).join(':').trim()
    }
    return null
  }

  function getStatusLabel(notification: InAppNotification) {
    const data = (notification.data || {}) as Record<
      string,
      string | number | boolean | null
    >
    const status = typeof data.status === 'string' ? data.status.trim() : ''
    if (!status) return null
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  function getActorDisplayName(notification: InAppNotification) {
    return getActorName(notification) || getSenderName(notification)
  }

  function getRichNotificationText(notification: InAppNotification): {
    actor: string | null
    action: string
    subject: string | null
    suffix: string
  } | null {
    const actor = getActorDisplayName(notification)
    const listingTitle = getListingTitle(notification)
    const eventTitle = getEventTitle(notification)
    const noticeTitle = getNoticeTitle(notification)
    const assignmentTitle = getAssignmentTitle(notification)
    const lostFoundTitle = getLostFoundTitle(notification)
    const lostFoundItemType = getLostFoundItemType(notification)

    if (notification.type === 'purchase_request') {
      return {
        actor: actor || 'Someone',
        action: 'is interested in your book:',
        subject: listingTitle,
        suffix: listingTitle ? '.' : ' this book.',
      }
    }

    if (
      notification.type === 'book_listed' ||
      notification.type === 'new_book'
    ) {
      return {
        actor: actor || 'Someone',
        action: 'listed a new book:',
        subject: listingTitle,
        suffix: listingTitle ? '.' : '',
      }
    }

    if (notification.type === 'request_response') {
      const status = getStatusLabel(notification) || 'Updated'
      return {
        actor,
        action: `${status} your request for`,
        subject: listingTitle,
        suffix: listingTitle ? '.' : '.',
      }
    }

    if (
      notification.type === 'chat_message' ||
      notification.type === 'chat_mention'
    ) {
      return {
        actor: actor || 'Someone',
        action:
          notification.type === 'chat_mention'
            ? 'mentioned you in a message about'
            : 'sent you a message about',
        subject: listingTitle,
        suffix: '.',
      }
    }

    if (notification.type === 'event_published') {
      return {
        actor,
        action: 'published an event:',
        subject: eventTitle,
        suffix: eventTitle ? '.' : '',
      }
    }

    if (notification.type === 'event_cancelled') {
      return {
        actor,
        action: 'cancelled an event:',
        subject: eventTitle,
        suffix: eventTitle ? '.' : '',
      }
    }

    if (notification.type.startsWith('notice_')) {
      const noticeActor = 'Exam Controller Divison'
      const action =
        notification.type === 'notice_deleted'
          ? 'removed notice:'
          : notification.type === 'notice_updated'
            ? 'updated notice:'
            : 'published notice:'
      return {
        actor: noticeActor,
        action,
        subject: noticeTitle,
        suffix: noticeTitle ? '.' : '',
      }
    }

    if (notification.type === 'new_assignment') {
      return {
        actor,
        action: 'posted a new assignment:',
        subject: assignmentTitle,
        suffix: assignmentTitle ? '.' : '',
      }
    }

    if (notification.type === 'grading_update') {
      const status = getStatusLabel(notification) || 'updated'
      return {
        actor,
        action: `${status} your submission for`,
        subject: assignmentTitle,
        suffix: assignmentTitle ? '.' : '',
      }
    }

    if (notification.type === 'assignment_deadline') {
      return {
        actor,
        action: 'reminder for assignment:',
        subject: assignmentTitle,
        suffix: assignmentTitle ? '.' : '',
      }
    }

    if (notification.type === 'event_registration_deadline') {
      return {
        actor,
        action: 'registration closes soon for event:',
        subject: eventTitle,
        suffix: eventTitle ? '.' : '',
      }
    }

    if (notification.type === 'lost_found_claim_received') {
      const actionText =
        lostFoundItemType === 'found'
          ? 'claimed your found item:'
          : 'reported finding your lost item:'
      return {
        actor: actor || 'Someone',
        action: actionText,
        subject: lostFoundTitle,
        suffix: lostFoundTitle ? '.' : '',
      }
    }

    if (
      notification.type === 'lost_found_claim_accepted' ||
      notification.type === 'lost_found_claim_rejected' ||
      notification.type === 'lost_found_claim_cancelled'
    ) {
      const statusText =
        notification.type === 'lost_found_claim_accepted'
          ? 'was accepted'
          : notification.type === 'lost_found_claim_rejected'
            ? 'was rejected'
            : 'was cancelled'
      return {
        actor: null,
        action: lostFoundItemType === 'lost' ? 'Your report for' : 'Your claim for',
        subject: lostFoundTitle,
        suffix: `${lostFoundTitle ? ' ' : ''}${statusText}.`,
      }
    }

    if (notification.type === 'role_changed') {
      return {
        actor,
        action: 'updated your account role.',
        subject: null,
        suffix: '',
      }
    }

    if (notification.type === 'security_alert') {
      return {
        actor,
        action: 'recorded a new sign-in on your account.',
        subject: null,
        suffix: '',
      }
    }

    if (
      notification.type === 'admin_moderation_update' ||
      notification.type === 'system_announcement'
    ) {
      return {
        actor,
        action: notification.body,
        subject: null,
        suffix: '',
      }
    }

    return null
  }

  function getIconKey(notification: InAppNotification) {
    const data = (notification.data || {}) as Record<
      string,
      string | number | boolean | null
    >
    const iconKey =
      typeof data.iconKey === 'string' ? data.iconKey.toLowerCase() : ''
    if (iconKey) return iconKey === 'search' ? 'lost_found' : iconKey
    const type = notification.type.toLowerCase()
    if (type.includes('chat')) return 'chat'
    if (type.includes('event')) return 'event'
    if (
      type.includes('book') ||
      type.includes('purchase') ||
      type.includes('request')
    ) {
      return 'book'
    }
    if (type.includes('lost_found')) return 'lost_found'
    if (type.includes('notice')) return 'notice'
    if (type.includes('assignment') || type.includes('grading'))
      return 'classroom'
    return 'general'
  }
</script>

<div class="min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 lg:px-8">
  <div class="max-w-4xl mx-auto">
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-2xl font-black text-slate-900">Notifications</h1>
        <p class="text-sm text-slate-500">
          Unread: {unreadCountQuery.data ?? 0}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 bg-white hover:bg-slate-50"
          onclick={toggleUnreadOnly}
        >
          {showUnreadOnly ? 'Show All' : 'Show Unread'}
        </button>
        <button
          class="px-3 py-2 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
          disabled={markAllMutation.isPending}
          onclick={() => markAllMutation.mutate()}
        >
          Mark all read
        </button>
      </div>
    </div>

    {#if notificationsQuery.isLoading && loadedNotifications.length === 0}
      <div class="py-20">
        <LoadingSpinner text="Loading notifications..." />
      </div>
    {:else if notificationsQuery.error}
      <div
        class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700"
      >
        {(notificationsQuery.error as Error).message}
      </div>
    {:else if loadedNotifications.length === 0}
      <div
        class="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500"
      >
        No notifications yet.
      </div>
    {:else}
      <div class="space-y-2">
        {#each loadedNotifications as notification (notification.id)}
          {@const actorAvatarUrl = getActorAvatarUrl(notification)}
          {@const bookThumbUrl = getBookThumbUrl(notification)}
          {@const lostFoundThumbUrl = getLostFoundThumbUrl(notification)}
          {@const mediaUrl = getImageUrl(notification)}
          {@const hasPdfMedia = isPdfUrl(mediaUrl)}
          {@const hasImageMedia = isImageUrl(mediaUrl)}
          {@const richText = getRichNotificationText(notification)}
          <a
            use:route
            href={getNotificationHref(notification)}
            onclick={() => {
              if (!notification.isRead) markReadMutation.mutate(notification.id)
            }}
            class="block rounded-xl border p-4 transition {notification.isRead
              ? 'border-slate-200 bg-white hover:bg-slate-50'
              : 'border-cyan-200 bg-cyan-50/60 hover:bg-cyan-50'}"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-3">
                {#if getIconKey(notification) === 'book' && bookThumbUrl}
                  <div class="relative w-14 h-14 shrink-0">
                    <img
                      src={bookThumbUrl}
                      alt="Book"
                      class="size-14 rounded-lg object-cover border border-slate-200 bg-slate-100"
                      loading="lazy"
                    />
                  </div>
                {:else if getIconKey(notification) === 'lost_found' && lostFoundThumbUrl}
                  <div class="relative w-14 h-14 shrink-0">
                    <img
                      src={lostFoundThumbUrl}
                      alt="Lost/Found item"
                      class="size-14 rounded-lg object-cover border border-slate-200 bg-slate-100"
                      loading="lazy"
                    />
                  </div>
                {:else if hasImageMedia && mediaUrl}
                  <img
                    src={mediaUrl}
                    alt={notification.title}
                    class="w-14 h-14 rounded-lg object-cover border border-slate-200 bg-slate-100 shrink-0"
                    loading="lazy"
                  />
                {:else if hasPdfMedia}
                  <div
                    class="w-14 h-14 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0"
                  >
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg"
                      alt="PDF file"
                      class="w-7 h-7 object-contain"
                      loading="lazy"
                    />
                  </div>
                {:else}
                  <div
                    class="w-14 h-14 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0 text-slate-600"
                  >
                    {#if getIconKey(notification) === 'event'}
                      <svg
                        class="w-6 h-6"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                    {:else if getIconKey(notification) === 'book'}
                      <img
                        src="https://cdn-icons-png.flaticon.com/512/5402/5402751.png"
                        alt="Book"
                        class="w-6 h-6 object-contain"
                        loading="lazy"
                      />
                    {:else if getIconKey(notification) === 'chat'}
                      <svg
                        class="w-6 h-6"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                        ></path>
                      </svg>
                    {:else if getIconKey(notification) === 'notice'}
                      <svg
                        class="w-6 h-6"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                        ></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                      </svg>
                    {:else if getIconKey(notification) === 'classroom'}
                      <svg
                        class="w-6 h-6"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path d="M22 10v6M2 10v6"></path>
                        <path d="M12 6 2 10l10 4 10-4-10-4z"></path>
                        <path d="M6 12v5c0 2 2.5 3 6 3s6-1 6-3v-5"></path>
                      </svg>
                    {:else if getIconKey(notification) === 'lost_found'}
                      <svg
                        class="w-6 h-6"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <rect x="3" y="7" width="18" height="13" rx="2"></rect>
                        <path d="M8 7V5a4 4 0 0 1 8 0v2"></path>
                      </svg>
                    {:else}
                      <svg
                        class="w-6 h-6"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
                        ></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                      </svg>
                    {/if}
                  </div>
                {/if}
                <div>
                  <p class="text-sm font-bold text-slate-900">
                    {notification.title}
                  </p>
                  {#if richText}
                    <div class="mt-1 flex items-center gap-2">
                      {#if actorAvatarUrl && richText.actor}
                        <img
                          src={actorAvatarUrl}
                          alt="Actor"
                          class="w-5 h-5 rounded-full object-cover border border-slate-200 bg-slate-100 shrink-0"
                          loading="lazy"
                        />
                      {/if}
                      <p class="text-sm text-slate-600">
                        {#if richText.actor}
                          <span class="font-semibold text-slate-800"
                            >{richText.actor}</span
                          >
                          <span> </span>
                        {/if}
                        <span>{richText.action}</span>
                        {#if richText.subject}
                          <span> </span>
                          <span class="font-semibold text-slate-800"
                            >{richText.subject}</span
                          >
                        {/if}
                        <span>{richText.suffix}</span>
                      </p>
                    </div>
                  {:else}
                    <p class="text-sm text-slate-600 mt-1">
                      {getBodyText(notification)}
                    </p>
                  {/if}
                  <p class="text-xs text-slate-400 mt-2">
                    {formatTime(notification.createdAt)}
                  </p>
                </div>
              </div>
              {#if !notification.isRead}
                <span
                  class="inline-block w-2.5 h-2.5 rounded-full bg-cyan-500 mt-1"
                ></span>
              {/if}
            </div>
          </a>
        {/each}

        {#if canLoadMore}
          <div class="pt-2 flex justify-center">
            <button
              type="button"
              onclick={loadMoreNotifications}
              disabled={notificationsQuery.isFetching || isAppendingPage}
              class="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60"
            >
              {notificationsQuery.isFetching || isAppendingPage
                ? 'Loading...'
                : 'Load more'}
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
