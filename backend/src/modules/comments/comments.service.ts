import {
  authorizeProject,
  garantirEdicaoDeComentario,
  garantirRemocaoDeComentario,
  resolveProjectContext,
} from "../../authorization/authorize.js";
import { registrarAtividade } from "../../lib/activity-log.js";
import { naoEncontrado } from "../../lib/errors.js";
import { prisma, type PrismaTx } from "../../lib/prisma.js";
import {
  nomeDoAutor,
  notificarComentariosAgrupados,
  notificarVarios,
} from "../notifications/notifications.service.js";

/**
 * Comentários em tarefas.
 *
 * Lista cronológica, sem fios: um nível só de conversa é mais fácil de ler e
 * evita discussões que se perdem em ramificações. O VISUALIZADOR acompanha sem
 * escrever.
 */

const selecaoDoComentario = {
  id: true,
  taskId: true,
  bodyMd: true,
  editedAt: true,
  createdAt: true,
  author: { select: { id: true, name: true, image: true } },
  mentions: { select: { user: { select: { id: true, name: true } } } },
} as const;

async function carregarTarefa(taskId: string) {
  const tarefa = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
    select: { id: true, projectId: true, title: true },
  });
  if (!tarefa) throw naoEncontrado("Tarefa");
  return tarefa;
}

// --- Leitura ---------------------------------------------------------------

export async function listarComentarios(userId: string, taskId: string) {
  const tarefa = await carregarTarefa(taskId);
  // Quem enxerga a tarefa enxerga a discussão dela, no mesmo papel.
  await authorizeProject(userId, tarefa.projectId, "projeto.ver");

  return prisma.comment.findMany({
    where: { taskId, deletedAt: null },
    select: selecaoDoComentario,
    orderBy: { createdAt: "asc" },
  });
}

// --- Escrita ---------------------------------------------------------------

export async function comentar(
  userId: string,
  taskId: string,
  bodyMd: string,
) {
  const tarefa = await carregarTarefa(taskId);
  const ctx = await authorizeProject(userId, tarefa.projectId, "comentario.criar");

  // Só membros do projeto podem ser mencionados: citar quem não tem acesso
  // geraria uma notificação sobre algo que a pessoa não pode abrir.
  const mencionados = await resolverMencoes(tarefa.projectId, bodyMd);

  const comentario = await prisma.$transaction(async (tx) => {
    const criado = await tx.comment.create({
      data: {
        taskId,
        authorId: userId,
        bodyMd,
        ...(mencionados.length > 0 && {
          mentions: { create: mencionados.map((id) => ({ userId: id })) },
        }),
      },
      select: selecaoDoComentario,
    });

    await registrarAtividade(
      {
        entityType: "COMENTARIO",
        entityId: criado.id,
        projectId: tarefa.projectId,
        actorId: userId,
        action: "CRIADO",
        after: { taskId },
      },
      tx,
    );

    return criado;
  });

  const autorNome = await nomeDoAutor(userId);

  await notificarVarios(
    mencionados,
    {
      type: "MENCAO_COMENTARIO",
      payload: {
        taskId,
        taskTitle: tarefa.title,
        commentId: comentario.id,
        projectName: ctx.project.name,
        autorNome,
      },
    },
    // Mencionar a si mesmo não gera aviso.
    userId,
  );

  // Quem cuida da tarefa (responsáveis e quem a criou) fica sabendo da
  // conversa mesmo sem ser citado. Quem foi mencionado já recebeu o aviso
  // de menção — um só aviso por pessoa.
  const interessados = await interessadosNaTarefa(taskId, tarefa.projectId);
  await notificarComentariosAgrupados(
    interessados.filter((id) => !mencionados.includes(id)),
    { taskId, taskTitle: tarefa.title, projectName: ctx.project.name, autorNome },
    userId,
  );

  return comentario;
}

/**
 * Responsáveis e criador da tarefa que ainda participam do projeto: quem saiu
 * não deve ser avisado de algo que não pode mais abrir.
 */
async function interessadosNaTarefa(taskId: string, projectId: string) {
  const tarefa = await prisma.task.findUnique({
    where: { id: taskId },
    select: { createdById: true, assignees: { select: { userId: true } } },
  });
  if (!tarefa) return [];

  const candidatos = [...tarefa.assignees.map((a) => a.userId), tarefa.createdById];
  const membros = await prisma.projectMember.findMany({
    where: { projectId, userId: { in: candidatos } },
    select: { userId: true },
  });
  return membros.map((m) => m.userId);
}

export async function editarComentario(
  userId: string,
  commentId: string,
  bodyMd: string,
) {
  const comentario = await prisma.comment.findFirst({
    where: { id: commentId, deletedAt: null },
    include: {
      task: { select: { projectId: true, title: true } },
      mentions: { select: { userId: true } },
    },
  });
  if (!comentario) throw naoEncontrado("Comentário");

  const ctx = await authorizeProject(userId, comentario.task.projectId, "projeto.ver");
  // Editar é sempre do autor, sem exceção nem para o proprietário: reescrever
  // a fala de outra pessoa seria falsificar o histórico.
  garantirEdicaoDeComentario(comentario, userId);

  const mencionados = await resolverMencoes(comentario.task.projectId, bodyMd);

  const atualizado = await prisma.$transaction(async (tx) => {
    await tx.commentMention.deleteMany({ where: { commentId } });

    return tx.comment.update({
      where: { id: commentId },
      data: {
        bodyMd,
        // A marca de "editado" deixa claro que o texto mudou depois de lido.
        editedAt: new Date(),
        ...(mencionados.length > 0 && {
          mentions: { create: mencionados.map((id) => ({ userId: id })) },
        }),
      },
      select: selecaoDoComentario,
    });
  });

  // Só quem passou a ser citado nesta edição: quem já estava foi avisado.
  const jaMencionados = new Set(comentario.mentions.map((m) => m.userId));
  await notificarVarios(
    mencionados.filter((id) => !jaMencionados.has(id)),
    {
      type: "MENCAO_COMENTARIO",
      payload: {
        taskId: comentario.taskId,
        taskTitle: comentario.task.title,
        commentId,
        projectName: ctx.project.name,
        autorNome: await nomeDoAutor(userId),
      },
    },
    userId,
  );

  return atualizado;
}

export async function removerComentario(userId: string, commentId: string) {
  const comentario = await prisma.comment.findFirst({
    where: { id: commentId, deletedAt: null },
    include: { task: { select: { projectId: true } } },
  });
  if (!comentario) throw naoEncontrado("Comentário");

  const ctx = await resolveProjectContext(userId, comentario.task.projectId);
  if (!ctx) throw naoEncontrado("Comentário");
  // O autor remove o próprio; o proprietário modera os demais.
  garantirRemocaoDeComentario(ctx, comentario, userId);

  await prisma.comment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });
}

// --- Menções ---------------------------------------------------------------

/** Captura @nome.sobrenome e @email no corpo do comentário. */
const PADRAO_DE_MENCAO = /@([\w.+-]+(?:@[\w.-]+\.\w+)?)/g;

/**
 * Traduz as menções escritas no texto em usuários do projeto.
 *
 * A busca aceita o e-mail inteiro ou a parte antes do @, que é o que as
 * pessoas costumam digitar. Menções a quem não participa do projeto são
 * simplesmente ignoradas.
 */
async function resolverMencoes(
  projectId: string,
  bodyMd: string,
  db: PrismaTx = prisma,
): Promise<string[]> {
  const termos = [...bodyMd.matchAll(PADRAO_DE_MENCAO)].map((m) =>
    m[1]!.toLowerCase(),
  );
  if (termos.length === 0) return [];

  const membros = await db.projectMember.findMany({
    where: { projectId },
    select: { user: { select: { id: true, name: true, email: true } } },
  });

  const encontrados = new Set<string>();
  for (const termo of termos) {
    for (const { user } of membros) {
      const email = user.email.toLowerCase();
      const apelido = email.split("@")[0] ?? "";
      const nomeCompacto = user.name.toLowerCase().replace(/\s+/g, ".");

      if (termo === email || termo === apelido || termo === nomeCompacto) {
        encontrados.add(user.id);
      }
    }
  }

  return [...encontrados];
}

/** Candidatos para o seletor de @menção na interface. */
export async function mencionaveis(userId: string, taskId: string) {
  const tarefa = await carregarTarefa(taskId);
  await authorizeProject(userId, tarefa.projectId, "projeto.ver");

  const membros = await prisma.projectMember.findMany({
    where: { projectId: tarefa.projectId },
    select: { user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { user: { name: "asc" } },
  });

  // A interface só precisa do apelido (o que vem antes do @, que é o termo de
  // menção reconhecido acima); o e-mail inteiro não sai do servidor.
  return membros.map(({ user: { email, ...pessoa } }) => ({
    ...pessoa,
    apelido: email.split("@")[0] ?? "",
  }));
}
