import { ViewMode, ViewPage } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import {
  definirVisualizacaoDaPagina,
  obterVisualizacaoDaPagina,
} from "../src/modules/preferences/view-preferences.service.js";
import { criarUsuario, limparBanco } from "./factories.js";

beforeEach(limparBanco);

describe("visualização das páginas de listagem", () => {
  it("sem escolha salva, devolve nulo para o cliente usar o padrão", async () => {
    const ana = await criarUsuario("Ana");
    expect(await obterVisualizacaoDaPagina(ana.id, ViewPage.TODOS_PROJETOS)).toBeNull();
  });

  it("guarda a escolha e a substitui na troca seguinte", async () => {
    const ana = await criarUsuario("Ana");

    await definirVisualizacaoDaPagina(ana.id, ViewPage.TODAS_TAREFAS, ViewMode.KANBAN);
    expect(await obterVisualizacaoDaPagina(ana.id, ViewPage.TODAS_TAREFAS)).toBe(
      ViewMode.KANBAN,
    );

    await definirVisualizacaoDaPagina(ana.id, ViewPage.TODAS_TAREFAS, ViewMode.CARDS);
    expect(await obterVisualizacaoDaPagina(ana.id, ViewPage.TODAS_TAREFAS)).toBe(
      ViewMode.CARDS,
    );
  });

  it("cada página tem a sua escolha", async () => {
    const ana = await criarUsuario("Ana");

    await definirVisualizacaoDaPagina(ana.id, ViewPage.TODOS_PROJETOS, ViewMode.LISTA);

    expect(await obterVisualizacaoDaPagina(ana.id, ViewPage.TODOS_PROJETOS)).toBe(
      ViewMode.LISTA,
    );
    expect(await obterVisualizacaoDaPagina(ana.id, ViewPage.TODAS_TAREFAS)).toBeNull();
  });

  it("a escolha de um usuário não vale para outro", async () => {
    const ana = await criarUsuario("Ana");
    const bruno = await criarUsuario("Bruno");

    await definirVisualizacaoDaPagina(ana.id, ViewPage.TODOS_PROJETOS, ViewMode.KANBAN);

    expect(await obterVisualizacaoDaPagina(bruno.id, ViewPage.TODOS_PROJETOS)).toBeNull();
  });
});
