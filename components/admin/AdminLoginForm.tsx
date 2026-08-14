"use client";

import { useActionState } from "react";

import { loginAction, type LoginState } from "@/app/admin/login/actions";
import { Button } from "@/components/ui/Button";

const initialState: LoginState = { error: null };

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="mt-8 space-y-5">
      <div>
        <label className="form-label" htmlFor="password">
          Yönetici şifresi
        </label>
        <p
          id="password-hint"
          className="mb-2 text-xs text-[color:var(--ink-soft)]"
        >
          Şifre dokümanda belirtilmiştir.
        </p>
        <input
          className="form-control"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          aria-invalid={Boolean(state.error)}
          aria-describedby={
            state.error ? "password-hint login-error" : "password-hint"
          }
        />
        {state.error ? (
          <p id="login-error" role="alert" className="form-error">
            {state.error}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
      </Button>
    </form>
  );
}
