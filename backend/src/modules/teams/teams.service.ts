import { TeamRole } from "@prisma/client";
import { authorizeTeam, resolveTeamContext } from "../../authorization/authorize.js";
import {
  equipesQueAdministro,
  equipesQueParticipo,
} from "../../authorization/scopes.js";
import { registrarAtividade } from "../../lib/activity-log.js";
import { naoEncontrado, regraDeNegocio, semPermissao } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { nomeDoAutor, notificar } from "../notifications/notifications.service.js";

/**
 * Equipes.
 *
 * A equipe agrupa pessoas e governa quem pode criar projetos nela. Ela **não**
 * concede acesso ao conteúdo dos projetos: isso vem de `project_members`, com a
 * única exceção do GESTOR, que tem acesso administrativo.
 */

const selecaoMembro = {
  id: true,
  role: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true, image: true } },
} as const;

// --- Leitura ---------------------------------------------------------------

export async function listarEquipes(userId: string) {
  const [administro, participo] = await Promise.all([
    prisma.team.findMany({
      where: equipesQueAdministro(userId),
      orderBy: { name: "asc" },
      include: { _count: { select: { members: true, projects: true } } },
    }),
    prisma.team.findMany({
      where: equipesQueParticipo(userId),
      orderBy: { name: "asc" },
      include: { _count: { select: { members: true, projects: true } } },
    }),
  ]);

  return { administro, participo };
}

export async function obterEquipe(userId: string, teamId: string) {
  const ctx = await authorizeTeam(userId, teamId, "equipe.ver");

  const membros = await prisma.teamMember.findMany({
    where: { teamId },
    select: selecaoMembro,
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  return {
    equipe: ctx.team,
    membros,
    meuPapel: ctx.role,
    souDono: ctx.isOwner,
  };
}

// --- Escrita ---------------------------------------------------------------

export async function criarEquipe(
  userId: string,
  dados: { name: string; description?: string },
) {
  const equipe = await prisma.$transaction(async (tx) => {
    const criada = await tx.team.create({
      data: {
        name: dados.name,
        description: dados.description ?? null,
        ownerId: userId,
        // Invariante: o criador é dono e também GESTOR em team_members, para
        // que a autorização consulte uma tabela só.
        members: { create: { userId, role: TeamRole.GESTOR } },
      },
    });

    await registrarAtividade(
      { entityType: "EQUIPE", entityId: criada.id, actorId: userId, action: "CRIADO", after: { name: criada.name } },
      tx,
    );

    return criada;
  });

  return equipe;
}

export async function atualizarEquipe(
  userId: string,
  teamId: string,
  dados: { name?: string; description?: string | null },
) {
  const ctx = await authorizeTeam(userId, teamId, "equipe.editar");

  const atualizada = await prisma.$transaction(async (tx) => {
    const resultado = await tx.team.update({
      where: { id: teamId },
      data: {
        ...(dados.name !== undefined && { name: dados.name }),
        ...(dados.description !== undefined && { description: dados.description }),
      },
    });

    await registrarAtividade(
      {
        entityType: "EQUIPE",
        entityId: teamId,
        actorId: userId,
        action: "ATUALIZADO",
        before: { name: ctx.team.name, description: ctx.team.description },
        after: { name: resultado.name, description: resultado.description },
      },
      tx,
    );

    return resultado;
  });

  return atualizada;
}

export async function alterarPapelDeMembro(
  userId: string,
  teamId: string,
  membroId: string,
  novoPapel: TeamRole,
) {
  const ctx = await authorizeTeam(userId, teamId, "equipe.membros.gerenciar");

  const membro = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: membroId } },
  });
  if (!membro) throw naoEncontrado("Membro");

  // Gestores têm o mesmo poder entre si; se um pudesse rebaixar o outro (ou
  // promover um aliado), uma conta de gestor comprometida tomaria a equipe.
  // Por isso só o dono cria, rebaixa ou altera Gestores.
  if (
    (membro.role === TeamRole.GESTOR || novoPapel === TeamRole.GESTOR) &&
    ctx.team.ownerId !== userId
  ) {
    throw semPermissao("alterar o papel de um Gestor; só o dono da equipe pode");
  }

  // O dono responde pela equipe: rebaixá-lo deixaria a equipe sem quem a
  // administre, contrariando a regra de que ela nunca fica sem dono.
  if (ctx.team.ownerId === membroId && novoPapel !== TeamRole.GESTOR) {
    throw regraDeNegocio(
      "O dono da equipe não pode deixar de ser Gestor. Transfira a propriedade antes.",
    );
  }

  if (membro.role === novoPapel) return membro;

  const atualizado = await prisma.$transaction(async (tx) => {
    const resultado = await tx.teamMember.update({
      where: { teamId_userId: { teamId, userId: membroId } },
      data: { role: novoPapel },
    });

    await registrarAtividade(
      {
        entityType: "EQUIPE",
        entityId: teamId,
        actorId: userId,
        action: "PAPEL_ALTERADO",
        before: { userId: membroId, role: membro.role },
        after: { userId: membroId, role: novoPapel },
      },
      tx,
    );

    return resultado;
  });

  // O papel decide o que a pessoa pode fazer na equipe: vale avisar.
  if (membroId !== userId) {
    await notificar({
      userId: membroId,
      type: "CONVITE_EQUIPE",
      payload: {
        evento: "PAPEL_ALTERADO",
        teamId,
        teamName: ctx.team.name,
        role: novoPapel,
        autorNome: await nomeDoAutor(userId),
      },
    });
  }

  return atualizado;
}

/**
 * Remove alguém da equipe.
 *
 * Como projeto de equipe só aceita membros dela, sair da equipe implica sair de
 * todos os seus projetos — na mesma transação, para não existir um instante em
 * que a pessoa está fora da equipe mas ainda dentro dos projetos.
 */
export async function removerMembro(
  userId: string,
  teamId: string,
  membroId: string,
) {
  const souEu = userId === membroId;
  const ctx = souEu
    ? await resolveTeamContext(userId, teamId)
    : await authorizeTeam(userId, teamId, "equipe.membros.gerenciar");

  if (!ctx) throw naoEncontrado("Equipe");

  if (ctx.team.ownerId === membroId) {
    throw regraDeNegocio(
      "O dono não pode sair nem ser removido. Transfira a propriedade da equipe antes.",
    );
  }

  const membro = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: membroId } },
  });
  if (!membro) throw naoEncontrado("Membro");

  // Mesma regra de alterarPapelDeMembro: um Gestor não remove outro.
  if (!souEu && membro.role === TeamRole.GESTOR && ctx.team.ownerId !== userId) {
    throw semPermissao("remover um Gestor; só o dono da equipe pode");
  }

  // Sair deixaria projetos sem dono, então a saída é bloqueada até a
  // propriedade ser transferida — mesma lógica aplicada à equipe.
  const projetosQuePossui = await prisma.project.count({
    where: { teamId, ownerId: membroId, deletedAt: null },
  });
  if (projetosQuePossui > 0) {
    throw regraDeNegocio(
      projetosQuePossui === 1
        ? "Esta pessoa é dona de 1 projeto da equipe. Transfira a propriedade antes de removê-la."
        : `Esta pessoa é dona de ${projetosQuePossui} projetos da equipe. Transfira a propriedade antes de removê-la.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    const projetosDaEquipe = await tx.project.findMany({
      where: { teamId },
      select: { id: true },
    });
    const idsDeProjeto = projetosDaEquipe.map((p) => p.id);

    if (idsDeProjeto.length > 0) {
      await tx.projectMember.deleteMany({
        where: { userId: membroId, projectId: { in: idsDeProjeto } },
      });

      // Deixa de ser responsável pelas tarefas desses projetos. As tarefas
      // continuam existindo: o trabalho não some junto com a pessoa.
      await tx.taskAssignee.deleteMany({
        where: { userId: membroId, task: { projectId: { in: idsDeProjeto } } },
      });
    }

    await tx.teamMember.delete({
      where: { teamId_userId: { teamId, userId: membroId } },
    });

    await registrarAtividade(
      {
        entityType: "EQUIPE",
        entityId: teamId,
        actorId: userId,
        action: "MEMBRO_REMOVIDO",
        before: { userId: membroId, role: membro.role },
        after: { projetosPerdidos: idsDeProjeto.length },
      },
      tx,
    );
  });

  if (!souEu) {
    await notificar({
      userId: membroId,
      type: "CONVITE_EQUIPE",
      payload: {
        evento: "REMOVIDO_DA_EQUIPE",
        teamId,
        teamName: ctx.team.name,
        autorNome: await nomeDoAutor(userId),
      },
    });
  }
}

export async function transferirPropriedade(
  userId: string,
  teamId: string,
  novoDonoId: string,
) {
  const ctx = await authorizeTeam(userId, teamId, "equipe.propriedade.transferir");

  if (novoDonoId === ctx.team.ownerId) {
    throw regraDeNegocio("Esta pessoa já é a dona da equipe.");
  }

  const novoDono = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: novoDonoId } },
  });
  if (!novoDono) {
    throw regraDeNegocio("A propriedade só pode ser transferida a um membro da equipe.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.team.update({
      where: { id: teamId },
      data: { ownerId: novoDonoId },
    });

    // O dono é sempre GESTOR, então a promoção acompanha a transferência.
    await tx.teamMember.update({
      where: { teamId_userId: { teamId, userId: novoDonoId } },
      data: { role: TeamRole.GESTOR },
    });

    await registrarAtividade(
      {
        entityType: "EQUIPE",
        entityId: teamId,
        actorId: userId,
        action: "PROPRIEDADE_TRANSFERIDA",
        before: { ownerId: ctx.team.ownerId },
        after: { ownerId: novoDonoId },
      },
      tx,
    );
  });

  await notificar({
    userId: novoDonoId,
    type: "CONVITE_EQUIPE",
    payload: {
      evento: "PROPRIEDADE_RECEBIDA",
      teamId,
      teamName: ctx.team.name,
      autorNome: await nomeDoAutor(userId),
    },
  });
}

/**
 * Exclui a equipe.
 *
 * Só é permitido quando não restam projetos ativos. Decidir sozinho o destino
 * do trabalho de outras pessoas — apagar junto ou converter em pessoal — seria
 * arriscado demais, então o sistema exige que o usuário resolva antes.
 */
export async function excluirEquipe(userId: string, teamId: string) {
  const ctx = await authorizeTeam(userId, teamId, "equipe.excluir");

  const projetosAtivos = await prisma.project.count({
    where: { teamId, deletedAt: null },
  });
  if (projetosAtivos > 0) {
    throw regraDeNegocio(
      projetosAtivos === 1
        ? "A equipe ainda tem 1 projeto ativo. Exclua ou transfira o projeto antes."
        : `A equipe ainda tem ${projetosAtivos} projetos ativos. Exclua ou transfira os projetos antes.`,
    );
  }

  const membros = await prisma.teamMember.findMany({
    where: { teamId },
    select: { userId: true },
  });

  await prisma.$transaction(async (tx) => {
    // Projetos na Lixeira não impedem a exclusão, mas também não são apagados
    // junto: destruir o que ainda era recuperável seria um efeito colateral
    // que o usuário não pediu. Eles são desvinculados e passam a ser projetos
    // pessoais de seus donos, que seguem podendo restaurá-los.
    const desvinculados = await tx.project.updateMany({
      where: { teamId, deletedAt: { not: null } },
      data: { teamId: null },
    });

    await registrarAtividade(
      {
        entityType: "EQUIPE",
        entityId: teamId,
        actorId: userId,
        action: "EXCLUIDO",
        before: { name: ctx.team.name },
        after: { projetosDesvinculados: desvinculados.count },
      },
      tx,
    );

    // A equipe não tem Lixeira: o prompt só prevê restauração de projetos e
    // tarefas. A exclusão é definitiva, e a interface confirma antes.
    await tx.team.delete({ where: { id: teamId } });
  });

  const autorNome = await nomeDoAutor(userId);
  for (const { userId: membroId } of membros) {
    if (membroId === userId) continue;
    await notificar({
      userId: membroId,
      type: "CONVITE_EQUIPE",
      payload: { evento: "EQUIPE_EXCLUIDA", teamName: ctx.team.name, autorNome },
    });
  }
}
