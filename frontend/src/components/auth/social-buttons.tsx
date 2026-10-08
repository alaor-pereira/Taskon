"use client";

import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";
import { t } from "@/lib/messages";

/**
 * Entrada por Google e GitHub.
 *
 * A união com uma conta existente só acontece quando o provedor declara o
 * e-mail verificado — a regra está no backend, aqui é só o disparo.
 */
export function SocialButtons({
  desabilitado,
  aoIniciar,
}: {
  desabilitado?: boolean;
  /** Roda antes de sair para o provedor (o cadastro marca o aceite aqui). */
  aoIniciar?: () => void;
}) {
  async function entrarCom(provedor: "google" | "github") {
    aoIniciar?.();
    await signIn.social({
      provider: provedor,
      callbackURL: `${window.location.origin}/`,
    });
  }

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={desabilitado}
        onClick={() => entrarCom("google")}
      >
        <GoogleIcon />
        {t.auth.entrarComGoogle}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={desabilitado}
        onClick={() => entrarCom("github")}
      >
        <GitHubIcon />
        {t.auth.entrarComGitHub}
      </Button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.7l4-3Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-current">
      <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.1 5.1 18.1 5.4 18.1 5.4c.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}
