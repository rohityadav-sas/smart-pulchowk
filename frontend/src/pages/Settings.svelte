<script lang="ts">
  import { goto, query as routeQuery } from "@mateothegreat/svelte5-router";
  import { onMount } from "svelte";
  import { authClient } from "../lib/auth-client";
  import {
    getNotificationPreferences,
    updateNotificationPreferences,
    type NotificationPreferences,
  } from "../lib/api";

  type ThemePref = "system" | "light" | "dark";

  type AccountPreferences = {
    notifications: NotificationPreferences;
    appearance: {
      theme: ThemePref;
    };
  };

  const SETTINGS_STORAGE_KEY = "smart-pulchowk:account-preferences";

  const defaultPreferences: AccountPreferences = {
    notifications: {
      eventReminders: true,
      marketplaceAlerts: true,
      noticeUpdates: true,
      classroomAlerts: true,
      chatAlerts: true,
      adminAlerts: true,
    },
    appearance: {
      theme: "system",
    },
  };

  const session = authClient.useSession();
  const user = $derived($session.data?.user as any);
  const role = $derived((user?.role as string | undefined) || "guest");

  let hasRedirectedToLogin = $state(false);
  let prefs = $state<AccountPreferences>(structuredClone(defaultPreferences));
  let saving = $state(false);
  let saveMessage = $state<string | null>(null);
  let signOutLoading = $state(false);
  let notificationPrefsLoadedForUserId = $state<string | null>(null);
  let highlightedSection = $state<string | null>(
    (routeQuery("highlightSection") as string | undefined) || null,
  );

  $effect(() => {
    if (hasRedirectedToLogin) return;
    if (!$session.isPending && !$session.error && !$session.data?.user) {
      hasRedirectedToLogin = true;
      goto("/register?message=login_required");
    }
  });

  $effect(() => {
    const userId = user?.id as string | undefined;
    if (!userId || userId === notificationPrefsLoadedForUserId) return;

    getNotificationPreferences()
      .then((result) => {
        if (!result.success || !result.data) return;
        prefs = {
          ...prefs,
          notifications: result.data,
        };
        persistPreferences(prefs);
      })
      .finally(() => {
        notificationPrefsLoadedForUserId = userId;
      });
  });

  onMount(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) {
        applyAppearance(defaultPreferences);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<AccountPreferences>;
      prefs = {
        notifications: {
          ...defaultPreferences.notifications,
          ...(parsed.notifications || {}),
        },
        appearance: {
          ...defaultPreferences.appearance,
          ...(parsed.appearance || {}),
        },
      };
      applyAppearance(prefs);
    } catch (error) {
      console.error("Failed to load preferences", error);
      prefs = structuredClone(defaultPreferences);
      applyAppearance(defaultPreferences);
    }
  });

  function applyAppearance(source: AccountPreferences) {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.dataset.themePref = source.appearance.theme;
  }

  function persistPreferences(source: AccountPreferences) {
    if (typeof window === "undefined") return;
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(source));
  }

  async function savePreferences() {
    saving = true;
    saveMessage = null;
    try {
      const notificationResult = await updateNotificationPreferences(
        prefs.notifications,
      );
      if (!notificationResult.success || !notificationResult.data) {
        saveMessage =
          notificationResult.message ||
          "Could not save notification preferences.";
        return;
      }
      prefs = {
        ...prefs,
        notifications: notificationResult.data,
      };
      persistPreferences(prefs);
      applyAppearance(prefs);
      await new Promise((resolve) => setTimeout(resolve, 250));
      saveMessage = "Preferences saved.";
    } catch (error) {
      console.error("Failed to save preferences", error);
      saveMessage = "Could not save preferences.";
    } finally {
      saving = false;
    }
  }

  async function resetToDefaults() {
    prefs = structuredClone(defaultPreferences);
    const notificationResult = await updateNotificationPreferences(
      defaultPreferences.notifications,
    );
    if (notificationResult.success && notificationResult.data) {
      prefs = {
        ...prefs,
        notifications: notificationResult.data,
      };
    }
    persistPreferences(prefs);
    applyAppearance(prefs);
    saveMessage = "Preferences reset to defaults.";
  }

  async function signOutCurrentSession() {
    signOutLoading = true;
    try {
      await authClient.signOut();
      window.location.href = "/";
    } catch (error) {
      console.error("Sign out error", error);
      signOutLoading = false;
    }
  }

  function exportAccountSummary() {
    if (!user || typeof window === "undefined") return;
    const payload = {
      exportedAt: new Date().toISOString(),
      account: {
        name: user.name,
        email: user.email,
        role,
      },
      preferences: prefs,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "smart-pulchowk-account-summary.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function toggleNotificationPreference(key: keyof NotificationPreferences) {
    prefs.notifications[key] = !prefs.notifications[key];
  }
</script>

<div
  class="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 lg:px-8 relative overflow-hidden"
>
  <div
    class="pointer-events-none absolute -top-28 -right-24 h-72 w-72 rounded-full bg-cyan-200/30 blur-3xl"
  ></div>
  <div
    class="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full bg-blue-200/25 blur-3xl"
  ></div>

  <div class="max-w-5xl mx-auto space-y-6 relative">
    <header
      class="rounded-2xl border border-slate-200 bg-white/85 backdrop-blur-sm p-5 sm:p-6 shadow-sm"
    >
      <div
        class="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div class="min-w-0">
          <p
            class="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-700"
          >
            Account Settings
          </p>
          <h1
            class="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mt-1"
          >
            Preferences & Controls
          </h1>
          <p class="mt-2 text-sm text-slate-500">
            Manage your account behavior, privacy, appearance, and security
            controls.
          </p>
        </div>

        {#if user}
          <div
            class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 min-w-0 w-full md:w-auto md:min-w-100"
          >
            <div
              class="h-11 w-11 rounded-xl overflow-hidden bg-cyan-100 border border-cyan-200 shrink-0"
            >
              {#if user.image}
                <img
                  src={user.image}
                  alt=""
                  class="h-full w-full object-cover"
                />
              {:else}
                <div
                  class="h-full w-full flex items-center justify-center text-cyan-700 font-bold"
                >
                  {user.name?.charAt(0)?.toUpperCase()}
                </div>
              {/if}
            </div>
            <div class="min-w-0">
              <p class="font-bold text-slate-900 truncate">{user.name}</p>
              <p class="text-xs text-slate-500 truncate">{user.email}</p>
              <p
                class="text-[11px] font-semibold uppercase tracking-wide text-cyan-700"
              >
                {role}
              </p>
            </div>
            <button
              onclick={signOutCurrentSession}
              disabled={signOutLoading}
              class="ml-auto shrink-0 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap"
            >
              {signOutLoading ? "Signing out..." : "Sign Out"}
            </button>
          </div>
        {/if}
      </div>
    </header>

    <section class="grid lg:grid-cols-2 gap-4">
      <div
        class="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 {highlightedSection ===
        'notifications'
          ? 'ring-2 ring-cyan-400 ring-offset-2 border-cyan-300 bg-cyan-50/30 notif-highlight-blink'
          : ''}"
      >
        <h3 class="text-base font-black text-slate-900">
          Notification Preferences
        </h3>
        <label class="flex items-center justify-between text-sm text-slate-700">
          <span>Event reminders</span>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.notifications.eventReminders}
            aria-label="Toggle event reminders"
            onclick={() => toggleNotificationPreference("eventReminders")}
            class="relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 {prefs
              .notifications.eventReminders
              ? 'bg-cyan-600'
              : 'bg-slate-300'}"
          >
            <span
              class="inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 {prefs
                .notifications.eventReminders
                ? 'translate-x-6'
                : 'translate-x-1'}"
            ></span>
          </button>
        </label>
        <label class="flex items-center justify-between text-sm text-slate-700">
          <span>Marketplace alerts</span>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.notifications.marketplaceAlerts}
            aria-label="Toggle marketplace alerts"
            onclick={() => toggleNotificationPreference("marketplaceAlerts")}
            class="relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 {prefs
              .notifications.marketplaceAlerts
              ? 'bg-cyan-600'
              : 'bg-slate-300'}"
          >
            <span
              class="inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 {prefs
                .notifications.marketplaceAlerts
                ? 'translate-x-6'
                : 'translate-x-1'}"
            ></span>
          </button>
        </label>
        <label class="flex items-center justify-between text-sm text-slate-700">
          <span>Notice updates</span>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.notifications.noticeUpdates}
            aria-label="Toggle notice updates"
            onclick={() => toggleNotificationPreference("noticeUpdates")}
            class="relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 {prefs
              .notifications.noticeUpdates
              ? 'bg-cyan-600'
              : 'bg-slate-300'}"
          >
            <span
              class="inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 {prefs
                .notifications.noticeUpdates
                ? 'translate-x-6'
                : 'translate-x-1'}"
            ></span>
          </button>
        </label>
        <label class="flex items-center justify-between text-sm text-slate-700">
          <span>Classroom alerts</span>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.notifications.classroomAlerts}
            aria-label="Toggle classroom alerts"
            onclick={() => toggleNotificationPreference("classroomAlerts")}
            class="relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 {prefs
              .notifications.classroomAlerts
              ? 'bg-cyan-600'
              : 'bg-slate-300'}"
          >
            <span
              class="inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 {prefs
                .notifications.classroomAlerts
                ? 'translate-x-6'
                : 'translate-x-1'}"
            ></span>
          </button>
        </label>
        <label class="flex items-center justify-between text-sm text-slate-700">
          <span>Chat alerts</span>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.notifications.chatAlerts}
            aria-label="Toggle chat alerts"
            onclick={() => toggleNotificationPreference("chatAlerts")}
            class="relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 {prefs
              .notifications.chatAlerts
              ? 'bg-cyan-600'
              : 'bg-slate-300'}"
          >
            <span
              class="inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 {prefs
                .notifications.chatAlerts
                ? 'translate-x-6'
                : 'translate-x-1'}"
            ></span>
          </button>
        </label>
        <label class="flex items-center justify-between text-sm text-slate-700">
          <span>Admin/security alerts</span>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.notifications.adminAlerts}
            aria-label="Toggle admin and security alerts"
            onclick={() => toggleNotificationPreference("adminAlerts")}
            class="relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 {prefs
              .notifications.adminAlerts
              ? 'bg-cyan-600'
              : 'bg-slate-300'}"
          >
            <span
              class="inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 {prefs
                .notifications.adminAlerts
                ? 'translate-x-6'
                : 'translate-x-1'}"
            ></span>
          </button>
        </label>
      </div>

      <div
        class="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 {highlightedSection ===
        'appearance'
          ? 'ring-2 ring-cyan-400 ring-offset-2 border-cyan-300 bg-cyan-50/30 notif-highlight-blink'
          : ''}"
      >
        <h3 class="text-base font-black text-slate-900">Appearance</h3>
        <label class="flex items-center justify-between text-sm text-slate-700">
          <span>Theme</span>
          <select
            bind:value={prefs.appearance.theme}
            class="min-w-37 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-200"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </div>
    </section>

    <section
      class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 {highlightedSection ===
      'security'
        ? 'ring-2 ring-cyan-400 ring-offset-2 border-cyan-300 bg-cyan-50/30 notif-highlight-blink'
        : ''}"
    >
      <h3 class="text-base font-black text-slate-900">Security & Session</h3>
      <p class="text-sm text-slate-500 mt-1">
        Use account controls for session safety and account exports.
      </p>

      <div class="mt-4 flex flex-wrap gap-2">
        <button
          onclick={savePreferences}
          disabled={saving}
          class="px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Preferences"}
        </button>
        <button
          onclick={resetToDefaults}
          class="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50"
        >
          Reset Defaults
        </button>
        <button
          onclick={exportAccountSummary}
          class="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50"
        >
          Download Account Data
        </button>
      </div>

      {#if saveMessage}
        <p class="mt-3 text-sm text-emerald-700">{saveMessage}</p>
      {/if}
    </section>
  </div>
</div>
