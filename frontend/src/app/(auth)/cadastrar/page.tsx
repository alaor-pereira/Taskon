"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { SocialButtons } from "@/components/auth/social-buttons";
import { CampoDeAceite } from "@/components/legal/campo-de-aceite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { signUp } from "@/lib/auth-client";
import { CHAVE_ACEITE_PENDENTE } from "@/lib/legal/constantes";
import { t } from "@/lib/messages";

export default function CadastrarPage() {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [aceitou, setAceitou] = useState(false);

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!aceitou) return;
    setErro(null);
    setEnviando(true);

    const dados = new FormData(evento.currentTarget);
    const cadastro = {
      name: String(dados.get("nome")),
      email: String(dados.get("email")),
      password: String(dados.get("senha")),
      // O fuso do navegador vira o padrão do perfil e define o "hoje" do usuário.
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      // O backend recusa o cadastro sem isto e grava a prova do aceite. Não é
      // um campo do usuário, por isso o cliente do Better Auth não o conhece.
      aceiteDosTermos: true,
    };
    const { error } = await signUp.email(cadastro);

    setEnviando(false);

    if (error) {
      setErro(error.message ?? t.erros.generico);
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          {t.auth.verifiqueSeuEmail}
        </h1>
        <p className="text-sm text-muted-foreground">{t.auth.verificacaoEnviada}</p>
        <Button
          render={<Link href="/entrar" />}
          variant="outline"
          className="w-full"
        >
          {t.auth.entrar}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight">{t.auth.criarConta}</h1>
        <p className="text-sm text-muted-foreground">
          Comece a organizar seus projetos.
        </p>
      </div>

      <form onSubmit={aoEnviar} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nome">{t.auth.nome}</Label>
          <Input id="nome" name="nome" autoComplete="name" required disabled={enviando} />
        </div>

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

        <div className="space-y-2">
          <Label htmlFor="senha">{t.auth.senha}</Label>
          <Input
            id="senha"
            name="senha"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={enviando}
          />
          <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
        </div>

        <CampoDeAceite marcado={aceitou} aoMudar={setAceitou} desabilitado={enviando} />

        {erro && (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={enviando || !aceitou}>
          {t.auth.criarConta}
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">{t.auth.ouContinueCom}</span>
        <Separator className="flex-1" />
      </div>

      <SocialButtons
        desabilitado={enviando || !aceitou}
        aoIniciar={() => {
          try {
            sessionStorage.setItem(CHAVE_ACEITE_PENDENTE, "1");
          } catch {
            // Sem sessionStorage, o app pede o aceite de novo na entrada.
          }
        }}
      />

      <p className="text-center text-sm text-muted-foreground">
        {t.auth.jaTenhoConta}{" "}
        <Link href="/entrar" className="text-foreground underline-offset-4 hover:underline">
          {t.auth.entrar}
        </Link>
      </p>
    </div>
  );
}
