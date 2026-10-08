"use client";

import { Delete02Icon } from "@hugeicons/core-free-icons";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmarDialog } from "@/components/confirmar-dialog";
import { SeletorDePessoas } from "@/components/seletor-de-pessoas";
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { useIntegracaoGoogle } from "@/lib/queries/integracoes";
import { t } from "@/lib/messages";
import {
  useAtualizarEvento,
  useConvidaveis,
  useCriarEvento,
  useEvento,
  useExcluirEvento,
} from "@/lib/queries/calendar";
import type {
  EscopoDaAlteracao,
  Frequencia,
  Recorrencia,
  TipoDeEvento,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const FREQUENCIAS: Array<{ id: Frequencia | "NENHUMA"; rotulo: string }> = [
  { id: "NENHUMA", rotulo: "Não se repete" },
  { id: "DIARIA", rotulo: "Todos os dias" },
  { id: "SEMANAL", rotulo: "Toda semana" },
  { id: "MENSAL", rotulo: "Todo mês" },
  { id: "ANUAL", rotulo: "Todo ano" },
];

const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];
const NOMES_DOS_DIAS = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  kind: TipoDeEvento;
  /** Informado ao editar. */
  eventId?: string | null;
  /** Ocorrência clicada, necessária para alterar séries recorrentes. */
  ocorrencia?: string | null;
  /** Vínculo opcional, quando criado a partir de uma tarefa ou projeto. */
  taskId?: string | null;
  projectId?: string | null;
  /**
   * Início sugerido ao criar, vindo de um clique no calendário. Sem horário
   * (clique num dia da visão Mês), só a data é aproveitada.
   */
  inicioSugerido?: { data: Date; comHorario: boolean } | null;
}

/**
 * Criação e edição de atividades e reuniões.
 *
 * Ao alterar um evento que se repete, o sistema pergunta o alcance da mudança
 * — só esta, esta e as seguintes, ou todas —, como em qualquer agenda. Sem
 * essa escolha, alterar uma ocorrência mexeria na série inteira sem aviso.
 */
export function EventDialog({
  aberto,
  aoFechar,
  kind,
  eventId,
  ocorrencia,
  taskId,
  projectId,
  inicioSugerido,
}: Props) {
  const editando = Boolean(eventId);
  const { data: evento } = useEvento(aberto && eventId ? eventId : null);
  const { data: pessoas } = useConvidaveis(aberto && kind === "REUNIAO");
  const { data: sessao } = useSession();
  const meuId = sessao?.user.id;

  const criar = useCriarEvento();
  const atualizar = useAtualizarEvento();
  const excluir = useExcluirEvento();
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [local, setLocal] = useState("");
  const [data, setData] = useState("");
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [horaFim, setHoraFim] = useState("10:00");
  const [frequencia, setFrequencia] = useState<Frequencia | "NENHUMA">("NENHUMA");
  const [diasDaSemana, setDiasDaSemana] = useState<number[]>([]);
  const [termino, setTermino] = useState<"NUNCA" | "ATE" | "APOS">("NUNCA");
  const [ate, setAte] = useState("");
  const [repeticoes, setRepeticoes] = useState(10);
  const [participantes, setParticipantes] = useState<string[]>([]);
  const [escopo, setEscopo] = useState<EscopoDaAlteracao>("TODAS");
  const [meet, setMeet] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const seRepete = frequencia !== "NENHUMA";
  const eraRecorrente = Boolean(evento?.rrule);

  useEffect(() => {
    if (!aberto) return;

    if (evento) {
      const inicio = new Date(ocorrencia ?? evento.startsAt);
      const duracao =
        new Date(evento.endsAt).getTime() - new Date(evento.startsAt).getTime();
      const fim = new Date(inicio.getTime() + duracao);

      setTitle(evento.title);
      setDescription(evento.description ?? "");
      setLocal(evento.locationOrLink ?? "");
      setMeet(Boolean(evento.meetLink));
      setData(paraCampoData(inicio));
      setHoraInicio(paraCampoHora(inicio));
      setHoraFim(paraCampoHora(fim));
      setParticipantes(evento.participants.map((p) => p.user.id));
      setEscopo(evento.rrule ? "SO_ESTA" : "TODAS");
      // A regra em si não é reaberta para edição: alterar a repetição de uma
      // série existente é feito escolhendo "todas" e definindo-a de novo.
      setFrequencia("NENHUMA");
    } else if (!eventId) {
      const base = inicioSugerido?.data ?? new Date();
      setTitle("");
      setDescription("");
      setLocal("");
      setMeet(false);
      setData(paraCampoData(base));
      if (inicioSugerido?.comHorario) {
        setHoraInicio(paraCampoHora(base));
        setHoraFim(horaDoFimSugerido(base));
      } else {
        setHoraInicio("09:00");
        setHoraFim("10:00");
      }
      setFrequencia("NENHUMA");
      setDiasDaSemana([base.getDay()]);
      setTermino("NUNCA");
      setAte("");
      setRepeticoes(10);
      setParticipantes([]);
      setEscopo("TODAS");
    }
    setErro(null);
  }, [aberto, evento, eventId, ocorrencia, inicioSugerido]);

  /** Salvar nunca falha por causa do Google: o problema com o Meet vem como aviso. */
  function avisarResultado(aviso: string | null | undefined, sucesso: string) {
    if (aviso) toast.warning(`${sucesso} ${aviso}`);
    else toast.success(sucesso);
  }

  async function salvar() {
    setErro(null);

    if (!title.trim()) {
      setErro("Informe um título.");
      return;
    }
    if (!data) {
      setErro("Informe a data.");
      return;
    }

    const inicio = montarInstante(data, horaInicio);
    const fim = montarInstante(data, horaFim);
    if (fim <= inicio) {
      setErro("O término precisa ser depois do início.");
      return;
    }

    const recorrencia: Recorrencia | null = seRepete
      ? {
          frequencia: frequencia as Frequencia,
          ...(frequencia === "SEMANAL" &&
            diasDaSemana.length > 0 && { diasDaSemana }),
          termino:
            termino === "ATE" && ate
              ? { tipo: "ATE", data: ate }
              : termino === "APOS"
                ? { tipo: "APOS", ocorrencias: repeticoes }
                : { tipo: "NUNCA" },
        }
      : null;

    try {
      if (editando && evento) {
        const salvo = await atualizar.mutateAsync({
          eventId: evento.id,
          title: title.trim(),
          description: description.trim() || null,
          locationOrLink: local.trim() || null,
          startsAt: inicio.toISOString(),
          endsAt: fim.toISOString(),
          ...(seRepete && { recorrencia }),
          ...(eraRecorrente && {
            escopo,
            ocorrencia: ocorrencia ?? evento.startsAt,
          }),
          ...(kind === "REUNIAO" && { meet }),
        });
        avisarResultado(salvo.aviso, "Evento atualizado.");
      } else {
        const salvo = await criar.mutateAsync({
          kind,
          title: title.trim(),
          description: description.trim() || null,
          locationOrLink: local.trim() || null,
          startsAt: inicio.toISOString(),
          endsAt: fim.toISOString(),
          // O fuso do navegador é o que o usuário enxerga na tela.
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          recorrencia,
          taskId: taskId ?? null,
          projectId: projectId ?? null,
          ...(kind === "REUNIAO" && { participantIds: participantes, meet }),
        });
        avisarResultado(salvo.aviso, kind === "REUNIAO" ? "Reunião marcada." : "Atividade criada.");
      }
      aoFechar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : t.erros.generico);
    }
  }

  async function remover() {
    if (!evento) return;

    try {
      await excluir.mutateAsync({
        eventId: evento.id,
        ...(eraRecorrente && {
          escopo,
          ocorrencia: ocorrencia ?? evento.startsAt,
        }),
      });
      toast.success("Evento excluído.");
      aoFechar();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.erros.generico);
    }
  }

  const salvando = criar.isPending || atualizar.isPending;
  const ehReuniao = kind === "REUNIAO";

  return (
    <>
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editando
              ? ehReuniao
                ? "Reunião"
                : "Atividade"
              : ehReuniao
                ? "Nova reunião"
                : "Nova atividade"}
          </DialogTitle>
          <DialogDescription>
            {ehReuniao
              ? "Convide pessoas que dividem uma equipe com você."
              : "Atividades são pessoais e não são tarefas de projeto."}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-2">
            <Label htmlFor="evento-titulo">Título</Label>
            <Input
              id="evento-titulo"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={300}
              autoFocus={!editando}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3 *:min-w-0">
            <div className="space-y-2">
              <Label htmlFor="evento-data">Data</Label>
              <Input
                id="evento-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="evento-inicio">Início</Label>
              <Input
                id="evento-inicio"
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="evento-fim">Término</Label>
              <Input
                id="evento-fim"
                type="time"
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="evento-local">
              {ehReuniao ? "Local ou link" : "Local"}
            </Label>
            <Input
              id="evento-local"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              maxLength={500}
              placeholder={ehReuniao ? "Sala 2 ou endereço da chamada" : ""}
            />
          </div>

          {ehReuniao && (!editando || evento?.ownerId === meuId) && (
            <OpcaoDoMeet ligado={meet} aoMudar={setMeet} />
          )}

          {/* Repetição: ao editar uma série, só é redefinida no escopo "todas". */}
          {(!editando || (eraRecorrente && escopo === "TODAS")) && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="space-y-2">
                <Label htmlFor="evento-repeticao">Repetição</Label>
                <Select
                  value={frequencia}
                  onValueChange={(v) =>
                    setFrequencia((v as Frequencia | "NENHUMA") ?? "NENHUMA")
                  }
                  items={Object.fromEntries(FREQUENCIAS.map((f) => [f.id, f.rotulo]))}
                >
                  <SelectTrigger id="evento-repeticao">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIAS.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {frequencia === "SEMANAL" && (
                <div className="space-y-2">
                  <Label>Dias</Label>
                  <div className="flex gap-1">
                    {DIAS.map((letra, indice) => (
                      <button
                        key={indice}
                        type="button"
                        onClick={() =>
                          setDiasDaSemana((atual) =>
                            atual.includes(indice)
                              ? atual.filter((d) => d !== indice)
                              : [...atual, indice],
                          )
                        }
                        aria-label={NOMES_DOS_DIAS[indice]}
                        aria-pressed={diasDaSemana.includes(indice)}
                        className={cn(
                          "size-8 rounded-md border text-xs font-semibold transition-colors",
                          diasDaSemana.includes(indice)
                            ? "border-ring/40 bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-accent/50",
                        )}
                      >
                        {letra}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {seRepete && (
                <div className="space-y-2">
                  <Label htmlFor="evento-termino">Termina</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={termino}
                      onValueChange={(v) =>
                        setTermino((v as typeof termino) ?? "NUNCA")
                      }
                      items={{ NUNCA: "Nunca", ATE: "Em uma data", APOS: "Após N vezes" }}
                    >
                      <SelectTrigger id="evento-termino" className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NUNCA">Nunca</SelectItem>
                        <SelectItem value="ATE">Em uma data</SelectItem>
                        <SelectItem value="APOS">Após N vezes</SelectItem>
                      </SelectContent>
                    </Select>

                    {termino === "ATE" && (
                      <Input
                        type="date"
                        value={ate}
                        onChange={(e) => setAte(e.target.value)}
                        aria-label="Data de término"
                        className="w-40"
                      />
                    )}
                    {termino === "APOS" && (
                      <Input
                        type="number"
                        min={1}
                        max={1000}
                        value={repeticoes}
                        onChange={(e) => setRepeticoes(Number(e.target.value))}
                        aria-label="Número de repetições"
                        className="w-24"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {ehReuniao && pessoas && pessoas.length > 0 && (
            <div className="space-y-2">
              <Label>Participantes</Label>
              <SeletorDePessoas
                pessoas={pessoas}
                selecionados={participantes}
                aoMudar={setParticipantes}
                rotuloAdicionar="Adicionar participante"
                vazio="Ninguém convidado"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="evento-descricao">Descrição</Label>
            <Textarea
              id="evento-descricao"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={5000}
            />
          </div>

          {/* Escopo: só aparece quando a alteração pode afetar outras datas. */}
          {editando && eraRecorrente && (
            <>
              <Separator />
              <fieldset className="space-y-2">
                <legend className="heading-subtle">
                  Esta alteração vale para
                </legend>
                {(
                  ["SO_ESTA", "ESTA_E_SEGUINTES", "TODAS"] as EscopoDaAlteracao[]
                ).map((opcao) => (
                  <label
                    key={opcao}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="radio"
                      name="escopo"
                      checked={escopo === opcao}
                      onChange={() => setEscopo(opcao)}
                      className="size-4"
                    />
                    {rotuloDoEscopo(opcao)}
                  </label>
                ))}
              </fieldset>
            </>
          )}

          {erro && (
            <p role="alert" className="text-sm text-destructive">
              {erro}
            </p>
          )}
        </DialogBody>

        <DialogFooter className="sm:justify-between">
          {editando ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmandoExclusao(true)}
              disabled={excluir.isPending}
            >
              <Icone icon={Delete02Icon} />
              Excluir
            </Button>
          ) : (
            <span />
          )}

          <span className="flex gap-2">
            <Button variant="ghost" onClick={aoFechar}>
              {t.acoes.cancelar}
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {t.acoes.salvar}
            </Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <ConfirmarDialog
      aberto={confirmandoExclusao}
      titulo={
        eraRecorrente ? `Excluir ${rotuloDoEscopo(escopo)}?` : "Excluir este evento?"
      }
      descricao={
        ehReuniao
          ? "A reunião sai da agenda de todos os participantes."
          : "A atividade sai da sua agenda."
      }
      rotuloConfirmar="Excluir"
      aoConfirmar={remover}
      aoFechar={() => setConfirmandoExclusao(false)}
    />
    </>
  );
}

const rotuloDoEscopo = (escopo: EscopoDaAlteracao) =>
  ({
    SO_ESTA: "somente esta data",
    ESTA_E_SEGUINTES: "esta e as seguintes",
    TODAS: "todas as datas",
  })[escopo];

/** AAAA-MM-DD no fuso do navegador, que é o que o usuário vê na tela. */
function paraCampoData(data: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
}

function paraCampoHora(data: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(data.getHours())}:${p(data.getMinutes())}`;
}

/**
 * Uma hora depois do início, sem passar para o dia seguinte: o formulário tem
 * uma data só, e um término "00:30" ficaria antes do início.
 */
function horaDoFimSugerido(inicio: Date): string {
  const fim = new Date(inicio.getTime() + 60 * 60_000);
  return fim.getDate() === inicio.getDate() ? paraCampoHora(fim) : "23:59";
}

/** Junta data e hora locais num instante real. */
function montarInstante(data: string, hora: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);
  return new Date(ano!, (mes ?? 1) - 1, dia ?? 1, h ?? 0, m ?? 0);
}

/**
 * Link do Google Meet: só o organizador gera, pela própria agenda Google. Sem
 * a integração, só orienta — conectar daqui levaria ao Google e perderia o
 * que já foi preenchido.
 */
function OpcaoDoMeet({ ligado, aoMudar }: { ligado: boolean; aoMudar: (v: boolean) => void }) {
  const { data: integracao } = useIntegracaoGoogle();
  if (!integracao?.disponivel) return null;
  const ativa = integracao.conectada && integracao.status === "ATIVA";

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor="evento-meet">Link do Google Meet</Label>
        <p className="text-xs text-muted-foreground">
          {ativa
            ? "Gerado pela sua agenda Google ao salvar, e visível a todos os participantes."
            : "Conecte o Google Agenda (na Agenda ou em Configurações) para gerar links do Meet."}
        </p>
      </div>
      {ativa && <Switch id="evento-meet" checked={ligado} onCheckedChange={aoMudar} />}
    </div>
  );
}
