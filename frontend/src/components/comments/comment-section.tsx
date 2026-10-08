"use client";

import {
  AtIcon,
  Cancel01Icon,
  Delete02Icon,
  PencilEdit02Icon,
  SentIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { ConfirmarDialog } from "@/components/confirmar-dialog";
import { iniciais } from "@/components/tasks/task-badges";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icone } from "@/components/ui/icone";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { dataEHora, hora, mesmoDia, rotuloDoDia, tempoRelativo } from "@/lib/datas";
import { t } from "@/lib/messages";
import {
  useComentar,
  useComentarios,
  useEditarComentario,
  useMencionaveis,
  useRemoverComentario,
} from "@/lib/queries/comments";
import type { Comentario, Mencionavel, PapelProjeto } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Comentários de uma tarefa, como uma conversa.
 *
 * As mensagens próprias ficam à direita, em destaque; as dos outros, à
 * esquerda, com avatar e nome. Mensagens seguidas da mesma pessoa se agrupam
 * — nome e avatar só na primeira —, e um separador marca a troca de dia, como
 * em qualquer app de mensagens.
 *
 * A conversa fica ancorada embaixo, junto do campo: a mais recente é a última.
 * Editar leva o texto de volta ao campo de escrita; mencionar é pelo `@`, com
 * uma lista de membros que se filtra enquanto se digita.
 *
 * Lista cronológica, sem fios. O Visualizador acompanha a conversa sem poder
 * escrever; o autor edita e remove o próprio, e o proprietário modera os demais.
 *
 * Em telas largas o painel ocupa a altura toda, com a lista rolando sozinha e
 * o campo de escrita preso embaixo; em telas estreitas ele só empilha.
 */
export function CommentSection({
  taskId,
  meuPapel,
  ownerId,
}: {
  taskId: string;
  meuPapel?: PapelProjeto;
  ownerId?: string;
}) {
  const { data: comentarios, isPending } = useComentarios(taskId);
  const { data: sessao } = useSession();
  const remover = useRemoverComentario(taskId);
  const lista = useRef<HTMLDivElement>(null);
  /** Quem rolou para cima para ler não é arrastado de volta por mensagem nova. */
  const pertoDoFim = useRef(true);

  const [editando, setEditando] = useState<Comentario | null>(null);
  const [removendo, setRemovendo] = useState<Comentario | null>(null);

  const podeComentar = meuPapel === "OWNER" || meuPapel === "EDITOR";
  const meuId = sessao?.user?.id;
  const souProprietario = meuId === ownerId;
  const quantidade = comentarios?.length ?? 0;
  const autorDaUltima = comentarios?.at(-1)?.author.id;

  // Abre na mensagem mais recente e acompanha as novas — se a pessoa já
  // estava no fim ou se a nova é dela. Só rola a própria lista: em tela
  // estreita quem rola é a página.
  useEffect(() => {
    const el = lista.current;
    if (!el) return;
    if (pertoDoFim.current || autorDaUltima === meuId) el.scrollTop = el.scrollHeight;
  }, [quantidade, autorDaUltima, meuId]);

  async function removerComentario(comentario: Comentario) {
    try {
      await remover.mutateAsync(comentario.id);
      if (editando?.id === comentario.id) setEditando(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.erros.generico);
    }
  }

  return (
    <section
      aria-label="Comentários"
      className="flex min-h-0 flex-col lg:h-full"
    >
      <header className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
        <h2 className="heading-section">Comentários</h2>
        <span className="text-sm text-muted-foreground">{quantidade}</span>
      </header>

      <div
        ref={lista}
        onScroll={(e) => {
          const el = e.currentTarget;
          pertoDoFim.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4"
      >
        {isPending ? (
          <div className="mt-auto space-y-3">
            <div className="h-12 w-3/4 animate-pulse rounded-2xl bg-muted" />
            <div className="ml-auto h-10 w-2/3 animate-pulse rounded-2xl bg-muted" />
          </div>
        ) : comentarios && comentarios.length > 0 ? (
          // `mt-auto` ancora a conversa embaixo, junto do campo de escrita.
          <ol className="mt-auto flex flex-col">
            {comentarios.map((comentario, i) => {
              const anterior = comentarios[i - 1];
              const novoDia =
                !anterior || !mesmoDia(anterior.createdAt, comentario.createdAt);
              const continuacao =
                !novoDia && anterior?.author.id === comentario.author.id;
              return (
                <Fragment key={comentario.id}>
                  {novoDia && (
                    <li
                      role="separator"
                      className={cn("flex justify-center", i > 0 ? "mt-5 mb-3" : "mb-3")}
                    >
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
                        {rotuloDoDia(comentario.createdAt)}
                      </span>
                    </li>
                  )}
                  <li
                    // Mais perto dentro do grupo, mais longe entre pessoas.
                    className={cn(!novoDia && (continuacao ? "mt-1" : "mt-4"))}
                  >
                    <Mensagem
                      comentario={comentario}
                      minha={comentario.author.id === meuId}
                      primeiraDoGrupo={!continuacao}
                      podeRemover={comentario.author.id === meuId || souProprietario}
                      emEdicao={editando?.id === comentario.id}
                      aoEditar={() => setEditando(comentario)}
                      aoRemover={() => setRemovendo(comentario)}
                    />
                  </li>
                </Fragment>
              );
            })}
          </ol>
        ) : (
          <p className="m-auto py-8 text-center text-sm text-muted-foreground">
            Nenhum comentário ainda.
          </p>
        )}
      </div>

      <footer className="shrink-0 border-t p-3">
        {podeComentar ? (
          <Composicao
            taskId={taskId}
            editando={editando}
            aoTerminarEdicao={() => setEditando(null)}
          />
        ) : (
          <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            Seu papel neste projeto permite acompanhar a conversa, mas não escrever.
          </p>
        )}
      </footer>

      <ConfirmarDialog
        aberto={Boolean(removendo)}
        titulo="Remover este comentário?"
        descricao="Ele sai da conversa para todos e não dá para desfazer."
        rotuloConfirmar="Remover"
        aoConfirmar={() => removendo && removerComentario(removendo)}
        aoFechar={() => setRemovendo(null)}
      />
    </section>
  );
}

const DICA_DE_ENVIO = "Enter envia · Shift+Enter quebra a linha";

/** O termo de menção que o servidor reconhece: o e-mail antes do @, já recortado por ele. */
const apelido = (u: Mencionavel) => u.apelido;

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Até 6 membros cujo nome ou apelido contém o que foi digitado após o @. */
function filtrarMencionaveis(membros: Mencionavel[], termo: string) {
  const busca = semAcento(termo);
  return membros
    .filter((u) => semAcento(u.name).includes(busca) || apelido(u).includes(busca))
    .slice(0, 6);
}

/**
 * Campo de escrita, numa caixa só: o texto cresce de uma linha até umas seis,
 * com "@" e enviar dentro dela. Enter envia, Shift+Enter quebra a linha.
 *
 * Também serve para editar: a mensagem volta ao campo, sob a faixa "Editando
 * mensagem", e o rascunho que estava ali é guardado e devolvido no fim.
 */
function Composicao({
  taskId,
  editando,
  aoTerminarEdicao,
}: {
  taskId: string;
  editando: Comentario | null;
  aoTerminarEdicao: () => void;
}) {
  const comentar = useComentar(taskId);
  const editar = useEditarComentario(taskId);
  const { data: mencionaveis } = useMencionaveis(taskId);
  const campo = useRef<HTMLTextAreaElement>(null);
  const idDaLista = useId();
  const idDaDica = useId();

  const [texto, setTexto] = useState("");
  const [rascunho, setRascunho] = useState("");
  /** `@termo` sendo digitado: onde começa e o que vem depois do @. */
  const [mencao, setMencao] = useState<{ inicio: number; termo: string } | null>(null);
  const [ativo, setAtivo] = useState(0);

  // Entrar e sair da edição troca o conteúdo do campo. Comparar pelo id: a
  // mesma mensagem chega como objeto novo a cada recarga da lista.
  const idEditando = editando?.id ?? null;
  const [idAnterior, setIdAnterior] = useState<string | null>(null);
  if (idEditando !== idAnterior) {
    setIdAnterior(idEditando);
    if (editando) {
      if (idAnterior === null) setRascunho(texto);
      setTexto(editando.bodyMd);
    } else {
      setTexto(rascunho);
    }
    setMencao(null);
  }

  useEffect(() => {
    if (!idEditando) return;
    const el = campo.current;
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
  }, [idEditando]);

  const sugestoes = mencao ? filtrarMencionaveis(mencionaveis ?? [], mencao.termo) : [];
  const listaAberta = sugestoes.length > 0;
  const indiceAtivo = Math.min(ativo, sugestoes.length - 1);
  const ocupado = comentar.isPending || editar.isPending;

  async function enviar(evento?: FormEvent) {
    evento?.preventDefault();
    const corpo = texto.trim();
    if (!corpo || ocupado) return;

    try {
      if (editando) {
        await editar.mutateAsync({ commentId: editando.id, bodyMd: corpo });
        aoTerminarEdicao();
      } else {
        await comentar.mutateAsync(corpo);
        setTexto("");
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.erros.generico);
    }
  }

  /** Há um `@termo` logo antes do cursor? Então a lista de membros abre. */
  function lerMencao(valor: string, cursor: number) {
    const achado = /(^|\s)@([\w.+-]*)$/.exec(valor.slice(0, cursor));
    const termo = achado?.[2];
    setMencao(termo === undefined ? null : { inicio: cursor - termo.length - 1, termo });
    setAtivo(0);
  }

  function posicionarCursor(posicao: number) {
    requestAnimationFrame(() => {
      campo.current?.focus();
      campo.current?.setSelectionRange(posicao, posicao);
    });
  }

  /** Troca o `@termo` digitado pelo apelido que o servidor reconhece. */
  function escolher(usuario: Mencionavel) {
    if (!mencao) return;
    const fim = mencao.inicio + 1 + mencao.termo.length;
    const insercao = `@${apelido(usuario)} `;
    setTexto(texto.slice(0, mencao.inicio) + insercao + texto.slice(fim));
    setMencao(null);
    posicionarCursor(mencao.inicio + insercao.length);
  }

  /** Botão "@": insere o @ no cursor e abre a lista. */
  function inserirArroba() {
    const posicao = campo.current?.selectionStart ?? texto.length;
    const antes = texto.slice(0, posicao);
    const espaco = antes && !/\s$/.test(antes) ? " " : "";
    const cursor = posicao + espaco.length + 1;
    setTexto(`${antes}${espaco}@${texto.slice(posicao)}`);
    setMencao({ inicio: cursor - 1, termo: "" });
    setAtivo(0);
    posicionarCursor(cursor);
  }

  function aoTeclar(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Durante a composição de acentos (IME), o Enter confirma o caractere.
    if (e.nativeEvent.isComposing) return;

    if (listaAberta) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const passo = e.key === "ArrowDown" ? 1 : -1;
        setAtivo((indiceAtivo + passo + sugestoes.length) % sugestoes.length);
        return;
      }
      if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
        e.preventDefault();
        escolher(sugestoes[indiceAtivo]!);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMencao(null);
        return;
      }
    }

    if (e.key === "Escape" && editando) {
      e.preventDefault();
      aoTerminarEdicao();
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void enviar();
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-2">
      {editando && (
        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-xs">
          <Icone icon={PencilEdit02Icon} className="size-3.5 text-link" aria-hidden />
          <span className="flex-1 font-medium">Editando mensagem</span>
          <button
            type="button"
            onClick={aoTerminarEdicao}
            aria-label="Cancelar edição"
            className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring"
          >
            <Icone icon={Cancel01Icon} className="size-3.5" />
          </button>
        </div>
      )}

      <div className="relative">
        {listaAberta && (
          <ul
            id={idDaLista}
            role="listbox"
            aria-label="Mencionar"
            className="absolute inset-x-0 bottom-full z-10 mb-2 max-h-60 overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-border"
          >
            {sugestoes.map((usuario, i) => (
              <li
                key={usuario.id}
                id={`${idDaLista}-${i}`}
                role="option"
                aria-selected={i === indiceAtivo}
                // mousedown, não click: o campo não pode perder o foco.
                onMouseDown={(e) => {
                  e.preventDefault();
                  escolher(usuario);
                }}
                onMouseEnter={() => setAtivo(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                  i === indiceAtivo && "bg-accent text-accent-foreground",
                )}
              >
                <Avatar className="size-6 shrink-0">
                  {usuario.image && <AvatarImage src={usuario.image} alt="" />}
                  <AvatarFallback className="text-[10px]">
                    {iniciais(usuario.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate">{usuario.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  @{apelido(usuario)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-end gap-1 rounded-2xl border bg-background p-1 transition-colors focus-within:border-ring dark:bg-input/30">
          <Textarea
            ref={campo}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              lerMencao(e.target.value, e.target.selectionStart);
            }}
            onClick={(e) =>
              lerMencao(e.currentTarget.value, e.currentTarget.selectionStart)
            }
            onBlur={() => setMencao(null)}
            onKeyDown={aoTeclar}
            rows={1}
            maxLength={10000}
            placeholder="Escreva um comentário… (@ menciona)"
            aria-label={editando ? "Editar comentário" : "Novo comentário"}
            aria-describedby={idDaDica}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={listaAberta}
            aria-controls={listaAberta ? idDaLista : undefined}
            aria-activedescendant={listaAberta ? `${idDaLista}-${indiceAtivo}` : undefined}
            className="max-h-40 min-h-0 flex-1 resize-none border-0 bg-transparent px-2.5 py-1.5 text-sm shadow-none focus-visible:outline-none dark:bg-transparent"
          />

          <button
            type="button"
            onClick={inserirArroba}
            aria-label="Mencionar alguém"
            title="Mencionar alguém"
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring"
          >
            <Icone icon={AtIcon} className="size-4" />
          </button>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="submit"
                  size="icon-sm"
                  aria-label={editando ? "Salvar edição" : "Enviar comentário"}
                  disabled={!texto.trim() || ocupado}
                />
              }
            >
              <Icone icon={editando ? Tick02Icon : SentIcon} />
            </TooltipTrigger>
            <TooltipContent>{DICA_DE_ENVIO}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <span id={idDaDica} className="sr-only">
        {DICA_DE_ENVIO}. Digite @ para mencionar alguém.
      </span>
    </form>
  );
}

/**
 * Um balão da conversa. Nome e avatar só aparecem na primeira mensagem de
 * um grupo, e nunca nas próprias — é óbvio quem as escreveu.
 */
function Mensagem({
  comentario,
  minha,
  primeiraDoGrupo,
  podeRemover,
  emEdicao,
  aoEditar,
  aoRemover,
}: {
  comentario: Comentario;
  minha: boolean;
  primeiraDoGrupo: boolean;
  podeRemover: boolean;
  /** A mensagem está aberta no campo de escrita. */
  emEdicao: boolean;
  aoEditar: () => void;
  aoRemover: () => void;
}) {
  // Ações no hover ou com foco de teclado — `focus-within` as deixaria presas
  // depois de um clique.
  const acoes = (minha || podeRemover) && (
    <span className="flex shrink-0 gap-0.5 self-center opacity-0 transition-opacity group-hover/msg:opacity-100 has-focus-visible:opacity-100">
      {minha && (
        <AcaoDaMensagem rotulo="Editar comentário" onClick={aoEditar}>
          <Icone icon={PencilEdit02Icon} className="size-3.5" />
        </AcaoDaMensagem>
      )}
      {podeRemover && (
        <AcaoDaMensagem rotulo="Remover comentário" onClick={aoRemover}>
          <Icone icon={Delete02Icon} className="size-3.5" />
        </AcaoDaMensagem>
      )}
    </span>
  );

  return (
    <article
      className={cn("group/msg flex items-start gap-2", minha && "justify-end")}
      aria-label={`${comentario.author.name}, ${tempoRelativo(comentario.createdAt)}`}
    >
      {!minha &&
        (primeiraDoGrupo ? (
          <Avatar className="mt-0.5 size-7 shrink-0">
            {comentario.author.image && (
              <AvatarImage src={comentario.author.image} alt="" />
            )}
            <AvatarFallback className="text-[10px]">
              {iniciais(comentario.author.name)}
            </AvatarFallback>
          </Avatar>
        ) : (
          // Mantém o balão alinhado aos de cima quando o avatar não se repete.
          <span aria-hidden className="w-7 shrink-0" />
        ))}

      {minha && acoes}

      <div
        className={cn(
          "min-w-0 max-w-[85%] rounded-2xl px-3 py-2 transition-shadow",
          minha
            ? "rounded-tr-md bg-primary/10 ring-1 ring-primary/15"
            : "rounded-tl-md bg-muted",
          // A ponta "colada" só na primeira; as seguintes ficam arredondadas.
          !primeiraDoGrupo && (minha ? "rounded-tr-2xl" : "rounded-tl-2xl"),
          emEdicao && "ring-2 ring-primary",
        )}
      >
        {!minha && primeiraDoGrupo && (
          <p className="mb-0.5 text-xs font-semibold">{comentario.author.name}</p>
        )}
        <CorpoDoComentario texto={comentario.bodyMd} />
        <p
          className="mt-1 text-right text-[10px] text-muted-foreground"
          title={dataEHora(comentario.createdAt)}
        >
          {hora(comentario.createdAt)}
          {comentario.editedAt && " · editado"}
        </p>
      </div>

      {!minha && acoes}
    </article>
  );
}

function AcaoDaMensagem({
  rotulo,
  onClick,
  children,
}: {
  rotulo: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring"
    >
      {children}
    </button>
  );
}

/**
 * Corpo do comentário.
 *
 * O texto é exibido como está, sem interpretar HTML — só as menções ganham
 * destaque. Renderizar Markdown completo exigiria sanitização para não abrir
 * caminho a injeção de conteúdo.
 */
function CorpoDoComentario({ texto }: { texto: string }) {
  const partes = texto.split(/(@[\w.+-]+(?:@[\w.-]+\.\w+)?)/g);

  return (
    <p className="text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">
      {partes.map((parte, i) =>
        parte.startsWith("@") ? (
          <span key={i} className="rounded bg-primary/10 px-1 font-semibold text-link">
            {parte}
          </span>
        ) : (
          <span key={i}>{parte}</span>
        ),
      )}
    </p>
  );
}
