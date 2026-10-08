"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useConcluirLogin } from "@/components/auth/use-concluir-login";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { twoFactor } from "@/lib/auth-client";
import { t } from "@/lib/messages";

/**
 * Segundo passo do login para quem ativou a verificação em duas etapas. A
 * senha já foi aceita; o servidor guarda isso num cookie de poucos minutos,
 * e a sessão só nasce quando o código confere.
 */
export default function VerificacaoPage() {
  const concluirLogin = useConcluirLogin();
  const [usandoBackup, setUsandoBackup] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [confiar, setConfiar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const pronto = usandoBackup ? codigo.trim().length >= 8 : /^\d{6}$/.test(codigo);

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!pronto) return;
    setErro(null);
    setEnviando(true);

    const { error } = usandoBackup
      ? await twoFactor.verifyBackupCode({ code: codigo.trim(), trustDevice: confiar })
      : await twoFactor.verifyTotp({ code: codigo, trustDevice: confiar });

    if (error) {
      setEnviando(false);
      setCodigo("");
      setErro(
        error.status === 401
          ? "O tempo para confirmar acabou. Entre de novo com sua senha."
          : usandoBackup
            ? "Código de backup inválido ou já usado."
            : "Código inválido. Confira o horário do celular e tente o código atual.",
      );
      return;
    }

    await concluirLogin();
  }

  function alternarModo() {
    setUsandoBackup((v) => !v);
    setCodigo("");
    setErro(null);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Verificação em duas etapas</h1>
        <p className="text-sm text-muted-foreground">
          {usandoBackup
            ? "Digite um dos códigos de backup que você guardou. Cada um vale uma vez."
            : "Digite o código de 6 dígitos do seu aplicativo autenticador."}
        </p>
      </div>

      <form onSubmit={aoEnviar} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="codigo">{usandoBackup ? "Código de backup" : "Código"}</Label>
          <Input
            id="codigo"
            name="codigo"
            value={codigo}
            onChange={(e) =>
              setCodigo(usandoBackup ? e.target.value : e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputMode={usandoBackup ? "text" : "numeric"}
            autoComplete="one-time-code"
            autoFocus
            maxLength={usandoBackup ? 32 : 6}
            className={usandoBackup ? undefined : "text-center font-mono text-lg tracking-[0.5em]"}
            disabled={enviando}
            required
          />
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-5 text-muted-foreground">
          <Checkbox
            checked={confiar}
            onCheckedChange={(v) => setConfiar(v === true)}
            disabled={enviando}
            className="mt-0.5"
          />
          <span>Confiar neste dispositivo por 30 dias. Não marque em computadores compartilhados.</span>
        </label>

        {erro && (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={!pronto || enviando}>
          {enviando ? "Verificando…" : "Verificar"}
        </Button>
      </form>

      <div className="space-y-2 text-center text-sm text-muted-foreground">
        <button
          type="button"
          onClick={alternarModo}
          className="text-foreground underline-offset-4 hover:underline"
        >
          {usandoBackup ? "Usar o aplicativo autenticador" : "Perdeu o celular? Use um código de backup"}
        </button>
        <p>
          <Link href="/entrar" className="underline-offset-4 hover:underline">
            {t.auth.entrar} com outra conta
          </Link>
        </p>
      </div>
    </div>
  );
}
