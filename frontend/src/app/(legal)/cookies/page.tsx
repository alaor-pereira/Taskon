import type { Metadata } from "next";
import { PoliticaDeCookies } from "@/components/legal/cookies";

export const metadata: Metadata = {
  title: "Política de cookies",
  description: "Os cookies e o armazenamento local que o Taskon usa, e por quê.",
};

export default function CookiesPage() {
  return <PoliticaDeCookies />;
}
