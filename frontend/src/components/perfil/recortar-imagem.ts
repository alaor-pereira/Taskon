/** Lado da foto guardada: o avatar nunca aparece maior que isso. */
const LADO = 256;
/** Arquivo de origem aceito; a foto final fica bem menor depois do recorte. */
export const TAMANHO_MAXIMO_DE_ORIGEM = 5 * 1024 * 1024;

/**
 * Recorta o centro da imagem num quadrado, reduz para 256×256 e devolve uma
 * data URL em WebP (ou PNG, nos navegadores que não geram WebP). Assim o que
 * vai para o servidor tem poucas dezenas de KB, seja qual for a foto original.
 */
export async function recortarParaAvatar(arquivo: File): Promise<string> {
  if (!arquivo.type.startsWith("image/")) {
    throw new Error("Escolha um arquivo de imagem.");
  }
  if (arquivo.size > TAMANHO_MAXIMO_DE_ORIGEM) {
    throw new Error("A imagem precisa ter até 5 MB.");
  }

  const bitmap = await createImageBitmap(arquivo).catch(() => {
    throw new Error("Não foi possível ler esta imagem.");
  });

  const lado = Math.min(bitmap.width, bitmap.height);
  const x = (bitmap.width - lado) / 2;
  const y = (bitmap.height - lado) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = LADO;
  canvas.height = LADO;
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("Não foi possível processar a imagem.");
  contexto.imageSmoothingQuality = "high";
  contexto.drawImage(bitmap, x, y, lado, lado, 0, 0, LADO, LADO);
  bitmap.close();

  const webp = canvas.toDataURL("image/webp", 0.85);
  // Sem suporte a WebP, o navegador devolve PNG mesmo pedindo WebP.
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
}
