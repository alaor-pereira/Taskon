"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSair } from "@/components/layout/use-sair";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { t } from "@/lib/messages";
import {
  useExcluirConta,
  usePreparacaoDaExclusao,
  type PreparacaoDaExclusao,
} from "@/lib/queries/profile";

/**
 * Exclusão da própria conta (LGPD, art. 18, VI). Antes de pedir a
 * confirmação, o diálogo confere o que impede a exclusão; depois exige o
 * e-mail digitado e, para quem tem senha, a senha.
 */
export function ExcluirContaDialog({ email }: { email: string }) {
  const [aberto, setAberto] = useState(false);
  const { data: preparacao, isLoading, refetch } = usePreparacaoDaExclusao(aberto);

  return (
    <AlertDialog open={aberto} onOpenChange={setAberto}>
      <Button variant="destructive" size="sm" onClick={() => setAberto(true)}>
        Excluir conta
      </Button>

      <AlertDialogContent className="data-[size=default]:max-w-[calc(100%-2rem)] data-[size=default]:sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir sua conta</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação é imediata e não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isLoading || !preparacao ? (
          <div className="space-y-2" aria-busy>
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ) : temBloqueio(preparacao) ? (
          <Bloqueios preparacao={preparacao} />
        ) : !preparacao.temSenha && !preparacao.sessaoRecente ? (
          <EntrarDeNovo />
        ) : (
          <Confirmacao
            email={email}
            temSenha={preparacao.temSenha}
            aoBloquear={() => refetch()}
          />
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

const temBloqueio = (p: PreparacaoDaExclusao) => p.equipes.length > 0 || p.projetos.length > 0;

function Bloqueios({ preparacao }: { preparacao: PreparacaoDaExclusao }) {
  return (
    <>
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Você é dono de espaços que outras pessoas usam. Transfira a posse ou exclua cada um
          antes de excluir a conta:
        </p>
        {preparacao.equipes.length > 0 && <ListaDeNomes titulo="Equipes" itens={preparacao.equipes} />}
        {preparacao.projetos.length > 0 && (
          <ListaDeNomes titulo="Projetos compartilhados" itens={preparacao.projetos} />
        )}
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel>Entendi</AlertDialogCancel>
      </AlertDialogFooter>
    </>
  );
}

function ListaDeNomes({ titulo, itens }: { titulo: string; itens: { id: string; nome: string }[] }) {
  return (
    <div className="space-y-1.5">
      <p className="text-label">{titulo}</p>
      <ul className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-2">
        {itens.map((item) => (
          <li key={item.id} className="truncate px-1 text-sm">
            {item.nome}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EntrarDeNovo() {
  const sair = useSair();

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Por segurança, a exclusão exige um login feito nas últimas 24 horas. Saia, entre de novo
        com sua conta e volte aqui.
      </p>
      <AlertDialogFooter>
        <AlertDialogCancel>{t.acoes.cancelar}</AlertDialogCancel>
        <Button onClick={sair}>Sair e entrar de novo</Button>
      </AlertDialogFooter>
    </>
  );
}

function Confirmacao({
  email,
  temSenha,
  aoBloquear,
}: {
  email: string;
  temSenha: boolean;
  aoBloquear: () => void;
}) {
  const sair = useSair();
  const excluir = useExcluirConta();
  const [emailDigitado, setEmailDigitado] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const emailConfere = emailDigitado.trim().toLowerCase() === email.toLowerCase();
  const pronto = emailConfere && (!temSenha || senha.length > 0) && !excluir.isPending;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!pronto) return;
    setErro(null);
    try {
      await excluir.mutateAsync({ email: emailDigitado.trim(), ...(temSenha && { senha }) });
    } catch (falha) {
      if (falha instanceof ApiError && falha.ehConflito) aoBloquear();
      setErro(falha instanceof Error ? falha.message : t.erros.generico);
      return;
    }

    // As sessões já foram apagadas no servidor; isto limpa o cookie local,
    // as abas e o cache.
    toast.success("Sua conta foi excluída.");
    await sair();
  }

  return (
    <form onSubmit={enviar} className="contents">
      <div className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-label">Será apagado</p>
            <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
              <li>nome, e-mail, foto e senha</li>
              <li>Caixa de entrada e projetos pessoais</li>
              <li>atividades da agenda</li>
              <li>notificações e preferências</li>
            </ul>
          </div>
          <div className="space-y-1">
            <p className="text-label">Permanece, como “Usuário removido”</p>
            <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
              <li>comentários</li>
              <li>tarefas em projetos de outras pessoas</li>
              <li>reuniões com outros participantes</li>
            </ul>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="excluir-email">
            Digite <span className="font-semibold text-foreground">{email}</span> para confirmar
          </Label>
          <Input
            id="excluir-email"
            type="email"
            value={emailDigitado}
            onChange={(e) => setEmailDigitado(e.target.value)}
            autoComplete="off"
            disabled={excluir.isPending}
          />
        </div>

        {temSenha && (
          <div className="space-y-2">
            <Label htmlFor="excluir-senha">{t.auth.senha}</Label>
            <Input
              id="excluir-senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              disabled={excluir.isPending}
            />
          </div>
        )}

        {erro && (
          <p role="alert" className="text-destructive">
            {erro}
          </p>
        )}
      </div>

      <AlertDialogFooter>
        <AlertDialogCancel disabled={excluir.isPending}>{t.acoes.cancelar}</AlertDialogCancel>
        <Button
          type="submit"
          disabled={!pronto}
          className="bg-destructive text-destructive-foreground"
        >
          {excluir.isPending ? "Excluindo…" : "Excluir conta"}
        </Button>
      </AlertDialogFooter>
    </form>
  );
}
