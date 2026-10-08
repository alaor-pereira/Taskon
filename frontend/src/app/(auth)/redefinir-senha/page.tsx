"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/lib/auth-client";
import { t } from "@/lib/messages";

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={null}>
      <Formulario />
    </Suspense>
  );
}

function Formulario() {
  const router = useRouter();
  const params = useSearchParams();
  // Guardado uma vez: logo abaixo ele sai da URL, e a busca mudaria.
  const [token] = useState(() => params.get("token"));

  // O token dá acesso a trocar a senha: não deve ficar no histórico do
  // navegador nem ser copiado junto com o endereço.
  useEffect(() => {
    if (!token) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("token");
    window.history.replaceState(window.history.state, "", url);
  }, [token]);

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    const dados = new FormData(evento.currentTarget);
    const senha = String(dados.get("senha"));
    const confirmacao = String(dados.get("confirmacao"));

    if (senha !== confirmacao) {
      setErro("As senhas não coincidem.");
      return;
    }

    setEnviando(true);
    const { error } = await resetPassword({ newPassword: senha, token: token ?? "" });
    setEnviando(false);

    if (error) {
      setErro(error.message ?? t.erros.generico);
      return;
    }

    toast.success("Senha redefinida.");
    router.push("/entrar");
  }

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Link inválido</h1>
        <p className="text-sm text-muted-foreground">
          Este link de redefinição está incompleto ou expirou.
        </p>
        <Button
          render={<Link href="/recuperar-senha" />}
          variant="outline"
          className="w-full"
        >
          Pedir um novo link
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Nova senha</h1>
        <p className="text-sm text-muted-foreground">Escolha uma senha para sua conta.</p>
      </div>

      <form onSubmit={aoEnviar} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="senha">Nova senha</Label>
          <Input
            id="senha"
            name="senha"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={enviando}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmacao">Confirme a senha</Label>
          <Input
            id="confirmacao"
            name="confirmacao"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={enviando}
          />
        </div>

        {erro && (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={enviando}>
          Redefinir senha
        </Button>
      </form>
    </div>
  );
}
