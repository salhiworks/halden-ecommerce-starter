"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { buttonClass } from "@/components/ui/button";
import { createOwnerAction, signInAction } from "@/server/actions/admin";
import { Notice, TextField } from "./ui";

/**
 * A form action that keeps what was typed when it comes back with an error.
 * (A plain `<form action>` is reset by React after every submission, so a
 * mistyped password would also wipe the email.) The `action` attribute stays
 * for browsers without JavaScript.
 */
function useFormAction<S>(action: (previous: S, form: FormData) => Promise<S>, initial: Awaited<S>) {
  const [state, dispatch, pending] = useActionState(action, initial);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };
  return { state, dispatch, pending, onSubmit };
}

export function SignInForm({ autoFocus = true }: { autoFocus?: boolean }) {
  const { state, dispatch, pending, onSubmit } = useFormAction(signInAction, {});
  return (
    <form action={dispatch} onSubmit={onSubmit} className="space-y-4">
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      <TextField label="Email" name="email" type="email" autoComplete="email" required autoFocus={autoFocus} />
      <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
      <button type="submit" disabled={pending} className={buttonClass({ full: true, size: "lg" })}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function OwnerSetupForm({ tokenRequired }: { tokenRequired: boolean }) {
  const { state, dispatch, pending, onSubmit } = useFormAction(createOwnerAction, {});
  return (
    <form action={dispatch} onSubmit={onSubmit} className="space-y-4">
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      <TextField label="Your email" name="email" type="email" autoComplete="email" required autoFocus />
      <TextField
        label="Choose a password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="At least 10 characters."
        required
      />
      <TextField label="Repeat the password" name="confirm" type="password" autoComplete="new-password" required />
      {tokenRequired && (
        <TextField
          label="Setup token"
          name="token"
          type="password"
          autoComplete="off"
          hint="The value of ADMIN_SETUP_TOKEN in your server's environment variables."
          required
        />
      )}
      <button type="submit" disabled={pending} className={buttonClass({ full: true, size: "lg" })}>
        {pending ? "Creating…" : "Create owner account"}
      </button>
    </form>
  );
}
