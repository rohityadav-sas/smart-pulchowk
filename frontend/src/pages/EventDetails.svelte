<script lang="ts">
  import { route as routeAction, goto } from "@mateothegreat/svelte5-router";
  import { authClient } from "../lib/auth-client";
  import {
    getClubEvents,
    getClub,
    registerForEvent,
    cancelRegistration,
    getRegisteredStudents,
    getEnrollments,
    getExtraEventDetails,
    createExtraEventDetails,
    updateExtraEventDetails,
    uploadEventBanner,
    cancelEvent,
    type ClubEvent,
    type Club,
    type ExtraEventDetail,
  } from "../lib/api";
  import LoadingSpinner from "../components/LoadingSpinner.svelte";
  import { fade, fly, slide } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import {
    formatEventDate,
    formatEventTime,
    parseEventDateTime,
  } from "../lib/event-dates";
  import { getEventStatusLabel } from "../lib/event-status";

  const { route } = $props();
  const clubId = $derived(route.result.path.params.clubId);
  const eventId = $derived(route.result.path.params.eventId);

  const session = authClient.useSession();
  const userId = $derived($session.data?.user?.id);

  let club = $state<Club | null>(null);
  let event = $state<ClubEvent | null>(null);
  const isUpcoming = $derived(
    event &&
      parseEventDateTime(event.eventStartTime) > new Date() &&
      event.status !== "cancelled" &&
      event.status !== "completed",
  );
  let loading = $state(true);
  let error = $state<string | null>(null);
  let actionLoading = $state(false);
  let actionMessage = $state<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  let isRegistered = $state(false);
  let registeredStudents = $state<any[]>([]);
  let isClubOwner = $state(false);

  // Extra details state
  let extraDetails = $state<ExtraEventDetail | null>(null);
  let isEditingDetails = $state(false);
  let editedDetails = $state<Partial<ExtraEventDetail>>({});
  let saveLoading = $state(false);

  // Banner editing state
  let isEditingBanner = $state(false);
  let bannerInputType = $state<"file" | "url">("file");
  let bannerUrlInput = $state("");
  let bannerFile = $state<File | null>(null);
  let bannerPreview = $state<string | null>(null);
  let uploadLoading = $state(false);

  // Export state
  let showExportMenu = $state(false);

  // Cancellation state
  let showCancelModal = $state(false);
  let cancelLoading = $state(false);

  // Click outside to close menu
  function handleGlobalClick(e: MouseEvent) {
    if (showExportMenu) {
      const target = e.target as HTMLElement;
      if (!target.closest(".export-container")) {
        showExportMenu = false;
      }
    }
  }

  $effect(() => {
    if (clubId && eventId) {
      window.scrollTo(0, 0);
      loadEventDetails();
    }
  });

  $effect(() => {
    if (club && userId) {
      isClubOwner = club.authClubId === userId;
    }
  });

  $effect(() => {
    if (userId && !isClubOwner && event) {
      checkRegistrationStatus();
    }
  });

  $effect(() => {
    if (userId && isClubOwner && event) {
      loadRegisteredStudents();
    }
  });

  $effect(() => {
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  });

  async function loadRegisteredStudents() {
    try {
      const studentsResult = await getRegisteredStudents(parseInt(eventId));
      if (studentsResult.success) {
        registeredStudents = studentsResult.registrations || [];
      }
    } catch (e) {
      console.error("Failed to load registered students", e);
    }
  }

  function exportParticipants(type: "csv" | "excel" | "pdf") {
    if (registeredStudents.length === 0) return;
    showExportMenu = false;

    const filename = `${event?.title.replace(/\s+/g, "_")}_Participants`;

    if (type === "csv") {
      const headers = ["Name", "Email", "Status", "Registration Date"];
      const csvData = registeredStudents.map((reg) => [
        reg.student.name,
        reg.student.email,
        reg.status,
        new Date(reg.registeredAt).toLocaleString(),
      ]);
      const csvContent = [
        headers.join(","),
        ...csvData.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
        ),
      ].join("\n");

      downloadFile(csvContent, `${filename}.csv`, "text/csv;charset=utf-8;");
    } else if (type === "excel") {
      const tableHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Participants</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
        <body>
          <table border="1">
            <tr style="background-color: #2563eb; color: #ffffff; font-weight: bold;">
              <th style="padding: 10px;">S.N.</th>
              <th style="padding: 10px;">Name</th>
              <th style="padding: 10px;">Email</th>
              <th style="padding: 10px;">Status</th>
              <th style="padding: 10px;">Registration Date</th>
            </tr>
            ${registeredStudents
              .map(
                (reg, i) => `
              <tr>
                <td style="padding: 8px;">${i + 1}</td>
                <td style="padding: 8px;">${reg.student.name}</td>
                <td style="padding: 8px;">${reg.student.email}</td>
                <td style="padding: 8px;">${reg.status}</td>
                <td style="padding: 8px;">${new Date(reg.registeredAt).toLocaleString()}</td>
              </tr>
            `,
              )
              .join("")}
          </table>
        </body>
        </html>
      `;
      downloadFile(
        tableHtml,
        `${filename}.xls`,
        "application/vnd.ms-excel;charset=utf-8;",
      );
    } else if (type === "pdf") {
      if (typeof (window as any).jspdf === "undefined") {
        const jspdfScript = document.createElement("script");
        jspdfScript.src =
          "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        jspdfScript.onload = () => {
          const autoTableScript = document.createElement("script");
          autoTableScript.src =
            "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js";
          autoTableScript.onload = () => generateHighPerformancePdf(filename);
          document.head.appendChild(autoTableScript);
        };
        document.head.appendChild(jspdfScript);
      } else {
        generateHighPerformancePdf(filename);
      }
    }
  }

  function generateHighPerformancePdf(filename: string) {
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF();

    // Premium Branding
    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235); // Blue-600
    doc.text(event?.title || "Event Participants", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128); // Gray-500
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Hosted by: ${club?.name}`, 14, 35);

    // Table Data
    const tableHeaders = [
      ["S.N.", "Full Name", "Email Address", "Status", "Joined Date"],
    ];
    const tableData = registeredStudents.map((reg, i) => [
      i + 1,
      reg.student.name,
      reg.student.email,
      reg.status.toUpperCase(),
      new Date(reg.registeredAt).toLocaleDateString(),
    ]);

    // AutoTable Configuration
    (doc as any).autoTable({
      head: tableHeaders,
      body: tableData,
      startY: 45,
      theme: "grid",
      headStyles: {
        fillColor: [37, 99, 235], // Blue-600
        fontSize: 10,
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [249, 250, 251] }, // Gray-50
      margin: { top: 45 },
    });

    // Save PDF
    doc.save(`${filename}.pdf`);
  }

  function downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function loadEventDetails() {
    loading = true;
    error = null;
    try {
      const [clubResult, eventsResult, detailsResult] = await Promise.all([
        getClub(parseInt(clubId)),
        getClubEvents(parseInt(clubId)),
        getExtraEventDetails(parseInt(eventId)),
      ]);

      if (clubResult.success && clubResult.clubData) {
        club = clubResult.clubData;
      }

      if (eventsResult.success && eventsResult.clubEvents) {
        event =
          eventsResult.clubEvents.find((e) => e.id === parseInt(eventId)) ||
          null;
      }

      if (detailsResult.success) {
        extraDetails = detailsResult.details;
        if (extraDetails) editedDetails = { ...extraDetails };
      }

      if (!event) {
        error = "Event not found";
        return;
      }
    } catch (err: any) {
      error = err.message || "An error occurred";
    } finally {
      loading = false;
    }
  }

  function handleFileChange(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      bannerFile = target.files[0];
      bannerPreview = URL.createObjectURL(bannerFile);
    }
  }

  function handleUrlChange() {
    bannerPreview = bannerUrlInput;
  }

  async function handleSaveBanner() {
    if (!bannerPreview) return;

    uploadLoading = true;
    try {
      const bannerData =
        bannerInputType === "file" ? (bannerFile as File) : bannerUrlInput;
      const result = await uploadEventBanner(parseInt(eventId), bannerData);

      if (result.success) {
        if (event) event.bannerUrl = result.data?.url || bannerPreview;
        isEditingBanner = false;
        bannerFile = null;
        bannerUrlInput = "";
        bannerPreview = null;
        actionMessage = {
          type: "success",
          text: "Banner updated successfully!",
        };
      } else {
        alert(result.message || "Failed to update banner");
      }
    } catch (err: any) {
      alert(err.message || "An error occurred");
    } finally {
      uploadLoading = false;
    }
  }

  function startEditingBanner() {
    isEditingBanner = true;
    bannerPreview = event?.bannerUrl || null;
    bannerUrlInput = event?.bannerUrl || "";
    bannerInputType = "file";
  }

  async function handleUpdateDetails() {
    saveLoading = true;
    try {
      let result;
      if (extraDetails) {
        result = await updateExtraEventDetails(
          parseInt(eventId),
          editedDetails,
        );
      } else {
        result = await createExtraEventDetails(
          parseInt(eventId),
          editedDetails,
        );
      }

      if (result.success && result.details) {
        extraDetails = result.details;
        isEditingDetails = false;
      } else {
        alert(result.message || "Failed to update details");
      }
    } catch (err: any) {
      alert(err.message || "An error occurred");
    } finally {
      saveLoading = false;
    }
  }

  function startEditing() {
    editedDetails = extraDetails ? { ...extraDetails } : {};
    isEditingDetails = true;
  }

  async function checkRegistrationStatus() {
    if (!userId) return;

    try {
      const result = await getEnrollments();
      if (result.success && result.registrations) {
        isRegistered = result.registrations.some(
          (reg) => reg.eventId === parseInt(eventId),
        );
      }
    } catch (err) {
      console.error("Error checking registration status:", err);
    }
  }

  async function handleRegister() {
    if (!userId) {
      goto("/register");
      return;
    }

    actionLoading = true;
    actionMessage = null;

    try {
      const result = await registerForEvent(parseInt(eventId));
      if (result.success) {
        isRegistered = true;
        actionMessage = {
          type: "success",
          text: "Successfully registered for this event!",
        };
        // Reload to update participant count
        await loadEventDetails();
      } else {
        actionMessage = {
          type: "error",
          text: result.message || "Failed to register",
        };
      }
    } catch (err: any) {
      actionMessage = {
        type: "error",
        text: err.message || "An error occurred",
      };
    } finally {
      actionLoading = false;
    }
  }

  async function handleCancelRegistration() {
    if (!$session.data?.user) return;

    actionLoading = true;
    actionMessage = null;

    try {
      const result = await cancelRegistration(parseInt(eventId));
      if (result.success) {
        isRegistered = false;
        actionMessage = {
          type: "success",
          text: "Registration cancelled successfully!",
        };

        await loadEventDetails();
      } else {
        actionMessage = {
          type: "error",
          text: result.message || "Failed to cancel registration",
        };
      }
    } catch (err: any) {
      actionMessage = {
        type: "error",
        text: err.message || "An error occurred",
      };
    } finally {
      actionLoading = false;
    }
  }

  async function handleCancelEvent() {
    if (!isClubOwner || !event) return;

    cancelLoading = true;
    try {
      const result = await cancelEvent(parseInt(eventId));
      if (result.success) {
        showCancelModal = false;
        if (event) event.status = "cancelled";
        actionMessage = {
          type: "success",
          text: "Event has been cancelled successfully.",
        };
      } else {
        alert(result.message || "Failed to cancel event");
      }
    } catch (err: any) {
      alert(err.message || "An error occurred");
    } finally {
      cancelLoading = false;
    }
  }

  function formatDate(dateStr: string): string {
    return formatEventDate(dateStr, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatTime(dateStr: string): string {
    return formatEventTime(dateStr);
  }

  function formatDateRange(startStr: string, endStr: string): string {
    const start = parseEventDateTime(startStr);
    const end = parseEventDateTime(endStr);
    const sameDay = start.toDateString() === end.toDateString();
    const startDate = formatEventDate(startStr, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const startTime = formatEventTime(startStr, { hour: "numeric", minute: "2-digit" });
    const endTime = formatEventTime(endStr, { hour: "numeric", minute: "2-digit" });
    if (sameDay) {
      return `${startDate} ${startTime} - ${endTime}`;
    }
    const endDate = formatEventDate(endStr, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${startDate} ${startTime} - ${endDate} ${endTime}`;
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case "published":
      case "upcoming":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "draft":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "cancelled":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "completed":
        return "bg-slate-100 text-slate-800 border-slate-200";
      case "ongoing":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  }

  function isEventFull(): boolean {
    if (!event) return false;
    return event.maxParticipants
      ? event.currentParticipants >= event.maxParticipants
      : false;
  }

  function isRegistrationClosed(): boolean {
    if (!event) return false;
    if (!event.isRegistrationOpen) return true;
    if (
      event.registrationDeadline &&
      new Date() > parseEventDateTime(event.registrationDeadline)
    )
      return true;
    return false;
  }
</script>

<div class="min-h-[calc(100vh-4rem)] bg-gray-50/30 px-4 py-8 sm:px-6 lg:px-8">
  <div class="max-w-5xl mx-auto">
    <!-- Breadcrumb -->
    <nav class="flex items-center gap-2 text-sm text-gray-500 mb-8" in:fade>
      <a
        href="/clubs"
        use:routeAction
        class="hover:text-blue-600 transition-colors hover:underline">Clubs</a
      >
      <svg
        class="w-4 h-4 text-gray-300"
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
      <a
        href="/clubs/{clubId}/events"
        use:routeAction
        class="hover:text-blue-600 transition-colors hover:underline"
        >{club?.name || "Club"}</a
      >
      <svg
        class="w-4 h-4 text-gray-300"
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
      <span class="text-gray-900 font-medium truncate"
        >{event?.title || "Event"}</span
      >
    </nav>

    {#if loading}
      <div class="flex items-center justify-center py-20" in:fade>
        <LoadingSpinner size="lg" text="Loading event details..." />
      </div>
    {:else if error}
      <div
        class="max-w-md mx-auto p-6 bg-white border border-red-100 rounded-2xl shadow-lg text-center"
        in:fly={{ y: 20, duration: 400 }}
      >
        <div
          class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <svg
            class="w-8 h-8 text-red-500"
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
        </div>
        <p class="text-red-600 font-medium mb-4">{error}</p>
        <a
          href="/clubs/{clubId}/events"
          use:routeAction
          class="px-6 py-2 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-colors shadow-sm"
        >
          Back to Events
        </a>
      </div>
    {:else if event}
      <!-- Event Banner -->
      <div
        class="relative h-72 sm:h-96 rounded-3xl overflow-hidden mb-8 shadow-2xl group"
        in:fly={{ y: 20, duration: 600 }}
      >
        {#if event.bannerUrl}
          <img
            src={event.bannerUrl}
            alt={event.title}
            class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        {:else}
          <div
            class="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 via-gray-900 to-black"
          >
            <svg
              class="w-24 h-24 text-white/20"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              ></path>
            </svg>
          </div>
        {/if}

        <!-- Gradient Overlay for Text Readability -->
        <div
          class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"
        ></div>

        <!-- Status Badge - Top Right -->
        <div class="absolute top-6 right-6 z-10">
          <span
            class={`px-4 py-1.5 text-sm font-bold rounded-full shadow-lg border backdrop-blur-md ${getStatusColor(event.status)} uppercase tracking-wider`}
          >
            {getEventStatusLabel(event.status)}
          </span>
        </div>

        {#if isClubOwner}
          <div class="absolute top-6 left-6 z-10">
            <button
              onclick={startEditingBanner}
              class="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-black/40 backdrop-blur-md rounded-xl hover:bg-black/60 transition-all border border-white/20"
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
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                ></path>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                ></path>
              </svg>
              Update Banner
            </button>
          </div>
        {/if}

        <!-- Banner Content Grid -->
        <div class="absolute bottom-8 left-8 right-8 z-10">
          <div class="space-y-4">
            <span
              class="inline-block px-3 py-1 text-sm font-bold text-white bg-blue-600/60 backdrop-blur-sm rounded-full uppercase tracking-wider border border-white/10"
            >
              {event.eventType}
            </span>
            <h1
              class="text-2xl md:text-4xl lg:text-4xl font-black text-white/70 tracking-tight drop-shadow-2xl leading-[1.1]"
            >
              {event.title}
            </h1>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Main Content -->
        <div
          class="lg:col-span-2 space-y-8"
          in:fly={{ y: 20, duration: 600, delay: 100 }}
        >
          <!-- Action Message -->
          {#if actionMessage}
            <div
              class="p-4 rounded-xl flex items-center gap-3 {actionMessage.type ===
              'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'}"
              in:slide
            >
              <svg
                class="w-5 h-5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {#if actionMessage.type === "success"}
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  ></path>
                {:else}
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                {/if}
              </svg>
              <p class="font-medium">{actionMessage.text}</p>
            </div>
          {/if}

          <div
            class="bg-white rounded-3xl shadow-sm border border-gray-100 p-8"
          >
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-bold text-gray-900">About this Event</h2>
              {#if isClubOwner && !isEditingDetails}
                <button
                  onclick={startEditing}
                  class="flex items-center gap-2 px-4 py-2 text-sm font-bold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
                >
                  Edit Details
                </button>
              {/if}
            </div>

            <p class="text-gray-600 leading-relaxed whitespace-pre-wrap">
              {event.description || "No description provided."}
            </p>

            {#if isEditingDetails}
              <div class="mt-8 space-y-6 border-t pt-8" in:slide>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label
                      for="fullDescription"
                      class="block text-sm font-bold text-gray-700 mb-2"
                      >Full Description</label
                    >
                    <textarea
                      id="fullDescription"
                      bind:value={editedDetails.fullDescription}
                      class="w-full px-4 py-3 rounded-xl border-gray-200"
                      rows="4"
                    ></textarea>
                  </div>
                  <div>
                    <label
                      for="objectives"
                      class="block text-sm font-bold text-gray-700 mb-2"
                      >Objectives</label
                    >
                    <textarea
                      id="objectives"
                      bind:value={editedDetails.objectives}
                      class="w-full px-4 py-3 rounded-xl border-gray-200"
                      rows="4"
                    ></textarea>
                  </div>
                  <div>
                    <label
                      for="rules"
                      class="block text-sm font-bold text-gray-700 mb-2"
                      >Rules</label
                    >
                    <textarea
                      id="rules"
                      bind:value={editedDetails.rules}
                      class="w-full px-4 py-3 rounded-xl border-gray-200"
                      rows="4"
                    ></textarea>
                  </div>
                  <div>
                    <label
                      for="judgingCriteria"
                      class="block text-sm font-bold text-gray-700 mb-2"
                      >Judging Criteria</label
                    >
                    <textarea
                      id="judgingCriteria"
                      bind:value={editedDetails.judgingCriteria}
                      class="w-full px-4 py-3 rounded-xl border-gray-200"
                      rows="4"
                    ></textarea>
                  </div>
                  <div>
                    <label
                      for="targetAudience"
                      class="block text-sm font-bold text-gray-700 mb-2"
                      >Target Audience</label
                    >
                    <input
                      id="targetAudience"
                      type="text"
                      bind:value={editedDetails.targetAudience}
                      class="w-full px-4 py-3 rounded-xl border-gray-200"
                    />
                  </div>
                  <div>
                    <label
                      for="prerequisites"
                      class="block text-sm font-bold text-gray-700 mb-2"
                      >Prerequisites</label
                    >
                    <input
                      id="prerequisites"
                      type="text"
                      bind:value={editedDetails.prerequisites}
                      class="w-full px-4 py-3 rounded-xl border-gray-200"
                    />
                  </div>
                </div>
                <div class="flex gap-4">
                  <button
                    onclick={handleUpdateDetails}
                    disabled={saveLoading}
                    class="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saveLoading ? "Saving..." : "Save Details"}
                  </button>
                  <button
                    onclick={() => (isEditingDetails = false)}
                    class="px-6 py-2 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            {:else if extraDetails}
              <div class="mt-8 space-y-8 border-t pt-8" in:fade>
                {#if extraDetails.fullDescription}
                  <div>
                    <h3 class="text-lg font-bold text-gray-900 mb-3">
                      Detailed Information
                    </h3>
                    <p
                      class="text-gray-600 leading-relaxed whitespace-pre-wrap"
                    >
                      {extraDetails.fullDescription}
                    </p>
                  </div>
                {/if}

                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {#if extraDetails.objectives}
                    <div
                      class="p-6 bg-blue-50/50 rounded-2xl border border-blue-100"
                    >
                      <h3 class="text-md font-bold text-blue-900 mb-3">
                        Objectives
                      </h3>
                      <p
                        class="text-sm text-blue-800 leading-relaxed whitespace-pre-wrap"
                      >
                        {extraDetails.objectives}
                      </p>
                    </div>
                  {/if}

                  {#if extraDetails.rules}
                    <div
                      class="p-6 bg-amber-50/50 rounded-2xl border border-amber-100"
                    >
                      <h3 class="text-md font-bold text-amber-900 mb-3">
                        Rules & Regulations
                      </h3>
                      <p
                        class="text-sm text-amber-800 leading-relaxed whitespace-pre-wrap"
                      >
                        {extraDetails.rules}
                      </p>
                    </div>
                  {/if}
                </div>

                {#if extraDetails.judgingCriteria}
                  <div
                    class="p-6 bg-purple-50/50 rounded-2xl border border-purple-100"
                  >
                    <h3 class="text-md font-bold text-purple-900 mb-3">
                      Judging Criteria
                    </h3>
                    <p
                      class="text-sm text-purple-800 leading-relaxed whitespace-pre-wrap"
                    >
                      {extraDetails.judgingCriteria}
                    </p>
                  </div>
                {/if}

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {#if extraDetails.targetAudience}
                    <div
                      class="flex items-center gap-3 p-4 bg-gray-50 rounded-xl"
                    >
                      <div
                        class="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-gray-400 shadow-sm"
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
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p
                          class="text-[10px] font-bold text-gray-400 uppercase tracking-widest"
                        >
                          Target Audience
                        </p>
                        <p class="text-sm font-semibold text-gray-700">
                          {extraDetails.targetAudience}
                        </p>
                      </div>
                    </div>
                  {/if}

                  {#if extraDetails.prerequisites}
                    <div
                      class="flex items-center gap-3 p-4 bg-gray-50 rounded-xl"
                    >
                      <div
                        class="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-gray-400 shadow-sm"
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
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p
                          class="text-[10px] font-bold text-gray-400 uppercase tracking-widest"
                        >
                          Prerequisites
                        </p>
                        <p class="text-sm font-semibold text-gray-700">
                          {extraDetails.prerequisites}
                        </p>
                      </div>
                    </div>
                  {/if}
                </div>
              </div>
            {/if}

            <div class="mt-8 pt-8 border-t border-gray-100">
              <p class="text-gray-500 text-sm">
                Hosted by <span class="font-semibold text-gray-900"
                  >{club?.name}</span
                >
              </p>
            </div>
          </div>

          <!-- REGISTERED STUDENTS LIST (OWNER ONLY) -->
          {#if isClubOwner}
            <div
              class="bg-white rounded-3xl shadow-sm border border-gray-100 p-8"
            >
              <div class="flex items-center justify-between mb-6">
                <h2
                  class="text-xl font-bold text-gray-900 flex items-center gap-2"
                >
                  Registered Students
                  <span
                    class="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-sm font-medium"
                  >
                    {registeredStudents.length}
                  </span>
                </h2>

                {#if isClubOwner}
                  <div class="relative export-container">
                    <button
                      onclick={() => (showExportMenu = !showExportMenu)}
                      class="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-md shadow-emerald-500/20"
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
                          d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      Export List
                      <svg
                        class="w-3 h-3 transition-transform {showExportMenu
                          ? 'rotate-180'
                          : ''}"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2.5"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {#if showExportMenu}
                      <div
                        in:fly={{ y: 10, duration: 200 }}
                        class="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
                      >
                        <div class="p-2 space-y-1">
                          <button
                            onclick={() => exportParticipants("excel")}
                            class="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-colors group"
                          >
                            <div
                              class="w-8 h-8 rounded-lg bg-emerald-100/50 flex items-center justify-center text-emerald-600"
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
                                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                            </div>
                            <span>Excel (.xls)</span>
                          </button>

                          <button
                            onclick={() => exportParticipants("pdf")}
                            class="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-red-50 hover:text-red-700 rounded-xl transition-colors group"
                          >
                            <div
                              class="w-8 h-8 rounded-lg bg-red-100/50 flex items-center justify-center text-red-600"
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
                                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                />
                              </svg>
                            </div>
                            <span>PDF Document</span>
                          </button>

                          <button
                            onclick={() => exportParticipants("csv")}
                            class="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors group"
                          >
                            <div
                              class="w-8 h-8 rounded-lg bg-blue-100/50 flex items-center justify-center text-blue-600"
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
                                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                            </div>
                            <span>CSV Text File</span>
                          </button>
                        </div>
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>

              {#if registeredStudents.length === 0}
                <div
                  class="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200"
                >
                  <p class="text-gray-500">No students registered yet.</p>
                </div>
              {:else}
                <div class="overflow-x-auto">
                  <table class="w-full text-left border-collapse">
                    <thead>
                      <tr
                        class="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                      >
                        <th class="py-3 px-4">Student</th>
                        <th class="py-3 px-4">Status</th>
                        <th class="py-3 px-4">Registered At</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-50">
                      {#each registeredStudents as reg}
                        <tr class="hover:bg-gray-50/50 transition-colors">
                          <td
                            class="py-3 px-4 text-sm font-medium text-gray-900"
                          >
                            <div>
                              <div class="font-bold">{reg.student.name}</div>
                              <div class="text-xs text-gray-500">
                                {reg.student.email}
                              </div>
                            </div>
                          </td>
                          <td class="py-3 px-4">
                            <span
                              class="inline-flex px-2 py-1 text-xs font-medium rounded-full {reg.status ===
                              'registered'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'}"
                            >
                              {reg.status}
                            </span>
                          </td>
                          <td class="py-3 px-4 text-sm text-gray-500">
                            {new Date(reg.registeredAt).toLocaleDateString()}
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Sidebar Info -->
        <div class="space-y-6" in:fly={{ y: 20, duration: 600, delay: 200 }}>
          <!-- Event Details Card -->
          <div
            class="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-6"
          >
            <div class="flex items-start gap-4">
              <div
                class="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0"
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
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  ></path>
                </svg>
              </div>
              <div>
                <p
                  class="text-xs font-bold text-gray-400 uppercase tracking-wide"
                >
                  Date & Time
                </p>
                <p class="font-semibold text-gray-900 mt-1">
                  {formatDateRange(
                    event.eventStartTime,
                    event.eventEndTime,
                  )}
                </p>
              </div>
            </div>

            {#if event.venue}
              <div class="flex items-start gap-4">
                <div
                  class="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0"
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
                <div>
                  <p
                    class="text-xs font-bold text-gray-400 uppercase tracking-wide"
                  >
                    Venue
                  </p>
                  <p class="font-semibold text-gray-900 mt-1">
                    {event.venue}
                  </p>
                </div>
              </div>
            {/if}

            <div class="flex items-start gap-4">
              <div
                class="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-green-600 shrink-0"
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
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  ></path>
                </svg>
              </div>
              <div>
                <p
                  class="text-xs font-bold text-gray-400 uppercase tracking-wide"
                >
                  Participants
                </p>
                {#if event.externalRegistrationLink}
                  <p class="font-semibold text-gray-900 mt-1 italic">
                    Refer to external form
                  </p>
                {:else}
                  <p class="font-semibold text-gray-900 mt-1">
                    {event.currentParticipants}
                    {#if event.maxParticipants}
                      <span class="text-gray-400"
                        >/ {event.maxParticipants}</span
                      >
                    {/if}
                  </p>
                  {#if event.maxParticipants}
                    <p class="text-xs text-gray-500 mt-0.5">
                      {Math.max(
                        0,
                        event.maxParticipants - event.currentParticipants,
                      )} spots remaining
                    </p>
                  {/if}
                {/if}
              </div>
            </div>

            {#if event.registrationDeadline}
              <div class="flex items-start gap-4">
                <div
                  class="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600 shrink-0"
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
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                </div>
                <div>
                  <p
                    class="text-xs font-bold text-gray-400 uppercase tracking-wide"
                  >
                    Registration Deadline
                  </p>
                  <p class="font-semibold text-gray-900 mt-1">
                    {formatDate(event.registrationDeadline)}
                  </p>
                  <p class="text-sm text-gray-500">
                    {formatTime(event.registrationDeadline)}
                  </p>
                </div>
              </div>
            {/if}
          </div>

          <!-- Registration Action -->
          {#if !isClubOwner}
            <div
              class="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sticky top-6"
            >
              {#if $session.isPending}
                <div class="h-12 bg-gray-100 rounded-xl animate-pulse"></div>
              {:else if !$session.data?.user}
                <div class="text-center">
                  <p class="text-gray-600 mb-4 font-medium">
                    Sign in to register for this event
                  </p>
                  <a
                    href="/register"
                    use:routeAction
                    class="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-blue-500/30"
                  >
                    Sign In to Register
                  </a>
                </div>
              {:else if event.status === "cancelled"}
                <div
                  class="text-center p-4 bg-red-50 rounded-xl border border-red-100"
                >
                  <p class="text-red-600 font-bold">Event Cancelled</p>
                </div>
              {:else if event.status === "completed"}
                <div
                  class="text-center p-4 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <p class="text-gray-600 font-bold">Event Ended</p>
                </div>
              {:else if isRegistered}
                <div class="space-y-4">
                  <div
                    class="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-xl border border-green-100"
                  >
                    <svg
                      class="w-5 h-5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                    <span class="font-bold text-sm">You are registered!</span>
                  </div>
                  <button
                    onclick={handleCancelRegistration}
                    disabled={actionLoading}
                    class="w-full px-6 py-3 border-2 border-red-50 text-red-600 hover:bg-red-50 hover:border-red-100 font-bold rounded-xl transition-all disabled:opacity-50"
                  >
                    {actionLoading ? "Processing..." : "Cancel Registration"}
                  </button>
                </div>
              {:else if isEventFull()}
                <div
                  class="text-center p-4 bg-amber-50 rounded-xl border border-amber-100"
                >
                  <p class="text-amber-800 font-bold">Event Full</p>
                  <p class="text-amber-600 text-sm mt-1">
                    No more spots available.
                  </p>
                </div>
              {:else if isRegistrationClosed()}
                <div
                  class="text-center p-4 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <p class="text-gray-600 font-bold">Registration Closed</p>
                  <p class="text-gray-500 text-sm mt-1">
                    The deadline {new Date(
                      event.registrationDeadline as string,
                    ) < new Date()
                      ? "has passed"
                      : "is approaching quickly"}.
                  </p>
                </div>
              {:else if event.externalRegistrationLink}
                <div class="space-y-4">
                  <a
                    href={event.externalRegistrationLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="w-full inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all active:scale-95 shadow-lg hover:shadow-blue-500/30 ring-4 ring-transparent hover:ring-blue-500/10"
                  >
                    <span>Register via External Form</span>
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
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                  <p class="text-xs text-gray-500 text-center">
                    Registration is handled via an external platform. Please
                    follow the link above to complete your registration.
                  </p>
                </div>
              {:else}
                <button
                  onclick={handleRegister}
                  disabled={actionLoading}
                  class="w-full px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 shadow-lg hover:shadow-blue-500/30 ring-4 ring-transparent hover:ring-blue-500/10"
                >
                  {actionLoading ? "Registering..." : "Register Now"}
                </button>
                <p class="text-xs text-gray-500 text-center mt-3">
                  Clicking register will reserve your spot immediately.
                </p>
              {/if}
            </div>
          {/if}

          {#if isClubOwner && isUpcoming}
            <div
              class="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sticky top-6"
            >
              <button
                onclick={() => (showCancelModal = true)}
                class="w-full px-4 py-3 bg-white border-2 border-rose-100 text-rose-600 font-bold rounded-xl hover:bg-rose-50 hover:border-rose-200 transition-all flex items-center justify-center gap-2 group text-sm"
              >
                <svg
                  class="w-4 h-4 group-hover:scale-110 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                Cancel Event
              </button>
            </div>
          {/if}
        </div>
      </div>

      <!-- Cancellation Confirmation Modal -->
      {#if showCancelModal}
        <div
          class="fixed inset-0 z-[100] flex items-center justify-center px-4"
          transition:fade={{ duration: 200 }}
        >
          <button
            type="button"
            class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            aria-label="Close cancel event modal"
            onclick={() => (showCancelModal = false)}
          ></button>
          <div
            class="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative z-10 overflow-hidden"
            in:fly={{ y: 20, duration: 400, easing: quintOut }}
          >
            <!-- Warning Background Icon -->
            <div
              class="absolute -top-12 -right-12 w-48 h-48 bg-rose-50 rounded-full flex items-center justify-center opacity-50"
            >
              <svg
                class="w-24 h-24 text-rose-100"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
                ></path>
              </svg>
            </div>

            <div class="relative">
              <div
                class="w-16 h-16 bg-rose-100 rounded-2xl flex items-center justify-center mb-6 shadow-sm"
              >
                <svg
                  class="w-8 h-8 text-rose-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  ></path>
                </svg>
              </div>

              <h3 class="text-2xl font-black text-gray-900 mb-2">
                Cancel Event?
              </h3>
              <p class="text-gray-600 mb-8 leading-relaxed">
                Are you sure you want to cancel <span
                  class="font-bold text-gray-900">"{event?.title}"</span
                >? This action cannot be undone and all registered students will
                see the cancelled status.
              </p>

              <div class="flex flex-col sm:flex-row gap-3">
                <button
                  onclick={() => (showCancelModal = false)}
                  class="flex-1 px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  No, Keep it
                </button>
                <button
                  onclick={handleCancelEvent}
                  disabled={cancelLoading}
                  class="flex-1 px-6 py-3 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {#if cancelLoading}
                    <div
                      class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"
                    ></div>
                    Cancelling...
                  {:else}
                    Yes, Cancel Event
                  {/if}
                </button>
              </div>
            </div>
          </div>
        </div>
      {/if}

      {#if isEditingBanner}
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          transition:fade
        >
          <div
            class="bg-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] w-full max-w-2xl overflow-hidden border border-white/20"
            in:fly={{ y: 40, duration: 800, easing: quintOut }}
          >
            <!-- Premium Header -->
            <div
              class="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50"
            >
              <div>
                <h2 class="text-2xl font-black text-gray-900 tracking-tight">
                  Update Event Banner
                </h2>
                <p class="text-sm text-gray-500 font-medium">
                  First impressions are everything.
                </p>
              </div>
              <button
                onclick={() => (isEditingBanner = false)}
                class="p-3 hover:bg-white rounded-2xl transition-all hover:shadow-sm active:scale-95 group"
                aria-label="Close banner editor"
              >
                <svg
                  class="w-6 h-6 text-gray-400 group-hover:text-gray-900 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2.5"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>

            <div class="p-8 space-y-8">
              <!-- Live Preview Component -->
              <div class="space-y-4">
                <div class="flex items-center justify-between px-1">
                  <p
                    class="block text-sm font-bold text-gray-900 uppercase tracking-widest"
                  >
                    Live Preview
                  </p>
                  <span
                    class="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md uppercase"
                    >Hero Display</span
                  >
                </div>

                <div
                  class="relative h-48 sm:h-56 w-full rounded-[2rem] overflow-hidden shadow-inner bg-gray-100 group"
                >
                  {#if bannerPreview}
                    <img
                      src={bannerPreview}
                      alt="Banner preview"
                      class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div
                      class="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent"
                    ></div>

                    <!-- Mock Content Overlay -->
                    {#if event}
                      <div
                        class="absolute bottom-6 left-8 right-8 flex items-end justify-between"
                      >
                        <div in:fade>
                          <span
                            class="inline-block px-2 py-0.5 mb-2 text-[10px] font-bold text-white bg-blue-600/80 backdrop-blur-sm rounded-full uppercase tracking-wider"
                          >
                            {event.eventType}
                          </span>
                          <p
                            class="text-xl font-black text-white leading-none tracking-tight"
                          >
                            {event.title}
                          </p>
                        </div>
                      </div>
                    {/if}
                  {:else}
                    <div
                      class="absolute inset-0 flex flex-col items-center justify-center bg-linear-to-br from-gray-50 to-gray-100 border-2 border-dashed border-gray-200 rounded-[2rem]"
                    >
                      <div
                        class="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 text-gray-300"
                      >
                        <svg
                          class="w-8 h-8"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          ></path>
                        </svg>
                      </div>
                      <p class="text-gray-400 font-bold text-sm tracking-tight">
                        Select an image to see the magic
                      </p>
                    </div>
                  {/if}
                </div>
              </div>

              <!-- Input Methods -->
              <div class="space-y-6">
                <div class="flex items-center justify-center">
                  <div
                    class="flex p-1 bg-gray-100 rounded-2xl shadow-inner w-full max-w-xs"
                  >
                    <button
                      onclick={() => (bannerInputType = "file")}
                      class={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all uppercase tracking-widest ${bannerInputType === "file" ? "bg-white text-blue-600 shadow-md scale-[1.02]" : "text-gray-400 hover:text-gray-600"}`}
                    >
                      Local File
                    </button>
                    <button
                      onclick={() => (bannerInputType = "url")}
                      class={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all uppercase tracking-widest ${bannerInputType === "url" ? "bg-white text-blue-600 shadow-md scale-[1.02]" : "text-gray-400 hover:text-gray-600"}`}
                    >
                      Remote URL
                    </button>
                  </div>
                </div>

                {#if bannerInputType === "file"}
                  <div in:fly={{ y: 10, duration: 400 }}>
                    <label
                      class="relative flex flex-col items-center justify-center w-full h-40 transition-all bg-gray-50/50 border-2 border-gray-200 border-dashed rounded-[2rem] cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 group overflow-hidden"
                    >
                      <div
                        class="flex flex-col items-center justify-center pb-6 pt-5 px-4 text-center"
                      >
                        <div
                          class="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-3 transition-transform group-hover:scale-110 group-hover:rotate-3 duration-500 text-blue-500"
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
                              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            ></path>
                          </svg>
                        </div>
                        {#if bannerFile}
                          <p
                            class="text-gray-900 font-bold text-sm tracking-tight truncate max-w-[250px]"
                          >
                            {bannerFile.name}
                          </p>
                          <p
                            class="text-gray-400 text-[10px] font-black uppercase mt-1"
                          >
                            Ready for upgrade
                          </p>
                        {:else}
                          <p
                            class="text-gray-900 font-bold text-sm tracking-tight"
                          >
                            Drop your banner here
                          </p>
                          <p class="text-gray-400 text-xs mt-1 font-medium">
                            Click to browse your desktop
                          </p>
                        {/if}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        class="hidden"
                        onchange={handleFileChange}
                      />
                    </label>
                  </div>
                {:else}
                  <div in:fly={{ y: 10, duration: 400 }} class="space-y-4">
                    <div class="relative group">
                      <input
                        type="text"
                        bind:value={bannerUrlInput}
                        oninput={handleUrlChange}
                        placeholder="https://images.unsplash.com/your-epic-banner"
                        class="w-full pl-6 pr-14 py-5 bg-gray-50 border-none rounded-[1.5rem] font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-gray-400/50 shadow-inner"
                      />
                      <div
                        class="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300"
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
                            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                          ></path>
                        </svg>
                      </div>
                    </div>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Actions -->
            <div class="p-8 bg-gray-50/80 border-t border-gray-100 flex gap-4">
              <button
                onclick={() => (isEditingBanner = false)}
                class="flex-1 px-8 py-4 bg-white text-gray-500 font-black rounded-2xl border border-gray-200 hover:bg-gray-100 hover:text-gray-700 transition-all active:scale-95 uppercase tracking-widest text-[10px]"
              >
                Cancel
              </button>
              <button
                onclick={handleSaveBanner}
                disabled={uploadLoading || !bannerPreview}
                class="flex-[2] px-8 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 shadow-2xl shadow-blue-500/20 active:scale-95 transition-all text-[10px] uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {#if uploadLoading}
                  <div
                    class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                  ></div>
                  <span>Uploading...</span>
                {:else}
                  <span>Update Banner</span>
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
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    ></path>
                  </svg>
                {/if}
              </button>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  /* Premium Export Menu Styling */
  .export-container {
    user-select: none;
  }
</style>
