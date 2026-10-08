import { ProjectRole, TeamRole } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import {
  authorizeProject,
  authorizeTeam,
  podeExcluirTarefa,
  podeRemoverComentario,
  resolveProjectContext,
} from "../src/authorization/authorize.js";
import { AppError } from "../src/lib/errors.js";
import { prisma } from "../src/lib/prisma.js";
import {
  projetosQueParticipo,
  equipesQueAdministro,
  equipesQueParticipo,
  meusProjetos,
} from "../src/authorization/scopes.js";
import {
  adicionarAEquipe,
  adicionarAoProjeto,
  criarEquipe,
  criarProjeto,
  criarTarefa,
  criarUsuario,
  limparBanco,
} from "./factories.js";

beforeEach(limparBanco);

/** Captura o código do erro de domínio, sem depender da mensagem. */
async function codigoDoErro(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "SEM_ERRO";
  } catch (erro) {
    return erro instanceof AppError ? erro.code : "ERRO_INESPERADO";
  }
}

describe("visibilidade: sem relação, o recurso não existe", () => {
  it("projeto alheio responde NAO_ENCONTRADO, não SEM_PERMISSAO", async () => {
    const dono = await criarUsuario();
    const estranho = await criarUsuario();
    const projeto = await criarProjeto(dono.id);

    // A distinção importa: SEM_PERMISSAO confirmaria que o projeto existe.
    expect(
      await codigoDoErro(() =>
        authorizeProject(estranho.id, projeto.id, "projeto.ver"),
      ),
    ).toBe("NAO_ENCONTRADO");
  });

  it("equipe alheia responde NAO_ENCONTRADO", async () => {
    const dono = await criarUsuario();
    const estranho = await criarUsuario();
    const equipe = await criarEquipe(dono.id);

    expect(
      await codigoDoErro(() => authorizeTeam(estranho.id, equipe.id, "equipe.ver")),
    ).toBe("NAO_ENCONTRADO");
  });

  it("pertencer à equipe não dá acesso aos projetos dela", async () => {
    const gestor = await criarUsuario();
    const membro = await criarUsuario();
    const equipe = await criarEquipe(gestor.id);
    await adicionarAEquipe(equipe.id, membro.id, TeamRole.MEMBRO);
    const projeto = await criarProjeto(gestor.id, { teamId: equipe.id });

    // Esta é a regra que diverge do documento original: o MEMBRO só vê os
    // projetos da equipe em que foi incluído.
    expect(await resolveProjectContext(membro.id, projeto.id)).toBeNull();
  });

  it("projeto excluído fica invisível fora das operações de Lixeira", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    await prisma.project.update({
      where: { id: projeto.id },
      data: { deletedAt: new Date(), deletedBy: dono.id },
    });

    expect(await resolveProjectContext(dono.id, projeto.id)).toBeNull();
    expect(
      await resolveProjectContext(dono.id, projeto.id, prisma, {
        incluirExcluidos: true,
      }),
    ).not.toBeNull();
  });
});

describe("exceção administrativa do GESTOR da equipe", () => {
  it("GESTOR alcança projeto da equipe sem ser membro dele", async () => {
    const gestor = await criarUsuario();
    const outroDono = await criarUsuario();
    const equipe = await criarEquipe(gestor.id);
    await adicionarAEquipe(equipe.id, outroDono.id, TeamRole.MEMBRO);
    const projeto = await criarProjeto(outroDono.id, { teamId: equipe.id });

    const ctx = await resolveProjectContext(gestor.id, projeto.id);
    expect(ctx?.role).toBe(ProjectRole.OWNER);
    expect(ctx?.viaGestorDaEquipe).toBe(true);
    // Tem os direitos de OWNER, mas não é o dono formal.
    expect(ctx?.isOwner).toBe(false);
  });

  it("GESTOR não alcança projeto pessoal de um membro", async () => {
    const gestor = await criarUsuario();
    const membro = await criarUsuario();
    const equipe = await criarEquipe(gestor.id);
    await adicionarAEquipe(equipe.id, membro.id, TeamRole.MEMBRO);
    const pessoal = await criarProjeto(membro.id); // sem teamId

    expect(await resolveProjectContext(gestor.id, pessoal.id)).toBeNull();
  });

  it("o papel mais alto vence quando há dois caminhos de acesso", async () => {
    const gestor = await criarUsuario();
    const dono = await criarUsuario();
    const equipe = await criarEquipe(gestor.id);
    await adicionarAEquipe(equipe.id, dono.id, TeamRole.MEMBRO);
    const projeto = await criarProjeto(dono.id, { teamId: equipe.id });
    // Mesmo listado como VIEWER, o GESTOR mantém os direitos de OWNER.
    await adicionarAoProjeto(projeto.id, gestor.id, ProjectRole.VIEWER);

    const ctx = await resolveProjectContext(gestor.id, projeto.id);
    expect(ctx?.role).toBe(ProjectRole.OWNER);
  });
});

describe("matriz de permissões da equipe", () => {
  const casos: Array<[TeamRole, string, boolean]> = [
    [TeamRole.GESTOR, "equipe.ver", true],
    [TeamRole.MEMBRO, "equipe.ver", true],
    [TeamRole.VISUALIZADOR, "equipe.ver", true],
    [TeamRole.GESTOR, "equipe.editar", true],
    [TeamRole.MEMBRO, "equipe.editar", false],
    [TeamRole.VISUALIZADOR, "equipe.editar", false],
    [TeamRole.GESTOR, "equipe.membros.gerenciar", true],
    [TeamRole.MEMBRO, "equipe.membros.gerenciar", false],
    [TeamRole.GESTOR, "equipe.projeto.criar", true],
    [TeamRole.MEMBRO, "equipe.projeto.criar", true],
    [TeamRole.VISUALIZADOR, "equipe.projeto.criar", false],
  ];

  it.each(casos)("%s pode %s: %s", async (role, acao, esperado) => {
    const dono = await criarUsuario();
    const ator = await criarUsuario();
    const equipe = await criarEquipe(dono.id);
    await adicionarAEquipe(equipe.id, ator.id, role);

    const codigo = await codigoDoErro(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      authorizeTeam(ator.id, equipe.id, acao as any),
    );
    expect(codigo === "SEM_ERRO").toBe(esperado);
  });

  it("transferir e excluir exigem ser o dono, não basta ser GESTOR", async () => {
    const dono = await criarUsuario();
    const outroGestor = await criarUsuario();
    const equipe = await criarEquipe(dono.id);
    await adicionarAEquipe(equipe.id, outroGestor.id, TeamRole.GESTOR);

    expect(
      await codigoDoErro(() =>
        authorizeTeam(dono.id, equipe.id, "equipe.propriedade.transferir"),
      ),
    ).toBe("SEM_ERRO");
    expect(
      await codigoDoErro(() =>
        authorizeTeam(outroGestor.id, equipe.id, "equipe.propriedade.transferir"),
      ),
    ).toBe("SEM_PERMISSAO");
  });
});

describe("matriz de permissões do projeto", () => {
  const casos: Array<[ProjectRole, string, boolean]> = [
    [ProjectRole.OWNER, "projeto.ver", true],
    [ProjectRole.EDITOR, "projeto.ver", true],
    [ProjectRole.VIEWER, "projeto.ver", true],
    [ProjectRole.OWNER, "projeto.editar", true],
    [ProjectRole.EDITOR, "projeto.editar", true],
    [ProjectRole.VIEWER, "projeto.editar", false],
    [ProjectRole.OWNER, "projeto.excluir", true],
    [ProjectRole.EDITOR, "projeto.excluir", false],
    [ProjectRole.OWNER, "projeto.membros.gerenciar", true],
    [ProjectRole.EDITOR, "projeto.membros.gerenciar", false],
    [ProjectRole.OWNER, "tarefa.criar", true],
    [ProjectRole.EDITOR, "tarefa.criar", true],
    [ProjectRole.VIEWER, "tarefa.criar", false],
    [ProjectRole.OWNER, "comentario.criar", true],
    [ProjectRole.EDITOR, "comentario.criar", true],
    // O VISUALIZADOR acompanha a discussão sem escrever.
    [ProjectRole.VIEWER, "comentario.criar", false],
    [ProjectRole.OWNER, "comentario.remover.qualquer", true],
    [ProjectRole.EDITOR, "comentario.remover.qualquer", false],
  ];

  it.each(casos)("%s pode %s: %s", async (role, acao, esperado) => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);

    let atorId = dono.id;
    if (role !== ProjectRole.OWNER) {
      const ator = await criarUsuario();
      await adicionarAoProjeto(projeto.id, ator.id, role);
      atorId = ator.id;
    }

    const codigo = await codigoDoErro(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      authorizeProject(atorId, projeto.id, acao as any),
    );
    expect(codigo === "SEM_ERRO").toBe(esperado);
  });
});

describe("exclusão de tarefa depende de quem criou", () => {
  it("EDITOR exclui a própria, mas não a dos outros; OWNER exclui qualquer uma", async () => {
    const dono = await criarUsuario();
    const editor = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    await adicionarAoProjeto(projeto.id, editor.id, ProjectRole.EDITOR);

    const doDono = await criarTarefa(projeto.id, dono.id);
    const doEditor = await criarTarefa(projeto.id, editor.id);

    const ctxEditor = (await resolveProjectContext(editor.id, projeto.id))!;
    expect(podeExcluirTarefa(ctxEditor, doEditor, editor.id)).toBe(true);
    expect(podeExcluirTarefa(ctxEditor, doDono, editor.id)).toBe(false);

    const ctxDono = (await resolveProjectContext(dono.id, projeto.id))!;
    expect(podeExcluirTarefa(ctxDono, doEditor, dono.id)).toBe(true);
  });
});

describe("remoção de comentário", () => {
  it("o autor remove o próprio; só o OWNER remove os de outros", async () => {
    const dono = await criarUsuario();
    const editor = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    await adicionarAoProjeto(projeto.id, editor.id, ProjectRole.EDITOR);

    const ctxEditor = (await resolveProjectContext(editor.id, projeto.id))!;
    const ctxDono = (await resolveProjectContext(dono.id, projeto.id))!;

    expect(podeRemoverComentario(ctxEditor, { authorId: editor.id }, editor.id)).toBe(true);
    expect(podeRemoverComentario(ctxEditor, { authorId: dono.id }, editor.id)).toBe(false);
    expect(podeRemoverComentario(ctxDono, { authorId: editor.id }, dono.id)).toBe(true);
  });
});

describe("filtros de listagem aplicados no banco", () => {
  it('"Meus Projetos" só traz projetos pessoais; "Projetos em equipe" só traz os de equipe', async () => {
    const usuario = await criarUsuario();
    const outroDono = await criarUsuario();
    const equipe = await criarEquipe(outroDono.id);
    const pessoal = await criarProjeto(usuario.id);
    const deEquipe = await criarProjeto(outroDono.id, { teamId: equipe.id });
    await adicionarAoProjeto(deEquipe.id, usuario.id, ProjectRole.EDITOR);

    const meus = await prisma.project.findMany({ where: meusProjetos(usuario.id) });
    const participo = await prisma.project.findMany({
      where: projetosQueParticipo(usuario.id),
    });

    expect(meus.map((p) => p.id)).toEqual([pessoal.id]);
    expect(participo.map((p) => p.id)).toEqual([deEquipe.id]);
  });

  it('projeto de equipe vai para "Projetos em equipe" mesmo quando o usuário é o dono', async () => {
    const usuario = await criarUsuario();
    const equipe = await criarEquipe(usuario.id);
    const projeto = await criarProjeto(usuario.id, { teamId: equipe.id });

    const meus = await prisma.project.findMany({ where: meusProjetos(usuario.id) });
    const participo = await prisma.project.findMany({
      where: projetosQueParticipo(usuario.id),
    });

    expect(meus).toHaveLength(0);
    expect(participo.map((p) => p.id)).toEqual([projeto.id]);
  });

  it('"Projetos que Participo" inclui o que chega pela equipe, sem duplicar', async () => {
    const gestor = await criarUsuario();
    const dono = await criarUsuario();
    const equipe = await criarEquipe(gestor.id);
    await adicionarAEquipe(equipe.id, dono.id, TeamRole.MEMBRO);
    const projeto = await criarProjeto(dono.id, { teamId: equipe.id });

    const participo = await prisma.project.findMany({
      where: projetosQueParticipo(gestor.id),
    });
    expect(participo.map((p) => p.id)).toEqual([projeto.id]);
  });

  it('"Equipes que Participo" não repete as que administro', async () => {
    const usuario = await criarUsuario();
    const outro = await criarUsuario();
    const minha = await criarEquipe(usuario.id);
    const alheiaComoGestor = await criarEquipe(outro.id);
    await adicionarAEquipe(alheiaComoGestor.id, usuario.id, TeamRole.GESTOR);
    const alheiaComoMembro = await criarEquipe(outro.id);
    await adicionarAEquipe(alheiaComoMembro.id, usuario.id, TeamRole.MEMBRO);

    const administro = await prisma.team.findMany({
      where: equipesQueAdministro(usuario.id),
    });
    const participo = await prisma.team.findMany({
      where: equipesQueParticipo(usuario.id),
    });

    expect(administro.map((t) => t.id).sort()).toEqual(
      [minha.id, alheiaComoGestor.id].sort(),
    );
    expect(participo.map((t) => t.id)).toEqual([alheiaComoMembro.id]);
  });

  it("projeto excluído não aparece em nenhuma listagem", async () => {
    const usuario = await criarUsuario();
    const projeto = await criarProjeto(usuario.id);
    await prisma.project.update({
      where: { id: projeto.id },
      data: { deletedAt: new Date() },
    });

    const meus = await prisma.project.findMany({ where: meusProjetos(usuario.id) });
    expect(meus).toHaveLength(0);
  });
});
