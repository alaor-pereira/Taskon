import { Prisma, ProjectRole, TeamRole } from "@prisma/client";

/**
 * Filtros reutilizáveis de visibilidade.
 *
 * Toda listagem (sidebar, busca, Dashboard, Lixeira) monta sua consulta a partir
 * daqui, para que a permissão seja aplicada **no banco**. Filtrar em memória,
 * depois de trazer as linhas, vaza dados no total de registros e na paginação.
 *
 * ⚠ Vários destes filtros usam `OR` para expressar os caminhos de acesso.
 * Ao combiná-los com outra condição que também tenha `OR` — um termo de busca,
 * por exemplo —, use `AND: [filtro, { OR: [...] }]`. Espalhar o filtro e
 * acrescentar um `OR` ao lado sobrescreve a chave e **apaga a permissão**:
 *
 *   ✗ { ...projetosAtivosVisiveis(id), OR: [...] }   // vaza recursos alheios
 *   ✓ { AND: [projetosAtivosVisiveis(id), { OR: [...] }] }
 */

/** Projetos que o usuário enxerga: membro do projeto, ou GESTOR da equipe dona. */
export function projetosVisiveis(userId: string): Prisma.ProjectWhereInput {
  return {
    OR: [
      { members: { some: { userId } } },
      { team: { members: { some: { userId, role: TeamRole.GESTOR } } } },
    ],
  };
}

/** Idem, restrito ao que não está na Lixeira. É o padrão de quase toda tela. */
export function projetosAtivosVisiveis(userId: string): Prisma.ProjectWhereInput {
  return { deletedAt: null, ...projetosVisiveis(userId) };
}

/** Tarefas ativas dentro de projetos ativos que o usuário enxerga. */
export function tarefasVisiveis(userId: string): Prisma.TaskWhereInput {
  return {
    deletedAt: null,
    project: projetosAtivosVisiveis(userId),
  };
}

/** Equipes das quais o usuário participa, em qualquer papel. */
export function equipesVisiveis(userId: string): Prisma.TeamWhereInput {
  return { members: { some: { userId } } };
}

/**
 * "Equipes que Administro": é dono ou GESTOR.
 * "Equipes que Participo" é o complemento — ver `equipesQueParticipo`.
 */
export function equipesQueAdministro(userId: string): Prisma.TeamWhereInput {
  return {
    OR: [
      { ownerId: userId },
      { members: { some: { userId, role: TeamRole.GESTOR } } },
    ],
  };
}

/** Participa mas não administra: sem repetir o que já aparece na outra seção. */
export function equipesQueParticipo(userId: string): Prisma.TeamWhereInput {
  return {
    members: { some: { userId } },
    NOT: equipesQueAdministro(userId),
  };
}

/**
 * "Meus Projetos": projetos pessoais (sem equipe) que o usuário enxerga.
 *
 * A classificação não olha mais quem é o dono — só se o projeto pertence a
 * uma equipe ou não. Hoje um projeto pessoal só tem uma pessoa (convidar
 * gente pra um projeto sem equipe ainda não existe), então "pessoal" e
 * "uma pessoa só" coincidem na prática.
 */
export function meusProjetos(userId: string): Prisma.ProjectWhereInput {
  return { deletedAt: null, teamId: null, ...projetosVisiveis(userId) };
}

/**
 * "Projetos em equipe": qualquer projeto de uma equipe que o usuário enxerga,
 * independentemente de quem seja o dono — inclui os que chegam só pelo
 * GESTOR da equipe, sem membership explícita no projeto.
 */
export function projetosQueParticipo(userId: string): Prisma.ProjectWhereInput {
  return {
    deletedAt: null,
    teamId: { not: null },
    ...projetosVisiveis(userId),
  };
}

// --- Lixeira ---------------------------------------------------------------

/**
 * Projetos na Lixeira que o usuário pode restaurar.
 *
 * Quem vê e restaura é quem poderia ter excluído: o proprietário, ou o GESTOR
 * da equipe dona. Um EDITOR não deve sequer saber que o projeto foi excluído.
 */
export function projetosNaLixeira(userId: string): Prisma.ProjectWhereInput {
  return {
    deletedAt: { not: null },
    OR: [
      { members: { some: { userId, role: ProjectRole.OWNER } } },
      { team: { members: { some: { userId, role: TeamRole.GESTOR } } } },
    ],
  };
}

/**
 * Tarefas na Lixeira que o usuário pode restaurar.
 *
 * Só entram as excluídas individualmente: as que caíram junto com o projeto
 * voltam restaurando o projeto, senão existiria tarefa sem projeto. Por isso a
 * exigência de que o projeto esteja ativo.
 *
 * O direito de restaurar segue o de excluir: o proprietário restaura qualquer
 * uma, e o editor apenas as que ele mesmo criou.
 */
export function tarefasNaLixeira(userId: string): Prisma.TaskWhereInput {
  return {
    deletedAt: { not: null },
    // Subtarefas voltam com o pai, então não aparecem soltas na Lixeira.
    parentId: null,
    project: { deletedAt: null },
    OR: [
      {
        project: {
          OR: [
            { members: { some: { userId, role: ProjectRole.OWNER } } },
            { team: { members: { some: { userId, role: TeamRole.GESTOR } } } },
          ],
        },
      },
      {
        createdById: userId,
        project: projetosVisiveis(userId),
      },
    ],
  };
}
