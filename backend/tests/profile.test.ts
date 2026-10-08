import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import {
  obterAvatar,
  removerAvatar,
  resumoDoPerfil,
  salvarAvatar,
  TAMANHO_MAXIMO_DO_AVATAR,
} from "../src/modules/profile/profile.service.js";
import { criarProjeto, criarTarefa, criarUsuario, limparBanco } from "./factories.js";

beforeEach(limparBanco);

/** Data URL de uma imagem com `bytes` bytes (o conteúdo não importa aqui). */
const dataUrl = (mime: string, bytes = 64) =>
  `data:${mime};base64,${Buffer.alloc(bytes, 7).toString("base64")}`;

async function concluirAtribuida(projectId: string, criadorId: string, responsavelId: string) {
  const tarefa = await criarTarefa(projectId, criadorId);
  await prisma.task.update({
    where: { id: tarefa.id },
    data: {
      status: TaskStatus.CONCLUIDO,
      completedAt: new Date(),
      assignees: { create: { userId: responsavelId } },
    },
  });
  return tarefa;
}

describe("resumo do perfil", () => {
  it("conta tarefas concluídas em que é responsável e projetos concluídos de que é membro", async () => {
    const ana = await criarUsuario("Ana");
    const bruno = await criarUsuario("Bruno");
    const projeto = await criarProjeto(ana.id);
    const caixa = await criarProjeto(ana.id, { isInbox: true });
    const deOutro = await criarProjeto(bruno.id);

    await concluirAtribuida(projeto.id, ana.id, ana.id);
    await concluirAtribuida(projeto.id, ana.id, ana.id);
    // Concluída, mas de outra pessoa: não conta para Ana.
    await concluirAtribuida(deOutro.id, bruno.id, bruno.id);
    // Na lixeira: não conta.
    const apagada = await concluirAtribuida(projeto.id, ana.id, ana.id);
    await prisma.task.update({ where: { id: apagada.id }, data: { deletedAt: new Date() } });
    // Atribuída a Ana, mas ainda aberta: não conta.
    const aberta = await criarTarefa(projeto.id, ana.id);
    await prisma.taskAssignee.create({ data: { taskId: aberta.id, userId: ana.id } });

    await prisma.project.updateMany({
      where: { id: { in: [projeto.id, caixa.id, deOutro.id] } },
      data: { status: TaskStatus.CONCLUIDO },
    });

    const resumo = await resumoDoPerfil(ana.id);
    expect(resumo.tarefasConcluidas).toBe(2);
    // A Caixa de entrada e o projeto de Bruno ficam de fora.
    expect(resumo.projetosConcluidos).toBe(1);
  });

  it("informa as contas conectadas e se há senha", async () => {
    const ana = await criarUsuario();
    await prisma.account.create({
      data: { userId: ana.id, accountId: "g-1", providerId: "google" },
    });

    const semSenha = await resumoDoPerfil(ana.id);
    expect(semSenha).toMatchObject({ contas: ["google"], temSenha: false });

    await prisma.account.create({
      data: { userId: ana.id, accountId: ana.id, providerId: "credential", password: "hash" },
    });
    expect((await resumoDoPerfil(ana.id)).temSenha).toBe(true);
  });
});

describe("foto do perfil", () => {
  it("guarda a imagem em binário e devolve um endereço versionado", async () => {
    const ana = await criarUsuario();

    const { url } = await salvarAvatar(ana.id, dataUrl("image/webp"));
    expect(url).toMatch(new RegExp(`/api/usuarios/${ana.id}/avatar\\?v=\\d+$`));

    const foto = await obterAvatar(ana.id);
    expect(foto.mimeType).toBe("image/webp");
    expect(foto.data.length).toBe(64);
  });

  it("uma foto nova muda o endereço, para não reaproveitar o cache", async () => {
    const ana = await criarUsuario();
    const primeira = await salvarAvatar(ana.id, dataUrl("image/png"));
    await new Promise((r) => setTimeout(r, 5));
    const segunda = await salvarAvatar(ana.id, dataUrl("image/png", 80));
    expect(segunda.url).not.toBe(primeira.url);
  });

  it("recusa formatos fora da lista e imagens grandes demais", async () => {
    const ana = await criarUsuario();
    await expect(salvarAvatar(ana.id, dataUrl("image/gif"))).rejects.toMatchObject({
      code: "DADOS_INVALIDOS",
    });
    await expect(salvarAvatar(ana.id, "não é imagem")).rejects.toMatchObject({
      code: "DADOS_INVALIDOS",
    });
    await expect(
      salvarAvatar(ana.id, dataUrl("image/jpeg", TAMANHO_MAXIMO_DO_AVATAR + 1)),
    ).rejects.toMatchObject({ code: "DADOS_INVALIDOS" });
  });

  it("remover apaga a foto", async () => {
    const ana = await criarUsuario();
    await salvarAvatar(ana.id, dataUrl("image/webp"));
    await removerAvatar(ana.id);
    await expect(obterAvatar(ana.id)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
  });
});
