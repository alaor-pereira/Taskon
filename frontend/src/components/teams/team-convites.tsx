"use client";

import { Delete02Icon, Mail01Icon } from "@hugeicons/core-free-icons";
import { useState, type FormEvent } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import { tempoRelativo } from "@/lib/datas";
import { t } from "@/lib/messages";
import {
  useCancelarConvite,
  useConvidarParaEquipe,
  useConvitesDaEquipe,
} from "@/lib/queries/teams";
import type { PapelEquipe } from "@/lib/types";
import { PAPEIS } from "./team-membros";

/** Convites pendentes. Só quem gerencia chega a esta aba. */
export function TeamConvites({ teamId }: { teamId: string }) {
  const { data: convites, isPending } = useConvitesDaEquipe(teamId);
  const cancelar = useCancelarConvite(teamId);

  async function cancelarConvite(conviteId: string) {
    try {
      await cancelar.mutateAsync(conviteId);
      toast.success("Convite cancelado.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.erros.generico);
    }
  }

  if (isPending) {
    return <div className="h-32 animate-pulse rounded-lg bg-muted" />;
  }

  if (!convites || convites.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nenhum convite pendente. Use “Convidar” para chamar alguém para a equipe.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {convites.map((convite) => (
        <li key={convite.id} className="flex items-center gap-3 px-3 py-2.5">
          <Icone icon={Mail01Icon} className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{convite.email}</p>
            <p className="text-xs text-muted-foreground">
              {t.papelEquipe[convite.role as PapelEquipe]} · expira{" "}
              {tempoRelativo(convite.expiresAt)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Cancelar convite para ${convite.email}`}
            onClick={() => cancelarConvite(convite.id)}
            disabled={cancelar.isPending}
          >
            <Icone icon={Delete02Icon} />
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** Convite de uma pessoa por vez, aberto pelo botão do cabeçalho. */
export function ConvidarDialog({
  teamId,
  aberto,
  aoFechar,
}: {
  teamId: string;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const convidar = useConvidarParaEquipe(teamId);
  const [role, setRole] = useState<PapelEquipe>("MEMBRO");
  const [erro, setErro] = useState<string | null>(null);

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    const dados = new FormData(evento.currentTarget);

    try {
      await convidar.mutateAsync({
        email: String(dados.get("email")).trim(),
        role,
      });
      toast.success("Convite enviado.");
      aoFechar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : t.erros.generico);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={aoEnviar} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Convidar para a equipe</DialogTitle>
            <DialogDescription>
              Quem ainda não tem conta recebe um e-mail com o convite, válido por 7 dias.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="space-y-2">
              <Label htmlFor="convite-email">{t.auth.email}</Label>
              <Input
                id="convite-email"
                name="email"
                type="email"
                required
                autoFocus
                placeholder="pessoa@empresa.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="convite-papel">Papel</Label>
              <Select
                value={role}
                onValueChange={(valor) => setRole(valor as PapelEquipe)}
                items={t.papelEquipe}
              >
                <SelectTrigger id="convite-papel" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAPEIS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t.papelEquipe[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {erro && (
              <p role="alert" className="text-sm text-destructive">
                {erro}
              </p>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={aoFechar}>
              {t.acoes.cancelar}
            </Button>
            <Button type="submit" disabled={convidar.isPending}>
              Enviar convite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
