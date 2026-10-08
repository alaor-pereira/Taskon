import {
  closestCenter,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from "@dnd-kit/core";

/** Prefixo do id das colunas droppable ("coluna:BACKLOG"). */
export const PREFIXO_COLUNA = "coluna:";

/**
 * Detecção de alvo dos Kanbans: vale onde o ponteiro está.
 *
 * O `closestCorners` comparava os cantos do cartão com os de cada droppable;
 * numa coluna alta os cantos ficam longe, e o card de uma coluna vizinha
 * "ganhava" — soltar na parte vazia de uma coluna não funcionava.
 *
 * - Ponteiro sobre um cartão: o alvo é o cartão (reordena).
 * - Ponteiro na coluna, no vão entre cartões: o cartão mais próximo dela.
 * - Ponteiro na coluna, abaixo do último cartão (ou coluna vazia): a coluna,
 *   que significa "fim da lista".
 * - Ponteiro fora de tudo (entre colunas): o que o cartão arrastado cobre.
 *
 * Cartões ordenáveis precisam de `data: { status }` para serem reconhecidos
 * como da coluna.
 */
export const colisaoDoKanban: CollisionDetection = (args) => {
  const sobPonteiro = pointerWithin(args);
  const colisoes = sobPonteiro.length > 0 ? sobPonteiro : rectIntersection(args);
  if (colisoes.length === 0) return [];

  const cartao = colisoes.find((c) => !String(c.id).startsWith(PREFIXO_COLUNA));
  if (cartao) return [cartao];

  const coluna = colisoes[0];
  const ponteiro = args.pointerCoordinates;
  if (!ponteiro) return [coluna];

  const status = String(coluna.id).slice(PREFIXO_COLUNA.length);
  const cartoesDaColuna = args.droppableContainers.filter(
    (c) => c.id !== args.active.id && c.data.current?.status === status,
  );
  const fundoDosCartoes = Math.max(
    ...cartoesDaColuna.map((c) => args.droppableRects.get(c.id)?.bottom ?? -Infinity),
  );
  if (cartoesDaColuna.length === 0 || ponteiro.y > fundoDosCartoes) return [coluna];

  return closestCenter({ ...args, droppableContainers: cartoesDaColuna });
};
