import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Eye } from "lucide-react";
import { SignInForm } from "@/components/admin/AuthForms";
import { Notice } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { startPreviewAction } from "@/server/actions/admin";
import { currentAdmin } from "@/server/admin";
import { getBackend } from "@/server/backend";
import type { SetupState } from "@/server/backend/types";
import { backendKind, publicDemoMode } from "@/server/env";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  let state: SetupState;
  try {
    state = await getBackend().auth.setupState();
  } catch (error) {
    state = { kind: "misconfigured", reason: error instanceof Error ? error.message : "The store's database is not reachable." };
  }
  // A public demo never sends visitors to the owner-setup screen.
  if (state.kind === "needs-owner" && !publicDemoMode()) redirect("/admin/setup");
  if (state.kind === "ready" && (await currentAdmin())) redirect("/admin");

  let storeName = "Your store";
  try {
    storeName = (await getBackend().public.loadSettings()).store.name;
  } catch {
    // Shown with the misconfiguration notice below.
  }

  return (
    <div className="rounded-[18px] border border-line bg-paper p-6 shadow-sm sm:p-8">
      <p className="eyebrow">Dashboard</p>
      <h1 className="display mt-2 text-2xl">{storeName}</h1>

      {state.kind === "misconfigured" ? (
        <div className="mt-6 space-y-4">
          <Notice tone="warning" title="The store isn't connected to its database yet">
            {state.reason}
          </Notice>
          <p className="text-sm text-ink-2">
            Follow step 2, <strong>“Connect Supabase”</strong>, in the README: on your computer, run{" "}
            <code className="rounded bg-canvas px-1">npm run setup</code>, which prepares the database and writes the keys
            to <code className="rounded bg-canvas px-1">.env.local</code>. On a host, add the same keys to its environment
            variables and restart the app.
          </p>
        </div>
      ) : (
        <div className="mt-6">
          {publicDemoMode() && (
            <div className="mb-8 rounded-[14px] bg-accent-soft p-5" data-testid="preview-entry">
              <p className="font-semibold">Exploring the demo?</p>
              <p className="mt-1 text-sm text-ink-2">
                Open the dashboard as a guest. You can look at everything — products, orders, settings — and nothing you
                change is saved.
              </p>
              <form action={startPreviewAction} className="mt-4">
                <button type="submit" className={buttonClass({ full: true })}>
                  <Eye size={17} /> Explore the dashboard
                </button>
              </form>
              <p className="mt-6 text-xs font-medium uppercase tracking-wide text-ink-3">Store owner? Sign in below</p>
            </div>
          )}
          <SignInForm autoFocus={!publicDemoMode()} />
          {backendKind() === "supabase" && !publicDemoMode() && (
            <details className="mt-6 rounded-[12px] bg-canvas px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium">First time? Create your admin login</summary>
              <ol className="mt-3 list-decimal space-y-2 ps-5 text-ink-2">
                <li>
                  In Supabase, open <strong>Authentication → Users → Add user</strong>, enter your email and a password,
                  and tick <em>Auto confirm user</em>.
                </li>
                <li>
                  Open the <strong>SQL editor</strong> and run:{" "}
                  <code className="block break-all rounded bg-paper px-2 py-1 font-mono text-xs">
                    select public.grant_admin(&apos;you@example.com&apos;);
                  </code>
                </li>
                <li>Come back here and sign in.</li>
              </ol>
              <p className="mt-3 text-ink-3">
                Or run <code className="font-mono">npm run admin:create</code> on your computer, which does both steps.
              </p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
