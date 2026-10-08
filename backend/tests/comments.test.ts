import { ProjectRole } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../src/lib/errors.js";
import { prisma } from "../src/lib/prisma.js";
import {
  comentar,
  editarComentario,
  listarComentarios,
  mencionaveis,
  removerComentario,
} from "../src/modules/comments/comments.service.js";
import { criarTarefa } from "../src/modules/tasks/tasks.service.js";
import {
  adicionarAoProjeto,
  criarProjeto,
  criarUsuario,
  limparBanco,
} from "./factories.js";

beforeEach(limparBanco);

async function erroDe(fn: () => Promise<unknown>) {
  try {
    await fn();
    return null;
  } catch (erro) {
    return erro instanceof AppError ? erro : null;
  }
}

/** Cenário reaproveitado: projeto com dono, editor e visualizador. */
async function cenario() {
  const dono = await criarUsuario("Ana Souza");
  const editor = await criarUsuario("Bruno Lima");
  const viewer = await criarUsuario("Carla Dias");
  const projeto = await criarProjeto(dono.id);
  await adicionarAoProjeto(projeto.id, editor.id, ProjectRole.EDITOR);
  await adicionarAoProjeto(projeto.id, viewer.id, ProjectRole.VIEWER);
  const tarefa = await criarTarefa(dono.id, {
    projectId: projeto.id,
    title: "Tarefa comentada",
  });
  return { dono, editor, viewer, projeto, tarefa };
}

describe("permissão para comentar", () => {
  it("OWNER e EDITOR comentam", async () => {
    const { dono, editor, tarefa } = await cenario();

    expect(await comentar(dono.id, tarefa.id, "Do dono")).toBeTruthy();
    expect(await comentar(editor.id, tarefa.id, "Do editor")).toBeTruthy();
  });

  it("VIEWER lê mas não escreve", async () => {
    const { dono, viewer, tarefa } = await cenario();
    await comentar(dono.id, tarefa.id, "Visível a todos");

    expect((await erroDe(() => comentar(viewer.id, tarefa.id, "Posso?")))?.code).toBe(
      "SEM_PERMISSAO",
    );
    expect(await listarComentarios(viewer.id, tarefa.id)).toHaveLength(1);
  });

  it("quem não acessa o projeto não vê a discussão", async () => {
    const { tarefa } = await cenario();
    const estranho = await criarUsuario();

    expect((await erroDe(() => listarComentarios(estranho.id, tarefa.id)))?.code).toBe(
      "NAO_ENCONTRADO",
    );
  });
});

describe("editar e remover", () => {
  it("só o autor edita, e o texto fica marcado como editado", async () => {
    const { dono, editor, tarefa } = await cenario();
    const comentario = await comentar(editor.id, tarefa.id, "Versão inicial");

    expect(comentario.editedAt).toBeNull();

    const editado = await editarComentario(editor.id, comentario.id, "Corrigido");
    expect(editado.bodyMd).toBe("Corrigido");
    expect(editado.editedAt).not.toBeNull();

    // Nem o proprietário reescreve a fala de outra pessoa.
    expect(
      (await erroDe(() => editarComentario(dono.id, comentario.id, "Mudando")))?.code,
    ).toBe("SEM_PERMISSAO");
  });

  it("o autor remove o próprio; o OWNER modera os demais", async () => {
    const { dono, editor, tarefa } = await cenario();
    const doEditor = await comentar(editor.id, tarefa.id, "A");
    const doDono = await comentar(dono.id, tarefa.id, "B");

    expect((await erroDe(() => removerComentario(editor.id, doDono.id)))?.code).toBe(
      "SEM_PERMISSAO",
    );

    await removerComentario(dono.id, doEditor.id);
    await removerComentario(dono.id, doDono.id);
    expect(await listarComentarios(dono.id, tarefa.id)).toHaveLength(0);
  });

  it("comentário removido some da listagem, mas a linha permanece", async () => {
    const { dono, tarefa } = await cenario();
    const comentario = await comentar(dono.id, tarefa.id, "Some daqui");
    await removerComentario(dono.id, comentario.id);

    expect(await listarComentarios(dono.id, tarefa.id)).toHaveLength(0);
    expect(await prisma.comment.findUnique({ where: { id: comentario.id } }))
      .not.toBeNull();
  });
});

describe("@menções", () => {
  it("menciona por apelido do e-mail e notifica", async () => {
    const { dono, editor, tarefa } = await cenario();
    const apelido = editor.email.split("@")[0];

    const comentario = await comentar(
      dono.id,
      tarefa.id,
      `Pode revisar, @${apelido}?`,
    );

    expect(comentario.mentions.map((m) => m.user.id)).toEqual([editor.id]);
    expect(
      await prisma.notification.count({
        where: { userId: editor.id, type: "MENCAO_COMENTARIO" },
      }),
    ).toBe(1);
  });

  it("menciona pelo nome com ponto", async () => {
    const { dono, tarefa, editor } = await cenario();

    const comentario = await comentar(dono.id, tarefa.id, "Oi @bruno.lima");
    expect(comentario.mentions.map((m) => m.user.id)).toEqual([editor.id]);
  });

  it("ignora menção a quem não participa do projeto", async () => {
    const { dono, tarefa } = await cenario();
    const deFora = await criarUsuario("Estranho Silva");

    const comentario = await comentar(
      dono.id,
      tarefa.id,
      `Oi @${deFora.email.split("@")[0]}`,
    );

    // Notificar sobre algo que a pessoa não pode abrir seria pior do que
    // simplesmente ignorar a menção.
    expect(comentario.mentions).toHaveLength(0);
    expect(
      await prisma.notification.count({ where: { userId: deFora.id } }),
    ).toBe(0);
  });

  it("mencionar a si mesmo não gera notificação", async () => {
    const { dono, tarefa } = await cenario();
    await comentar(dono.id, tarefa.id, `Anotando @${dono.email.split("@")[0]}`);

    expect(
      await prisma.notification.count({
        where: { userId: dono.id, type: "MENCAO_COMENTARIO" },
      }),
    ).toBe(0);
  });

  it("editar recalcula as menções", async () => {
    const { dono, editor, viewer, tarefa } = await cenario();
    const comentario = await comentar(
      dono.id,
      tarefa.id,
      `@${editor.email.split("@")[0]}`,
    );

    const editado = await editarComentario(
      dono.id,
      comentario.id,
      `Agora é com @${viewer.email.split("@")[0]}`,
    );
    expect(editado.mentions.map((m) => m.user.id)).toEqual([viewer.id]);
  });

  it("os mencionáveis são exatamente os membros do projeto", async () => {
    const { dono, editor, viewer, tarefa } = await cenario();
    await criarUsuario("De Fora");

    const lista = await mencionaveis(dono.id, tarefa.id);
    expect(lista.map((u) => u.id).sort()).toEqual(
      [dono.id, editor.id, viewer.id].sort(),
    );
  });
});
