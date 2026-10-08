/**
 * Barrel d'icones centralise — Baitly PMS
 *
 * Source par defaut : Reicon (https://reicon.dev), graisse DUOTONE privilegiee
 * (aplat a 50 % + trait plein) ; contour quand Reicon n'a pas de duotone pour
 * le glyphe. Fallback : Iconify pour les rares pictos absents de Reicon.
 *
 * Pourquoi ce fichier :
 *   1. Tree-shaking preserve : chaque glyphe est un module (`./glyphs/<Nom>.ts`)
 *      qui n'importe que ses donnees SVG depuis `@iconify-icons/reicon`.
 *   2. Noms semantiques stables : si on change le glyphe source d'une icone
 *      donnee, les composants consommateurs ne bougent pas.
 *   3. Source de verite unique pour les conventions (taille, graisse).
 *
 * Convention d'usage cote composants :
 *   import { Edit, Delete, Save } from '@/icons';
 *   <Edit size={16} />
 *   <Star size={14} fill="currentColor" />   // variante pleine (notation)
 *   <Home size={18} weight="outline" />       // forcer le contour
 *
 * `./glyphs` expose aussi les noms historiques Lucide (`Trash2`, `CheckCircle`,
 * `XIcon`…) : la table nom → glyphe Reicon vit dans
 * `scripts/reicon/glyph-map.json`, regeneree par
 * `node scripts/reicon/generate-glyphs.mjs`.
 *
 * Pour ajouter une icone : chercher le glyphe sur https://reicon.dev, l'ajouter
 * a `glyph-map.json`, regenerer, puis exporter ici avec un nom semantique.
 */

// ─── Actions CRUD ───────────────────────────────────────────────────────────
export {
  Plus as Add,
  Save,
  X as Close,
  X as Cancel,
  CornerDownLeft as EnterKey,
  Pencil as Edit,
  Trash2 as Delete,
  Trash2 as DeleteOutline,
  Copy as ContentCopy,
  RefreshCw as Refresh,
  Send,
  Minus as Remove,
} from './glyphs';

// ─── Navigation ─────────────────────────────────────────────────────────────
export {
  ArrowLeft as ArrowBack,
  ArrowRight as ArrowForward,
  ArrowUp as ArrowUpward,
  ArrowDown as ArrowDownward,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown as ExpandMore,
  ChevronUp as ExpandLess,
  Menu as MenuIcon,
  MoreHorizontal as MoreHoriz,
  MoreVertical as MoreVert,
  ExternalLink as OpenInNew,
} from './glyphs';

// ─── Statuts / feedback ─────────────────────────────────────────────────────
export {
  CircleCheck as CheckCircle,
  CircleCheck as CheckCircleOutline,
  CircleAlert as ErrorOutline,
  CircleAlert as Error,
  TriangleAlert as Warning,
  TriangleAlert as WarningAmber,
  OctagonAlert as ReportProblem,
  ChevronsUp as PriorityHigh,
  Info,
  Info as InfoOutlined,
  CircleHelp as Help,
  Check,
  Check as Done,
  Ban,
  Ban as BlockOutlined,
  X as Clear,
  Shield as Security,
  HeartPulse as HealthAndSafety,
  CirclePlay as PlayCircle,
  CirclePlay as PlayCircleOutline,
  Play as PlayArrow,
  CircleStop as StopCircle,
  Hourglass as HourglassEmpty,
  Hourglass as HourglassTop,
  RotateCw as Replay,
  RotateCw as Autorenew,
  Rocket as RocketLaunch,
  MessageSquare as Comment,
  Circle as FiberManualRecord,
  Circle as RadioButtonUnchecked,
  MapPin as Room,
  FileText as Summarize,
  Layers,
  CalendarCheck as EventAvailable,
  Zap as Bolt,
  Clock as AccessTime,
} from './glyphs';

// ─── Vue / visibilite ───────────────────────────────────────────────────────
export {
  Eye as Visibility,
  EyeOff as VisibilityOff,
  Search,
  Filter,
  SlidersHorizontal as TuneOutlined,
  Filter as FilterList,
  LayoutGrid as GridView,
  List as ViewList,
  Orbit,
  MousePointerClick,
} from './glyphs';

// ─── Utilisateurs / auth ────────────────────────────────────────────────────
export {
  User as Person,
  Users as People,
  Users as Group,
  Lock,
  Key as VpnKey,
  ShieldCheck as VerifiedUser,
  LogOut as Logout,
  LogIn as Login,
  UserPlus as PersonAdd,
  ShieldAlert as AdminPanelSettings,
  Briefcase as BusinessCenter,
  Building as Business,
} from './glyphs';

// ─── Property / domaine PMS ─────────────────────────────────────────────────
export {
  Home,
  House as Villa,
  Building as Apartment,
  BedDouble as Hotel,
  Bed,
  Bath as Bathtub,
  Bath as Bathroom,
  Utensils as Restaurant,
  Sofa as Weekend,
  Trees as Yard,
  Monitor as Computer,
  Refrigerator as Kitchen,
  WashingMachine as LocalLaundryService,
  DoorClosed as DoorFront,
  Boxes as Inventory2,
  Wrench as Build,
  Network as Hub,
  PlaneLanding as FlightLand,
  Wifi,
  WifiOff,
  ParkingCircle as LocalParking,
  Snowflake as AcUnit,
  BrushCleaning as CleaningServices,
  Ruler as SquareFoot,
  Moon as NightsStay,
  Euro,
  Trash as DeleteForever,
  TrashIcon,
  Trees as Deck,
  SprayCan as Sanitizer,
  Gavel,
  Scale,
} from './glyphs';

// Pas d'equivalent Reicon pour le fer a repasser → fallback Iconify.
// Usage : import { Iron } from '@/icons'; <Iron width={16} /> ou <Iron size={16} />
import { Icon as _IronifyIcon, addIcon } from '@iconify/react';
import { createElement, type FC, type ComponentProps } from 'react';
import { createIcon } from './createIcon';
import broomFilled from '@iconify-icons/reicon/broom-filled';
import setting2Filled from '@iconify-icons/reicon/setting2-filled';
import cardFilled from '@iconify-icons/reicon/card-filled';
import checkFilled from '@iconify-icons/reicon/check-filled';
import tuning2Duotone from '@iconify-icons/reicon/tuning2-duotone';
import windowDuotone from '@iconify-icons/reicon/window-duotone';

// Les wrappers Iconify acceptent aussi `size` (mappé à width/height) et `strokeWidth`
// (ignoré silencieusement) pour rester compatibles avec l'API des glyphes Reicon.
type IconifyBaseProps = Omit<ComponentProps<typeof _IronifyIcon>, 'icon'>;
type IconifyProps = IconifyBaseProps & {
  size?: number | string;
  strokeWidth?: number | string;
};

const buildIconifyProps = (icon: string, { size, strokeWidth: _sw, ...rest }: IconifyProps) => ({
  icon,
  ...(size !== undefined ? { width: size, height: size } : {}),
  ...rest,
});

export const Iron: FC<IconifyProps> = (props) =>
  createElement(_IronifyIcon, buildIconifyProps('mdi:iron', props));

// Window (fenetre)
export const Window = createIcon('Window', { duotone: windowDuotone });

// Stairs (escaliers) — pas dans Reicon
export const Stairs: FC<IconifyProps> = (props) =>
  createElement(_IronifyIcon, buildIconifyProps('mdi:stairs', props));

// DoorSliding (porte coulissante / baie vitree) — pas dans Reicon
export const DoorSliding: FC<IconifyProps> = (props) =>
  createElement(_IronifyIcon, buildIconifyProps('mdi:door-sliding', props));

// ─── Pastilles pleines — planning + préférences barre latérale ───────────────
// Langage de la brique planning : balai (ménage) et outil (maintenance) pour le
// tarif de prestation, carte bancaire (non réglé) et check (payé) pour le prix
// de réservation. Pastilles de 21px → variantes PLEINES de Reicon, plus lisibles
// que le duotone a cette taille. `Faders` habille le menu de préférences
// (apparence + langue + devise) de la barre latérale.
export const BroomFill = createIcon('BroomFill', { filled: broomFilled });
export const WrenchFill = createIcon('WrenchFill', { filled: setting2Filled });
export const CreditCardFill = createIcon('CreditCardFill', { filled: cardFilled });
export const CheckBold = createIcon('CheckBold', { filled: checkFilled });
export const Faders = createIcon('Faders', { duotone: tuning2Duotone });

// Symbole officiel du riyal saoudien (U+20C1, Unicode 17.0 — pas encore
// supporté par les polices courantes, donc rendu en icône plutôt qu'en
// caractère). Tracé « saudi-riyal » inspiré du symbole SAMA (cf. glyphs/SaudiRiyal.ts).
export { SaudiRiyal } from './glyphs';

// « Scanner » (revue proactive) — balayage radar, métaphore de scan la plus
// parlante.
export { Radar } from './glyphs';

// Symbole du dirham marocain — pas de code Unicode rendu par les polices ni
// d'icône Reicon/Iconify dédiée (symbole récent). Glyphe vectoriel (deux barres
// verticales + swash calligraphique) enregistré EN LOCAL ; viewBox carré centré
// sur la glyphe (bbox réelle x≈[261,346] y≈[17,143]) pour un rendu sans
// déformation à taille carrée.
addIcon('clenzy:moroccan-dirham', {
  left: 234, top: 11, width: 138, height: 138,
  body: '<path fill="currentColor" d="m300.92 17.36h7.0116v125.28h-7.0116zm-13.095 0h7.0117v125.28h-7.0117zm-17.844 82.957c0.13639 1.6815 0.53703 3.3412 1.1827 4.8997 1.8104 4.3699 5.52 7.7989 9.7969 9.819 4.277 2.0201 9.0885 2.7168 13.818 2.6196 3.8938-0.0799 7.7652-0.68026 11.554-1.5821 4.9397-1.1758 9.8016-2.8879 14.082-5.619 5.9146-3.7737 10.617-9.5705 12.587-16.304 2.1237-7.2604 0.97882-15.264-2.3653-22.049-3.5712-7.2458-9.5366-13.178-16.473-17.318-6.3684-3.8004-13.504-6.137-20.697-7.9407-7.4382-1.8653-15.011-3.1933-22.64-3.9704l3.3791-11.995c5 0.77913 9.9854 1.6523 14.953 2.6188 6.3498 1.2355 12.696 2.6313 18.754 4.8997 8.4858 3.1775 16.354 8.0858 22.725 14.53 8.0937 8.1876 13.735 19.085 14.361 30.581 0.58463 10.734-3.3527 21.662-10.729 29.483-6.6389 7.0388-15.732 11.417-25.136 13.692-6.192 1.4977-12.607 2.1443-18.961 1.6828-4.4022-0.31974-8.7998-1.1811-12.84-2.9567-6.9603-3.0586-12.707-8.9552-15.206-16.135-0.99894-2.8698-1.4876-5.9164-1.4361-8.9544z"/>',
});
export const MoroccanDirham: FC<IconifyProps> = (props) =>
  createElement(_IronifyIcon, buildIconifyProps('clenzy:moroccan-dirham', props));

// ─── Donnees / dashboard ────────────────────────────────────────────────────
export {
  TrendingUp,
  TrendingDown,
  LineChart as ShowChart,
  BarChart3,
  BarChart3 as Assessment,
  LayoutDashboard as Dashboard,
  ClipboardList as Assignment,
  ListChecks as Checklist,
  Activity as Timeline,
  Star,
  Percent,
  Timer,
  Calendar as CalendarMonth,
  Calendar,
  Calendar as CalendarToday,
  Clock as Schedule,
  Sparkles as AutoAwesome,
  Wand2 as AutoFixHigh,
  Bug as BugReport,
  Camera as PhotoCamera,
  Banknote as Payments,
  DollarSign as AttachMoney,
  NotebookPen as NoteAlt,
  Maximize as Fullscreen,
  ImageOff as ImageNotSupported,
  PersonStanding as DirectionsWalk,
  Gauge as Speed,
  HardDrive as Storage,
  HardDrive as StorageRounded,
  Cpu as Memory,
  Activity as MonitorHeart,
  RotateCw as Sync,
  RadioTower as SettingsInputAntenna,
  ReceiptText as Receipt,
} from './glyphs';

// ─── Localisation / map ─────────────────────────────────────────────────────
export {
  Map as MapIcon,
  MapPin as LocationOn,
  Building2 as LocationCity,
  Globe as Public,
  Flag,
} from './glyphs';

// ─── Media / fichiers ───────────────────────────────────────────────────────
export {
  Images as PhotoLibrary,
  Image as ImageIcon,
  ImagePlus as AddPhotoAlternate,
  UploadCloud as CloudUpload,
  DownloadCloud as CloudDownload,
  Upload,
  Download,
  Download as GetApp,
  Paperclip as AttachFile,
  Folder,
  File,
} from './glyphs';

// ─── Communication ──────────────────────────────────────────────────────────
export {
  Mail as Email,
  Phone,
  Bell as Notifications,
  BellOff as NotificationsNone,
  MessageCircle as Chat,
  CreditCard as Payment,
  FileText as Description,
  UsersRound as Groups,
  Circle,
  CalendarDays as EventNote,
  Languages as Language,
  Mic,
  MicOff,
} from './glyphs';

// ─── Meteo (Open-Meteo widget) ───────────────────────────────────────────────
export {
  Sun as WeatherSun,
  CloudSun as WeatherCloudSun,
  Cloud as WeatherCloud,
  CloudRain as WeatherRain,
  CloudDrizzle as WeatherDrizzle,
  CloudSnow as WeatherSnow,
  CloudLightning as WeatherStorm,
  CloudFog as WeatherFog,
  Droplets as WeatherDroplets,
} from './glyphs';

// ─── Reglages / parametres ──────────────────────────────────────────────────
export {
  Settings,
  ToggleRight as ToggleOn,
  Power,
  Tag as Label,
  ListFilter as Category,
  StickyNote as StickyNote2,
  Hash as Numbers,
  ShoppingCart as ShoppingCartOutlined,
  CirclePlus as AddCircleOutline,
  Ban as Block,
  Camera as CameraAlt,
  Ticket as ConfirmationNumber,
  CreditCard,
  CreditCard as CreditCardOff,
  FilterX as FilterListOff,
  PlaneTakeoff as FlightTakeoff,
  Minimize as FullscreenExit,
  History,
  Wallet as AccountBalance,
  Wrench as Handyman,
  CalendarDays as TodayOutlined,
  Rows3 as ViewCompact,
  LayoutGrid as ViewComfy,
  MailCheck as MarkEmailRead,
  DoorOpen as MeetingRoom,
  BanknoteX as MoneyOff,
  BellRing as NotificationsActive,
  CircleMinus as RemoveCircleOutline,
  ArrowLeftRight as SwapHoriz,
  CircleCheckBig as TaskAlt,
  AlignLeft as Notes,
  BadgeCheck as Verified,
} from './glyphs';

// ─── Dashboard / analytics / monitoring ─────────────────────────────────────
export {
  Wallet as AccountBalanceWallet,
  BatteryLow as Battery20,
  BatteryWarning as BatteryAlert,
  BatteryFull,
  Calculator as Calculate,
  Megaphone as Campaign,
  MessageCircle as ChatBubbleOutline,
  Puzzle as Extension,
  UserRoundPlus as GroupAdd,
  Hand,
  Handshake,
  Building as HomeWork,
  Lightbulb,
  Unlink as LinkOff,
  LockOpen,
  Lock as LockOutlined,
  ChevronLeft as NavigateBefore,
  ChevronRight as NavigateNext,
  User as PersonOutline,
  PieChart,
  BadgeEuro as PriceChange,
  QrCode as QrCode2,
  FileSpreadsheet as RequestQuote,
  Antenna as Sensors,
  Settings2 as SettingsRemote,
  Store,
  RefreshCwOff as SyncProblem,
  SlidersHorizontal as Tune,
  Volume2 as VolumeUp,
} from './glyphs';

// ─── Settings / org / users / teams ─────────────────────────────────────────
export {
  IdCard as Badge,
  BarChart3 as BarChart,
  Moon as DarkMode,
  Trash2 as DeleteOutlined,
  Sun as LightMode,
  Link,
  Map,
  Palette,
  UserMinus as PersonRemove,
  FlaskConical as Science,
  SunMoon as SettingsBrightness,
  ArrowDownAZ as SortByAlpha,
  Star as StarRate,
  UserCog as SupervisorAccount,
} from './glyphs';

// ─── Phase 8 : booking / documents / channels / messaging / admin / misc ────
export {
  UserCircle as AccountCircle,
  FolderTree as AccountTree,
  Infinity as AllInclusive,
  Archive,
  FileText as Article,
  ClipboardCheck as AssignmentTurnedIn,
  Brush as BrushRounded,
  Cable,
  CalendarRange as CalendarViewWeek,
  Code,
  ArrowLeftRight as CompareArrows,
  ConciergeBell,
  Contact as Contacts,
  Building2 as CorporateFare,
  Code as Css,
  ArrowRightLeft as CurrencyExchange,
  CalendarRange as DateRange,
  Smartphone as Devices,
  CheckCheck as DoneAll,
  Plug as ElectricalServices,
  HardHat as Engineering,
  CalendarSync as EventRepeat,
  LogOut as ExitToApp,
  FileDown as FileDownload,
  Fingerprint,
  MessagesSquare as Forum,
  ShieldOff as GppBad,
  ShieldCheck as GppGood,
  Inbox,
  File as InsertDriveFile,
  Package as Inventory,
  BedSingle as KingBed,
  ListTodo as ListAlt,
  Tag as LocalOffer,
  UserCog as ManageAccounts,
  MailOpen as MarkAsUnread,
  MessageSquare as Message,
  Wrench as MiscellaneousServices,
  StickyNote as Note,
  Send as Outbox,
  UserSearch as PersonSearch,
  FileText as PictureAsPdf,
  ListChecks as PlaylistAddCheck,
  Droplet as Plumbing,
  Brain as Psychology,
  ReceiptText as ReceiptLong,
  Reply,
  RotateCcw as Restore,
  DoorClosed as SensorDoor,
  Bot as SmartToy,
  CigaretteOff as SmokeFree,
  MessageSquareText as Sms,
  Store as StorefrontOutlined,
  AlignJustify as Subject,
  Headset as SupportAgent,
  Thermometer as Thermostat,
  ArchiveRestore as Unarchive,
  PanelLeft as ViewSidebar,
  // Booking-engine Design tokens (variantes MUI « Rounded » → glyphes Reicon)
  ChevronDown as ExpandMoreRounded,
  Palette as PaletteRounded,
  Type as TextFieldsRounded,
  Space as SpaceBarRounded,
  Cloud as FilterDramaRounded,
  MousePointerClick as SmartButtonRounded,
  Wand2 as AutoFixHighRounded,
  CircleCheck as CheckCircleOutlineRounded,
  Settings as SettingsRounded,
  // Build-revealed missing aliases (direct re-exports + new aliases)
  Mail,
  ShoppingCart,
  Shield,
  Menu,
  Pause,
  Mouse,
  Smartphone,
  Tablet,
  Undo,
  Redo,
  Luggage,
  PieChart as DataUsage,
  GitCompare as Compare,
  Trophy as EmojiEvents,
  PiggyBank as Savings,
  Eye as Preview,
  LayoutGrid as Widgets,
  Monitor as DesktopWindows,
  FilterX as FilterAltOff,
  Upload as UploadFile,
  Wrench as BuildRounded,
  Puzzle as IntegrationInstructions,
  // Dedicated role icons (avoid duplicate visuals across roles in selectors)
  Crown as RoleSuperAdmin,
  Briefcase as RoleSuperManager,
  Eye as RoleSupervisor,
  Wrench as RoleTechnician,
  Sparkles as RoleHousekeeper,
  Shirt as RoleLaundry,
  Leaf as RoleExteriorTech,
  Home as RoleHost,
} from './glyphs';

// LinkedIn — logo de marque, pas dans Reicon → Iconify
/**
 * Types de logement (`PROPERTY_TYPES` de `utils/statusUtils.ts`) — une forme
 * par type, pour les surfaces ou le libelle ne tient pas : colonne logements
 * repliee du planning, listes tres denses. Le mapping valeur -> icone vit dans
 * `utils/propertyTypeIcon.ts`.
 */
export {
  Building2 as PropertyApartment,
  House as PropertyHouse,
  TreePalm as PropertyVilla,
  BedSingle as PropertyStudio,
  Warehouse as PropertyLoft,
  Layers2 as PropertyDuplex,
  Building as PropertyTownhouse,
  TentTree as PropertyBungalow,
  Landmark as PropertyRiad,
  MountainSnow as PropertyChalet,
  TreePine as PropertyCottage,
  BedDouble as PropertyGuestRoom,
  Sailboat as PropertyBoat,
  KeyRound as PropertyOther,
} from './glyphs';

export const LinkedIn: FC<IconifyProps> = (props) =>
  createElement(_IronifyIcon, buildIconifyProps('mdi:linkedin', props));

// WhatsApp — logo de marque, tracé repris de `reicon-brands` (MIT).
export const WhatsApp = createIcon('WhatsApp', {
  filled: {
    body: '<path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>',
  },
});

// ─── Re-export du composant Iconify pour les cas exotiques ──────────────────
// Usage : <Icon icon="mdi:stairs" width={16} />
//         <Icon icon="solar:bed-bold-duotone" width={20} />
// Voir https://icon-sets.iconify.design/ pour browser tous les sets
export { Icon as IconifyIcon } from '@iconify/react';

// ─── Chevrons de NAVIGATION (précédent / suivant) ───────────────────────────
// Un chevron ne se retourne pas tout seul en RTL : « précédent » y pointe à
// DROITE. Ces deux-là prennent le sens logique et choisissent le glyphe selon
// la direction de lecture — cf. src/icons/directional.tsx.
export { ChevronPrev, ChevronNext } from './directional';
