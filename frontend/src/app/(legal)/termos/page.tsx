import type { Metadata } from "next";
import { TermosDeUso } from "@/components/legal/termos";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "As regras de uso do Taskon.",
};

export default function TermosPage() {
  return <TermosDeUso />;
}
