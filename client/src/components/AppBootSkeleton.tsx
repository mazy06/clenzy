import { Skeleton, Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuSkeleton, SidebarProvider } from './ui';
import { useSidebarState } from '../hooks/useSidebarState';
import { useTranslation } from '../hooks/useTranslation';

/**
 * L'application, le temps qu'elle sache qui la regarde.
 *
 * <p>Un sursis tournant plein cadre occupait cette place — le plus long des
 * quatre, puisqu'il couvre l'init Keycloak ET `/api/me`. Il disparaissait d'un
 * coup pour laisser place à une coquille qui n'avait rien à voir avec lui :
 * une barre latérale, une barre de titre, une carte. Le saut était total.</p>
 *
 * <p>On dessine donc la coquille TOUT DE SUITE, dans sa géométrie définitive,
 * avec les primitives du kit plutôt qu'une copie à la main — la vraie barre
 * latérale prend exactement la même largeur, se replie sur la même préférence,
 * et devient la même feuille sous 1024 px. Quand l'authentification arrive,
 * rien ne bouge : les entrées de navigation et le contenu se posent dans des
 * cadres déjà là.</p>
 *
 * <p>Aucun spinner : le battement des blocs dit déjà que ça charge, et un
 * disque qui tourne par-dessus rouvrirait la question qu'on vient de fermer.</p>
 */
export default function AppBootSkeleton() {
  const { isCollapsed } = useSidebarState();
  const { isArabic } = useTranslation();

  return (
    // `open` sans `onOpenChange` : le rail est volontairement INERTE ici — le
    // raccourci de repli n'a rien a reveler tant que la navigation est vide, et
    // la vraie coquille reprendra la preference persistee.
    <SidebarProvider open={!isCollapsed} className="h-svh min-h-svh overflow-hidden">
      <Sidebar collapsible="icon" side={isArabic ? 'right' : 'left'}>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuSkeleton showIcon />
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          {/* Deux groupes, comme la navigation en porte au minimum. Le nombre
              exact d'entrees depend des droits : on en promet peu. */}
          {[4, 3].map((count, group) => (
            <SidebarGroup key={group}>
              <SidebarMenu>
                {Array.from({ length: count }, (_, i) => (
                  <SidebarMenuSkeleton key={i} showIcon />
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuSkeleton showIcon />
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 overflow-hidden">
        {/* Memes marges que la zone de contenu de MainLayoutFull : ce que la
            page posera ici tombera exactement a la meme place. */}
        <div className="flex flex-col grow min-h-0 bg-background p-[9px] min-[900px]:p-3">
          <div className="mb-3 flex shrink-0 items-center gap-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="ms-auto h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
          {/* Rien sous la barre de titre : ni carte, ni trame.
              Deux essais ont echoue ici. Une carte VIDE cerclee d'un filet
              donnait un grand rectangle au milieu de l'ecran — la silhouette
              d'un cadre qui n'a pas charge. Une trame de grille, elle,
              PROMETTAIT un ecran precis alors que la coquille ne sait pas
              encore quelle page arrive : le chunk de la route n'est pas la.
              Reste le fond, qui n'annonce rien qu'il ne puisse tenir ; la page
              posera sa propre attente des qu'elle sera chargee. */}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
