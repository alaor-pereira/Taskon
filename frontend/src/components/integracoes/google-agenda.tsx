"use client";

import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  GoogleIcon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { t } from "@/lib/messages";
import {
  useConectarGoogle,
  useDesconectarGoogle,
  useIntegracaoGoogle,
  type IntegracaoGoogle,
} from "@/lib/queries/integracoes";
import { cn } from "@/lib/utils";

/**
 * Sincronização com o Google Agenda (só Taskon → Google).
 *
 * Nada sai do Taskon sem o consentimento dado no diálogo abaixo, que diz o
 * que vai e o que não vai para o Google (LGPD, art. 7º, I e art. 9º).
 */

// --- Consentimento ------------------------------------------------------------

export function ConectarGoogleDialog({
  aberto,
  aoFechar,
}: {
  aberto: boolean;
  aoFechar: () => void;
}) {
  const conectar = useConectarGoogle();

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sincronizar com o Google Agenda</DialogTitle>
          <DialogDescription>
            Suas atividades e reuniões passam a aparecer também no Google Agenda.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 text-sm">
          <div className="space-y-1.5">
            <p className="text-label">Vai para o Google</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>título, data, horário e repetição de atividades e reuniões;</li>
              <li>local, descrição e o link do Google Meet, quando houver;</li>
              <li>um link para abrir o compromisso no Taskon.</li>
            </ul>
          </div>
          <div className="space-y-1.5">
            <p className="text-label">Não vai</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>nomes e e-mails dos participantes (só a quantidade);</li>
              <li>tarefas, projetos e comentários.</li>
            </ul>
          </div>
          <p className="rounded-lg border bg-muted/40 p-3 text-muted-foreground">
            Criamos uma agenda separada chamada <strong className="text-foreground">Taskon</strong>{" "}
            na sua conta Google e só ela é acessada: o Taskon não lê nem altera seus outros
            compromissos. Você pode desconectar quando quiser, e a agenda é apagada.{" "}
            <Link
              href="/privacidade"
              target="_blank"
              rel="noopener noreferrer"
              className="text-link underline underline-offset-4"
            >
              Política de privacidade
            </Link>
          </p>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={aoFechar} disabled={conectar.isPending}>
            {t.acoes.cancelar}
          </Button>
          <Button
            onClick={() =>
              conectar.mutate(undefined, {
                onError: (e) => toast.error(e.message),
              })
            }
            disabled={conectar.isPending}
          >
            <Icone icon={GoogleIcon} data-icon="inline-start" />
            {conectar.isPending ? "Abrindo o Google…" : "Concordo, conectar com o Google"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Desconectar -----------------------------------------------------------------

function DesconectarGoogleDialog({
  integracao,
  aberto,
  aoFechar,
}: {
  integracao: IntegracaoGoogle;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const desconectar = useDesconectarGoogle();
  const n = integracao.reunioesComMeetFuturas;

  return (
    <AlertDialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desconectar o Google Agenda?</AlertDialogTitle>
          <AlertDialogDescription>
            A agenda “Taskon” será apagada da conta {integracao.googleEmail} e o Taskon perde o
            acesso a ela. Seus compromissos continuam no Taskon.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {n > 0 && (
          <p className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <Icone icon={Alert02Icon} className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            {n === 1
              ? "1 reunião futura perde o link do Google Meet, e os participantes serão avisados."
              : `${n} reuniões futuras perdem o link do Google Meet, e os participantes serão avisados.`}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={desconectar.isPending}>{t.acoes.cancelar}</AlertDialogCancel>
          <Button
            className="bg-destructive text-destructive-foreground"
            disabled={desconectar.isPending}
            onClick={() =>
              desconectar.mutate(undefined, {
                onSuccess: () => {
                  toast.success("Google Agenda desconectado.");
                  aoFechar();
                },
                onError: (e) => toast.error(e.message),
              })
            }
          >
            {desconectar.isPending ? "Desconectando…" : "Desconectar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// --- Cartão (Configurações e menu da Agenda) -------------------------------------

export function CartaoGoogleAgenda() {
  const { data: integracao, isLoading } = useIntegracaoGoogle();
  const [conectando, setConectando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);

  if (isLoading || !integracao) return <div className="h-16 animate-pulse rounded-lg bg-muted" />;

  if (!integracao.disponivel) {
    return (
      <p className="text-sm text-muted-foreground">
        A integração com o Google não está disponível neste servidor.
      </p>
    );
  }

  const precisaReconectar = integracao.status === "PRECISA_RECONECTAR";

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border bg-background">
          <Icone icon={GoogleIcon} className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-semibold">Google Agenda</p>
          {!integracao.conectada ? (
            <p className="text-sm text-muted-foreground">
              Veja suas atividades e reuniões no Google Agenda e gere links do Google Meet.
            </p>
          ) : precisaReconectar ? (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <Icone icon={Alert02Icon} className="size-4" aria-hidden />
              O Google não aceita mais o acesso. Conecte de novo para voltar a sincronizar.
            </p>
          ) : (
            <>
              <p className="flex items-center gap-1.5 truncate text-sm">
                <Icone icon={CheckmarkCircle02Icon} className="size-4 text-primary" aria-hidden />
                Sincronizando com {integracao.googleEmail}
              </p>
              <p className="text-xs text-muted-foreground">
                {integracao.lastSyncAt
                  ? `Última sincronização ${formatDistanceToNow(new Date(integracao.lastSyncAt), { addSuffix: true, locale: ptBR })}`
                  : "Primeira sincronização em andamento"}
                {integracao.lastError ? " · houve falhas, tentaremos de novo" : ""}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {integracao.conectada && (
          <Button variant="ghost" size="sm" onClick={() => setDesconectando(true)}>
            Desconectar
          </Button>
        )}
        {(!integracao.conectada || precisaReconectar) && (
          <Button size="sm" onClick={() => setConectando(true)}>
            <Icone icon={precisaReconectar ? Refresh01Icon : GoogleIcon} data-icon="inline-start" />
            {precisaReconectar ? "Reconectar" : "Conectar"}
          </Button>
        )}
      </div>

      <ConectarGoogleDialog aberto={conectando} aoFechar={() => setConectando(false)} />
      {integracao.conectada && (
        <DesconectarGoogleDialog
          integracao={integracao}
          aberto={desconectando}
          aoFechar={() => setDesconectando(false)}
        />
      )}
    </div>
  );
}

// --- Cabeçalho da Agenda -----------------------------------------------------------

export function SincronizacaoGoogle() {
  const { data: integracao } = useIntegracaoGoogle();
  const [conectando, setConectando] = useState(false);

  if (!integracao?.disponivel) return null;

  if (!integracao.conectada) {
    return (
      <>
        <Button variant="outline" onClick={() => setConectando(true)}>
          <Icone icon={GoogleIcon} />
          Sincronizar com Google Agenda
        </Button>
        <ConectarGoogleDialog aberto={conectando} aoFechar={() => setConectando(false)} />
      </>
    );
  }

  const precisaReconectar = integracao.status === "PRECISA_RECONECTAR";
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm transition-colors hover:bg-muted data-popup-open:bg-muted",
          precisaReconectar && "border-destructive/40 text-destructive",
        )}
      >
        <Icone icon={precisaReconectar ? Alert02Icon : GoogleIcon} className="size-4" aria-hidden />
        {precisaReconectar ? "Reconectar Google Agenda" : "Google Agenda"}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <CartaoGoogleAgenda />
      </PopoverContent>
    </Popover>
  );
}
