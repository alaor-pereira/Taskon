"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields, twoFactorClient } from "better-auth/client/plugins";
import { API_URL } from "./api";

/**
 * Cliente do Better Auth. Aponta para o backend, que serve /api/auth.
 * A sessão vive em cookie, então nada de token em localStorage.
 *
 * `inferAdditionalFields` declara os campos que o Taskon acrescenta ao usuário
 * além do contrato padrão. Sem isso, `timezone` não existiria nos tipos do
 * cadastro nem na sessão.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  fetchOptions: { credentials: "include" },
  plugins: [
    inferAdditionalFields({
      user: {
        timezone: { type: "string", required: false },
        twoFactorEnabled: { type: "boolean", required: false, input: false },
      },
    }),
    // Sem redirecionamento automático: o /entrar decide para onde ir quando
    // o login por senha pede o segundo fator.
    twoFactorClient(),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
  updateUser,
  changePassword,
  twoFactor,
  listSessions,
  revokeSession,
  revokeOtherSessions,
} = authClient;

export type Usuario = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  timezone?: string;
};
