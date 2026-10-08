"use client";

import {
  Calendar03Icon,
  Clock01Icon,
  Location01Icon,
  PencilEdit02Icon,
  RepeatIcon,
  UserGroupIcon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Icone } from "@/components/ui/icone";
import { dataEHora } from "@/lib/datas";
import { urlExterna } from "@/lib/links";
import { t } from "@/lib/messages";
import { iniciais } from "@/components/tasks/task-badges";
import type { OcorrenciaDeAgenda } from "@/lib/types";

/**
 * Detalhes de uma ocorrência da agenda, num painel lateral — a leitura fica
 * aqui; editar delega para o EventDialog já existente, que já sabe lidar com
 * escopo de série recorrente.
 */
export function EventDrawer({
  ocorrencia,
  aoFechar,
  aoEditar,
}: {
  ocorrencia: OcorrenciaDeAgenda | null;
  aoFechar: () => void;
  aoEditar: () => void;
}) {
  const evento = ocorrencia?.evento;
  const link = urlExterna(evento?.locationOrLink);
  const meet = urlExterna(evento?.meetLink);

  return (
    <Drawer open={Boolean(ocorrencia)} onOpenChange={(v) => !v && aoFechar()}>
      {evento && (
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{evento.title}</DrawerTitle>
            <DrawerDescription>
              {evento.kind === "REUNIAO" ? "Reunião" : "Atividade"}
            </DrawerDescription>
          </DrawerHeader>

          <DrawerBody className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Icone icon={Clock01Icon} className="size-4 shrink-0 text-muted-foreground" />
              <span>
                {dataEHora(ocorrencia!.inicio)} — {dataEHora(ocorrencia!.fim)}
              </span>
            </div>

            {evento.rrule && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icone icon={RepeatIcon} className="size-4 shrink-0" />
                <span>Evento que se repete</span>
              </div>
            )}

            {evento.locationOrLink && (
              <div className="flex items-center gap-2 text-sm">
                <Icone icon={Location01Icon} className="size-4 shrink-0 text-muted-foreground" />
                {/* Endereço de videochamada abre numa nova aba; uma sala fica como texto. */}
                {link ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 break-all text-link underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring"
                  >
                    {evento.locationOrLink}
                  </a>
                ) : (
                  <span className="min-w-0 wrap-anywhere">{evento.locationOrLink}</span>
                )}
              </div>
            )}

            {meet && (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<a href={meet} target="_blank" rel="noopener noreferrer" />}
                className="w-fit"
              >
                <Icone icon={Video01Icon} data-icon="inline-start" />
                Entrar no Google Meet
              </Button>
            )}

            {evento.project && (
              <div className="flex items-center gap-2 text-sm">
                <Icone icon={Calendar03Icon} className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 wrap-anywhere">{evento.project.name}</span>
              </div>
            )}

            {evento.description && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere text-muted-foreground">
                {evento.description}
              </p>
            )}

            {evento.kind === "REUNIAO" && evento.participants.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Icone icon={UserGroupIcon} className="size-4 shrink-0 text-muted-foreground" />
                  Participantes
                </div>
                <ul className="space-y-1.5 pl-6">
                  {evento.participants.map((p) => (
                    <li key={p.user.id} className="flex items-center gap-2 text-sm">
                      <Avatar className="size-5">
                        {p.user.image && <AvatarImage src={p.user.image} alt="" />}
                        <AvatarFallback className="text-[9px]">
                          {iniciais(p.user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate">{p.user.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {t.respostaDeParticipante[p.response]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </DrawerBody>

          <DrawerFooter>
            <Button onClick={aoEditar}>
              <Icone icon={PencilEdit02Icon} />
              Editar
            </Button>
          </DrawerFooter>
        </DrawerContent>
      )}
    </Drawer>
  );
}
