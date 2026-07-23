import { useState, type ComponentType, type ReactNode } from 'react';
import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import { resolveTabHeader, type TabHeaderMeta } from '../../components/PageHeaderActionsContext';
import { Palette, Search, Mail, Add, Delete, ArrowForward, DarkMode, LightMode } from '../../icons';
import {
  Button,
  Input,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Label,
  Textarea,
  Checkbox,
  RadioGroup,
  RadioGroupItem,
  Switch,
  Separator,
  Skeleton,
  Alert,
  AlertTitle,
  AlertDescription,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Progress,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
  Slider,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
  ScrollArea,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  Toaster,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Calendar,
  CalendarDayButton,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Kbd,
  KbdGroup,
  Spinner,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  ButtonGroup,
  ButtonGroupSeparator,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  Item,
  ItemContent,
  ItemDescription as UiItemDescription,
  ItemMedia,
  ItemTitle,
  ItemActions,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '../../components/ui';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Label as RechartsLabel,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ActivityIcon,
  BarChart3Icon,
  CalendarDaysIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EuroIcon,
  FileTextIcon,
  HammerIcon,
  HomeIcon,
  LayoutDashboardIcon,
  PaletteIcon,
  SettingsIcon,
  Share2Icon,
  ShieldCheckIcon,
  UsersIcon,
  WrenchIcon,
  ZapIcon,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import BaitlyMarkLogo from '../../components/BaitlyMarkLogo';
import { addDays } from 'date-fns';
import { REGEXP_ONLY_DIGITS_AND_CHARS } from 'input-otp';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import type { DateRange } from 'react-day-picker';
import { EXAMPLE_DEMOS } from './design-system/demos';
import {
  BPageHeaderDemo,
  BStatTileDemo,
  BEmptyStateDemo,
  BFilterChipRowDemo,
  BPeriodSegmentedDemo,
  BStatusChipDemo,
  BMoneyDemo,
  BListSkeletonDemo,
  BHeaderSearchFieldDemo,
  BGuestAvatarDemo,
  BConfirmationModalDemo,
  BFilterSearchBarDemo,
  BDataFetchWrapperDemo,
  BHelpBannerDemo,
  BHelpPopoverDemo,
  BExportButtonDemo,
  BLoadingStatesDemo,
  BPageTabsDemo,
  BDateRangePickerDemo,
  BThemedTooltipDemo,
} from './design-system/primitives-demos';
import {
  BRevenueByChannelCardDemo,
  BServiceRequestCardDemo,
  BDescriptionNotesDemo,
  BOfflineBannerDemo,
  BDashboardSectionDemo,
  BInterventionsSectionDemo,
  BTeamCardDemo,
  BAppUpdateBannerDemo,
  BPWAInstallBannerDemo,
  BAiCreditsPaywallDemo,
  BHubScreenSwitcherDemo,
  BReservationDetailSectionDemo,
} from './design-system/sections-demos';
import {
  BPlanningSectionDemo,
  BPropertiesSectionDemo,
  BGuestsSectionDemo,
  BMessagingSectionDemo,
  BBillingSectionDemo,
  BSettingsSectionDemo,
} from './design-system/screens-demos';
import {
  BPricingSectionDemo,
  BReportsSectionDemo,
  BOnboardingSectionDemo,
  BOwnerPortalSectionDemo,
} from './design-system/screens-demos-2';
import {
  BIntegrationsSectionDemo,
  BDocumentsSectionDemo,
  BNotificationsSectionDemo,
  BAssistantSectionDemo,
} from './design-system/screens-demos-3';
import { BAgentsConstellationSectionDemo } from './design-system/agents-demo';
import { BIotSectionDemo } from './design-system/iot-demo';

/**
 * Bibliothèque Baitly UI — galerie du design system (super admin).
 *
 * Ancre du chantier de refonte progressive shadcn/ui → Baitly :
 * chaque composant porté dans components/ui/ DOIT être démontré ici
 * (variants, tailles, états) avant toute migration d'écran.
 *
 * Le canvas de prévisualisation force localement data-theme / dir,
 * ce qui permet de vérifier clair + sombre + RTL sans changer les
 * préférences globales de l'utilisateur.
 */

// ─── Canvas de prévisualisation (thème/direction locaux) ─────────────────────

type PreviewTheme = 'light' | 'dark';

function Section({
  title,
  description,
  previewTheme,
  rtl,
  action,
  canvasClassName,
  children,
}: {
  title: string;
  description: string;
  previewTheme: PreviewTheme;
  rtl: boolean;
  /** Slot en fin de ligne de titre (ex. sélecteur de variante). */
  action?: ReactNode;
  /** Classes additionnelles du canvas (ex. min-height pour les overlays ancrés). */
  canvasClassName?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      <p className="m-0 mt-1 text-sm text-muted-foreground">{description}</p>
      {/* data-theme local : les tokens Signature cascadent depuis n'importe
          quel élément porteur de l'attribut, pas seulement <html>. */}
      <div
        data-theme={previewTheme}
        dir={rtl ? 'rtl' : 'ltr'}
        className={cn('mt-3 rounded-lg border border-border bg-background p-6', canvasClassName)}
      >
        {children}
      </div>
    </section>
  );
}
// ─── Démos par composant ─────────────────────────────────────────────────────
// Une fonction par VARIANTE (façon exemples multiples du site shadcn) ;
// GALLERY_SECTIONS assemble les variantes par section, le sélecteur de
// variante est rendu par GallerySection quand il y en a plusieurs.

function ButtonVariantsDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Créer une réservation</Button>
      <Button variant="secondary">Exporter</Button>
      <Button variant="outline">Filtrer</Button>
      <Button variant="ghost">Annuler</Button>
      <Button variant="destructive">Supprimer</Button>
      <Button variant="link">En savoir plus</Button>
    </div>
  );
}

function ButtonSizesDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs">Très compact</Button>
      <Button size="sm">Compact</Button>
      <Button size="default">Par défaut</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" variant="outline" aria-label="Ajouter">
        <Add />
      </Button>
      <Button size="icon-sm" variant="outline" aria-label="Ajouter">
        <Add />
      </Button>
      <Button size="icon-xs" variant="outline" aria-label="Ajouter">
        <Add />
      </Button>
    </div>
  );
}

function ButtonIconStatesDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button>
        <Add /> Nouveau bien
      </Button>
      <Button variant="secondary">
        Continuer <ArrowForward />
      </Button>
      <Button variant="destructive" size="sm">
        <Delete /> Retirer
      </Button>
      <Button disabled>Désactivé</Button>
      <Button disabled variant="outline">
        <Spinner /> Chargement…
      </Button>
    </div>
  );
}

function InputBasicDemo() {
  return (
    <div className="flex max-w-sm flex-col gap-4">
      <Input placeholder="Rechercher un logement…" />
      <Input type="email" placeholder="email@exemple.fr" />
      <Input disabled placeholder="Champ désactivé" />
    </div>
  );
}

function InputIconDemo() {
  return (
    <div className="flex max-w-sm flex-col gap-4">
      <div className="relative">
        <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <Input className="ps-9" placeholder="Recherche avec icône" />
      </div>
    </div>
  );
}

function BadgeDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge>Direct</Badge>
      <Badge variant="secondary">Brouillon</Badge>
      <Badge variant="outline">Archivé</Badge>
      <Badge variant="success">Confirmée</Badge>
      <Badge variant="warning">En attente</Badge>
      <Badge variant="destructive">Annulée</Badge>
      <Badge variant="info">Synchronisée</Badge>
    </div>
  );
}

function CardDemo() {
  return (
    <Card className="max-w-md">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Riad Yasmine — Marrakech</CardTitle>
          <Badge variant="success">Confirmée</Badge>
        </div>
        <CardDescription>Séjour du 12 au 19 août · 4 voyageurs</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">Total séjour</span>
          <span className="text-xl font-semibold text-foreground tabular-nums">1 240 €</span>
        </div>
      </CardContent>
      <CardFooter>
        <Button size="sm">
          <Mail /> Contacter le guest
        </Button>
        <Button size="sm" variant="ghost">
          Voir la fiche
        </Button>
      </CardFooter>
    </Card>
  );
}

function SelectGroupedDemo() {
  return (
    <Select>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Choisir un logement" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Marrakech</SelectLabel>
          <SelectItem value="riad-yasmine">Riad Yasmine</SelectItem>
          <SelectItem value="duplex-gueliz">Duplex Guéliz</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Casablanca</SelectLabel>
          <SelectItem value="appart-maarif">Appartement Maârif</SelectItem>
          <SelectItem value="studio-anfa" disabled>
            Studio Anfa (archivé)
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function SelectCompactDemo() {
  return (
    <Select defaultValue="confirmed">
      <SelectTrigger size="sm" className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="confirmed">Confirmée</SelectItem>
        <SelectItem value="pending">En attente</SelectItem>
        <SelectItem value="cancelled">Annulée</SelectItem>
      </SelectContent>
    </Select>
  );
}

function DialogDemo() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Annuler la réservation…</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Annuler la réservation</DialogTitle>
          <DialogDescription>
            Le séjour du 12 au 19 août au Riad Yasmine sera annulé et le guest notifié. Cette
            action est irréversible.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Retour</Button>
          </DialogClose>
          <Button variant="destructive">Confirmer l'annulation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TabsDefaultDemo() {
  return (
    <Tabs defaultValue="details">
      <TabsList>
        <TabsTrigger value="details">Détails</TabsTrigger>
        <TabsTrigger value="pricing">Tarification</TabsTrigger>
        <TabsTrigger value="history">Historique</TabsTrigger>
      </TabsList>
      <TabsContent value="details" className="text-sm text-muted-foreground">
        Informations générales du logement.
      </TabsContent>
      <TabsContent value="pricing" className="text-sm text-muted-foreground">
        Prix de base, saisons et promotions.
      </TabsContent>
      <TabsContent value="history" className="text-sm text-muted-foreground">
        Dernières modifications.
      </TabsContent>
    </Tabs>
  );
}

function TabsLineDemo() {
  return (
    <Tabs defaultValue="details">
      <TabsList variant="line">
        <TabsTrigger value="details">Détails</TabsTrigger>
        <TabsTrigger value="pricing">Tarification</TabsTrigger>
        <TabsTrigger value="history">Historique</TabsTrigger>
      </TabsList>
      <TabsContent value="details" className="text-sm text-muted-foreground">
        Variante « line » — soulignement sous l'onglet actif.
      </TabsContent>
      <TabsContent value="pricing" className="text-sm text-muted-foreground">
        Prix de base, saisons et promotions.
      </TabsContent>
      <TabsContent value="history" className="text-sm text-muted-foreground">
        Dernières modifications.
      </TabsContent>
    </Tabs>
  );
}

const TABLE_ROWS = [
  { id: 'RES-1042', property: 'Riad Yasmine', dates: '12–19 août', status: 'success', label: 'Confirmée', total: '1 240 €' },
  { id: 'RES-1043', property: 'Duplex Guéliz', dates: '14–16 août', status: 'warning', label: 'En attente', total: '380 €' },
  { id: 'RES-1044', property: 'Appartement Maârif', dates: '20–27 août', status: 'destructive', label: 'Annulée', total: '910 €' },
] as const;

function TableDemo() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Référence</TableHead>
          <TableHead>Logement</TableHead>
          <TableHead>Dates</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead className="text-end">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {TABLE_ROWS.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">{row.id}</TableCell>
            <TableCell>{row.property}</TableCell>
            <TableCell>{row.dates}</TableCell>
            <TableCell>
              <Badge variant={row.status}>{row.label}</Badge>
            </TableCell>
            <TableCell className="text-end tabular-nums">{row.total}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LabelInputDemo() {
  return (
    <div className="flex max-w-sm flex-col gap-2">
      <Label htmlFor="ds-guest-name">Nom du guest</Label>
      <Input id="ds-guest-name" placeholder="Amina Benali" />
    </div>
  );
}

function TextareaDemo() {
  return (
    <div className="flex max-w-sm flex-col gap-2">
      <Label htmlFor="ds-notes">Notes internes</Label>
      <Textarea id="ds-notes" placeholder="Instructions d'arrivée, préférences…" />
    </div>
  );
}

function CheckboxDemo() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Checkbox id="ds-check-1" defaultChecked />
        <Label htmlFor="ds-check-1">Envoyer la confirmation au guest</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="ds-check-2" />
        <Label htmlFor="ds-check-2">Créer l'intervention de ménage</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="ds-check-3" disabled />
        <Label htmlFor="ds-check-3">Option désactivée</Label>
      </div>
    </div>
  );
}

function RadioGroupDemo() {
  return (
    <RadioGroup defaultValue="direct" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="direct" id="ds-radio-1" />
        <Label htmlFor="ds-radio-1">Réservation directe</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="ota" id="ds-radio-2" />
        <Label htmlFor="ds-radio-2">Canal OTA</Label>
      </div>
    </RadioGroup>
  );
}

function SwitchDemo() {
  return (
    <div className="flex items-center gap-2">
      <Switch id="ds-switch-1" defaultChecked />
      <Label htmlFor="ds-switch-1">Synchronisation automatique</Label>
    </div>
  );
}

function AlertDefaultDemo() {
  return (
    <Alert className="max-w-xl">
      <Mail />
      <AlertTitle>Nouveau message guest</AlertTitle>
      <AlertDescription>
        Amina Benali a répondu à propos de son arrivée du 12 août.
      </AlertDescription>
    </Alert>
  );
}

function AlertDestructiveDemo() {
  return (
    <Alert variant="destructive" className="max-w-xl">
      <Delete />
      <AlertTitle>Échec de synchronisation</AlertTitle>
      <AlertDescription>
        Le calendrier Airbnb du Riad Yasmine n'a pas pu être mis à jour.
      </AlertDescription>
    </Alert>
  );
}

function AvatarDemo() {
  return (
    <div className="flex items-center gap-3">
      <Avatar>
        <AvatarImage src="/broken-on-purpose.png" alt="" />
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>RY</AvatarFallback>
      </Avatar>
    </div>
  );
}

function ProgressDemo() {
  return <Progress value={64} className="max-w-sm" />;
}

function SkeletonDemo() {
  return (
    <div className="flex max-w-sm flex-col gap-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}

function SeparatorDemo() {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span>Réservations</span>
      <Separator orientation="vertical" className="h-4" />
      <span>Interventions</span>
      <Separator orientation="vertical" className="h-4" />
      <span>Facturation</span>
    </div>
  );
}

function TooltipDemo() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">Survole-moi</Button>
        </TooltipTrigger>
        <TooltipContent>Synchroniser maintenant</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function PopoverDemo() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Ouvrir le popover</Button>
      </PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Période</PopoverTitle>
          <PopoverDescription>
            Filtre les réservations affichées sur le planning.
          </PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  );
}

function DropdownMenuDemo() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Actions réservation</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>RES-1042 — Riad Yasmine</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          Voir la fiche
          <DropdownMenuShortcut>⌘F</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>Contacter le guest</DropdownMenuItem>
        <DropdownMenuItem>Générer la facture</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">Annuler la réservation</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AlertDialogDemo() {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Supprimer le logement…</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer le Riad Yasmine ?</AlertDialogTitle>
          <AlertDialogDescription>
            Les réservations passées sont conservées, mais le logement disparaîtra du planning et
            des canaux connectés. Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Retour</AlertDialogCancel>
          <AlertDialogAction>Supprimer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SheetDemo() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Détail de l'intervention</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Ménage — Riad Yasmine</SheetTitle>
          <SheetDescription>Prévu le 19 août après le check-out de 11 h.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4 text-sm text-muted-foreground">
          <p className="m-0">Housekeeper : Fatima Z.</p>
          <p className="m-0">Durée estimée : 2 h 30</p>
        </div>
        <SheetFooter>
          <Button>Marquer comme terminé</Button>
          <SheetClose asChild>
            <Button variant="outline">Fermer</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function AccordionDemo() {
  return (
    <Accordion type="single" collapsible defaultValue="q1" className="max-w-md">
      <AccordionItem value="q1">
        <AccordionTrigger>Comment connecter un canal OTA ?</AccordionTrigger>
        <AccordionContent>
          Depuis Intégrations, choisis le canal puis suis l'assistant de connexion.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="q2">
        <AccordionTrigger>Comment modifier un tarif saisonnier ?</AccordionTrigger>
        <AccordionContent>
          Dans Tarification, sélectionne la saison et ajuste le prix nuit.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function CollapsibleDemo() {
  return (
    <Collapsible className="flex max-w-md flex-col gap-2">
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="self-start">
          Afficher les 3 logements archivés
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="text-sm text-muted-foreground">
        Studio Anfa · Riad Bahia · Loft Racine
      </CollapsibleContent>
    </Collapsible>
  );
}

function ToggleDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Toggle aria-label="Gras">Gras</Toggle>
      <Toggle defaultPressed variant="outline" aria-label="Synchronisation">
        Sync auto
      </Toggle>
    </div>
  );
}

function ToggleGroupDemo() {
  return (
    <ToggleGroup type="single" defaultValue="month" variant="outline">
      <ToggleGroupItem value="week">Semaine</ToggleGroupItem>
      <ToggleGroupItem value="month">Mois</ToggleGroupItem>
      <ToggleGroupItem value="year">Année</ToggleGroupItem>
    </ToggleGroup>
  );
}

function SliderDemo() {
  return <Slider defaultValue={[60]} max={100} step={5} className="max-w-md" />;
}

function HoverCardDemo() {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant="link">@riad-yasmine</Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-72">
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Riad Yasmine — Marrakech</span>
          <span className="text-muted-foreground">
            6 chambres · note 4,9 · 82 % d'occupation sur 30 jours
          </span>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function ScrollAreaDemo() {
  return (
    <ScrollArea className="h-32 w-56 rounded-md border">
      <div className="flex flex-col gap-2 p-3 text-sm">
        {['RES-1040', 'RES-1041', 'RES-1042', 'RES-1043', 'RES-1044', 'RES-1045', 'RES-1046', 'RES-1047'].map(
          (id) => (
            <span key={id} className="text-muted-foreground">
              {id} — Riad Yasmine
            </span>
          )
        )}
      </div>
    </ScrollArea>
  );
}

function ContextMenuDemo() {
  return (
    <ContextMenu>
      <ContextMenuTrigger className="flex h-24 w-56 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
        Clic droit ici
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem>Dupliquer la réservation</ContextMenuItem>
        <ContextMenuItem>Bloquer les dates</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive">Supprimer</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function MenubarDemo() {
  return (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger>Planning</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            Aujourd'hui <MenubarShortcut>⌘T</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>Aller à une date…</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Affichage</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>Par logement</MenubarItem>
          <MenubarItem>Par équipe</MenubarItem>
          <MenubarSeparator />
          <MenubarItem>Plein écran</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}

function BreadcrumbDemo() {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="#">Logements</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="#">Riad Yasmine</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Tarification</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function PaginationDemo() {
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href="#" />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">1</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#" isActive>
            2
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">3</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationEllipsis />
        </PaginationItem>
        <PaginationItem>
          <PaginationNext href="#" />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

function ToastDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        onClick={() => toast.success('Réservation confirmée', { description: 'RES-1042 — Riad Yasmine' })}
      >
        Toast succès
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.error('Échec de synchronisation', { description: 'Calendrier Airbnb injoignable' })}
      >
        Toast erreur
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast('Nouvelle demande de réservation', {
            description: '14–16 août · Duplex Guéliz',
            action: { label: 'Voir', onClick: () => {} },
          })
        }
      >
        Toast avec action
      </Button>
    </div>
  );
}

function CommandDemo() {
  return (
    <Command className="max-w-md rounded-lg border shadow-md">
      <CommandInput placeholder="Rechercher une action ou un logement…" />
      <CommandList>
        <CommandEmpty>Aucun résultat.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem>Créer une réservation</CommandItem>
          <CommandItem>Bloquer des dates</CommandItem>
          <CommandItem>Générer une facture</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Logements">
          <CommandItem>Riad Yasmine</CommandItem>
          <CommandItem>Duplex Guéliz</CommandItem>
          <CommandItem>Appartement Maârif</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

function CalendarRangeDemo() {
  const [range, setRange] = useState<DateRange | undefined>();
  return (
    <Calendar
      mode="range"
      numberOfMonths={2}
      selected={range}
      onSelect={setRange}
      className="rounded-lg border"
    />
  );
}

function CalendarSingleDemo() {
  const [date, setDate] = useState<Date | undefined>();
  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      className="rounded-lg border"
    />
  );
}

/* Block calendar-21 du site shadcn : prix par nuit sous chaque jour. */
function CalendarPricingDemo() {
  const [range, setRange] = useState<DateRange | undefined>();
  return (
    <Calendar
      mode="range"
      selected={range}
      onSelect={setRange}
      numberOfMonths={1}
      captionLayout="dropdown"
      className="rounded-lg border shadow-sm [--cell-size:2.75rem] md:[--cell-size:3rem]"
      formatters={{
        formatMonthDropdown: (date) => date.toLocaleString('fr-FR', { month: 'long' }),
      }}
      components={{
        DayButton: ({ children, modifiers, day, ...props }) => {
          const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
          return (
            <CalendarDayButton day={day} modifiers={modifiers} {...props}>
              {children}
              {!modifiers.outside && <span>{isWeekend ? '120 €' : '80 €'}</span>}
            </CalendarDayButton>
          );
        },
      }}
    />
  );
}

/* Block calendar-14 : jours réservés/indisponibles (barrés et désactivés). */
function CalendarBookedDemo() {
  const [date, setDate] = useState<Date | undefined>();
  const bookedDates = Array.from({ length: 6 }, (_, i) => addDays(new Date(), 3 + i));
  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      disabled={bookedDates}
      modifiers={{ booked: bookedDates }}
      modifiersClassNames={{ booked: '[&>button]:line-through opacity-100' }}
      className="rounded-lg border shadow-sm"
    />
  );
}

/* Block calendar-06 : plage avec minimum de nuits (min-stay). */
function CalendarMinStayDemo() {
  const [range, setRange] = useState<DateRange | undefined>();
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Calendar
        mode="range"
        selected={range}
        onSelect={setRange}
        numberOfMonths={1}
        min={3}
        className="rounded-lg border shadow-sm"
      />
      <div className="text-center text-xs text-muted-foreground">Séjour minimum : 3 nuits</div>
    </div>
  );
}

/* Block calendar-13 : navigation par dropdowns mois + année. */
function CalendarDropdownDemo() {
  const [date, setDate] = useState<Date | undefined>();
  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      captionLayout="dropdown"
      className="rounded-lg border shadow-sm"
    />
  );
}

/* Block calendar-22 : date picker en popover. */
function CalendarDatePickerDemo() {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>();
  return (
    <div className="flex flex-col gap-3">
      <Label htmlFor="ds-cal-date" className="px-1">
        Date d'arrivée
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" id="ds-cal-date" className="w-48 justify-between font-normal">
            {date ? date.toLocaleDateString('fr-FR') : 'Choisir une date'}
            <ChevronDownIcon />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            captionLayout="dropdown"
            onSelect={(next) => {
              setDate(next);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* Block calendar-23 : date range picker en popover. */
function CalendarRangePickerDemo() {
  const [range, setRange] = useState<DateRange | undefined>();
  return (
    <div className="flex flex-col gap-3">
      <Label htmlFor="ds-cal-dates" className="px-1">
        Dates du séjour
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" id="ds-cal-dates" className="w-64 justify-between font-normal">
            {range?.from && range?.to
              ? `${range.from.toLocaleDateString('fr-FR')} – ${range.to.toLocaleDateString('fr-FR')}`
              : 'Choisir les dates'}
            <ChevronDownIcon />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar mode="range" selected={range} captionLayout="dropdown" onSelect={setRange} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* Block calendar-19 : présets rapides sous le calendrier. */
function CalendarPresetsDemo() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  return (
    <Card className="max-w-[300px] py-4">
      <CardContent className="px-4">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          defaultMonth={date}
          className="bg-transparent p-0 [--cell-size:2.375rem]"
        />
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 border-t px-4 pt-4 pb-0">
        {[
          { label: "Aujourd'hui", value: 0 },
          { label: 'Demain', value: 1 },
          { label: 'Dans 3 jours', value: 3 },
          { label: 'Dans 1 semaine', value: 7 },
        ].map((preset) => (
          <Button
            key={preset.value}
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setDate(addDays(new Date(), preset.value))}
          >
            {preset.label}
          </Button>
        ))}
      </CardFooter>
    </Card>
  );
}

function DrawerDemo() {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline">Ouvrir le drawer (mobile)</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Filtres du planning</DrawerTitle>
          <DrawerDescription>Optimisé mobile — glisser vers le bas pour fermer.</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <Button>Appliquer</Button>
          <DrawerClose asChild>
            <Button variant="outline">Annuler</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function InputOtpDemo() {
  return (
    <InputOTP maxLength={6}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  );
}

/* Exemple input-otp-pattern : accepte chiffres ET lettres. */
function InputOtpPatternDemo() {
  return (
    <InputOTP maxLength={6} pattern={REGEXP_ONLY_DIGITS_AND_CHARS}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  );
}

/* Exemple input-otp-separator : séparateur entre chaque paire. */
function InputOtpPairsDemo() {
  return (
    <InputOTP maxLength={6}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={2} />
        <InputOTPSlot index={3} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  );
}

/* Exemple input-otp-controlled : valeur pilotée par l'état React. */
function InputOtpControlledDemo() {
  const [value, setValue] = useState('');
  return (
    <div className="flex flex-col gap-2">
      <InputOTP maxLength={6} value={value} onChange={setValue}>
        <InputOTPGroup>
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <InputOTPSlot key={index} index={index} />
          ))}
        </InputOTPGroup>
      </InputOTP>
      <div className="text-sm text-muted-foreground">
        {value === '' ? 'Saisis le code à 6 chiffres.' : `Code saisi : ${value}`}
      </div>
    </div>
  );
}

function CarouselDemo() {
  return (
    <Carousel className="mx-12 max-w-xs">
      <CarouselContent>
        {['Riad Yasmine', 'Duplex Guéliz', 'Appartement Maârif', 'Villa Palmeraie'].map((name) => (
          <CarouselItem key={name}>
            <div className="flex h-32 items-center justify-center rounded-lg border bg-muted text-sm font-medium">
              {name}
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}

function ResizableDemo() {
  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="h-40 max-w-xl rounded-lg border"
    >
      <ResizablePanel defaultSize={30} className="flex items-center justify-center text-sm text-muted-foreground">
        Liste
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel className="flex items-center justify-center text-sm text-muted-foreground">
        Détail
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

const guestInviteSchema = z.object({
  email: z.string().email('Adresse email invalide'),
});

function FormDemo() {
  const form = useForm<z.infer<typeof guestInviteSchema>>({
    resolver: zodResolver(guestInviteSchema),
    defaultValues: { email: '' },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(() =>
          toast.success('Invitation envoyée', { description: 'Le guest recevra le lien du portail.' })
        )}
        className="flex max-w-sm flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email du guest</FormLabel>
              <FormControl>
                <Input placeholder="amina@exemple.ma" {...field} />
              </FormControl>
              <FormDescription>Recevra le lien du portail guest.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="self-start">
          Envoyer l'invitation
        </Button>
      </form>
    </Form>
  );
}

const CHART_DATA = [
  { month: 'Mars', direct: 12, ota: 21 },
  { month: 'Avril', direct: 18, ota: 24 },
  { month: 'Mai', direct: 22, ota: 28 },
  { month: 'Juin', direct: 27, ota: 31 },
  { month: 'Juil.', direct: 34, ota: 38 },
];

const CHART_CONFIG = {
  direct: { label: 'Direct', color: 'var(--bui-chart-1)' },
  ota: { label: 'OTA', color: 'var(--bui-chart-2)' },
} satisfies ChartConfig;

function ChartDemo() {
  return (
    <ChartContainer config={CHART_CONFIG} className="h-56 w-full max-w-xl">
      <BarChart accessibilityLayer data={CHART_DATA}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="direct" fill="var(--color-direct)" radius={4} />
        <Bar dataKey="ota" fill="var(--color-ota)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}

/* Exemples chart-* du site shadcn, adaptés aux données PMS. */

const OCCUPANCY_CONFIG = {
  occupancy: { label: 'Occupation', color: 'var(--bui-chart-1)' },
} satisfies ChartConfig;

const OCCUPANCY_DATA = [
  { month: 'Février', occupancy: 46 },
  { month: 'Mars', occupancy: 58 },
  { month: 'Avril', occupancy: 64 },
  { month: 'Mai', occupancy: 61 },
  { month: 'Juin', occupancy: 72 },
  { month: 'Juillet', occupancy: 84 },
];

function ChartAreaDemo() {
  return (
    <ChartContainer config={OCCUPANCY_CONFIG} className="h-56 w-full max-w-xl">
      <AreaChart accessibilityLayer data={OCCUPANCY_DATA} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value: string) => value.slice(0, 3)}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
        <Area
          dataKey="occupancy"
          type="natural"
          fill="var(--color-occupancy)"
          fillOpacity={0.4}
          stroke="var(--color-occupancy)"
        />
      </AreaChart>
    </ChartContainer>
  );
}

function ChartAreaStackedDemo() {
  return (
    <ChartContainer config={CHART_CONFIG} className="h-56 w-full max-w-xl">
      <AreaChart accessibilityLayer data={CHART_DATA} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value: string) => value.slice(0, 3)}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
        <Area
          dataKey="ota"
          type="natural"
          fill="var(--color-ota)"
          fillOpacity={0.4}
          stroke="var(--color-ota)"
          stackId="a"
        />
        <Area
          dataKey="direct"
          type="natural"
          fill="var(--color-direct)"
          fillOpacity={0.4}
          stroke="var(--color-direct)"
          stackId="a"
        />
      </AreaChart>
    </ChartContainer>
  );
}

const REVENUE_CONFIG = {
  revenue: { label: 'Revenus (€)', color: 'var(--bui-chart-1)' },
} satisfies ChartConfig;

const REVENUE_DATA = [
  { property: 'Riad Yasmine', revenue: 12400 },
  { property: 'Duplex Guéliz', revenue: 8600 },
  { property: 'Appart Maârif', revenue: 6900 },
  { property: 'Villa Palmeraie', revenue: 15800 },
];

function ChartBarHorizontalDemo() {
  return (
    <ChartContainer config={REVENUE_CONFIG} className="h-56 w-full max-w-xl">
      <BarChart accessibilityLayer data={REVENUE_DATA} layout="vertical" margin={{ left: 30 }}>
        <XAxis type="number" dataKey="revenue" hide />
        <YAxis
          dataKey="property"
          type="category"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={5} />
      </BarChart>
    </ChartContainer>
  );
}

function ChartLineMultipleDemo() {
  return (
    <ChartContainer config={CHART_CONFIG} className="h-56 w-full max-w-xl">
      <LineChart accessibilityLayer data={CHART_DATA} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value: string) => value.slice(0, 3)}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Line
          dataKey="direct"
          type="monotone"
          stroke="var(--color-direct)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          dataKey="ota"
          type="monotone"
          stroke="var(--color-ota)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}

const CHANNEL_CONFIG = {
  reservations: { label: 'Réservations' },
  direct: { label: 'Direct', color: 'var(--bui-chart-1)' },
  airbnb: { label: 'Airbnb', color: 'var(--bui-chart-2)' },
  booking: { label: 'Booking', color: 'var(--bui-chart-3)' },
  vrbo: { label: 'Vrbo', color: 'var(--bui-chart-4)' },
  autres: { label: 'Autres', color: 'var(--bui-chart-5)' },
} satisfies ChartConfig;

const CHANNEL_DATA = [
  { channel: 'direct', reservations: 86, fill: 'var(--color-direct)' },
  { channel: 'airbnb', reservations: 124, fill: 'var(--color-airbnb)' },
  { channel: 'booking', reservations: 97, fill: 'var(--color-booking)' },
  { channel: 'vrbo', reservations: 41, fill: 'var(--color-vrbo)' },
  { channel: 'autres', reservations: 27, fill: 'var(--color-autres)' },
];

const CHANNEL_TOTAL = CHANNEL_DATA.reduce((acc, curr) => acc + curr.reservations, 0);

function ChartPieDonutDemo() {
  return (
    <ChartContainer config={CHANNEL_CONFIG} className="mx-auto aspect-square max-h-[250px]">
      <PieChart>
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Pie
          data={CHANNEL_DATA}
          dataKey="reservations"
          nameKey="channel"
          innerRadius={60}
          strokeWidth={5}
        >
          <RechartsLabel
            content={({ viewBox }) => {
              if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                return (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                    <tspan
                      x={viewBox.cx}
                      y={viewBox.cy}
                      className="fill-foreground text-3xl font-bold"
                    >
                      {CHANNEL_TOTAL.toLocaleString('fr-FR')}
                    </tspan>
                    <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground">
                      réservations
                    </tspan>
                  </text>
                );
              }
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}

function ChartRadarDemo() {
  return (
    <ChartContainer config={OCCUPANCY_CONFIG} className="mx-auto aspect-square max-h-[250px]">
      <RadarChart data={OCCUPANCY_DATA}>
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <PolarAngleAxis dataKey="month" />
        <PolarGrid />
        <Radar dataKey="occupancy" fill="var(--color-occupancy)" fillOpacity={0.6} />
      </RadarChart>
    </ChartContainer>
  );
}

const RADIAL_CONFIG = {
  occupancy: { label: 'Occupation' },
  july: { label: 'Juillet', color: 'var(--bui-chart-2)' },
} satisfies ChartConfig;

const RADIAL_DATA = [{ month: 'july', occupancy: 84, fill: 'var(--color-july)' }];

function ChartRadialDemo() {
  return (
    <ChartContainer config={RADIAL_CONFIG} className="mx-auto aspect-square max-h-[250px]">
      <RadialBarChart
        data={RADIAL_DATA}
        startAngle={0}
        endAngle={302}
        outerRadius={90}
        innerRadius={80}
      >
        <PolarGrid
          gridType="circle"
          radialLines={false}
          stroke="none"
          className="first:fill-muted last:fill-background"
          polarRadius={[90, 80]}
        />
        <RadialBar dataKey="occupancy" background cornerRadius={10} />
        <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
          <RechartsLabel
            content={({ viewBox }) => {
              if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                return (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                    <tspan
                      x={viewBox.cx}
                      y={viewBox.cy}
                      className="fill-foreground text-4xl font-bold"
                    >
                      84 %
                    </tspan>
                    <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground">
                      occupation
                    </tspan>
                  </text>
                );
              }
            }}
          />
        </PolarRadiusAxis>
      </RadialBarChart>
    </ChartContainer>
  );
}

function KbdDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <KbdGroup>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
      <span className="text-sm text-muted-foreground">ouvre la palette de commandes</span>
    </div>
  );
}

function SpinnerDemo() {
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Synchronisation en cours…
      </div>
      <Button disabled>
        <Spinner /> Génération de la facture
      </Button>
    </div>
  );
}

function ButtonGroupDemo() {
  return (
    <ButtonGroup>
      <Button variant="outline">Jour</Button>
      <Button variant="outline">Semaine</Button>
      <ButtonGroupSeparator />
      <Button variant="outline">Mois</Button>
    </ButtonGroup>
  );
}

function InputGroupDemo() {
  return (
    <InputGroup className="max-w-md">
      <InputGroupInput placeholder="Rechercher une réservation…" />
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupAddon align="inline-end">
        <InputGroupButton>Rechercher</InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

function FieldDemo() {
  return (
    <FieldGroup className="max-w-sm">
      <Field>
        <FieldLabel htmlFor="ds-field-price">Prix nuit de base</FieldLabel>
        <Input id="ds-field-price" placeholder="120" />
        <FieldDescription>Appliqué quand aucune saison ni promotion ne matche.</FieldDescription>
      </Field>
      <Field orientation="horizontal">
        <Switch id="ds-field-sync" defaultChecked />
        <FieldLabel htmlFor="ds-field-sync">Publier sur les canaux connectés</FieldLabel>
      </Field>
    </FieldGroup>
  );
}

function ItemDemo() {
  return (
    <Item variant="outline" className="max-w-md">
      <ItemMedia variant="icon">
        <Mail />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Message de Amina Benali</ItemTitle>
        <UiItemDescription>« Bonjour, à quelle heure peut-on arriver ? »</UiItemDescription>
      </ItemContent>
      <ItemActions>
        <Button size="sm" variant="outline">
          Répondre
        </Button>
      </ItemActions>
    </Item>
  );
}

function EmptyDemo() {
  return (
    <Empty className="max-w-md border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Search />
        </EmptyMedia>
        <EmptyTitle>Aucune réservation</EmptyTitle>
        <EmptyDescription>
          Aucune réservation ne correspond à ces filtres. Élargis la période ou réinitialise la
          recherche.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/* Navigation PMS réelle (useNavigationMenu/navigationHubs) : 1 entrée par hub,
   sous-menus = onglets du hub. Badges réels : Planning = cartes HITL en attente
   (warning), Documents = échecs d'envoi récents (destructive). */
interface SidebarNavItem {
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string;
  badgeTone?: 'warning' | 'destructive';
  active?: boolean;
  defaultOpen?: boolean;
  sub?: string[];
}

const SIDEBAR_NAV: Array<{ group: string; items: SidebarNavItem[] }> = [
  {
    group: 'Principal',
    items: [
      { label: 'Planning', icon: CalendarDaysIcon, badge: '12', badgeTone: 'warning' },
      { label: 'Tableau de bord', icon: LayoutDashboardIcon },
      {
        label: 'Exploitation',
        icon: HomeIcon,
        defaultOpen: true,
        sub: ['Propriétés', 'Réservations', 'Interventions'],
      },
    ],
  },
  {
    group: 'Gestion',
    items: [
      { label: 'Contacts', icon: UsersIcon, sub: ['Messagerie', 'Annuaire'] },
      {
        label: 'Documents',
        icon: FileTextIcon,
        badge: '3',
        badgeTone: 'destructive',
        sub: ['Documents', 'Contrats de gestion'],
      },
      { label: 'Finances', icon: EuroIcon, sub: ['Facturation', 'Tarification'] },
      {
        label: 'Distribution',
        icon: Share2Icon,
        sub: ['Réservation & accueil', 'Boutique', 'Channels'],
      },
      { label: 'Rapports', icon: BarChart3Icon },
      { label: 'Mes tarifs travaux', icon: WrenchIcon },
    ],
  },
  {
    group: 'Administration',
    items: [
      { label: 'Paramètres', icon: SettingsIcon },
      { label: 'Automatisations', icon: ZapIcon },
      { label: 'Rôles & permissions', icon: ShieldCheckIcon },
      { label: 'Monitoring', icon: ActivityIcon },
      { label: 'Bibliothèque UI', icon: PaletteIcon, active: true },
      {
        label: 'Outils plateforme',
        icon: HammerIcon,
        sub: ['Diagnostics sync', 'KPI readiness', 'Taux de change', 'Base de données', 'Codes promo'],
      },
    ],
  },
];

function SidebarNavBadge({ item }: { item: SidebarNavItem }) {
  if (!item.badge) return null;
  return (
    <span
      className={cn(
        'ms-auto flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums',
        item.badgeTone === 'destructive'
          ? 'bg-destructive/15 text-destructive'
          : 'bg-warning/15 text-warning',
      )}
    >
      {item.badge}
    </span>
  );
}

function SidebarNavEntry({ item }: { item: SidebarNavItem }) {
  const Icon = item.icon;

  if (!item.sub) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton isActive={item.active} tooltip={item.label}>
          <Icon />
          <span>{item.label}</span>
          <SidebarNavBadge item={item} />
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible asChild defaultOpen={item.defaultOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.label}>
            <Icon />
            <span>{item.label}</span>
            <SidebarNavBadge item={item} />
            <ChevronRightIcon
              className={cn(
                'transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90',
                !item.badge && 'ms-auto',
              )}
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.sub.map((label) => (
              <SidebarMenuSubItem key={label}>
                <SidebarMenuSubButton>{label}</SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function SidebarDemo() {
  return (
    /* Le wrapper porte un `transform` : il devient le containing block des
       éléments `position: fixed` de la Sidebar, qui reste donc confinée au
       canvas au lieu de recouvrir le viewport. h-full/min-h-full neutralisent
       les hauteurs viewport (h-svh) via tailwind-merge. */
    <div className="h-[36rem] overflow-hidden rounded-lg border [transform:translateZ(0)]">
      <SidebarProvider className="h-full min-h-full">
        <Sidebar collapsible="icon" className="h-full">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" tooltip="Baitly PMS">
                  <span className="flex size-8 shrink-0 items-center justify-center">
                    <BaitlyMarkLogo variant="mark" size={30} />
                  </span>
                  <span className="grid flex-1 text-start leading-tight">
                    <span className="truncate text-sm font-semibold">Baitly</span>
                    <span className="truncate text-xs text-muted-foreground">
                      Property Management
                    </span>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            {SIDEBAR_NAV.map((section) => (
              <SidebarGroup key={section.group}>
                <SidebarGroupLabel>{section.group}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => (
                      <SidebarNavEntry key={item.label} item={item} />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" tooltip="Compte">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                    TM
                  </span>
                  <span className="grid flex-1 text-start leading-tight">
                    <span className="truncate text-sm font-medium">Toufik M.</span>
                    <span className="truncate text-xs text-muted-foreground">Super admin</span>
                  </span>
                  <ChevronDownIcon className="ms-auto size-4" />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>
        <SidebarInset className="min-h-0">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <span className="text-sm font-medium">Bibliothèque UI</span>
          </header>
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Zone de contenu — replie la sidebar avec le bouton ci-dessus (mode icônes + tooltips).
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

// ─── Nuancier tokens ─────────────────────────────────────────────────────────

const TOKEN_SWATCHES: Array<{ name: string; varName: string; border?: boolean }> = [
  { name: 'primary', varName: '--bui-primary' },
  { name: 'primary-deep', varName: '--bui-primary-deep' },
  { name: 'background', varName: '--bui-background', border: true },
  { name: 'card', varName: '--bui-card', border: true },
  { name: 'field', varName: '--bui-field', border: true },
  { name: 'border', varName: '--bui-border', border: true },
  { name: 'ink', varName: '--bui-ink' },
  { name: 'muted', varName: '--bui-muted-foreground' },
  { name: 'success', varName: '--bui-success' },
  { name: 'warning', varName: '--bui-warning' },
  { name: 'destructive', varName: '--bui-destructive' },
  { name: 'info', varName: '--bui-info' },
];

function TokensDemo() {
  return (
    <div className="flex flex-wrap gap-4">
      {TOKEN_SWATCHES.map((swatch) => (
        <div key={swatch.name} className="flex flex-col items-center gap-1.5">
          <div
            className={`size-12 rounded-md ${swatch.border ? 'border border-input' : ''}`}
            style={{ backgroundColor: `var(${swatch.varName})` }}
          />
          <span className="text-2xs text-muted-foreground">{swatch.name}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

type GalleryCategory = 'foundations' | 'forms' | 'display' | 'overlays' | 'navigation' | 'primitives' | 'projections';

interface GalleryVariant {
  key: string;
  label: string;
  Demo: ComponentType;
  /** Nom registry du composant — branche les exemples du site (EXAMPLE_DEMOS). */
  component?: string;
}

/** Fusionne nos démos maison avec les exemples du site shadcn portés. */
function mergedVariants(own: GalleryVariant[], component?: string): GalleryVariant[] {
  const site = component ? (EXAMPLE_DEMOS[component] ?? []) : [];
  return [
    ...own,
    ...site.map((s) => ({ key: `site-${s.key}`, label: s.label, Demo: s.Demo })),
  ];
}

interface GallerySectionDef {
  title: string;
  i18nKey: string;
  fallback: string;
  category: GalleryCategory;
  /** Sous-groupe de navigation dans l'onglet (chips) — évite le long scroll. */
  group?: string;
  /** Paramètres d'interpolation i18n de la description (ex. {{file}}). */
  i18nParams?: Record<string, string>;
  /** Nom registry du composant (sections mono-composant). */
  component?: string;
  /** 1+ variantes (façon exemples multiples du site shadcn). */
  variants: GalleryVariant[];
  /**
   * - 'select' (défaut) : implémentations multiples d'un MÊME composant —
   *   un Select bascule entre elles (une seule affichée).
   * - 'stack' : la section regroupe PLUSIEURS composants distincts —
   *   tous affichés en même temps, chacun avec son propre mini-select
   *   d'implémentations.
   */
  display?: 'select' | 'stack';
  /** Classes additionnelles du canvas (ex. min-height pour les panneaux ancrés). */
  canvasClassName?: string;
}

const single = (Demo: ComponentType): GalleryVariant[] => [{ key: 'default', label: 'Défaut', Demo }];

/** Source unique des sections de la galerie — l'ordre est l'ordre d'affichage dans chaque onglet. */
const GALLERY_SECTIONS: GallerySectionDef[] = [
  // Fondations
  { category: 'foundations', title: 'Tokens', i18nKey: 'designSystem.tokens.description', fallback: "Identité Baitly : primaire bleu nuit #1B2A35 (couleur du wordmark), inversée en sombre sur navy #0A1120. Teintes du mark : #2563EB (info) et #14B8A6 (success). Dark via data-theme.", variants: single(TokensDemo) },
  { category: 'foundations', title: 'Chart', component: 'chart', i18nKey: 'designSystem.chart.description', fallback: "Wrapper Recharts : config déclarative, tooltip thématisé, séries chart-1..5. Types repris des exemples du site shadcn, données PMS.", variants: [
    { key: 'bar', label: 'Barres', Demo: ChartDemo },
    { key: 'bar-horizontal', label: 'Barres horizontales', Demo: ChartBarHorizontalDemo },
    { key: 'area', label: 'Aires', Demo: ChartAreaDemo },
    { key: 'area-stacked', label: 'Aires empilées', Demo: ChartAreaStackedDemo },
    { key: 'line', label: 'Lignes', Demo: ChartLineMultipleDemo },
    { key: 'donut', label: 'Donut (total centré)', Demo: ChartPieDonutDemo },
    { key: 'radar', label: 'Radar', Demo: ChartRadarDemo },
    { key: 'radial', label: 'Radial (KPI)', Demo: ChartRadialDemo },
  ] },
  { category: 'foundations', title: 'Kbd & Spinner', i18nKey: 'designSystem.kbdSpinner.description', fallback: "Touche clavier pour documenter les raccourcis et indicateur de chargement inline.", display: 'stack', variants: [
    { key: 'kbd', label: 'Kbd', component: 'kbd', Demo: KbdDemo },
    { key: 'spinner', label: 'Spinner', component: 'spinner', Demo: SpinnerDemo },
  ] },
  // Formulaires
  { category: 'forms', title: 'Button', component: 'button', i18nKey: 'designSystem.button.description', fallback: "Variants, tailles, icônes et états — classes alignées sur shadcn v4. Focus clavier visible.", variants: [
    { key: 'variants', label: 'Variants', Demo: ButtonVariantsDemo },
    { key: 'sizes', label: 'Tailles', Demo: ButtonSizesDemo },
    { key: 'icons', label: 'Icônes & états', Demo: ButtonIconStatesDemo },
  ] },
  { category: 'forms', title: 'Input', component: 'input', i18nKey: 'designSystem.input.description', fallback: "Fond transparent, bordure neutre, focus en anneau. Icônes positionnées en propriétés logiques (compatibles RTL).", variants: [
    { key: 'basic', label: 'Simple', Demo: InputBasicDemo },
    { key: 'icon', label: 'Avec icône', Demo: InputIconDemo },
  ] },
  { category: 'forms', title: 'Label & Textarea', i18nKey: 'designSystem.formControls.description', fallback: "Libellés associés (htmlFor) et zone de texte multi-lignes, mêmes états de focus que l'Input.", display: 'stack', variants: [
    { key: 'label', label: 'Label + Input', component: 'label', Demo: LabelInputDemo },
    { key: 'textarea', label: 'Textarea', component: 'textarea', Demo: TextareaDemo },
  ] },
  { category: 'forms', title: 'Checkbox, Radio & Switch', i18nKey: 'designSystem.selectionControls.description', fallback: "Contrôles de sélection Radix : coche, choix exclusif, interrupteur. Navigation clavier et états désactivés.", display: 'stack', variants: [
    { key: 'checkbox', label: 'Checkbox', component: 'checkbox', Demo: CheckboxDemo },
    { key: 'radio', label: 'Radio Group', component: 'radio-group', Demo: RadioGroupDemo },
    { key: 'switch', label: 'Switch', component: 'switch', Demo: SwitchDemo },
  ] },
  { category: 'forms', title: 'Select', component: 'select', i18nKey: 'designSystem.select.description', fallback: "Liste déroulante Radix : groupes, libellés, items désactivés, taille sm. Le menu s'affiche en portail (thème global).", variants: [
    { key: 'grouped', label: 'Groupé', Demo: SelectGroupedDemo },
    { key: 'compact', label: 'Compact (sm)', Demo: SelectCompactDemo },
  ] },
  { category: 'forms', title: 'Toggle, Toggle Group & Slider', i18nKey: 'designSystem.toggleSlider.description', fallback: "Bascules à état pressé, groupe exclusif (vues planning) et curseur de valeur.", display: 'stack', variants: [
    { key: 'toggle', label: 'Toggle', component: 'toggle', Demo: ToggleDemo },
    { key: 'group', label: 'Toggle Group', component: 'toggle-group', Demo: ToggleGroupDemo },
    { key: 'slider', label: 'Slider', component: 'slider', Demo: SliderDemo },
  ] },
  { category: 'forms', title: 'Button Group & Input Group', i18nKey: 'designSystem.buttonInputGroups.description', fallback: "Boutons accolés (segments) et champ composé avec addons (icône, bouton d'action).", display: 'stack', variants: [
    { key: 'button', label: 'Button Group', component: 'button-group', Demo: ButtonGroupDemo },
    { key: 'input', label: 'Input Group', component: 'input-group', Demo: InputGroupDemo },
  ] },
  { category: 'forms', title: 'Field', component: 'field', i18nKey: 'designSystem.field.description', fallback: "Mise en page de formulaire déclarative (vertical/horizontal), sans lib de formulaire — complément léger de Form.", variants: single(FieldDemo) },
  { category: 'forms', title: 'Form', i18nKey: 'designSystem.form.description', fallback: "Couche formulaire react-hook-form + zod : label, contrôle, description et message d'erreur reliés (aria).", variants: single(FormDemo) },
  { category: 'forms', title: 'Input OTP', component: 'input-otp', i18nKey: 'designSystem.inputOtp.description', fallback: "Saisie de code (2FA, codes serrures) : collage supporté, navigation clavier. Implémentations reprises des exemples du site shadcn.", variants: [
    { key: 'default', label: 'Groupes + séparateur', Demo: InputOtpDemo },
    { key: 'pattern', label: 'Chiffres et lettres', Demo: InputOtpPatternDemo },
    { key: 'pairs', label: 'Séparateurs (paires)', Demo: InputOtpPairsDemo },
    { key: 'controlled', label: 'Contrôlé', Demo: InputOtpControlledDemo },
  ] },
  { category: 'forms', title: 'Calendar', component: 'calendar', i18nKey: 'designSystem.calendar.description', fallback: "Calendrier react-day-picker — implémentations reprises des blocks du site shadcn : prix par nuit, jours réservés, séjour minimum, pickers en popover, présets.", variants: [
    { key: 'range', label: 'Plage (2 mois)', Demo: CalendarRangeDemo },
    { key: 'single', label: 'Jour unique', Demo: CalendarSingleDemo },
    { key: 'pricing', label: 'Prix par nuit', Demo: CalendarPricingDemo },
    { key: 'booked', label: 'Jours réservés', Demo: CalendarBookedDemo },
    { key: 'min-stay', label: 'Séjour minimum', Demo: CalendarMinStayDemo },
    { key: 'dropdown', label: 'Dropdown mois/année', Demo: CalendarDropdownDemo },
    { key: 'picker', label: 'Date picker (popover)', Demo: CalendarDatePickerDemo },
    { key: 'range-picker', label: 'Date range picker', Demo: CalendarRangePickerDemo },
    { key: 'presets', label: 'Présets rapides', Demo: CalendarPresetsDemo },
  ] },
  // Affichage
  { category: 'display', title: 'Badge', component: 'badge', i18nKey: 'designSystem.badge.description', fallback: "Variants shadcn (default/secondary/outline/destructive) + statuts PMS sur fonds doux de la palette d'accents.", variants: single(BadgeDemo) },
  { category: 'display', title: 'Card', component: 'card', i18nKey: 'designSystem.card.description', fallback: "Surface, bordure fine et ombre légère. Composition Header / Content / Footer.", variants: single(CardDemo) },
  { category: 'display', title: 'Table', component: 'table', i18nKey: 'designSystem.table.description', fallback: "Tableau de données : en-têtes, survol de ligne, alignements logiques (RTL) et chiffres tabulaires.", variants: single(TableDemo) },
  { category: 'display', title: 'Alert', component: 'alert', i18nKey: 'designSystem.alert.description', fallback: "Message contextuel inline avec icône, titre et description. Variante destructive.", variants: [
    { key: 'default', label: 'Défaut', Demo: AlertDefaultDemo },
    { key: 'destructive', label: 'Destructive', Demo: AlertDestructiveDemo },
  ] },
  { category: 'display', title: 'Avatar, Progress, Skeleton & Separator', i18nKey: 'designSystem.feedback.description', fallback: "Identité et états d'attente : avatar avec fallback initiales, barre de progression, squelettes de chargement, séparateurs.", display: 'stack', variants: [
    { key: 'avatar', label: 'Avatar', component: 'avatar', Demo: AvatarDemo },
    { key: 'progress', label: 'Progress', component: 'progress', Demo: ProgressDemo },
    { key: 'skeleton', label: 'Skeleton', component: 'skeleton', Demo: SkeletonDemo },
    { key: 'separator', label: 'Separator', component: 'separator', Demo: SeparatorDemo },
  ] },
  { category: 'display', title: 'Item & Empty', i18nKey: 'designSystem.itemEmpty.description', fallback: "Ligne de liste générique (média, contenu, actions) et état vide standardisé.", display: 'stack', variants: [
    { key: 'item', label: 'Item', component: 'item', Demo: ItemDemo },
    { key: 'empty', label: 'Empty', component: 'empty', Demo: EmptyDemo },
  ] },
  { category: 'display', title: 'Accordion & Collapsible', i18nKey: 'designSystem.accordionCollapsible.description', fallback: "Sections dépliables : FAQ, détails progressifs. Animation de hauteur native Radix.", display: 'stack', variants: [
    { key: 'accordion', label: 'Accordion', component: 'accordion', Demo: AccordionDemo },
    { key: 'collapsible', label: 'Collapsible', component: 'collapsible', Demo: CollapsibleDemo },
  ] },
  { category: 'display', title: 'Hover Card & Scroll Area', i18nKey: 'designSystem.hoverCardScroll.description', fallback: "Aperçu riche au survol d'un lien et zone défilante à scrollbar stylée.", display: 'stack', variants: [
    { key: 'hover-card', label: 'Hover Card', component: 'hover-card', Demo: HoverCardDemo },
    { key: 'scroll-area', label: 'Scroll Area', component: 'scroll-area', Demo: ScrollAreaDemo },
  ] },
  { category: 'display', title: 'Carousel', component: 'carousel', i18nKey: 'designSystem.carousel.description', fallback: "Carrousel Embla : défilement des photos de logements, flèches et clavier.", variants: single(CarouselDemo) },
  { category: 'display', title: 'Resizable', component: 'resizable', i18nKey: 'designSystem.resizable.description', fallback: "Panneaux redimensionnables (liste/détail) avec poignée accessible au clavier.", variants: single(ResizableDemo) },
  // Overlays
  { category: 'overlays', title: 'Dialog', component: 'dialog', i18nKey: 'designSystem.dialog.description', fallback: "Boîte modale Radix : overlay, animations d'entrée/sortie, fermeture Échap/clic dehors. S'affiche en portail (thème global).", variants: single(DialogDemo) },
  { category: 'overlays', title: 'Alert Dialog', component: 'alert-dialog', i18nKey: 'designSystem.alertDialog.description', fallback: "Confirmation bloquante pour les actions irréversibles — pas de fermeture au clic dehors. S'affiche en portail (thème global).", variants: single(AlertDialogDemo) },
  { category: 'overlays', title: 'Sheet', component: 'sheet', i18nKey: 'designSystem.sheet.description', fallback: "Panneau latéral coulissant (drawer) pour le détail d'un élément sans quitter l'écran. S'affiche en portail (thème global).", variants: single(SheetDemo) },
  { category: 'overlays', title: 'Drawer', component: 'drawer', i18nKey: 'designSystem.drawer.description', fallback: "Tiroir bas façon mobile (Vaul) : geste de glissement pour fermer. Complément mobile du Sheet.", variants: single(DrawerDemo) },
  { category: 'overlays', title: 'Tooltip & Popover', i18nKey: 'designSystem.tooltipPopover.description', fallback: "Infobulle au survol et panneau flottant riche. S'affichent en portail (thème global).", display: 'stack', variants: [
    { key: 'tooltip', label: 'Tooltip', component: 'tooltip', Demo: TooltipDemo },
    { key: 'popover', label: 'Popover', component: 'popover', Demo: PopoverDemo },
  ] },
  { category: 'overlays', title: 'Dropdown Menu', component: 'dropdown-menu', i18nKey: 'designSystem.dropdownMenu.description', fallback: "Menu d'actions contextuel : libellés, séparateurs, raccourcis, item destructif. S'affiche en portail (thème global).", variants: single(DropdownMenuDemo) },
  { category: 'overlays', title: 'Context Menu & Menubar', i18nKey: 'designSystem.menus.description', fallback: "Menu au clic droit et barre de menus applicative. S'affichent en portail (thème global).", display: 'stack', variants: [
    { key: 'context', label: 'Context Menu', component: 'context-menu', Demo: ContextMenuDemo },
    { key: 'menubar', label: 'Menubar', component: 'menubar', Demo: MenubarDemo },
  ] },
  { category: 'overlays', title: 'Toast (Sonner)', component: 'sonner', i18nKey: 'designSystem.toast.description', fallback: "Notifications transitoires empilées : succès, erreur, action. Toaster monté sur la page, thème suivi via data-theme.", variants: single(ToastDemo) },
  { category: 'overlays', title: 'Command', component: 'command', i18nKey: 'designSystem.command.description', fallback: "Palette de commandes (cmdk) : recherche floue, groupes, navigation clavier. Base du futur ⌘K global.", variants: single(CommandDemo) },
  // Navigation
  { category: 'navigation', title: 'Tabs', component: 'tabs', i18nKey: 'designSystem.tabs.description', fallback: "Onglets Radix : variante par défaut (fond muted) et variante line (soulignement). Navigation clavier.", variants: [
    { key: 'default', label: 'Défaut', Demo: TabsDefaultDemo },
    { key: 'line', label: 'Line', Demo: TabsLineDemo },
  ] },
  { category: 'navigation', title: 'Breadcrumb & Pagination', i18nKey: 'designSystem.navigation.description', fallback: "Fil d'Ariane et pagination de listes, construits sur les variants du Button.", display: 'stack', variants: [
    { key: 'breadcrumb', label: 'Breadcrumb', component: 'breadcrumb', Demo: BreadcrumbDemo },
    { key: 'pagination', label: 'Pagination', component: 'pagination', Demo: PaginationDemo },
  ] },
  { category: 'navigation', title: 'Sidebar', i18nKey: 'designSystem.sidebar.description', fallback: "Navigation latérale complète : repli en mode icônes (tooltips), rail cliquable, sous-menus, badge. Démo confinée au canvas — en réel elle occupe toute la hauteur ; sous 768px elle bascule en Sheet mobile. Remplacera le Sidebar MUI à la migration de la navigation.", variants: single(SidebarDemo) },
  // Nouveaux composants (portés depuis la doc radix — démos = exemples du site)
  { category: 'display', title: 'Aspect Ratio', component: 'aspect-ratio', i18nKey: 'designSystem.aspectRatio.description', fallback: "Contraint un média à un ratio fixe (16/9, carré, portrait) — photos de logements.", variants: [] },
  { category: 'forms', title: 'Combobox', component: 'combobox', i18nKey: 'designSystem.combobox.description', fallback: "Select avec recherche (Base UI) : simple, multiple, groupes, chips — le futur sélecteur logement/guest.", variants: [] },
  { category: 'forms', title: 'Native Select', component: 'native-select', i18nKey: 'designSystem.nativeSelect.description', fallback: "<select> natif stylé : léger, idéal mobile et formulaires simples.", variants: [] },
  { category: 'navigation', title: 'Navigation Menu', component: 'navigation-menu', i18nKey: 'designSystem.navigationMenu.description', fallback: "Menu de navigation horizontal riche (panneaux, listes) — header marketing/booking engine. Le canvas réserve la hauteur d'ouverture des panneaux.", canvasClassName: 'min-h-[460px]', variants: [] },
  { category: 'display', title: 'Attachment', component: 'attachment', i18nKey: 'designSystem.attachment.description', fallback: "Pièce jointe (fichier/image) : états, tailles, groupes — messagerie guest et documents.", variants: [] },
  { category: 'display', title: 'Message', component: 'message', i18nKey: 'designSystem.message.description', fallback: "Message de chat : avatar, en-tête/pied, actions, pièces jointes — brique de la messagerie guest.", variants: [] },
  { category: 'display', title: 'Bubble', component: 'bubble', i18nKey: 'designSystem.bubble.description', fallback: "Bulles de conversation : variantes, alignements, réactions, groupes.", variants: [] },
  { category: 'display', title: 'Marker', component: 'marker', i18nKey: 'designSystem.marker.description', fallback: "Pastille de statut compacte : variantes, shimmer, icônes — statuts denses du planning.", variants: [] },
  // Primitives maison remasterisées (components/baitly/) — cf. onglet Primitives
  { category: 'primitives', group: 'Structure', title: 'PageHeader', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'PageHeader.tsx' }, fallback: "Remaster de components/PageHeader.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BPageHeaderDemo) },
  { category: 'primitives', group: 'Données', title: 'StatTile', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'StatTile.tsx' }, fallback: "Remaster de components/StatTile.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BStatTileDemo) },
  { category: 'primitives', group: 'États & feedback', title: 'EmptyState', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'EmptyState.tsx' }, fallback: "Remaster de components/EmptyState.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BEmptyStateDemo) },
  { category: 'primitives', group: 'Formulaires & filtres', title: 'FilterChipRow', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'FilterChipRow.tsx' }, fallback: "Remaster de components/FilterChipRow.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BFilterChipRowDemo) },
  { category: 'primitives', group: 'Formulaires & filtres', title: 'PeriodSegmented', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'PeriodSegmented.tsx' }, fallback: "Remaster de components/PeriodSegmented.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BPeriodSegmentedDemo) },
  { category: 'primitives', group: 'Données', title: 'StatusChip', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'StatusChip.tsx' }, fallback: "Remaster de components/StatusChip.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BStatusChipDemo) },
  { category: 'primitives', group: 'Données', title: 'Money', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'Money.tsx' }, fallback: "Remaster de components/Money.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BMoneyDemo) },
  { category: 'primitives', group: 'États & feedback', title: 'ListSkeleton', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'ListSkeleton.tsx' }, fallback: "Remaster de components/ListSkeleton.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BListSkeletonDemo) },
  { category: 'primitives', group: 'Formulaires & filtres', title: 'HeaderSearchField', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'HeaderSearchField.tsx' }, fallback: "Remaster de components/HeaderSearchField.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BHeaderSearchFieldDemo) },
  { category: 'primitives', group: 'Données', title: 'GuestAvatar', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'GuestAvatar.tsx' }, fallback: "Remaster de components/GuestAvatar.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BGuestAvatarDemo) },
  { category: 'primitives', group: 'Overlays', title: 'ConfirmationModal', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'ConfirmationModal.tsx' }, fallback: "Remaster de components/ConfirmationModal.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BConfirmationModalDemo) },
  // Vague 2
  { category: 'primitives', group: 'Structure', title: 'PageTabs', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'PageTabs.tsx' }, fallback: "Remaster de components/PageTabs.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BPageTabsDemo) },
  { category: 'primitives', group: 'Formulaires & filtres', title: 'FilterSearchBar', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'FilterSearchBar.tsx' }, fallback: "Remaster de components/FilterSearchBar.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BFilterSearchBarDemo) },
  { category: 'primitives', group: 'États & feedback', title: 'DataFetchWrapper', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'DataFetchWrapper.tsx' }, fallback: "Remaster de components/DataFetchWrapper.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BDataFetchWrapperDemo) },
  { category: 'primitives', group: 'États & feedback', title: 'HelpBanner', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'HelpBanner.tsx' }, fallback: "Remaster de components/HelpBanner.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BHelpBannerDemo) },
  { category: 'primitives', group: 'États & feedback', title: 'HelpPopover', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'HelpPopover.tsx' }, fallback: "Remaster de components/HelpPopover.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BHelpPopoverDemo) },
  { category: 'primitives', group: 'Formulaires & filtres', title: 'ExportButton', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'ExportButton.tsx' }, fallback: "Remaster de components/ExportButton.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BExportButtonDemo) },
  { category: 'primitives', group: 'États & feedback', title: 'LoadingStates', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'LoadingStates.tsx' }, fallback: "Remaster de components/LoadingStates.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BLoadingStatesDemo) },
  { category: 'primitives', group: 'Formulaires & filtres', title: 'DateRangePicker', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'MiniDateRangePicker.tsx' }, fallback: "Remaster de components/MiniDateRangePicker.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BDateRangePickerDemo) },
  { category: 'primitives', group: 'États & feedback', title: 'ThemedTooltip', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'ThemedTooltip.tsx' }, fallback: "Remaster de components/ThemedTooltip.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BThemedTooltipDemo) },
  // Vague 3 — composants métier
  { category: 'primitives', group: 'Données', title: 'RevenueByChannelCard', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'RevenueByChannelCard.tsx' }, fallback: "Remaster de components/RevenueByChannelCard.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BRevenueByChannelCardDemo) },
  { category: 'primitives', group: 'Données', title: 'ServiceRequestCard', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'ServiceRequestCard.tsx' }, fallback: "Remaster de components/ServiceRequestCard.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BServiceRequestCardDemo) },
  { category: 'primitives', group: 'Données', title: 'DescriptionNotesDisplay', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'DescriptionNotesDisplay.tsx' }, fallback: "Remaster de components/DescriptionNotesDisplay.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BDescriptionNotesDemo) },
  { category: 'primitives', group: 'États & feedback', title: 'OfflineBanner', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'OfflineBanner.tsx' }, fallback: "Remaster de components/OfflineBanner.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BOfflineBannerDemo) },
  // Vague 4 — composants partagés restants
  { category: 'primitives', group: 'Données', title: 'TeamCard', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'TeamCard.tsx' }, fallback: "Remaster de components/TeamCard.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BTeamCardDemo) },
  { category: 'primitives', group: 'Structure', title: 'HubScreenSwitcher', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'HubScreenSwitcher.tsx' }, fallback: "Remaster de components/HubScreenSwitcher.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BHubScreenSwitcherDemo) },
  { category: 'primitives', group: 'États & feedback', title: 'AppUpdateBanner', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'AppUpdateBanner.tsx' }, fallback: "Remaster de components/AppUpdateBanner.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BAppUpdateBannerDemo) },
  { category: 'primitives', group: 'États & feedback', title: 'PWAInstallBanner', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'PWAInstallBanner.tsx' }, fallback: "Remaster de components/PWAInstallBanner.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BPWAInstallBannerDemo) },
  { category: 'primitives', group: 'Overlays', title: 'AiCreditsPaywall', i18nKey: 'designSystem.remaster.description', i18nParams: { file: 'AiCreditsPaywall.tsx' }, fallback: "Remaster de components/AiCreditsPaywall.tsx (MUI) avec le kit Baitly UI — API équivalente, prêt pour la migration.", variants: single(BAiCreditsPaywallDemo) },
  // Sections d'écran (rendu cible de la migration — projections uniquement)
  { category: 'projections', group: 'Dashboard', title: 'Section — Dashboard', i18nKey: 'designSystem.section.description', i18nParams: { screen: 'Dashboard' }, fallback: "Section d'écran composée uniquement de primitives Baitly UI — aperçu du rendu cible de la migration de « Dashboard ».", variants: single(BDashboardSectionDemo) },
  { category: 'projections', group: 'Interventions', title: 'Section — Interventions', i18nKey: 'designSystem.section.description', i18nParams: { screen: 'Interventions' }, fallback: "Section d'écran composée uniquement de primitives Baitly UI — aperçu du rendu cible de la migration de « Interventions ».", variants: single(BInterventionsSectionDemo) },
  { category: 'projections', group: 'Fiche réservation', title: 'Section — Fiche réservation', i18nKey: 'designSystem.section.description', i18nParams: { screen: 'Fiche réservation' }, fallback: "Section d'écran composée uniquement de primitives Baitly UI — aperçu du rendu cible de la migration de « Fiche réservation ».", variants: single(BReservationDetailSectionDemo) },
  // Vague 5 — projections d'écrans supplémentaires
  { category: 'projections', group: 'Planning', title: 'Section — Planning', i18nKey: 'designSystem.section.description', i18nParams: { screen: 'Planning' }, fallback: "Section d'écran composée uniquement de primitives Baitly UI — aperçu du rendu cible de la migration de « Planning ».", variants: single(BPlanningSectionDemo) },
  { category: 'projections', group: 'Logements', title: 'Section — Logements', i18nKey: 'designSystem.section.description', i18nParams: { screen: 'Logements' }, fallback: "Section d'écran composée uniquement de primitives Baitly UI — aperçu du rendu cible de la migration de « Logements ».", variants: single(BPropertiesSectionDemo) },
  { category: 'projections', group: 'Guests', title: 'Section — Guests', i18nKey: 'designSystem.section.description', i18nParams: { screen: 'Guests' }, fallback: "Section d'écran composée uniquement de primitives Baitly UI — aperçu du rendu cible de la migration de « Guests ».", variants: single(BGuestsSectionDemo) },
  { category: 'projections', group: 'Messagerie', title: 'Section — Messagerie', i18nKey: 'designSystem.section.description', i18nParams: { screen: 'Messagerie' }, fallback: "Section d'écran composée uniquement de primitives Baitly UI — aperçu du rendu cible de la migration de « Messagerie ».", variants: single(BMessagingSectionDemo) },
  { category: 'projections', group: 'Facturation', title: 'Section — Facturation', i18nKey: 'designSystem.section.description', i18nParams: { screen: 'Facturation' }, fallback: "Section d'écran composée uniquement de primitives Baitly UI — aperçu du rendu cible de la migration de « Facturation ».", variants: single(BBillingSectionDemo) },
  { category: 'projections', group: 'Paramètres', title: 'Section — Paramètres', i18nKey: 'designSystem.section.description', i18nParams: { screen: 'Paramètres' }, fallback: "Section d'écran composée uniquement de primitives Baitly UI — aperçu du rendu cible de la migration de « Paramètres ».", variants: single(BSettingsSectionDemo) },
  // Vague 6 — projections d'écrans
  { category: 'projections', group: 'Tarification', title: 'Section — Tarification', i18nKey: 'designSystem.section.description', i18nParams: { screen: 'Tarification' }, fallback: "Section d'écran composée uniquement de primitives Baitly UI — aperçu du rendu cible de la migration de « Tarification ».", variants: single(BPricingSectionDemo) },
  { category: 'projections', group: 'Rapports', title: 'Section — Rapports', i18nKey: 'designSystem.section.description', i18nParams: { screen: 'Rapports' }, fallback: "Section d'écran composée uniquement de primitives Baitly UI — aperçu du rendu cible de la migration de « Rapports ».", variants: single(BReportsSectionDemo) },
  { category: 'projections', group: 'Onboarding', title: 'Section — Onboarding', i18nKey: 'designSystem.section.description', i18nParams: { screen: 'Onboarding' }, fallback: "Section d'écran composée uniquement de primitives Baitly UI — aperçu du rendu cible de la migration de « Onboarding ».", variants: single(BOnboardingSectionDemo) },
  { category: 'projections', group: 'Portail propriétaire', title: 'Section — Portail propriétaire', i18nKey: 'designSystem.section.description', i18nParams: { screen: 'Portail propriétaire' }, fallback: "Section d'écran composée uniquement de primitives Baitly UI — aperçu du rendu cible de la migration de « Portail propriétaire ».", variants: single(BOwnerPortalSectionDemo) },
  // Vague 7 — projections d'écrans
  { category: 'projections', group: 'Intégrations', title: 'Section — Intégrations', i18nKey: 'designSystem.section.description', i18nParams: { screen: 'Intégrations' }, fallback: "Section d'écran composée uniquement de primitives Baitly UI — aperçu du rendu cible de la migration de « Intégrations ».", variants: single(BIntegrationsSectionDemo) },
  { category: 'projections', group: 'Documents', title: 'Section — Documents', i18nKey: 'designSystem.section.description', i18nParams: { screen: 'Documents' }, fallback: "Section d'écran composée uniquement de primitives Baitly UI — aperçu du rendu cible de la migration de « Documents ».", variants: single(BDocumentsSectionDemo) },
  { category: 'projections', group: 'Notifications', title: 'Section — Notifications', i18nKey: 'designSystem.section.description', i18nParams: { screen: 'Notifications' }, fallback: "Section d'écran composée uniquement de primitives Baitly UI — aperçu du rendu cible de la migration de « Notifications ».", variants: single(BNotificationsSectionDemo) },
  { category: 'projections', group: 'Assistant IA', title: 'Section — Assistant IA', i18nKey: 'designSystem.section.description', i18nParams: { screen: 'Assistant IA' }, fallback: "Section d'écran composée uniquement de primitives Baitly UI — aperçu du rendu cible de la migration de « Assistant IA ».", variants: single(BAssistantSectionDemo) },
  { category: 'projections', group: 'Constellation agents', title: 'Section — Constellation d\'agents', i18nKey: 'designSystem.section.description', i18nParams: { screen: 'Constellation d\'agents' }, fallback: "Section d'écran composée uniquement de primitives Baitly UI — aperçu du rendu cible de la migration de « Constellation d'agents ».", variants: single(BAgentsConstellationSectionDemo) },
  { category: 'projections', group: 'Objets connectés', title: 'Section — Objets connectés', i18nKey: 'designSystem.section.description', i18nParams: { screen: 'Objets connectés' }, fallback: "Section d'écran composée uniquement de primitives Baitly UI — aperçu du rendu cible de la migration de « Objets connectés ».", variants: single(BIotSectionDemo) },
];

/** Section + sélecteur de variante (Select Baitly UI) quand il y en a plusieurs. */
function VariantSelect({
  options,
  value,
  onChange,
}: {
  options: GalleryVariant[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((v) => (
          <SelectItem key={v.key} value={v.key}>
            {v.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Bloc d'une section empilée : un composant + son mini-select d'implémentations. */
function StackBlock({ variant }: { variant: GalleryVariant }) {
  const options = mergedVariants([variant], variant.component);
  const [key, setKey] = useState(options[0].key);
  const active = options.find((o) => o.key === key) ?? options[0];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {variant.label}
        </h3>
        {options.length > 1 && <VariantSelect options={options} value={active.key} onChange={setKey} />}
      </div>
      <active.Demo />
    </div>
  );
}

function GallerySection({
  def,
  previewTheme,
  rtl,
}: {
  def: GallerySectionDef;
  previewTheme: PreviewTheme;
  rtl: boolean;
}) {
  const { t } = useTranslation();
  const stacked = def.display === 'stack';
  const options = stacked ? def.variants : mergedVariants(def.variants, def.component);
  const [variantKey, setVariantKey] = useState(options[0].key);
  const variant = options.find((v) => v.key === variantKey) ?? options[0];

  const selector =
    !stacked && options.length > 1 ? (
      <VariantSelect options={options} value={variant.key} onChange={setVariantKey} />
    ) : null;

  return (
    <Section
      title={def.title}
      description={t(def.i18nKey, { defaultValue: def.fallback, ...def.i18nParams })}
      previewTheme={previewTheme}
      rtl={rtl}
      action={selector}
      canvasClassName={def.canvasClassName}
    >
      {stacked ? (
        <div className="flex flex-col gap-8">
          {def.variants.map((v) => (
            <StackBlock key={v.key} variant={v} />
          ))}
        </div>
      ) : (
        <variant.Demo />
      )}
    </Section>
  );
}

export default function DesignSystemPage() {
  const { t } = useTranslation();
  const [previewTheme, setPreviewTheme] = useState<PreviewTheme>('light');
  const [rtl, setRtl] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const categories: Array<{ key: GalleryCategory; label: string; subtitle: string }> = [
    {
      key: 'foundations',
      label: t('tabHeaders.designSystem.foundations', 'Fondations'),
      subtitle: t('tabHeaders.designSystem.foundationsSub', 'Tokens monochromes, graphiques et primitives de base.'),
    },
    {
      key: 'forms',
      label: t('tabHeaders.designSystem.forms', 'Formulaires'),
      subtitle: t('tabHeaders.designSystem.formsSub', 'Saisie et contrôles : boutons, champs, sélection, validation.'),
    },
    {
      key: 'display',
      label: t('tabHeaders.designSystem.display', 'Affichage'),
      subtitle: t('tabHeaders.designSystem.displaySub', 'Surfaces, listes, états et médias.'),
    },
    {
      key: 'overlays',
      label: t('tabHeaders.designSystem.overlays', 'Overlays'),
      subtitle: t('tabHeaders.designSystem.overlaysSub', 'Modales, panneaux, menus et notifications en portail.'),
    },
    {
      key: 'navigation',
      label: t('tabHeaders.designSystem.navigation', 'Navigation'),
      subtitle: t('tabHeaders.designSystem.navigationSub', "Onglets, fil d'Ariane, pagination et sidebar."),
    },
    {
      key: 'primitives',
      label: t('tabHeaders.designSystem.primitives', 'Primitives Baitly'),
      subtitle: t('tabHeaders.designSystem.primitivesSub', 'Les primitives maison (PageHeader, StatTile…) remasterisées avec le kit — prêtes pour la migration.'),
    },
    {
      key: 'projections',
      label: t('tabHeaders.designSystem.projections', 'Projections'),
      subtitle: t('tabHeaders.designSystem.projectionsSub', 'Écrans du PMS reconstitués avec le kit — la maquette navigable de la cible. Un écran à la fois.'),
    },
  ];

  const { title, subtitle } = resolveTabHeader(
    t('designSystem.title', 'Bibliothèque Baitly UI'),
    t(
      'designSystem.subtitle',
      'Design system de la refonte — composants portés depuis shadcn/ui, palette monochrome'
    ),
    categories.map((c) => c.label),
    activeTab,
    Object.fromEntries(
      categories.map((c) => [c.label, { subtitle: c.subtitle }])
    ) as Record<string, TabHeaderMeta>
  );

  const tabSections = GALLERY_SECTIONS.filter((s) => s.category === categories[activeTab].key);

  // Sous-navigation par groupe (chips) — évite le long scroll : Primitives par
  // famille, Projections un écran à la fois.
  const groups = [...new Set(tabSections.map((s) => s.group).filter(Boolean))] as string[];
  const [groupByCategory, setGroupByCategory] = useState<Record<string, string>>({});
  const activeGroup =
    groups.length > 0
      ? (groupByCategory[categories[activeTab].key] ?? groups[0])
      : undefined;
  const sections =
    groups.length > 0 ? tabSections.filter((s) => s.group === activeGroup) : tabSections;

  return (
    <Box>
      <PageHeader title={title} subtitle={subtitle} iconBadge={<Palette size={20} />} />

      <PageTabs
        options={categories.map((c) => ({ key: c.key, label: c.label }))}
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel={t('designSystem.title', 'Bibliothèque Baitly UI')}
      />

      {/* Contrôles de prévisualisation : n'affectent QUE les canvas ci-dessous */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="me-1 text-sm text-muted-foreground">
          {t('designSystem.previewLabel', 'Prévisualiser :')}
        </span>
        <Button
          size="sm"
          variant={previewTheme === 'light' ? 'secondary' : 'ghost'}
          onClick={() => setPreviewTheme('light')}
        >
          <LightMode /> {t('designSystem.previewLight', 'Clair')}
        </Button>
        <Button
          size="sm"
          variant={previewTheme === 'dark' ? 'secondary' : 'ghost'}
          onClick={() => setPreviewTheme('dark')}
        >
          <DarkMode /> {t('designSystem.previewDark', 'Sombre')}
        </Button>
        <Button size="sm" variant={rtl ? 'secondary' : 'ghost'} onClick={() => setRtl((v) => !v)}>
          {t('designSystem.previewRtl', 'RTL (arabe)')}
        </Button>
      </div>

      {groups.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          {groups.map((group) => (
            <button
              key={group}
              type="button"
              aria-pressed={group === activeGroup}
              onClick={() =>
                setGroupByCategory((prev) => ({ ...prev, [categories[activeTab].key]: group }))
              }
              className={
                group === activeGroup
                  ? 'inline-flex h-[26px] cursor-pointer items-center rounded-full border border-primary/35 bg-primary-soft px-2.5 text-xs font-medium whitespace-nowrap text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
                  : 'inline-flex h-[26px] cursor-pointer items-center rounded-full border border-border bg-transparent px-2.5 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50'
              }
            >
              {group}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-8 pb-10">
        {sections.map((section) => (
          <GallerySection key={section.title} def={section} previewTheme={previewTheme} rtl={rtl} />
        ))}
      </div>

      {/* Toaster Sonner — monté ici tant que la lib n'est pas déployée app-wide ;
          à déplacer près de la racine (AuthenticatedApp) lors de la migration. */}
      <Toaster />
    </Box>
  );
}
