import type { Metadata } from "next";
import { PoliticaDePrivacidade } from "@/components/legal/privacidade";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Como o Taskon trata seus dados pessoais, de acordo com a LGPD.",
};

export default function PrivacidadePage() {
  return <PoliticaDePrivacidade />;
}
