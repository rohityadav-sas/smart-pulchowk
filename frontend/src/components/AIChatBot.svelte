<script lang="ts">
  import { chatBotQuery } from "../lib/api";
  import { fade, fly, scale } from "svelte/transition";
  import { onMount } from "svelte";

  interface ChatMessage {
    content: string;
    role: "user" | "assistant" | "error";
    followUp?: string[];
    timestamp: Date;
  }

  let isOpen = $state(false);
  let isLoading = $state(false);
  let messages = $state<ChatMessage[]>([]);
  let inputValue = $state("");
  let messagesContainer: HTMLDivElement | undefined = $state();
  let inputEl: HTMLInputElement | undefined = $state();

  const STORAGE_KEY = "smart_pulchowk_chatbot_messages";

  const suggestions = $derived.by(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) {
      return [
        "Summarize recent notices",
        "Any upcoming events?",
        "Exam routine?",
      ];
    } else if (hour >= 12 && hour < 17) {
      return [
        "Canteen location",
        "Any lost items reported?",
        "How to sell a book?",
      ];
    } else {
      return [
        "Any upcoming events?",
        "Summarize recent notices",
        "What can you help with?",
      ];
    }
  });

  onMount(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as any[];
        messages = parsed.map((m) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
      }
    } catch (_) {}
  });

  function saveMessages() {
    try {
      const toSave = messages.slice(-50);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (_) {}
  }

  function toggleChat() {
    isOpen = !isOpen;
    if (isOpen) {
      setTimeout(() => {
        inputEl?.focus();
        scrollToBottom();
      }, 100);
    }
  }

  function scrollToBottom() {
    setTimeout(() => {
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 50);
  }

  function clearChat() {
    messages = [];
    saveMessages();
  }

  async function sendMessage(text?: string) {
    const query = (text ?? inputValue).trim();
    if (!query || isLoading) return;
    if (query.length > 500) {
      messages.push({
        content: "✏️ Please keep your message under 500 characters.",
        role: "error",
        timestamp: new Date(),
      });
      return;
    }

    messages.push({
      content: query,
      role: "user",
      timestamp: new Date(),
    });
    inputValue = "";
    isLoading = true;
    scrollToBottom();

    const result = await chatBotQuery(query);

    if (result.success && result.data) {
      messages.push({
        content: result.data.message,
        role: "assistant",
        followUp: result.data.follow_up ?? [],
        timestamp: new Date(),
      });
    } else {
      let errorMsg = result.message ?? "Something went wrong.";
      if (result.errorType === "query_too_long") {
        errorMsg =
          "✏️ Your message is too long. Please keep it under 500 characters.";
      }
      messages.push({
        content: errorMsg,
        role: "error",
        timestamp: new Date(),
      });
    }

    isLoading = false;
    scrollToBottom();
    saveMessages();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Simple markdown: **bold** processing
  function renderMarkdown(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
      .replace(/\n/g, "<br />");
  }
</script>

<!-- FAB Button -->
<div class="fixed bottom-6 right-6 z-[9999]" id="ai-chatbot-fab">
  <button
    onclick={toggleChat}
    class="group relative flex items-center justify-center w-14 h-14 rounded-full shadow-xl transition-all duration-300 hover:scale-105 active:scale-95"
    style="background: linear-gradient(135deg, #667EEA, #764BA2);"
    aria-label={isOpen ? "Close AI Assistant" : "Open AI Assistant"}
  >
    {#if !isOpen}
      <span
        class="absolute inset-0 rounded-full animate-ping opacity-20"
        style="background: linear-gradient(135deg, #667EEA, #764BA2);"
      ></span>
    {/if}
    <svg
      class="w-6 h-6 text-white transition-transform duration-300 {isOpen
        ? 'rotate-90'
        : ''}"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      {#if isOpen}
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        />
      {:else}
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
        />
      {/if}
    </svg>
  </button>
</div>

<!-- Chat Panel -->
{#if isOpen}
  <div
    class="fixed bottom-24 right-6 z-[9998] w-[380px] max-w-[calc(100vw-2rem)]"
    id="ai-chatbot-panel"
    transition:fly={{ y: 20, duration: 250 }}
  >
    <div
      class="flex flex-col h-[520px] max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-slate-200/60 overflow-hidden"
    >
      <!-- Header -->
      <div
        class="flex items-center gap-3 px-5 py-4 text-white shrink-0"
        style="background: linear-gradient(135deg, #667EEA, #764BA2);"
      >
        <svg
          class="w-6 h-6 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 14.5M14.25 3.104c.251.023.501.05.75.082M19.8 14.5a2.25 2.25 0 010 3l-3.75 3.75m0 0L12 17.25m4.05 4l-8.1-8.1"
          />
        </svg>
        <div class="flex-1 min-w-0">
          <h3 class="text-[15px] font-bold leading-tight">
            Smart Pulchowk Assistant
          </h3>
          <p class="text-[11px] text-white/70 mt-0.5">
            Notices, events, map & more
          </p>
        </div>
        {#if messages.length > 0}
          <button
            onclick={clearChat}
            class="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
            title="Clear chat"
            aria-label="Clear chat"
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        {/if}
        <button
          onclick={toggleChat}
          class="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
          aria-label="Minimize chatbot"
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
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      <!-- Messages -->
      <div
        bind:this={messagesContainer}
        class="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar"
      >
        {#if messages.length === 0}
          <div
            class="flex flex-col items-center justify-center h-full text-center px-4"
          >
            <div
              class="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style="background: linear-gradient(135deg, #667EEA20, #764BA220);"
            >
              <svg
                class="w-8 h-8"
                fill="none"
                stroke="#667EEA"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p class="text-sm text-slate-500 mb-5">
              Ask me anything — notices, events, map directions, and more!
            </p>
            <div class="flex flex-wrap gap-2 justify-center">
              {#each suggestions as suggestion}
                <button
                  onclick={() => sendMessage(suggestion)}
                  class="text-xs px-3 py-1.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all"
                >
                  {suggestion}
                </button>
              {/each}
            </div>
          </div>
        {:else}
          {#each messages as message, i}
            <div
              class="flex {message.role === 'user'
                ? 'justify-end'
                : 'justify-start'}"
            >
              <div
                class="max-w-[85%] px-4 py-2.5 rounded-2xl text-[13.5px] leading-relaxed {message.role ===
                'user'
                  ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-br-md'
                  : message.role === 'error'
                    ? 'bg-red-50 text-red-700 border border-red-100 rounded-bl-md'
                    : 'bg-slate-100 text-slate-800 rounded-bl-md'}"
              >
                {#if message.role === "user"}
                  {message.content}
                {:else}
                  {@html renderMarkdown(message.content)}
                {/if}
              </div>
            </div>

            <!-- Follow-up chips -->
            {#if message.role === "assistant" && message.followUp && message.followUp.length > 0}
              <div class="flex flex-wrap gap-1.5 pl-1">
                {#each message.followUp as followUp}
                  <button
                    onclick={() => sendMessage(followUp)}
                    class="text-[11px] px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 transition-colors flex items-center gap-1"
                  >
                    <svg
                      class="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                      />
                    </svg>
                    {followUp}
                  </button>
                {/each}
              </div>
            {/if}
          {/each}

          {#if isLoading}
            <div class="flex justify-start">
              <div class="px-4 py-3 rounded-2xl rounded-bl-md bg-slate-100">
                <div class="flex gap-1.5">
                  <span
                    class="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
                    style="animation-delay: 0ms"
                  ></span>
                  <span
                    class="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
                    style="animation-delay: 150ms"
                  ></span>
                  <span
                    class="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
                    style="animation-delay: 300ms"
                  ></span>
                </div>
              </div>
            </div>
          {/if}
        {/if}
      </div>

      <!-- Input -->
      <div
        class="flex items-center gap-2 px-4 py-3 border-t border-slate-100 shrink-0"
      >
        <input
          bind:this={inputEl}
          bind:value={inputValue}
          onkeydown={handleKeydown}
          placeholder="Type your question..."
          maxlength={500}
          class="flex-1 text-sm px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400"
          disabled={isLoading}
        />
        <button
          onclick={() => sendMessage()}
          disabled={!inputValue.trim() || isLoading}
          aria-label="Send message"
          class="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 {inputValue.trim() &&
          !isLoading
            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'}"
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
              d="M12 19V5m0 0l-7 7m7-7l7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #e2e8f0;
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #cbd5e1;
  }
</style>
