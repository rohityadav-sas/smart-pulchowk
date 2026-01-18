<script lang="ts">
  import { goto, query } from "@mateothegreat/svelte5-router";
  import Google from "../icons/google.svelte";
  import { authClient } from "../lib/auth-client";
  import ErrorToast from "../components/ErrorToast.svelte";
  let signingIn = $state(false);
  let error = $state<string | null>(null);

  const toastError = query("message");
  let showError = $state(toastError === "login_required");

  $effect(() => {
    if (toastError === "login_required") {
      showError = true;
    }
  });

  const handleGoogleSignIn = async () => {
    signingIn = true;
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: `${window.origin}/dashboard`,
      });
    } catch (err: any) {
      error = err.message;
      signingIn = false;
    }
  };
</script>

<ErrorToast bind:show={showError} title="Login Required">
  Please use your <span class="font-medium text-gray-900">@pcampus.edu.np</span>
  email address to sign in.
</ErrorToast>

<main
  class="min-h-[calc(100vh-4rem)] flex items-center justify-center relative p-4 sm:p-8 overflow-hidden"
>
  <!-- Background Elements -->
  <div class="absolute inset-0 -z-10">
    <div
      class="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl"
    >
      <div
        class="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"
      ></div>
      <div
        class="absolute top-1/4 right-1/4 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"
      ></div>
      <div
        class="absolute bottom-1/4 left-1/3 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"
      ></div>
    </div>
  </div>

  <div
    class="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-2xl px-8 py-10 shadow-2xl border border-white/50"
  >
    <div class="space-y-8">
      <div class="text-center space-y-2">
        <div
          class="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-600/20"
        >
          <span class="text-white font-bold text-xl">P</span>
        </div>
        <h2 class="text-3xl font-bold text-gray-900 tracking-tight">
          Welcome Back
        </h2>
        <p class="text-gray-600">Sign in to access your dashboard</p>
      </div>

      <button
        class="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-medium text-base cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed group"
        onclick={handleGoogleSignIn}
        disabled={signingIn}
      >
        <div class="w-5 h-5 transition-transform group-hover:scale-110">
          <Google />
        </div>
        <span>
          {signingIn ? "Connecting..." : "Continue with Google"}
        </span>
      </button>

      {#if error}
        <div
          class="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2"
        >
          <svg
            class="w-5 h-5 text-red-500 shrink-0 mt-0.5"
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
          <p class="text-red-600 text-sm">{error}</p>
        </div>
      {/if}
    </div>

    <div class="mt-8 pt-6 border-t border-gray-200/60">
      <p class="text-xs text-gray-500 text-center leading-relaxed">
        By continuing, you agree to PulchowkX's
        <a
          href="#terms"
          class="text-blue-600 hover:text-blue-700 font-medium hover:underline"
          >Terms of Service</a
        >
        and
        <a
          href="#privacy"
          class="text-blue-600 hover:text-blue-700 font-medium hover:underline"
          >Privacy Policy</a
        >.
      </p>
    </div>
  </div>
</main>
