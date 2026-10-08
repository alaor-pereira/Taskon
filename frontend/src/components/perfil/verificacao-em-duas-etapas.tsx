"use client";

import { CheckmarkCircle02Icon, Copy01Icon, Download04Icon } from "@hugeicons/core-free-icons";
import QRCode from "qrcode";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icone } from "@/components/ui/icone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { twoFactor } from "@/lib/auth-client";
import { t } from "@/lib/messages";

/**
 * Verificação em duas etapas por aplicativo autenticador (TOTP).
 *
 * Só para quem entra com senha: no login pelo Google ou GitHub, quem cuida do
 * segundo fator é o provedor. Ativar, desativar e gerar novos códigos de
 * backup pedem a senha de novo — uma sessão esquecida aberta não basta.
 */
export function VerificacaoEmDuasEtapas({
  ativa,
  temSenha,
  aoMudar,
}: {
  ativa: boolean;
  temSenha: boolean;
  aoMudar: () => void;
}) {
  const [dialogo, setDialogo] = useState<"ativar" | "desativar" | "codigos" | null>(null);
  const fechar = () => setDialogo(null);

  if (!temSenha) {
    return (
      <p className="text-sm text-muted-foreground">
        Você entra com uma conta do Google ou do GitHub: a verificação em duas etapas é feita
        por lá. Ative-a nas configurações de segurança do provedor.
      </p>
    );
  }

  return (
    <>
      {ativa ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm">
            <Icone icon={CheckmarkCircle02Icon} className="size-4 text-primary" aria-hidden />
            Ativa. Ao entrar com senha, pedimos o código do aplicativo autenticador.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setDialogo("codigos")}>
              Novos códigos de backup
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDialogo("desativar")}>
              Desativar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            Além da senha, peça um código do celular ao entrar. Quem descobrir sua senha não
            consegue acessar a conta sem ele.
          </p>
          <Button size="sm" onClick={() => setDialogo("ativar")}>
            Ativar
          </Button>
        </div>
      )}

      <Dialog open={dialogo !== null} onOpenChange={(aberto) => !aberto && fechar()}>
        <DialogContent className="sm:max-w-md">
          {dialogo === "ativar" && <Ativar aoConcluir={() => { fechar(); aoMudar(); }} />}
          {dialogo === "desativar" && (
            <Desativar aoConcluir={() => { fechar(); aoMudar(); }} />
          )}
          {dialogo === "codigos" && <NovosCodigos aoConcluir={fechar} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

// --- Etapas compartilhadas ---------------------------------------------------

function PedirSenha({
  descricao,
  rotulo,
  destrutivo,
  aoConfirmar,
}: {
  descricao: string;
  rotulo: string;
  destrutivo?: boolean;
  aoConfirmar: (senha: string) => Promise<string | null>;
}) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const falha = await aoConfirmar(senha);
    setEnviando(false);
    if (falha) setErro(falha);
  }

  return (
    <form onSubmit={enviar} className="flex min-h-0 flex-1 flex-col">
      <DialogBody>
        <p className="text-sm text-muted-foreground">{descricao}</p>
        <div className="space-y-2">
          <Label htmlFor="mfa-senha">Senha atual</Label>
          <Input
            id="mfa-senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
            disabled={enviando}
          />
        </div>
        {erro && (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <Button
          type="submit"
          disabled={!senha || enviando}
          className={destrutivo ? "bg-destructive text-destructive-foreground" : undefined}
        >
          {enviando ? "Conferindo…" : rotulo}
        </Button>
      </DialogFooter>
    </form>
  );
}

const mensagemDaSenha = (error: { status?: number; message?: string }) =>
  error.status === 400 || error.status === 401
    ? "Senha incorreta."
    : (error.message ?? t.erros.generico);

function CodigosDeBackup({ codigos, aoConcluir }: { codigos: string[]; aoConcluir: () => void }) {
  const texto = codigos.join("\n");

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Códigos copiados.");
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  }

  function baixar() {
    const url = URL.createObjectURL(
      new Blob([`Códigos de backup do Taskon (cada um vale uma vez)\n\n${texto}\n`], {
        type: "text/plain",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "taskon-codigos-de-backup.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <DialogBody>
        <p className="text-sm text-muted-foreground">
          Guarde estes códigos num lugar seguro, como um gerenciador de senhas. Se perder o
          celular, cada um permite entrar uma vez. Eles não serão mostrados de novo.
        </p>
        <ul className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 font-mono text-sm">
          {codigos.map((codigo) => (
            <li key={codigo} className="text-center tabular-nums">
              {codigo}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copiar}>
            <Icone icon={Copy01Icon} data-icon="inline-start" />
            Copiar
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={baixar}>
            <Icone icon={Download04Icon} data-icon="inline-start" />
            Baixar .txt
          </Button>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button onClick={aoConcluir}>Já guardei os códigos</Button>
      </DialogFooter>
    </>
  );
}

// --- Fluxos ------------------------------------------------------------------

function Ativar({ aoConcluir }: { aoConcluir: () => void }) {
  const [etapa, setEtapa] = useState<
    | { nome: "senha" }
    | { nome: "codigo"; uri: string; backup: string[] }
    | { nome: "backup"; backup: string[] }
  >({ nome: "senha" });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Ativar verificação em duas etapas</DialogTitle>
        <DialogDescription>
          {etapa.nome === "senha" && "Passo 1 de 3 — confirme que é você."}
          {etapa.nome === "codigo" && "Passo 2 de 3 — conecte o aplicativo autenticador."}
          {etapa.nome === "backup" && "Passo 3 de 3 — guarde os códigos de backup."}
        </DialogDescription>
      </DialogHeader>

      {etapa.nome === "senha" && (
        <PedirSenha
          descricao="Para ativar, digite a senha da sua conta."
          rotulo="Continuar"
          aoConfirmar={async (senha) => {
            const { data, error } = await twoFactor.enable({ password: senha, issuer: "Taskon" });
            if (error) return mensagemDaSenha(error);
            // Só TOTP está configurado no servidor; o outro método é por e-mail.
            if (!data || data.method !== "totp") return t.erros.generico;
            setEtapa({ nome: "codigo", uri: data.totpURI, backup: data.backupCodes });
            return null;
          }}
        />
      )}

      {etapa.nome === "codigo" && (
        <ConectarAplicativo
          uri={etapa.uri}
          aoConfirmar={() => setEtapa({ nome: "backup", backup: etapa.backup })}
        />
      )}

      {etapa.nome === "backup" && (
        <CodigosDeBackup
          codigos={etapa.backup}
          aoConcluir={() => {
            toast.success("Verificação em duas etapas ativada.");
            aoConcluir();
          }}
        />
      )}
    </>
  );
}

function ConectarAplicativo({ uri, aoConfirmar }: { uri: string; aoConfirmar: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const chave = new URL(uri).searchParams.get("secret") ?? "";

  useEffect(() => {
    let ativo = true;
    QRCode.toDataURL(uri, { margin: 1, width: 192 }).then((url) => {
      if (ativo) setQr(url);
    });
    return () => {
      ativo = false;
    };
  }, [uri]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const { error } = await twoFactor.verifyTotp({ code: codigo });
    setEnviando(false);
    if (error) {
      setCodigo("");
      setErro("Código inválido. Confira se o horário do celular está certo e use o código atual.");
      return;
    }
    aoConfirmar();
  }

  return (
    <form onSubmit={enviar} className="flex min-h-0 flex-1 flex-col">
      <DialogBody>
        <p className="text-sm text-muted-foreground">
          Abra o aplicativo autenticador (Google Authenticator, Microsoft Authenticator,
          1Password…) e leia o QR code. Se não puder ler, digite a chave.
        </p>
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-48 items-center justify-center rounded-lg border bg-white p-2">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL gerada aqui
              <img src={qr} alt="QR code para o aplicativo autenticador" className="size-full" />
            ) : (
              <div className="size-full animate-pulse rounded bg-muted" />
            )}
          </div>
          <code className="max-w-full rounded bg-muted px-2 py-1 font-mono text-xs break-all">
            {chave}
          </code>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mfa-codigo">Código de 6 dígitos</Label>
          <Input
            id="mfa-codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            className="text-center font-mono text-lg tracking-[0.5em]"
            disabled={enviando}
            required
          />
        </div>
        {erro && (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <Button type="submit" disabled={!/^\d{6}$/.test(codigo) || enviando}>
          {enviando ? "Verificando…" : "Confirmar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Desativar({ aoConcluir }: { aoConcluir: () => void }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Desativar verificação em duas etapas</DialogTitle>
        <DialogDescription>Sua conta volta a depender só da senha.</DialogDescription>
      </DialogHeader>
      <PedirSenha
        descricao="Para desativar, digite a senha da sua conta."
        rotulo="Desativar"
        destrutivo
        aoConfirmar={async (senha) => {
          const { error } = await twoFactor.disable({ password: senha });
          if (error) return mensagemDaSenha(error);
          toast.success("Verificação em duas etapas desativada.");
          aoConcluir();
          return null;
        }}
      />
    </>
  );
}

function NovosCodigos({ aoConcluir }: { aoConcluir: () => void }) {
  const [codigos, setCodigos] = useState<string[] | null>(null);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Novos códigos de backup</DialogTitle>
        <DialogDescription>Os códigos anteriores deixam de funcionar.</DialogDescription>
      </DialogHeader>
      {codigos ? (
        <CodigosDeBackup codigos={codigos} aoConcluir={aoConcluir} />
      ) : (
        <PedirSenha
          descricao="Para gerar novos códigos, digite a senha da sua conta."
          rotulo="Gerar códigos"
          aoConfirmar={async (senha) => {
            const { data, error } = await twoFactor.generateBackupCodes({ password: senha });
            if (error || !data) return error ? mensagemDaSenha(error) : t.erros.generico;
            setCodigos(data.backupCodes);
            return null;
          }}
        />
      )}
    </>
  );
}
