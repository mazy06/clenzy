/**
 * Baitly UI — bibliothèque de composants (copie du base radix + style Nova
 * du site shadcn/ui, palette Baitly bleu nuit). Galerie : /admin/design-system.
 *
 * Règles d'usage :
 * - Code aligné sur apps/v4/registry/bases/radix/ui + style-nova.css ;
 *   adaptations locales limitées (imports, RTL logique, resets data-slot).
 * - Aucune couleur en dur, aucun import MUI dans ce dossier.
 * - Chaque composant ajouté ici DOIT être démontré dans DesignSystemPage.
 */
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './accordion';
export { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogOverlay, AlertDialogPortal, AlertDialogTitle, AlertDialogTrigger } from './alert-dialog';
export { Alert, AlertTitle, AlertDescription, AlertAction } from './alert';
export { AspectRatio } from './aspect-ratio';
export { Attachment, AttachmentGroup, AttachmentMedia, AttachmentContent, AttachmentTitle, AttachmentDescription, AttachmentActions, AttachmentAction, AttachmentTrigger } from './attachment';
export { Avatar, AvatarImage, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarBadge } from './avatar';
export { Badge, badgeVariants } from './badge';
export { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator, BreadcrumbEllipsis } from './breadcrumb';
export { BubbleGroup, Bubble, BubbleContent, BubbleReactions } from './bubble';
export { ButtonGroup, ButtonGroupSeparator, ButtonGroupText, buttonGroupVariants } from './button-group';
export { Button, buttonVariants } from './button';
export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent } from './card';
// `chart` N'EST PAS re-exporte ici, et ne doit pas l'etre : il importe recharts
// (491 Ko bruts). Un baril est un import STATIQUE — le re-exporter mettait
// recharts dans le graphe d'entree de tout module touchant `components/ui`,
// donc de l'application entiere, donc en preload au boot. Les quinze ecrans qui
// font des graphiques importent `components/ui/chart` directement ; eux seuls
// paient recharts, dans leur propre chunk.
export { Checkbox } from './checkbox';
export { Collapsible, CollapsibleTrigger, CollapsibleContent } from './collapsible';
export { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuCheckboxItem, ContextMenuRadioItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuShortcut, ContextMenuGroup, ContextMenuPortal, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuRadioGroup } from './context-menu';
export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from './dialog';
export { DirectionProvider, useDirection } from './direction';
export { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from './dropdown-menu';
export { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia } from './empty';
export { Field, FieldLabel, FieldDescription, FieldError, FieldGroup, FieldLegend, FieldSeparator, FieldSet, FieldContent, FieldTitle } from './field';
export { HoverCard, HoverCardTrigger, HoverCardContent } from './hover-card';
export { type IconPlaceholderProps, IconPlaceholder } from './icon-placeholder';
export { InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupInput, InputGroupTextarea } from './input-group';
export { Input } from './input';
export { Item, ItemMedia, ItemContent, ItemActions, ItemGroup, ItemSeparator, ItemTitle, ItemDescription, ItemHeader, ItemFooter } from './item';
export { Kbd, KbdGroup } from './kbd';
export { Label } from './label';
export { Marker, MarkerIcon, MarkerContent, markerVariants } from './marker';
export { Menubar, MenubarPortal, MenubarMenu, MenubarTrigger, MenubarContent, MenubarGroup, MenubarSeparator, MenubarLabel, MenubarItem, MenubarShortcut, MenubarCheckboxItem, MenubarRadioGroup, MenubarRadioItem, MenubarSub, MenubarSubTrigger, MenubarSubContent } from './menubar';
export { MessageGroup, Message, MessageAvatar, MessageContent, MessageFooter, MessageHeader } from './message';
export { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from './native-select';
export { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuContent, NavigationMenuTrigger, NavigationMenuLink, NavigationMenuIndicator, NavigationMenuViewport, navigationMenuTriggerStyle } from './navigation-menu';
export { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from './pagination';
export { Popover, PopoverAnchor, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from './popover';
export { Progress } from './progress';
export { RadioGroup, RadioGroupItem } from './radio-group';
export { ScrollArea, ScrollBar } from './scroll-area';
export { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger, SelectValue } from './select';
export { Separator } from './separator';
export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription } from './sheet';
export { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupAction, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInput, SidebarInset, SidebarMenu, SidebarMenuAction, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarMenuSkeleton, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarProvider, SidebarRail, SidebarSeparator, SidebarTrigger, useSidebar } from './sidebar';
export { Skeleton } from './skeleton';
export { Slider } from './slider';
export { Toaster } from './sonner';
export { Spinner } from './spinner';
export { Switch } from './switch';
export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption } from './table';
export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants } from './tabs';
export { Textarea } from './textarea';
export { ToggleGroup, ToggleGroupItem } from './toggle-group';
export { Toggle, toggleVariants } from './toggle';
export { Tooltip, TooltipRoot, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
export { Stepper, Step, StepLabel } from './stepper';

// ─── Feuilles LOURDES : volontairement ABSENTES de ce baril ──────────────────
//
// Un baril est un import STATIQUE : re-exporter une feuille la met dans le
// graphe de TOUT module qui touche `components/ui` — c'est-a-dire de
// l'application entiere, donc du chunk d'entree, donc du preload au boot.
// Importer un `Button` tirait ainsi le selecteur de dates, la palette de
// commandes, le tiroir, le champ OTP et la couche de formulaires.
//
// Ces huit-la s'importent donc par leur chemin propre, et seuls les ecrans qui
// s'en servent les paient, dans leur propre chunk :
//
//   import { Calendar } from '../../components/ui/calendar';     // react-day-picker (+ /hijri)
//   import { Carousel } from '../../components/ui/carousel';     // embla-carousel-react
//   import { Combobox } from '../../components/ui/combobox';     // @base-ui/react
//   import { Command } from '../../components/ui/command';       // cmdk
//   import { Drawer } from '../../components/ui/drawer';         // vaul
//   import { Form } from '../../components/ui/form';             // react-hook-form + zod
//   import { InputOTP } from '../../components/ui/input-otp';    // input-otp
//   import { ResizablePanel } from '../../components/ui/resizable'; // react-resizable-panels
//   import { ChartContainer } from '../../components/ui/chart';  // recharts
//
// Avant d'ajouter un `export ... from` ici, verifier que la feuille n'importe
// aucun paquet npm lourd. Sinon, c'est tout le monde qui le telecharge.
