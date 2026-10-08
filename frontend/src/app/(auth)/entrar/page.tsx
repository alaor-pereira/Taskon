"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { SocialButtons } from "@/components/auth/social-buttons";
import { useConcluirLogin } from "@/components/auth/use-concluir-login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { signIn, useSession } from "@/lib/auth-client";
import { t } from "@/lib/messages";

export default function EntrarPage() {
  const router = useRouter();
  const concluirLogin = useConcluirLogin();
  // Assinar a sessão aqui mantém o estado dela vivo na tela de login: sem
  // ninguém ouvindo, o Better Auth não rebusca a sessão depois do signIn, e o
  // AppLayout leria o "sem usuário" de antes — mandando de volta para cá com o
  // formulário limpo (o login só funcionava na segunda tentativa).
  const { data: sessao, isPending, isRefetching } = useSession();
  const entrando = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Quem já tem sessão não precisa ver o login. Durante o envio, quem navega
  // é o próprio aoEnviar (depois de preparar as abas).
  useEffect(() => {
    if (!entrando.current && !isPending && !isRefetching && sessao?.user) {
      router.replace("/");
    }
  }, [sessao, isPending, isRefetching, router]);

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    entrando.current = true;

    const dados = new FormData(evento.currentTarget);
    const { data, error } = await signIn.email({
      email: String(dados.get("email")),
      password: String(dados.get("senha")),
    });

    if (error) {
      entrando.current = false;
      setEnviando(false);
      // O backend exige e-mail verificado para o login por senha.
      setErro(error.message ?? t.erros.generico);
      return;
    }

    // Senha certa, mas a conta tem verificação em duas etapas: ainda não há
    // sessão, só o pedido do código.
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      router.push("/verificacao");
      return;
    }

    await concluirLogin();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight">{t.auth.entrar}</h1>
        <p className="text-sm text-muted-foreground">
          Acesse sua conta para continuar.
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="senha">{t.auth.senha}</Label>
            <Link
              href="/recuperar-senha"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              {t.auth.esqueciSenha}
            </Link>
          </div>
          <Input
            id="senha"
            name="senha"
            type="password"
            autoComplete="current-password"
            required
            disabled={enviando}
          />
        </div>

        {erro && (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={enviando}>
          {t.auth.entrar}
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {t.auth.ouContinueCom}
        </span>
        <Separator className="flex-1" />
      </div>

      <SocialButtons desabilitado={enviando} />

      <p className="text-center text-sm text-muted-foreground">
        {t.auth.aindaNaoTenhoConta}{" "}
        <Link href="/cadastrar" className="text-foreground underline-offset-4 hover:underline">
          {t.auth.criarConta}
        </Link>
      </p>
    </div>
  );
}
