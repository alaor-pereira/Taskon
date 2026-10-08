"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/auth-client";
import { t } from "@/lib/messages";

export default function RecuperarSenhaPage() {
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true);

    const dados = new FormData(evento.currentTarget);
    await requestPasswordReset({
      email: String(dados.get("email")),
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    setEnviando(false);
    // A confirmação é sempre a mesma, exista a conta ou não: dizer "e-mail não
    // encontrado" revelaria quem tem cadastro no sistema.
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Verifique seu e-mail</h1>
        <p className="text-sm text-muted-foreground">
          Se houver uma conta com esse endereço, enviamos um link para redefinir a
          senha. Ele vale por 1 hora.
        </p>
        <Button
          render={<Link href="/entrar" />}
          variant="outline"
          className="w-full"
        >
          Voltar para o acesso
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Recuperar senha</h1>
        <p className="text-sm text-muted-foreground">
          Informe seu e-mail e enviaremos um link de redefinição.
        </p>
      </div>

      <form onSubmit={aoEnviar} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t.auth.email}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={enviando}
          />
        </div>

        <Button type="submit" className="w-full" disabled={enviando}>
          Enviar link
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/entrar" className="text-foreground underline-offset-4 hover:underline">
          Voltar para o acesso
        </Link>
      </p>
    </div>
  );
}
