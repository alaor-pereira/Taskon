import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Os testes de serviço compartilham um banco real; rodar em paralelo faria
    // um arquivo apagar os dados do outro.
    fileParallelism: false,
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    testTimeout: 20_000,
  },
});
