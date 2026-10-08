import { ProjectRole, TeamRole } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { excluirProjeto } from "../src/modules/projects/projects.service.js";
import { criarTarefa, excluirTarefa } from "../src/modules/tasks/tasks.service.js";
import { buscar } from "../src/modules/search/search.service.js";
import {
  adicionarAEquipe,
  adicionarAoProjeto,
  criarEquipe,
  criarProjeto,
  criarUsuario,
  limparBanco,
} from "./factories.js";

beforeEach(limparBanco);

describe("o que a busca encontra", () => {
  it("acha projeto, tarefa e equipe, agrupados por tipo", async () => {
    const usuario = await criarUsuario();
    const equipe = await criarEquipe(usuario.id, "Equipe Relatórios");
    const projeto = await criarProjeto(usuario.id, {
      nome: "Relatórios gerenciais",
      teamId: equipe.id,
    });
    await criarTarefa(usuario.id, {
      projectId: projeto.id,
      title: "Montar relatório mensal",
    });

    const r = await buscar(usuario.id, "relat");
    expect(r.projetos).toHaveLength(1);
    expect(r.tarefas).toHaveLength(1);
    expect(r.equipes).toHaveLength(1);
    expect(r.total).toBe(3);
  });

  it("acha pedaço de palavra, e não só a palavra inteira", async () => {
    const usuario = await criarUsuario();
    const projeto = await criarProjeto(usuario.id, { nome: "Faturamento" });
    await criarTarefa(usuario.id, { projectId: projeto.id, title: "x" });

    // Quem digita na barra lateral escreve pedaços; full-text casaria só
    // palavras inteiras já radicalizadas.
    expect((await buscar(usuario.id, "turam")).projetos).toHaveLength(1);
  });

  it("ignora maiúsculas e minúsculas", async () => {
    const usuario = await criarUsuario();
    await criarProjeto(usuario.id, { nome: "Sistema ERP" });

    expect((await buscar(usuario.id, "erp")).projetos).toHaveLength(1);
    expect((await buscar(usuario.id, "ERP")).projetos).toHaveLength(1);
  });

  it("procura também na descrição", async () => {
    const usuario = await criarUsuario();
    const projeto = await criarProjeto(usuario.id, { nome: "Projeto X" });
    await prisma.project.update({
      where: { id: projeto.id },
      data: { description: "Integração com o banco central" },
    });

    expect((await buscar(usuario.id, "banco central")).projetos).toHaveLength(1);
  });

  it("termo curto demais não devolve nada", async () => {
    const usuario = await criarUsuario();
    await criarProjeto(usuario.id, { nome: "Alguma coisa" });

    // Uma letra casaria com quase tudo e não ajudaria ninguém.
    expect((await buscar(usuario.id, "a")).total).toBe(0);
    expect((await buscar(usuario.id, "   ")).total).toBe(0);
  });
});

describe("a busca respeita a permissão", () => {
  it("não encontra projeto de outra pessoa", async () => {
    const eu = await criarUsuario();
    const outro = await criarUsuario();
    await criarProjeto(outro.id, { nome: "Projeto Secreto" });

    expect((await buscar(eu.id, "secreto")).total).toBe(0);
  });

  it("não encontra tarefa de projeto sem acesso", async () => {
    const eu = await criarUsuario();
    const outro = await criarUsuario();
    const alheio = await criarProjeto(outro.id, { nome: "Alheio" });
    await criarTarefa(outro.id, {
      projectId: alheio.id,
      title: "Tarefa confidencial",
    });

    expect((await buscar(eu.id, "confidencial")).tarefas).toHaveLength(0);
  });

  it("estar na equipe não faz achar projeto do qual não participo", async () => {
    const gestor = await criarUsuario();
    const membro = await criarUsuario();
    const equipe = await criarEquipe(gestor.id);
    await adicionarAEquipe(equipe.id, membro.id, TeamRole.MEMBRO);
    await criarProjeto(gestor.id, {
      nome: "Estratégia interna",
      teamId: equipe.id,
    });

    expect((await buscar(membro.id, "estratégia")).projetos).toHaveLength(0);
  });

  it("encontra depois de ser incluído no projeto", async () => {
    const dono = await criarUsuario();
    const convidado = await criarUsuario();
    const projeto = await criarProjeto(dono.id, { nome: "Migração de dados" });
    await adicionarAoProjeto(projeto.id, convidado.id, ProjectRole.VIEWER);

    expect((await buscar(convidado.id, "migração")).projetos).toHaveLength(1);
  });

  it("não encontra equipe da qual não participo", async () => {
    const eu = await criarUsuario();
    const outro = await criarUsuario();
    await criarEquipe(outro.id, "Diretoria");

    expect((await buscar(eu.id, "diretoria")).equipes).toHaveLength(0);
  });
});

describe("a busca ignora a Lixeira", () => {
  it("projeto excluído não aparece", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id, { nome: "Projeto Arquivado" });
    await excluirProjeto(dono.id, projeto.id);

    expect((await buscar(dono.id, "arquivado")).projetos).toHaveLength(0);
  });

  it("tarefa excluída não aparece", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    const tarefa = await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Tarefa descartada",
    });
    await excluirTarefa(dono.id, tarefa.id);

    expect((await buscar(dono.id, "descartada")).tarefas).toHaveLength(0);
  });

  it("tarefa de projeto excluído também não aparece", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    await criarTarefa(dono.id, { projectId: projeto.id, title: "Some junto" });
    await excluirProjeto(dono.id, projeto.id);

    expect((await buscar(dono.id, "some junto")).tarefas).toHaveLength(0);
  });
});
