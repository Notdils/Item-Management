"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { signIn } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, null);
  const invalid = state ? true : undefined;
  return (
    <form action={action}>
      <FieldGroup className="gap-4">
        <Field data-invalid={invalid}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="username" spellCheck={false}
            required enterKeyHint="next" aria-invalid={invalid} aria-describedby={state ? "login-error" : undefined} />
        </Field>
        <Field data-invalid={invalid}>
          <FieldLabel htmlFor="current-password">Kata sandi</FieldLabel>
          <Input id="current-password" name="password" type="password" autoComplete="current-password"
            required enterKeyHint="done" aria-invalid={invalid} aria-describedby={state ? "login-error" : undefined} />
          <div aria-live="assertive">{state && <FieldError id="login-error">{state}</FieldError>}</div>
        </Field>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          {pending ? "Masuk..." : "Masuk"}
        </Button>
      </FieldGroup>
    </form>
  );
}
