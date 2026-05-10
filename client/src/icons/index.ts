/**
 * Barrel d'icones centralise — Clenzy PMS
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
  Sparkles as CleaningServices,
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
import { Icon as _IronifyIcon } from '@iconify/react';
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
