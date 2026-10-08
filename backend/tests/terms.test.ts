import { TermsAcceptanceOrigin } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { VERSAO_DOS_TERMOS } from "../src/config/legal.js";
import { prisma } from "../src/lib/prisma.js";
import { registrarAceite, situacaoDosTermos } from "../src/modules/terms/terms.service.js";
import { criarUsuario, limparBanco } from "./factories.js";

beforeEach(limparBanco);

describe("aceite dos termos", () => {
  it("pede o aceite a quem ainda não aceitou a versão vigente", async () => {
    const ana = await criarUsuario();

    expect(await situacaoDosTermos(ana.id)).toEqual({
      versaoAtual: VERSAO_DOS_TERMOS,
      aceitouEm: null,
      precisaAceitar: true,
    });
  });

  it("registra versão, origem, IP e navegador, uma vez por versão", async () => {
    const ana = await criarUsuario();

    await registrarAceite(ana.id, TermsAcceptanceOrigin.CADASTRO, {
      ip: "203.0.113.7",
      userAgent: "Navegador de teste",
    });
    await registrarAceite(ana.id, TermsAcceptanceOrigin.REACEITE);

    const aceites = await prisma.termsAcceptance.findMany({ where: { userId: ana.id } });
    expect(aceites).toHaveLength(1);
    expect(aceites[0]).toMatchObject({
      version: VERSAO_DOS_TERMOS,
      origin: TermsAcceptanceOrigin.CADASTRO,
      ipAddress: "203.0.113.7",
      userAgent: "Navegador de teste",
    });

    const situacao = await situacaoDosTermos(ana.id);
    expect(situacao.precisaAceitar).toBe(false);
    expect(situacao.aceitouEm).toBe(aceites[0]!.acceptedAt.toISOString());
  });

  it("volta a pedir o aceite quando os documentos mudam de versão", async () => {
    const ana = await criarUsuario();
    await prisma.termsAcceptance.create({
      data: { userId: ana.id, version: "2000-01-01", origin: TermsAcceptanceOrigin.CADASTRO },
    });

    expect((await situacaoDosTermos(ana.id)).precisaAceitar).toBe(true);
  });
});
