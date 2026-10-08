import { Prisma } from "@prisma/client";
import {
  equipesVisiveis,
  projetosAtivosVisiveis,
  tarefasVisiveis,
} from "../../authorization/scopes.js";
import { prisma } from "../../lib/prisma.js";

/**
 * Busca da barra lateral.
 *
 * Procura em projetos, tarefas e equipes, por título e descrição, e agrupa o
 * resultado por tipo. Itens da Lixeira ficam de fora.
 *
 * O filtro de permissão é o mesmo usado nas listagens e é aplicado **no banco**.
 * Buscar primeiro e filtrar depois vazaria informação na contagem de
 * resultados, mesmo que as linhas alheias nunca fossem exibidas.
 *
 * A comparação é por `ILIKE` em vez de `to_tsvector`. Full-text casa palavras
 * inteiras já radicalizadas, e quem digita na busca da barra lateral costuma
 * escrever pedaços ("relat" para "relatório"). O custo do `ILIKE` com curinga
 * à esquerda é resolvido pelos índices GIN de trigrama criados na migração.
 */

/** Abaixo de dois caracteres, qualquer termo devolveria quase tudo. */
const MINIMO_DE_CARACTERES = 2;
const LIMITE_POR_TIPO = 8;

export interface ResultadoDaBusca {
  termo: string;
  projetos: Array<{
    id: string;
    name: string;
    description: string | null;
    isInbox: boolean;
    team: { id: string; name: string } | null;
  }>;
  tarefas: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    project: { id: string; name: string };
  }>;
  equipes: Array<{ id: string; name: string; description: string | null }>;
  total: number;
}

export async function buscar(
  userId: string,
  termo: string,
  limite = LIMITE_POR_TIPO,
): Promise<ResultadoDaBusca> {
  const busca = termo.trim();

  if (busca.length < MINIMO_DE_CARACTERES) {
    return { termo: busca, projetos: [], tarefas: [], equipes: [], total: 0 };
  }

  const contem: Prisma.StringFilter = {
    contains: busca,
    mode: "insensitive",
  };

  /**
   * Permissão e termo são combinados com `AND`, e nunca por espalhamento.
   *
   * Os filtros de visibilidade usam `OR` para expressar os caminhos de acesso.
   * Espalhar esse objeto e acrescentar outro `OR` — o dos campos pesquisados —
   * sobrescreveria a chave e apagaria a permissão, devolvendo recursos alheios.
   */
  const [projetos, tarefas, equipes] = await Promise.all([
    prisma.project.findMany({
      where: {
        AND: [
          projetosAtivosVisiveis(userId),
          { OR: [{ name: contem }, { description: contem }] },
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
        isInbox: true,
        team: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: limite,
    }),

    prisma.task.findMany({
      where: {
        AND: [
          tarefasVisiveis(userId),
          { OR: [{ title: contem }, { description: contem }] },
        ],
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: limite,
    }),

    prisma.team.findMany({
      where: {
        AND: [
          equipesVisiveis(userId),
          { OR: [{ name: contem }, { description: contem }] },
        ],
      },
      select: { id: true, name: true, description: true },
      orderBy: { name: "asc" },
      take: limite,
    }),
  ]);

  return {
    termo: busca,
    projetos,
    tarefas,
    equipes,
    total: projetos.length + tarefas.length + equipes.length,
  };
}
