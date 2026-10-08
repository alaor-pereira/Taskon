import { ProjectRole, TeamRole } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../src/lib/errors.js";
import { prisma } from "../src/lib/prisma.js";
import { excluirProjeto } from "../src/modules/projects/projects.service.js";
import { criarTarefa, excluirTarefa } from "../src/modules/tasks/tasks.service.js";
import {
  esvaziarLixeira,
  excluirEmLoteDefinitivamente,
  excluirProjetoDefinitivamente,
  listarLixeira,
  purgarLixeiraAntiga,
  restaurarEmLote,
  restaurarProjeto,
  restaurarTarefa,
} from "../src/modules/trash/trash.service.js";
import {
  adicionarAEquipe,
  adicionarAoProjeto,
  criarEquipe,
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

describe("o que aparece na Lixeira", () => {
  it("o proprietário vê o próprio projeto excluído", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    await excluirProjeto(dono.id, projeto.id);

    const { projetos, totais } = await listarLixeira(dono.id);
    expect(projetos.map((p) => p.id)).toEqual([projeto.id]);
    expect(totais.projetos).toBe(1);
  });

  it("o EDITOR não vê o projeto excluído: ele nem poderia excluí-lo", async () => {
    const dono = await criarUsuario();
    const editor = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    await adicionarAoProjeto(projeto.id, editor.id, ProjectRole.EDITOR);
    await excluirProjeto(dono.id, projeto.id);

    expect((await listarLixeira(editor.id)).projetos).toHaveLength(0);
  });

  it("o GESTOR da equipe vê os projetos excluídos dela", async () => {
    const gestor = await criarUsuario();
    const membro = await criarUsuario();
    const equipe = await criarEquipe(gestor.id);
    await adicionarAEquipe(equipe.id, membro.id, TeamRole.MEMBRO);
    const projeto = await criarProjeto(membro.id, { teamId: equipe.id });
    await excluirProjeto(membro.id, projeto.id);

    expect((await listarLixeira(gestor.id)).projetos.map((p) => p.id)).toEqual([
      projeto.id,
    ]);
  });

  it("tarefas de projeto excluído não aparecem soltas", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    await criarTarefa(dono.id, { projectId: projeto.id, title: "Vai junto" });
    await excluirProjeto(dono.id, projeto.id);

    // Elas voltam restaurando o projeto: sozinhas, ficariam sem onde morar.
    const { projetos, tarefas } = await listarLixeira(dono.id);
    expect(projetos).toHaveLength(1);
    expect(tarefas).toHaveLength(0);
  });

  it("tarefa excluída sozinha aparece, e a subtarefa não vem solta", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    const pai = await criarTarefa(dono.id, { projectId: projeto.id, title: "Pai" });
    await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Filha",
      parentId: pai.id,
    });
    await excluirTarefa(dono.id, pai.id);

    const { tarefas } = await listarLixeira(dono.id);
    expect(tarefas.map((t) => t.id)).toEqual([pai.id]);
  });

  it("o EDITOR vê na Lixeira as tarefas que ele mesmo criou", async () => {
    const dono = await criarUsuario();
    const editor = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    await adicionarAoProjeto(projeto.id, editor.id, ProjectRole.EDITOR);

    const dele = await criarTarefa(editor.id, {
      projectId: projeto.id,
      title: "Do editor",
    });
    const doDono = await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Do dono",
    });
    await excluirTarefa(editor.id, dele.id);
    await excluirTarefa(dono.id, doDono.id);

    // Ele pode excluir só as próprias, então só essas pode restaurar.
    const { tarefas } = await listarLixeira(editor.id);
    expect(tarefas.map((t) => t.id)).toEqual([dele.id]);
  });
});

describe("restaurar projeto", () => {
  it("devolve só as tarefas do mesmo lote", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    const junto = await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Vai junto",
    });
    const antes = await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Excluída antes",
    });

    await excluirTarefa(dono.id, antes.id);
    await excluirProjeto(dono.id, projeto.id);

    const { tarefasRestauradas } = await restaurarProjeto(dono.id, projeto.id);
    expect(tarefasRestauradas).toBe(1);

    expect((await prisma.task.findUnique({ where: { id: junto.id } }))?.deletedAt)
      .toBeNull();
    // A que já estava descartada continua descartada: restaurar o projeto não
    // é um pedido para desfazer tudo.
    expect((await prisma.task.findUnique({ where: { id: antes.id } }))?.deletedAt)
      .not.toBeNull();
  });

  it("o projeto restaurado volta às listagens", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    await excluirProjeto(dono.id, projeto.id);
    await restaurarProjeto(dono.id, projeto.id);

    const atual = await prisma.project.findUnique({ where: { id: projeto.id } });
    expect(atual?.deletedAt).toBeNull();
    expect(atual?.deletionBatchId).toBeNull();
    expect((await listarLixeira(dono.id)).projetos).toHaveLength(0);
  });

  it("quem não pode excluir não pode restaurar", async () => {
    const dono = await criarUsuario();
    const editor = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    await adicionarAoProjeto(projeto.id, editor.id, ProjectRole.EDITOR);
    await excluirProjeto(dono.id, projeto.id);

    expect((await erroDe(() => restaurarProjeto(editor.id, projeto.id)))?.code).toBe(
      "NAO_ENCONTRADO",
    );
  });
});

describe("restaurar tarefa", () => {
  it("traz as subtarefas do mesmo lote", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    const pai = await criarTarefa(dono.id, { projectId: projeto.id, title: "Pai" });
    const filha = await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Filha",
      parentId: pai.id,
    });

    await excluirTarefa(dono.id, pai.id);
    await restaurarTarefa(dono.id, pai.id);

    expect((await prisma.task.findUnique({ where: { id: filha.id } }))?.deletedAt)
      .toBeNull();
  });

  it("tarefa de projeto excluído orienta a restaurar o projeto", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    const tarefa = await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Presa",
    });
    await excluirProjeto(dono.id, projeto.id);

    const erro = await erroDe(() => restaurarTarefa(dono.id, tarefa.id));
    expect(erro?.code).toBe("REGRA_DE_NEGOCIO");
    expect(erro?.message).toContain("Restaure o projeto");
  });
});

describe("exclusão definitiva e purga", () => {
  it("excluir de vez remove o projeto e suas tarefas", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    const tarefa = await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Some junto",
    });
    await excluirProjeto(dono.id, projeto.id);

    await excluirProjetoDefinitivamente(dono.id, projeto.id);

    expect(await prisma.project.findUnique({ where: { id: projeto.id } })).toBeNull();
    expect(await prisma.task.findUnique({ where: { id: tarefa.id } })).toBeNull();
  });

  it("a purga apaga o que passou de 30 dias e poupa o resto", async () => {
    const dono = await criarUsuario();
    const antigo = await criarProjeto(dono.id);
    const recente = await criarProjeto(dono.id);

    await excluirProjeto(dono.id, antigo.id);
    await excluirProjeto(dono.id, recente.id);

    const trintaEUmDiasAtras = new Date();
    trintaEUmDiasAtras.setDate(trintaEUmDiasAtras.getDate() - 31);
    await prisma.project.update({
      where: { id: antigo.id },
      data: { deletedAt: trintaEUmDiasAtras },
    });

    const resultado = await purgarLixeiraAntiga();
    expect(resultado.projetosApagados).toBe(1);

    expect(await prisma.project.findUnique({ where: { id: antigo.id } })).toBeNull();
    expect(await prisma.project.findUnique({ where: { id: recente.id } })).not.toBeNull();
  });

  it("a purga não toca no que está ativo", async () => {
    const dono = await criarUsuario();
    const ativo = await criarProjeto(dono.id);

    await purgarLixeiraAntiga();
    expect(await prisma.project.findUnique({ where: { id: ativo.id } })).not.toBeNull();
  });
});

describe("lotes e esvaziar", () => {
  it("restaura projetos e tarefas juntos, e aponta o que falhou", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    const outro = await criarProjeto(dono.id);
    const tarefa = await criarTarefa(dono.id, { projectId: outro.id, title: "Volta" });
    await excluirProjeto(dono.id, projeto.id);
    await excluirTarefa(dono.id, tarefa.id);

    // Um id que não está na Lixeira não derruba o resto do lote.
    const inexistente = "00000000-0000-4000-8000-000000000000";
    const resultado = await restaurarEmLote(dono.id, {
      projetos: [projeto.id],
      tarefas: [tarefa.id, inexistente],
    });

    expect(resultado.projetos).toEqual([projeto.id]);
    expect(resultado.tarefas).toEqual([tarefa.id]);
    expect(resultado.falhas).toEqual([
      expect.objectContaining({ tipo: "tarefa", id: inexistente }),
    ]);
    const { totais } = await listarLixeira(dono.id);
    expect(totais).toEqual({ projetos: 0, tarefas: 0 });
  });

  it("exclusão em lote respeita a permissão de cada item", async () => {
    const dono = await criarUsuario();
    const intruso = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    await excluirProjeto(dono.id, projeto.id);

    const resultado = await excluirEmLoteDefinitivamente(intruso.id, {
      projetos: [projeto.id],
      tarefas: [],
    });

    expect(resultado.projetos).toHaveLength(0);
    expect(resultado.falhas).toHaveLength(1);
    expect(await prisma.project.findUnique({ where: { id: projeto.id } })).not.toBeNull();
  });

  it("esvaziar apaga só a Lixeira de quem pediu", async () => {
    const eu = await criarUsuario();
    const outro = await criarUsuario();
    const meu = await criarProjeto(eu.id);
    const ativo = await criarProjeto(eu.id);
    const tarefa = await criarTarefa(eu.id, { projectId: ativo.id, title: "Descartada" });
    const deOutro = await criarProjeto(outro.id);
    await excluirProjeto(eu.id, meu.id);
    await excluirTarefa(eu.id, tarefa.id);
    await excluirProjeto(outro.id, deOutro.id);

    const resultado = await esvaziarLixeira(eu.id);

    expect(resultado).toEqual({ projetosApagados: 1, tarefasApagadas: 1 });
    expect(await prisma.task.findUnique({ where: { id: tarefa.id } })).toBeNull();
    expect(await prisma.project.findUnique({ where: { id: ativo.id } })).not.toBeNull();
    expect(await prisma.project.findUnique({ where: { id: deOutro.id } })).not.toBeNull();
  });
});
