<script lang="ts">
  import { query, replace, route } from "@mateothegreat/svelte5-router";
  import Google from "../icons/google.svelte";
  import { authClient } from "../lib/auth-client";
  import ErrorToast from "../components/ErrorToast.svelte";
  let signingIn = $state(false);
  let error = $state<string | null>(null);

  const toastError = query("message");
  let showError = $state(false);
  let handledLoginRequired = $state(false);

  $effect(() => {
    if (!handledLoginRequired && toastError === "login_required") {
      showError = true;
      handledLoginRequired = true;
      replace("/register");
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
  Student access requires a valid
  <span class="font-medium text-gray-900">@pcampus.edu.np</span> student email format.
  Other emails can continue with guest access.
</ErrorToast>

<main
  class="min-h-[calc(100vh-4rem)] px-4 pt-14 pb-8 sm:px-6 sm:pt-16 lg:px-8 lg:pt-20 relative overflow-hidden"
>
  <div
    class="pointer-events-none absolute -top-28 -right-24 h-72 w-72 rounded-full bg-cyan-200/35 blur-3xl"
  ></div>
  <div
    class="pointer-events-none absolute -bottom-28 -left-24 h-80 w-80 rounded-full bg-blue-200/30 blur-3xl"
  ></div>

  <div class="max-w-5xl mx-auto">
    <div
      class="rounded-3xl border border-slate-200/80 bg-white/85 backdrop-blur-sm shadow-xl shadow-cyan-100/40 overflow-hidden"
    >
      <div class="grid lg:grid-cols-[minmax(0,1fr)_430px]">
        <section
          class="relative p-8 sm:p-10 lg:p-12 bg-linear-to-br from-cyan-50 via-white to-blue-50 border-b lg:border-b-0 lg:border-r border-slate-200/80"
        >
          <div
            class="absolute top-0 right-0 h-44 w-44 bg-linear-to-br from-cyan-200/30 to-blue-200/20 rounded-full blur-2xl"
          ></div>

          <p
            class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-700 bg-cyan-50 border border-cyan-200"
          >
            Pulchowk Digital
          </p>

          <h1
            class="mt-5 text-3xl sm:text-4xl font-black tracking-tight text-slate-900 leading-tight"
          >
            Access Smart Pulchowk
          </h1>
          <p class="mt-3 text-slate-600 max-w-lg">
            Sign in with Google to access Smart Pulchowk. Student-specific
            features are enabled for valid campus student emails.
          </p>

          <div class="mt-8 space-y-3">
            <div
              class="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5"
            >
              <span
                class="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700"
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
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
              </span>
              <div>
                <p class="font-semibold text-slate-900 text-sm">
                  Student role via @pcampus
                </p>
                <p class="text-xs text-slate-500">
                  Valid student-format
                  <span class="font-semibold">@pcampus.edu.np</span> emails get student
                  access.
                </p>
              </div>
            </div>

            <div
              class="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5"
            >
              <span
                class="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-700"
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
                    d="M12 8c-2.2 0-4 1.8-4 4v6h8v-6c0-2.2-1.8-4-4-4zm0 0a3 3 0 100-6 3 3 0 000 6z"
                  ></path>
                </svg>
              </span>
              <div>
                <p class="font-semibold text-slate-900 text-sm">
                  Other emails get guest access
                </p>
                <p class="text-xs text-slate-500">
                  Non-campus or non-student-format emails can still sign in and
                  use guest features.
                </p>
              </div>
            </div>

            <div
              class="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5"
            >
              <span
                class="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-700"
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
                    d="M12 8c-2.2 0-4 1.8-4 4v6h8v-6c0-2.2-1.8-4-4-4zm0 0a3 3 0 100-6 3 3 0 000 6z"
                  ></path>
                </svg>
              </span>
              <div>
                <p class="font-semibold text-slate-900 text-sm">
                  Single secure login
                </p>
                <p class="text-xs text-slate-500">
                  We use Google sign-in for authentication and session security.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section class="p-8 sm:p-10 flex items-center">
          <div class="mx-auto w-full max-w-sm">
            <div class="text-center mb-7">
              <div
                class="mx-auto mb-4 h-12 w-12 flex items-center justify-center"
              >
                <img
                  src="/logo.png"
                  alt="Smart Pulchowk logo"
                  class="w-10 h-10"
                />
              </div>
              <h2 class="text-2xl font-black tracking-tight text-slate-900">
                Sign In
              </h2>
              <p class="mt-1 text-sm text-slate-500">
                Continue to your Smart Pulchowk account
              </p>
            </div>

            <button
              class="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white border border-slate-200 hover:border-cyan-200 hover:bg-cyan-50 text-slate-700 rounded-xl font-semibold text-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              onclick={handleGoogleSignIn}
              disabled={signingIn}
            >
              <div class="w-5 h-5 flex items-center justify-center">
                <Google />
              </div>
              <span>{signingIn ? "Connecting..." : "Continue with Google"}</span
              >
            </button>

            {#if error}
              <div
                class="mt-4 p-3.5 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3"
              >
                <svg
                  class="w-5 h-5 text-rose-500 shrink-0 mt-0.5"
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
                <p class="text-rose-700 text-sm">{error}</p>
              </div>
            {/if}

            <p class="mt-6 text-xs text-slate-500 text-center leading-relaxed">
              By continuing, you agree to Smart Pulchowk's
              <a href="#terms" class="text-cyan-700 hover:underline font-medium"
                >Terms of Service</a
              >
              and
              <a
                use:route
                href="/privacy"
                class="text-cyan-700 hover:underline font-medium"
                >Privacy Policy</a
              >.
            </p>
          </div>
        </section>
      </div>
    </div>
  </div>
</main>
