<script lang="ts">
  import { route } from "@mateothegreat/svelte5-router";
  import { authClient } from "../lib/auth-client";

  const session = authClient.useSession();
  const user = $derived($session.data?.user as any);

  let activeTab = $state("intro");

  const sections = [
    {
      id: "intro",
      label: "Introduction",
      icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    {
      id: "collect",
      label: "Information We Collect",
      icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
    },
    {
      id: "usage",
      label: "How We Use Data",
      icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 00-2 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
    },
    {
      id: "sharing",
      label: "Sharing & Disclosure",
      icon: "M8.684 10.742l4.828-2.414m0 0a3 3 0 10-3.62-3.62l-4.828 2.414m4.828 2.414a3 3 0 11-3.62 3.62",
    },
    {
      id: "security",
      label: "Security & Retention",
      icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z",
    },
    {
      id: "controls",
      label: "Your Controls",
      icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
    },
    {
      id: "contact",
      label: "Contact Us",
      icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
    },
  ];

  function selectTab(id: string) {
    activeTab = id;
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
</script>

<div
  class="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 lg:px-8 relative overflow-hidden"
>
  <!-- Aesthetic background gradients -->
  <div
    class="pointer-events-none absolute -top-28 -right-24 h-80 w-80 rounded-full bg-cyan-200/35 blur-3xl"
  ></div>
  <div
    class="pointer-events-none absolute -bottom-28 -left-24 h-96 w-96 rounded-full bg-indigo-200/30 blur-3xl"
  ></div>

  <div class="max-w-5xl mx-auto relative space-y-8">
    <!-- Header Card -->
    <header
      class="rounded-3xl border border-slate-200 bg-white/85 backdrop-blur-md p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6"
    >
      <div class="space-y-2">
        <div class="flex items-center gap-3">
          <p
            class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-700 bg-cyan-50 border border-cyan-200"
          >
            Legal & Trust
          </p>
          <p class="text-xs text-slate-500 font-semibold">
            Last Updated: June 2026
          </p>
        </div>
        <h1
          class="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 leading-tight"
        >
          Privacy Policy
        </h1>
        <p class="text-slate-600 max-w-xl">
          At Smart Pulchowk, your privacy is our priority. We are committed to
          protecting the information you share on our campus platform.
        </p>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-3 shrink-0">
        {#if !user}
          <a
            use:route
            href="/register"
            class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-md shadow-slate-900/10"
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
                stroke-width="2.5"
                d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
              />
            </svg>
            Sign In
          </a>
        {:else}
          <a
            use:route
            href="/"
            class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 hover:text-slate-900 active:scale-95 transition-all shadow-sm"
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
                d="M3 12l9-9 9 9M5 10v10h14V10"
              />
            </svg>
            Home
          </a>
        {/if}
      </div>
    </header>

    <!-- Main Content Area -->
    <div class="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-8 items-start">
      <!-- Interactive Sidebar Navigation (sticky) -->
      <aside
        class="sticky top-24 hidden md:flex flex-col gap-1.5 p-2 bg-white/70 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-sm"
      >
        <p
          class="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider"
        >
          Sections
        </p>
        {#each sections as section}
          <button
            onclick={() => selectTab(section.id)}
            class="flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm text-left transition-all duration-200 group relative
              {activeTab === section.id
              ? 'bg-cyan-50 text-cyan-700 shadow-xs border border-cyan-100/50'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'}"
          >
            <svg
              class="w-4 h-4 shrink-0 transition-transform group-hover:scale-110"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d={section.icon}
              />
            </svg>
            <span class="truncate">{section.label}</span>
            {#if activeTab === section.id}
              <div
                class="absolute left-0 top-1/4 bottom-1/4 w-1 bg-cyan-600 rounded-r-md"
              ></div>
            {/if}
          </button>
        {/each}
      </aside>

      <!-- Content Sections -->
      <div class="space-y-6">
        <!-- Intro -->
        <section
          id="intro"
          class="scroll-mt-24 p-6 sm:p-8 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-4"
        >
          <div class="flex items-center gap-3 text-cyan-600">
            <div class="p-2 bg-cyan-50 rounded-xl">
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
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 class="text-xl font-black text-slate-950">1. Introduction</h2>
          </div>
          <div class="text-slate-600 leading-relaxed space-y-3 text-sm">
            <p>
              Welcome to <strong>Smart Pulchowk</strong> (the "Platform", "we", "us",
              or "our"). We provide a unified digital environment for Pulchowk Campus
              students, teachers, and administration to engage in class activities,
              clubs, book sales, campus mapping, and notifications.
            </p>
            <p>
              This Privacy Policy explains how we collect, use, store, and
              safeguard your data when you visit and interact with our
              application. By using Smart Pulchowk, you consent to the data
              practices described in this document.
            </p>
          </div>
        </section>

        <!-- Collect -->
        <section
          id="collect"
          class="scroll-mt-24 p-6 sm:p-8 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-4"
        >
          <div class="flex items-center gap-3 text-cyan-600">
            <div class="p-2 bg-cyan-50 rounded-xl">
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
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h2 class="text-xl font-black text-slate-950">
              2. Information We Collect
            </h2>
          </div>
          <div class="text-slate-600 leading-relaxed space-y-4 text-sm">
            <p>
              We collect information you provide directly or that we gather from
              your usage of the Platform:
            </p>

            <div class="grid gap-4 sm:grid-cols-2">
              <div
                class="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2"
              >
                <p class="font-bold text-slate-900 flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-cyan-500"></span>
                  Authentication & Profile
                </p>
                <p class="text-slate-500 text-xs leading-relaxed">
                  When you sign in using Google Auth, we retrieve your email
                  address, name, and profile photo. This determines your role
                  (guest, student, teacher, or admin).
                </p>
              </div>

              <div
                class="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2"
              >
                <p class="font-bold text-slate-900 flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
                  Marketplace & Posts
                </p>
                <p class="text-slate-500 text-xs leading-relaxed">
                  If you sell books on the Marketplace or report lost/found
                  items, we store descriptions, prices, condition ratings,
                  photos, and contact information you choose to enter.
                </p>
              </div>

              <div
                class="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2"
              >
                <p class="font-bold text-slate-900 flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Classroom & Clubs
                </p>
                <p class="text-slate-500 text-xs leading-relaxed">
                  We store files, notices, routines, links, announcements, and
                  comments that you upload to Classrooms or Club spaces to
                  ensure your peers can view them.
                </p>
              </div>

              <div
                class="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2"
              >
                <p class="font-bold text-slate-900 flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                  Conversations & Bot Chats
                </p>
                <p class="text-slate-500 text-xs leading-relaxed">
                  We store real-time user-to-user chat logs and queries sent to
                  the campus AI chatbot, assisting in message delivery and
                  personalized AI help.
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- Usage -->
        <section
          id="usage"
          class="scroll-mt-24 p-6 sm:p-8 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-4"
        >
          <div class="flex items-center gap-3 text-cyan-600">
            <div class="p-2 bg-cyan-50 rounded-xl">
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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 00-2 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
            </div>
            <h2 class="text-xl font-black text-slate-950">
              3. How We Use Data
            </h2>
          </div>
          <div class="text-slate-600 leading-relaxed space-y-3 text-sm">
            <p>
              Your data is processed to serve Pulchowk's community activities.
              Specifically, we use it to:
            </p>
            <ul
              class="space-y-2 pl-4 list-disc marker:text-cyan-500 text-slate-500"
            >
              <li>
                Manage your account, determine role-based access, and provide
                secure sessions.
              </li>
              <li>
                Coordinate Book Marketplace and Lost & Found queries between
                buyers and sellers.
              </li>
              <li>
                Deliver campus notices, updates, and classroom notifications
                dynamically.
              </li>
              <li>
                Train or run the AI Assistant chatbot contextually to guide you
                with Pulchowk Campus information.
              </li>
              <li>
                Analyze general platform statistics to optimize server
                performance.
              </li>
            </ul>
          </div>
        </section>

        <!-- Sharing -->
        <section
          id="sharing"
          class="scroll-mt-24 p-6 sm:p-8 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-4"
        >
          <div class="flex items-center gap-3 text-cyan-600">
            <div class="p-2 bg-cyan-50 rounded-xl">
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
                  d="M8.684 10.742l4.828-2.414m0 0a3 3 0 10-3.62-3.62l-4.828 2.414m4.828 2.414a3 3 0 11-3.62 3.62"
                />
              </svg>
            </div>
            <h2 class="text-xl font-black text-slate-950">
              4. Sharing & Disclosure
            </h2>
          </div>
          <div class="text-slate-600 leading-relaxed space-y-3 text-sm">
            <p>
              Smart Pulchowk does <strong>not sell, rent, or trade</strong> your
              personal information with external third-party advertisers.
            </p>
            <div
              class="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl space-y-2"
            >
              <p
                class="font-bold text-amber-900 flex items-center gap-2 text-xs"
              >
                <svg
                  class="w-4 h-4 text-amber-600 shrink-0"
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
                Campus Visbility Notice
              </p>
              <p class="text-amber-800 text-xs leading-relaxed">
                Some details (like your name, marketplace listings, or reports)
                are visible to other authorized users of Smart Pulchowk to
                coordinate interactions. Contact information shared in listings
                will be viewable by other students.
              </p>
            </div>
          </div>
        </section>

        <!-- Security -->
        <section
          id="security"
          class="scroll-mt-24 p-6 sm:p-8 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-4"
        >
          <div class="flex items-center gap-3 text-cyan-600">
            <div class="p-2 bg-cyan-50 rounded-xl">
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
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h2 class="text-xl font-black text-slate-950">
              5. Security & Data Retention
            </h2>
          </div>
          <div class="text-slate-600 leading-relaxed space-y-3 text-sm">
            <p>
              We implement database encryption, secure OAuth handshakes, and
              HTTPS protocols to protect your files and logins. Your data is
              stored only as long as you maintain your account or until campus
              operational periods require updates.
            </p>
          </div>
        </section>

        <!-- Controls -->
        <section
          id="controls"
          class="scroll-mt-24 p-6 sm:p-8 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-4"
        >
          <div class="flex items-center gap-3 text-cyan-600">
            <div class="p-2 bg-cyan-50 rounded-xl">
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
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
              </svg>
            </div>
            <h2 class="text-xl font-black text-slate-950">
              6. Your Choices & Controls
            </h2>
          </div>
          <div class="text-slate-600 leading-relaxed space-y-3 text-sm">
            <p>
              We respect your ownership of your data. You can access the
              following controls via the platform:
            </p>
            <ul
              class="space-y-2 pl-4 list-disc marker:text-cyan-500 text-slate-500"
            >
              <li>
                <strong>Notification Tuning:</strong> Toggle preferences for
                Event Reminders, Marketplace Alerts, Notice Updates, Classroom
                Alerts, and Chat Alerts within
                <a
                  use:route
                  href="/settings"
                  class="text-cyan-600 hover:underline font-semibold"
                  >Settings</a
                >.
              </li>
              <li>
                <strong>Data Export:</strong> Use the "Download Account Data" button
                in your settings to obtain a JSON summary of your profile and stored
                preferences.
              </li>
              <li>
                <strong>Marketplace Updates:</strong> Edit or delete your book offers
                at any time to remove visibility.
              </li>
            </ul>
          </div>
        </section>

        <!-- Contact -->
        <section
          id="contact"
          class="scroll-mt-24 p-6 sm:p-8 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-4"
        >
          <div class="flex items-center gap-3 text-cyan-600">
            <div class="p-2 bg-cyan-50 rounded-xl">
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
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 class="text-xl font-black text-slate-950">7. Contact Us</h2>
          </div>
          <div class="text-slate-600 leading-relaxed space-y-3 text-sm">
            <p>
              If you have any questions, feedback, or data concerns regarding
              this Privacy Policy, please contact the administrators or email
              our support desk at <span class="font-bold text-slate-950"
                >smartpulchowk@gmail.com</span
              >.
            </p>
          </div>
        </section>
      </div>
    </div>
  </div>
</div>
