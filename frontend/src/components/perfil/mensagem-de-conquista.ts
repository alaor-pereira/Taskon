/**
 * Mensagem curta de parabéns do card "Conquistas", que muda conforme o total
 * de entregas (tarefas + projetos concluídos).
 */
export function mensagemDeConquista(tarefas: number, projetos: number): string {
  const total = tarefas + projetos;
  if (total === 0) {
    return "Toda grande entrega começa pela primeira tarefa. Estamos torcendo por você!";
  }
  if (total < 10) {
    return "Ótimo começo! Cada entrega conta — continue nesse ritmo.";
  }
  if (total < 50) {
    return "Que ritmo! Seu esforço faz o time andar. Obrigado por tanta dedicação.";
  }
  return "Você é referência! Tanta entrega mostra um esforço admirável — parabéns e obrigado.";
}
