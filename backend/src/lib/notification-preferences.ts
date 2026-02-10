export type NotificationPreferences = {
  eventReminders: boolean;
  marketplaceAlerts: boolean;
  noticeUpdates: boolean;
  classroomAlerts: boolean;
  chatAlerts: boolean;
  adminAlerts: boolean;
  lostAndFoundAlerts: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  eventReminders: true,
  marketplaceAlerts: true,
  noticeUpdates: true,
  classroomAlerts: true,
  chatAlerts: true,
  adminAlerts: true,
  lostAndFoundAlerts: true,
};

export function normalizeNotificationPreferences(
  raw: unknown,
): NotificationPreferences {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  const source = raw as Partial<NotificationPreferences>;

  return {
    eventReminders:
      typeof source.eventReminders === "boolean"
        ? source.eventReminders
        : DEFAULT_NOTIFICATION_PREFERENCES.eventReminders,
    marketplaceAlerts:
      typeof source.marketplaceAlerts === "boolean"
        ? source.marketplaceAlerts
        : DEFAULT_NOTIFICATION_PREFERENCES.marketplaceAlerts,
    noticeUpdates:
      typeof source.noticeUpdates === "boolean"
        ? source.noticeUpdates
        : DEFAULT_NOTIFICATION_PREFERENCES.noticeUpdates,
    classroomAlerts:
      typeof source.classroomAlerts === "boolean"
        ? source.classroomAlerts
        : DEFAULT_NOTIFICATION_PREFERENCES.classroomAlerts,
    chatAlerts:
      typeof source.chatAlerts === "boolean"
        ? source.chatAlerts
        : DEFAULT_NOTIFICATION_PREFERENCES.chatAlerts,
    adminAlerts:
      typeof source.adminAlerts === "boolean"
        ? source.adminAlerts
        : DEFAULT_NOTIFICATION_PREFERENCES.adminAlerts,
    lostAndFoundAlerts:
      typeof source.lostAndFoundAlerts === "boolean"
        ? source.lostAndFoundAlerts
        : DEFAULT_NOTIFICATION_PREFERENCES.lostAndFoundAlerts,
  };
}

export function mergeNotificationPreferences(
  current: NotificationPreferences,
  patch: Partial<NotificationPreferences>,
): NotificationPreferences {
  return normalizeNotificationPreferences({
    ...current,
    ...patch,
  });
}
