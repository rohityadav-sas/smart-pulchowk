<script lang="ts">
  import { onMount } from "svelte";
  import { goto, query as routeQuery } from "@mateothegreat/svelte5-router";

  onMount(() => {
    const listing = routeQuery("listing");
    const conversation = routeQuery("conversation");

    let url = "/books/my-books?tab=messages";
    if (listing) url += `&listing=${listing}`;
    if (conversation) url += `&conversation=${conversation}`;

    goto(url);
  });
</script>

<div class="flex items-center justify-center min-h-[calc(100vh-4rem)]">
  <div
    class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"
  ></div>
</div>
