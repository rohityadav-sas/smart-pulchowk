<script lang="ts" context="module">
  export type SelectOption = {
    value: string;
    label: string;
    disabled?: boolean;
  };
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import { scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  export let value = "";
  export let options: SelectOption[] = [];
  export let placeholder = "Select option";
  export let disabled = false;

  let open = false;
  let buttonEl: HTMLButtonElement | null = null;
  let listEl: HTMLDivElement | null = null;

  $: selectedLabel =
    options.find((option) => option.value === value)?.label || "";

  function toggleOpen() {
    if (disabled) return;
    open = !open;
  }

  function choose(option: SelectOption) {
    if (option.disabled) return;
    value = option.value;
    open = false;
  }

  function onKeydown(event: KeyboardEvent) {
    if (disabled) return;
    if (event.key === "Escape") {
      open = false;
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open = !open;
      return;
    }
    if (event.key === "ArrowDown" && !open) {
      event.preventDefault();
      open = true;
    }
  }

  onMount(() => {
    const handler = (event: MouseEvent) => {
      if (!open) return;
      const target = event.target as Node;
      if (buttonEl?.contains(target) || listEl?.contains(target)) return;
      open = false;
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  });
</script>

<div class="relative">
  <button
    type="button"
    class="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 shadow-sm transition focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
    aria-haspopup="listbox"
    aria-expanded={open}
    on:click={toggleOpen}
    on:keydown={onKeydown}
    bind:this={buttonEl}
    disabled={disabled}
  >
    <span class={selectedLabel ? "text-slate-700" : "text-slate-400"}>
      {selectedLabel || placeholder}
    </span>
    <svg
      class="h-4 w-4 text-slate-400"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fill-rule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.7a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
        clip-rule="evenodd"
      />
    </svg>
  </button>

  {#if open}
    <div
      class="absolute z-20 mt-2 w-full origin-top rounded-xl border border-slate-200 bg-white shadow-lg"
      role="listbox"
      bind:this={listEl}
      transition:scale={{ duration: 140, easing: cubicOut, start: 0.98 }}
    >
      <div class="max-h-60 overflow-auto p-1">
        {#if options.length === 0}
          <div class="px-3 py-2 text-sm text-slate-400">
            No options available
          </div>
        {:else}
          {#each options as option}
            <button
              type="button"
              class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:text-slate-400"
              class:bg-slate-100={option.value === value}
              on:click={() => choose(option)}
              disabled={option.disabled}
              role="option"
              aria-selected={option.value === value}
            >
              <span>{option.label}</span>
              {#if option.value === value}
                <span class="h-2 w-2 rounded-full bg-blue-500"></span>
              {/if}
            </button>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>
