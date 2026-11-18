"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="field-label">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" spellCheck={false}
          required enterKeyHint="next" className="input" aria-describedby={state ? "login-error" : undefined} />
      </div>
      <div>
        <label htmlFor="current-password" className="field-label">Kata sandi</label>
        <input id="current-password" name="password" type="password" autoComplete="current-password"
          required enterKeyHint="done" className="input" aria-describedby={state ? "login-error" : undefined} />
      </div>
      <p id="login-error" role="alert" aria-live="assertive" className="min-h-5 text-sm text-danger">
        {state ?? ""}
      </p>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Masuk..." : "Masuk"}
      </button>
    </form>
  );
}
