/**
 * Barrel d'icones centralise — Baitly PMS
 *
 * Source par defaut : Lucide React (look moderne, stroke 2px, ~1600 icones)
 * Fallback : Iconify (acces a 150+ sets d'icones via lazy-loading)
 *
 * Pourquoi ce fichier :
 *   1. Tree-shaking preserve : chaque icone est importee individuellement
 *      depuis sa lib source, pas via un wrapper runtime.
 *   2. Noms semantiques stables : si on change la lib source d'une icone
 *      donnee, les composants consommateurs ne bougent pas.
 *   3. Source de verite unique pour les conventions (taille, stroke).
 *
 * Convention d'usage cote composants :
 *   import { Edit, Delete, Save } from '@/icons';
 *   <Edit size={16} strokeWidth={1.75} />
 *
 * Pour ajouter une icone manquante :
 *   - Verifier d'abord dans Lucide : https://lucide.dev/icons/
 *   - Sinon, ajouter via Iconify (cf. README.md de ce dossier)
 *   - Ajouter l'export ici avec un nom semantique stable
 *
 * /!\ VERSION PIN : lucide-react@^1.14.0
 *
 * Le pin est important — Lucide renomme regulierement ses icones entre
 * versions majeures (ex: `Home` -> `House`, `Tv2` -> `TvMinimal`,
 * `Waves` -> `WavesHorizontal`, `AlertTriangle` -> `TriangleAlert`,
 * `ParkingCircle` -> `CircleParking`). En v1.14 les anciens noms sont
 * toujours exposes comme aliases ; un bump vers une version future peut
 * casser les imports.
 *
 * Avant tout bump de lucide-react :
 *   1. Verifier le CHANGELOG : https://github.com/lucide-icons/lucide/blob/main/CHANGELOG.md
 *   2. Run `grep -rh "from 'lucide-react'" client/src | grep -oE '[A-Z][a-zA-Z0-9]+' | sort -u`
 *      pour lister TOUS les noms utilises, et croiser avec les exports
 *      de la nouvelle version.
 *   3. Lancer `npm run build` puis Vitest pour detecter les imports casses.
 */

// ─── Actions CRUD ───────────────────────────────────────────────────────────
export {
  Plus as Add,
  Save,
  X as Close,
  X as Cancel,
  Pencil as Edit,
  Trash2 as Delete,
  Trash2 as DeleteOutline,
  Copy as ContentCopy,
  RefreshCw as Refresh,
  Send,
  Minus as Remove,
} from 'lucide-react';

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
} from 'lucide-react';

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
} from 'lucide-react';

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
} from 'lucide-react';

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
} from 'lucide-react';

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
} from 'lucide-react';

// Pas d'equivalent Lucide pour le fer a repasser → fallback Iconify.
// Usage : import { Iron } from '@/icons'; <Iron width={16} /> ou <Iron size={16} />
import { Icon as _IronifyIcon, addIcon } from '@iconify/react';
import { createElement, type FC, type ComponentProps } from 'react';

// Les wrappers Iconify acceptent aussi `size` (mappé à width/height) et `strokeWidth`
// (ignoré silencieusement) pour rester compatibles avec l'API Lucide.
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

// Window (fenetre) — pas dans Lucide
export const Window: FC<IconifyProps> = (props) =>
  createElement(_IronifyIcon, buildIconifyProps('mdi:window-closed', props));

// Stairs (escaliers) — pas dans Lucide
export const Stairs: FC<IconifyProps> = (props) =>
  createElement(_IronifyIcon, buildIconifyProps('mdi:stairs', props));

// DoorSliding (porte coulissante / baie vitree) — pas dans Lucide
export const DoorSliding: FC<IconifyProps> = (props) =>
  createElement(_IronifyIcon, buildIconifyProps('mdi:door-sliding', props));

// ─── Pictos Phosphor (Iconify) — planning + préférences barre latérale ───────
// Langage de la brique planning : balai (ménage) et clé à molette (maintenance)
// pour le tarif de prestation, carte bancaire (non réglé) et check (payé) pour
// le prix de réservation. Lucide n'a pas de balai et ses traits sont trop fins
// pour ces pastilles 21px → variantes « fill » de Phosphor. `Faders` habille le
// menu de préférences (apparence + langue + devise) de la barre latérale.
//
// Données enregistrées EN LOCAL via addIcon : pas de fetch runtime vers
// api.iconify.design, rendu synchrone (et visible en test jsdom hors réseau).
// Glyphes Phosphor stables, viewBox 256 (extraits de @iconify-json/ph).
addIcon('ph:broom-fill', {
  width: 256, height: 256,
  body: '<path fill="currentColor" d="M235.29 216.7C212.86 205.69 200 182.12 200 152v-17.31a15.94 15.94 0 0 0-10.09-14.87l-28.65-11.46A8 8 0 0 1 156.79 98l22.32-56.67C184 28.79 178 14.21 165.34 9.51a24 24 0 0 0-30.7 13.71l-22.39 56.86a8 8 0 0 1-10.41 4.5l-28.73-11.5a15.91 15.91 0 0 0-17.38 3.66C34.68 98.4 24 123.71 24 152a111.53 111.53 0 0 0 31.15 77.53A8.06 8.06 0 0 0 61 232h171a8 8 0 0 0 8-7.51a8.21 8.21 0 0 0-4.71-7.79m-120.18-.7a87.5 87.5 0 0 1-24.26-41.71a8.21 8.21 0 0 0-9.25-6.18a8 8 0 0 0-6.32 9.89a105.3 105.3 0 0 0 18.36 38h-29.2A95.62 95.62 0 0 1 40 152a85.9 85.9 0 0 1 7.73-36.3l137.8 55.13c3 18.06 10.55 33.5 21.89 45.19Z"/>',
});
addIcon('ph:wrench-fill', {
  width: 256, height: 256,
  body: '<path fill="currentColor" d="M232 96a72 72 0 0 1-100.94 66L79 222.22c-.12.14-.26.29-.39.42a32 32 0 0 1-45.26-45.26c.14-.13.28-.27.43-.39L94 124.94a72.07 72.07 0 0 1 83.54-98.78a8 8 0 0 1 3.93 13.19L144 80l5.66 26.35L176 112l40.65-37.52a8 8 0 0 1 13.19 3.93A72.6 72.6 0 0 1 232 96"/>',
});
addIcon('ph:credit-card-fill', {
  width: 256, height: 256,
  body: '<path fill="currentColor" d="M224 48H32a16 16 0 0 0-16 16v128a16 16 0 0 0 16 16h192a16 16 0 0 0 16-16V64a16 16 0 0 0-16-16m-88 128h-16a8 8 0 0 1 0-16h16a8 8 0 0 1 0 16m64 0h-32a8 8 0 0 1 0-16h32a8 8 0 0 1 0 16M32 88V64h192v24Z"/>',
});
addIcon('ph:check-bold', {
  width: 256, height: 256,
  body: '<path fill="currentColor" d="m232.49 80.49l-128 128a12 12 0 0 1-17 0l-56-56a12 12 0 1 1 17-17L96 183L215.51 63.51a12 12 0 0 1 17 17Z"/>',
});
addIcon('ph:faders', {
  width: 256, height: 256,
  body: '<path fill="currentColor" d="M136 120v96a8 8 0 0 1-16 0v-96a8 8 0 0 1 16 0m64 72a8 8 0 0 0-8 8v16a8 8 0 0 0 16 0v-16a8 8 0 0 0-8-8m24-32h-16V40a8 8 0 0 0-16 0v120h-16a8 8 0 0 0 0 16h48a8 8 0 0 0 0-16m-168 0a8 8 0 0 0-8 8v48a8 8 0 0 0 16 0v-48a8 8 0 0 0-8-8m24-32H64V40a8 8 0 0 0-16 0v88H32a8 8 0 0 0 0 16h48a8 8 0 0 0 0-16m72-48h-16V40a8 8 0 0 0-16 0v40h-16a8 8 0 0 0 0 16h48a8 8 0 0 0 0-16"/>',
});

// Wrappers compat-Lucide (acceptent size/strokeWidth).
export const BroomFill: FC<IconifyProps> = (props) =>
  createElement(_IronifyIcon, buildIconifyProps('ph:broom-fill', props));
export const WrenchFill: FC<IconifyProps> = (props) =>
  createElement(_IronifyIcon, buildIconifyProps('ph:wrench-fill', props));
export const CreditCardFill: FC<IconifyProps> = (props) =>
  createElement(_IronifyIcon, buildIconifyProps('ph:credit-card-fill', props));
export const CheckBold: FC<IconifyProps> = (props) =>
  createElement(_IronifyIcon, buildIconifyProps('ph:check-bold', props));
export const Faders: FC<IconifyProps> = (props) =>
  createElement(_IronifyIcon, buildIconifyProps('ph:faders', props));

// Symbole officiel du riyal saoudien (U+20C1, Unicode 17.0 — pas encore
// supporté par les polices courantes, donc rendu en icône plutôt qu'en
// caractère). Glyphe Lucide « saudi-riyal » (≥ 1.x), inspiré du symbole SAMA.
export { SaudiRiyal } from 'lucide-react';

// « Scanner » (revue proactive) — balayage radar, métaphore de scan la plus
// parlante ; stroke Lucide cohérent avec le reste du HUD.
export { Radar } from 'lucide-react';

// Symbole du dirham marocain — pas de code Unicode rendu par les polices ni
// d'icône lucide/Iconify dédiée (symbole récent). Glyphe vectoriel (deux barres
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
} from 'lucide-react';

// ─── Localisation / map ─────────────────────────────────────────────────────
export {
  Map as MapIcon,
  MapPin as LocationOn,
  Building2 as LocationCity,
  Globe as Public,
  Flag,
} from 'lucide-react';

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
} from 'lucide-react';

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
} from 'lucide-react';

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
} from 'lucide-react';

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
} from 'lucide-react';

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
} from 'lucide-react';

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
} from 'lucide-react';

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
  // Booking-engine Design tokens (Rounded variants → modern Lucide equivalents)
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
} from 'lucide-react';

// LinkedIn — pas dans Lucide → Iconify
export const LinkedIn: FC<IconifyProps> = (props) =>
  createElement(_IronifyIcon, buildIconifyProps('mdi:linkedin', props));

// WhatsApp — pas de variante officielle dans Lucide → fallback Iconify
export const WhatsApp: FC<IconifyProps> = (props) =>
  createElement(_IronifyIcon, buildIconifyProps('mdi:whatsapp', props));

// ─── Re-export du composant Iconify pour les cas exotiques ──────────────────
// Usage : <Icon icon="mdi:stairs" width={16} />
//         <Icon icon="solar:bed-bold-duotone" width={20} />
// Voir https://icon-sets.iconify.design/ pour browser tous les sets
export { Icon as IconifyIcon } from '@iconify/react';
