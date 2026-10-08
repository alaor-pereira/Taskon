"use client";

import { CrownIcon, Delete02Icon, UserAdd01Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmarDialog } from "@/components/confirmar-dialog";
import { iniciais } from "@/components/tasks/task-badges";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icone } from "@/components/ui/icone";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ApiError } from "@/lib/api";
import { t } from "@/lib/messages";
import {
  useAdicionarMembroDoProjeto,
  useAlterarPapelNoProjeto,
  useCandidatosAMembro,
  useRemoverMembroDoProjeto,
  useTransferirProjeto,
} from "@/lib/queries/projects";
import type { DetalheDoProjeto, PapelProjeto, UsuarioResumo } from "@/lib/types";

/** Só EDITOR e VIEWER são atribuíveis: o proprietário muda por transferência. */
const PAPEIS: PapelProjeto[] = ["EDITOR", "VIEWER"];

/**
 * Membros do projeto.
 *
 * Em projeto de equipe, os candidatos são os membros da equipe que ainda não
 * participam — é a regra que dá sentido ao projeto "de equipe". Em projeto
 * pessoal, a inclusão é por convite, que chega na fase seguinte.
 */
export function ProjectMembersDialog({
  aberto,
  aoFechar,
  projectId,
  detalhe,
}: {
  aberto: boolean;
  aoFechar: () => void;
  projectId: string;
  detalhe: DetalheDoProjeto;
}) {
  const { data: candidatos } = useCandidatosAMembro(projectId, aberto);
  const adicionar = useAdicionarMembroDoProjeto(projectId);
  const alterarPapel = useAlterarPapelNoProjeto(projectId);
  const remover = useRemoverMembroDoProjeto(projectId);
  const transferir = useTransferirProjeto(projectId);

  const [selecionado, setSelecionado] = useState<string>("");
  const [papel, setPapel] = useState<PapelProjeto>("EDITOR");
  const [transferindoPara, setTransferindoPara] = useState<UsuarioResumo | null>(null);

  async function executar(acao: () => Promise<unknown>, sucesso: string) {
    try {
      await acao();
      toast.success(sucesso);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.erros.generico);
    }
  }

  return (
    <>
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Membros do projeto</DialogTitle>
          <DialogDescription>
            Quem participa vê as tarefas deste projeto, conforme o papel.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
        {detalhe.equipe ? (
          candidatos && candidatos.length > 0 ? (
            <div className="flex flex-wrap items-end gap-2 py-2">
              <div className="min-w-48 flex-1 space-y-2">
                <Label htmlFor="membro-candidato">Da equipe {detalhe.equipe.name}</Label>
                <Select
                  value={selecionado}
                  onValueChange={(v) => setSelecionado(v ?? "")}
                  items={Object.fromEntries(candidatos.map((u) => [u.id, u.name]))}
                >
                  <SelectTrigger id="membro-candidato">
                    <SelectValue placeholder="Escolha alguém" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidatos.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="membro-papel">Papel</Label>
                <Select
                  value={papel}
                  onValueChange={(v) => setPapel(v as PapelProjeto)}
                  items={t.papelProjeto}
                >
                  <SelectTrigger id="membro-papel" className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAPEIS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {t.papelProjeto[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                disabled={!selecionado || adicionar.isPending}
                onClick={() =>
                  executar(async () => {
                    await adicionar.mutateAsync({ userId: selecionado, role: papel });
                    setSelecionado("");
                  }, "Membro adicionado.")
                }
              >
                <Icone icon={UserAdd01Icon} />
                Adicionar
              </Button>
            </div>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">
              Todos os membros da equipe já participam deste projeto.
            </p>
          )
        ) : (
          <p className="py-2 text-sm text-muted-foreground">
            Este é um projeto pessoal. O convite por e-mail para projetos chega na
            próxima fase.
          </p>
        )}

        <Separator />

        <div className="divide-y rounded-lg border">
          {detalhe.membros.map((membro) => {
            const ehDono = membro.user.id === detalhe.projeto.ownerId;
            const editavel = detalhe.meuPapel === "OWNER" && !ehDono;

            return (
              <div key={membro.id} className="flex items-center gap-3 px-3 py-2.5">
                <Avatar className="size-8 shrink-0">
                  {membro.user.image && <AvatarImage src={membro.user.image} alt="" />}
                  <AvatarFallback className="text-xs">
                    {iniciais(membro.user.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                    {membro.user.name}
                    {ehDono && <Icone icon={CrownIcon} className="size-4 text-muted-foreground" />}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {membro.user.email}
                  </p>
                </div>

                {editavel ? (
                  <Select
                    value={membro.role}
                    onValueChange={(v) =>
                      executar(
                        () =>
                          alterarPapel.mutateAsync({
                            membroId: membro.user.id,
                            role: v as PapelProjeto,
                          }),
                        "Papel atualizado.",
                      )
                    }
                    items={t.papelProjeto}
                  >
                    <SelectTrigger size="sm" className="w-32" aria-label="Papel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAPEIS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {t.papelProjeto[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="secondary">{t.papelProjeto[membro.role]}</Badge>
                )}

                {editavel && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Transferir propriedade para ${membro.user.name}`}
                      onClick={() => setTransferindoPara(membro.user)}
                    >
                      <Icone icon={CrownIcon} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remover ${membro.user.name}`}
                      onClick={() =>
                        executar(
                          () => remover.mutateAsync(membro.user.id),
                          "Membro removido.",
                        )
                      }
                    >
                      <Icone icon={Delete02Icon} />
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </div>
        </DialogBody>
      </DialogContent>
    </Dialog>

    <ConfirmarDialog
      aberto={Boolean(transferindoPara)}
      titulo={`Transferir a propriedade para ${transferindoPara?.name ?? ""}?`}
      descricao="Você continua no projeto como Editor."
      rotuloConfirmar="Transferir"
      destrutivo={false}
      aoConfirmar={() => {
        const alvo = transferindoPara;
        if (!alvo) return;
        executar(() => transferir.mutateAsync(alvo.id), "Propriedade transferida.");
      }}
      aoFechar={() => setTransferindoPara(null)}
    />
    </>
  );
}
