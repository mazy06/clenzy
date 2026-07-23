import { useState } from 'react';
import {
  BanknoteIcon,
  BedDoubleIcon,
  BuildingIcon,
  CalendarDaysIcon,
  CameraIcon,
  CircleCheckIcon,
  EuroIcon,
  FileTextIcon,
  LayoutGridIcon,
  ListIcon,
  MessageSquareIcon,
  PaperclipIcon,
  PercentIcon,
  PlusIcon,
  RepeatIcon,
  SendIcon,
  SettingsIcon,
  StickyNoteIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  UserPlusIcon,
  UsersIcon,
} from 'lucide-react';
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  Badge,
  Button,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
  Message,
  MessageAvatar,
  MessageContent,
  MessageGroup,
  NativeSelect,
  NativeSelectOption,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ToggleGroup,
  ToggleGroupItem,
} from '../../../components/ui';
import PageHeader from '../../../components/baitly/PageHeader';
import HeaderSearchField from '../../../components/baitly/HeaderSearchField';
import FilterChipRow from '../../../components/baitly/FilterChipRow';
import StatusChip from '../../../components/baitly/StatusChip';
import StatTile from '../../../components/baitly/StatTile';
import GuestAvatar from '../../../components/baitly/GuestAvatar';
import ExportButton from '../../../components/baitly/ExportButton';
import DateRangePicker from '../../../components/baitly/DateRangePicker';
import { Money } from '../../../components/baitly/Money';
import { cn } from '../../../utils/cn';

/**
 * Projections d'écrans PMS (vague 5, enrichies) — composées uniquement de
 * primitives Baitly UI. Galerie only : aucun écran réel n'est modifié.
 */

// ─── Section — Planning ──────────────────────────────────────────────────────

const PLANNING_DAYS = ['Lun 21', 'Mar 22', 'Mer 23', 'Jeu 24', 'Ven 25', 'Sam 26', 'Dim 27'];
const PLANNING_DAY_OCCUPANCY = [75, 75, 50, 50, 100, 100, 75];

interface PlanningBlock {
  guest: string;
  start: number;
  span: number;
  color: string;
  kind?: 'reservation' | 'blocked';
}

const PLANNING_ROWS: Array<{ property: string; blocks: PlanningBlock[] }> = [
  {
    property: 'Riad Yasmine',
    blocks: [
      { guest: 'A. Benali', start: 1, span: 3, color: '#FF5A5F' },
      { guest: 'J. Smith', start: 5, span: 3, color: '#2563EB' },
    ],
  },
  {
    property: 'Duplex Guéliz',
    blocks: [{ guest: 'L. Martin', start: 2, span: 4, color: '#003580' }],
  },
  {
    property: 'Villa Palmeraie',
    blocks: [
      { guest: 'K. El Fassi', start: 4, span: 2, color: '#14B8A6' },
      { guest: 'Bloc propriétaire', start: 6, span: 2, color: '', kind: 'blocked' },
    ],
  },
  { property: 'Appartement Maârif', blocks: [] },
];

export function BPlanningSectionDemo() {
  const [property, setProperty] = useState('all');
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Planning"
        subtitle="Semaine du 21 au 27 juillet · 71 % d'occupation"
        iconBadge={<CalendarDaysIcon />}
        showBackButton={false}
        className="mb-0"
        actions={
          <>
            <Select value={property} onValueChange={setProperty}>
              <SelectTrigger size="sm" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les logements</SelectItem>
                <SelectItem value="riad">Riad Yasmine</SelectItem>
                <SelectItem value="duplex">Duplex Guéliz</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline">
              Aujourd'hui
            </Button>
            <Button size="sm">
              <PlusIcon /> Réservation
            </Button>
          </>
        }
      />

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <div className="min-w-[680px]">
          <div className="grid grid-cols-[140px_repeat(7,1fr)] border-b border-border bg-muted/50">
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">Logement</div>
            {PLANNING_DAYS.map((day, index) => (
              <div
                key={day}
                className={cn(
                  'px-2 py-2 text-center text-xs text-muted-foreground',
                  index === 2 && 'bg-primary-soft font-semibold text-primary',
                  index >= 5 && 'bg-primary-soft/40 font-medium'
                )}
              >
                {day}
              </div>
            ))}
          </div>
          {PLANNING_ROWS.map((row) => (
            <div
              key={row.property}
              className="grid grid-cols-[140px_repeat(7,1fr)] items-center border-b border-border"
            >
              <div className="truncate px-3 py-3 text-sm font-medium text-foreground">
                {row.property}
              </div>
              <div className="relative col-span-7 grid h-12 grid-cols-7 self-stretch">
                {PLANNING_DAYS.map((_, index) => (
                  <div key={index} className="cursor-pointer border-s border-border/60 transition-colors hover:bg-accent/60" />
                ))}
                {row.blocks.map((block) =>
                  block.kind === 'blocked' ? (
                    <div
                      key={block.guest}
                      className="absolute inset-y-2 flex items-center truncate rounded-md border border-dashed border-border bg-muted px-2 text-xs font-medium text-muted-foreground"
                      style={{
                        insetInlineStart: `calc(${((block.start - 1) / 7) * 100}% + 3px)`,
                        width: `calc(${(block.span / 7) * 100}% - 6px)`,
                      }}
                    >
                      {block.guest}
                    </div>
                  ) : (
                    <div
                      key={block.guest}
                      className="absolute inset-y-2 flex cursor-pointer items-center truncate rounded-md px-2 text-xs font-medium text-white shadow-sm transition-opacity hover:opacity-90"
                      style={{
                        backgroundColor: block.color,
                        insetInlineStart: `calc(${((block.start - 1) / 7) * 100}% + 3px)`,
                        width: `calc(${(block.span / 7) * 100}% - 6px)`,
                      }}
                    >
                      {block.guest}
                    </div>
                  )
                )}
                {row.blocks.length === 0 && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-2xs text-faint">
                    Disponible toute la semaine
                  </span>
                )}
              </div>
            </div>
          ))}
          <div className="grid grid-cols-[140px_repeat(7,1fr)] bg-muted/30">
            <div className="px-3 py-1.5 text-2xs font-medium text-muted-foreground">Occupation</div>
            {PLANNING_DAY_OCCUPANCY.map((pct, index) => (
              <div
                key={index}
                className={cn(
                  'py-1.5 text-center text-2xs font-medium tabular-nums',
                  pct === 100 ? 'text-success' : pct >= 60 ? 'text-foreground' : 'text-warning'
                )}
              >
                {pct}%
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-2xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-[3px]" style={{ backgroundColor: '#FF5A5F' }} /> Airbnb
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-[3px]" style={{ backgroundColor: '#2563EB' }} /> Direct
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-[3px]" style={{ backgroundColor: '#003580' }} /> Booking
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-[3px]" style={{ backgroundColor: '#14B8A6' }} /> Vrbo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-[3px] border border-dashed border-border bg-muted" /> Bloc propriétaire
        </span>
        <span className="ms-auto">Projection 7 jours — le vrai planning gardera son moteur de virtualisation.</span>
      </div>
    </div>
  );
}

// ─── Section — Propriétés ────────────────────────────────────────────────────

const PROPERTIES = [
  {
    name: 'Riad Yasmine', city: 'Marrakech', beds: 6, price: 120, occupancy: 84,
    status: 'ok' as const, statusLabel: 'Actif', channels: ['#FF5A5F', '#2563EB', '#003580'], warning: null,
  },
  {
    name: 'Duplex Guéliz', city: 'Marrakech', beds: 2, price: 65, occupancy: 71,
    status: 'ok' as const, statusLabel: 'Actif', channels: ['#FF5A5F', '#2563EB'], warning: '3 photos manquantes',
  },
  {
    name: 'Villa Palmeraie', city: 'Marrakech', beds: 5, price: 210, occupancy: 54,
    status: 'ok' as const, statusLabel: 'Actif', channels: ['#003580', '#14B8A6'], warning: null,
  },
  {
    name: 'Studio Anfa', city: 'Casablanca', beds: 1, price: 40, occupancy: 0,
    status: 'neutral' as const, statusLabel: 'Archivé', channels: [], warning: null,
  },
];

export function BPropertiesSectionDemo() {
  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid');
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Logements"
        subtitle="4 logements · 2 villes · 3 actifs"
        iconBadge={<BuildingIcon />}
        showBackButton={false}
        className="mb-0"
        actions={
          <>
            <HeaderSearchField value={search} onChange={setSearch} placeholder="Rechercher…" className="w-52" />
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={view}
              onValueChange={(v) => v && setView(v)}
            >
              <ToggleGroupItem value="grid" aria-label="Grille">
                <LayoutGridIcon />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="Liste">
                <ListIcon />
              </ToggleGroupItem>
            </ToggleGroup>
            <Button size="sm">
              <PlusIcon /> Ajouter
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile icon={<PercentIcon />} label="Occupation moyenne" value="70" unit="%" hint={<><b>+5 pts</b> sur 30 jours</>} />
        <StatTile icon={<EuroIcon />} label="ADR portefeuille" value={<Money value={109} decimals={0} />} hint="prix moyen par nuit vendue" />
        <StatTile icon={<TriangleAlertIcon />} label="À compléter" value="1" iconClassName="text-warning" hint="Duplex Guéliz : photos manquantes" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PROPERTIES.map((property) => (
          <div
            key={property.name}
            className="group cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md"
          >
            <div className="relative flex aspect-video w-full items-center justify-center bg-muted text-faint">
              <BedDoubleIcon className="size-8" />
              {property.warning && (
                <span className="absolute start-2 top-2">
                  <StatusChip tone="warn" label={property.warning} size="sm" icon={<CameraIcon className="size-3" />} />
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="m-0 truncate text-sm font-semibold text-foreground">{property.name}</h3>
                <StatusChip tone={property.status} label={property.statusLabel} dot size="sm" />
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{property.city}</span>
                <span className="flex items-center gap-1">
                  <BedDoubleIcon className="size-3.5" /> {property.beds} ch.
                </span>
                <span className="ms-auto font-semibold text-foreground tabular-nums">
                  <Money value={property.price} decimals={0} />
                  <span className="font-normal text-muted-foreground"> /nuit</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-field">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${property.occupancy}%` }} />
                </div>
                <span className="text-2xs text-muted-foreground tabular-nums">{property.occupancy}%</span>
              </div>
              <div className="flex items-center gap-1 pt-0.5">
                {property.channels.map((color) => (
                  <span key={color} className="inline-block size-2 rounded-full" style={{ backgroundColor: color }} />
                ))}
                <span className="ms-1 text-2xs text-muted-foreground">
                  {property.channels.length > 0 ? `${property.channels.length} canaux` : 'Aucun canal'}
                </span>
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <PlusIcon className="size-5" />
          <span className="text-sm font-medium">Ajouter un logement</span>
        </button>
      </div>
    </div>
  );
}

// ─── Section — Guests ────────────────────────────────────────────────────────

const GUESTS = [
  { name: 'Amina Benali', email: 'amina@exemple.ma', stays: 4, lastStay: 'Août 2026', ltv: 4820, channel: 'Direct', channelColor: '#2563EB', tag: { tone: 'warn' as const, label: 'VIP' } },
  { name: 'Lea Martin', email: 'lea.martin@example.fr', stays: 2, lastStay: 'Juin 2026', ltv: 3390, channel: 'Booking', channelColor: '#003580', tag: { tone: 'ok' as const, label: 'Fidèle' } },
  { name: 'John Smith', email: 'john.s@example.com', stays: 1, lastStay: 'Juil. 2026', ltv: 380, channel: 'Airbnb', channelColor: '#FF5A5F', tag: null },
  { name: 'Karim El Fassi', email: 'k.elfassi@exemple.ma', stays: 1, lastStay: 'Juil. 2026', ltv: 510, channel: 'Vrbo', channelColor: '#14B8A6', tag: null },
];

export function BGuestsSectionDemo() {
  const [segment, setSegment] = useState<string | ''>('');
  const [search, setSearch] = useState('');
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Guests"
        subtitle="128 voyageurs connus"
        iconBadge={<UsersIcon />}
        showBackButton={false}
        className="mb-0"
        actions={<HeaderSearchField value={search} onChange={setSearch} placeholder="Nom, email, téléphone…" className="w-56" />}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile icon={<UserPlusIcon />} label="Nouveaux (30 j)" value="14" hint={<><b>+3</b> vs mois précédent</>} />
        <StatTile icon={<RepeatIcon />} label="Taux de retour" value="17" unit="%" iconClassName="text-success" hint="22 guests revenus au moins 1 fois" />
        <StatTile icon={<EuroIcon />} label="Valeur vie moyenne" value={<Money value={1240} decimals={0} />} hint="par guest connu" />
      </div>

      <FilterChipRow
        allLabel="Tous"
        allCount={128}
        value={segment}
        onChange={setSegment}
        options={[
          { value: 'vip', label: 'VIP', color: '#D4A574', count: 8 },
          { value: 'repeat', label: 'Fidèles', color: '#14B8A6', count: 22 },
          { value: 'recent', label: 'Récents', color: '#2563EB', count: 41 },
        ]}
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Guest</TableHead>
            <TableHead className="text-end">Séjours</TableHead>
            <TableHead>Dernier séjour</TableHead>
            <TableHead>Canal préféré</TableHead>
            <TableHead className="text-end">Valeur vie</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {GUESTS.map((guest) => (
            <TableRow key={guest.email} className="cursor-pointer">
              <TableCell>
                <span className="flex items-center gap-2.5">
                  <GuestAvatar name={guest.name} size={28} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-foreground">{guest.name}</span>
                      {guest.tag && <StatusChip tone={guest.tag.tone} label={guest.tag.label} size="sm" />}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{guest.email}</span>
                  </span>
                </span>
              </TableCell>
              <TableCell className="text-end tabular-nums">{guest.stays}</TableCell>
              <TableCell>{guest.lastStay}</TableCell>
              <TableCell>
                <StatusChip color={guest.channelColor} label={guest.channel} dot size="sm" />
              </TableCell>
              <TableCell className="text-end font-medium tabular-nums">
                <Money value={guest.ltv} decimals={0} />
              </TableCell>
              <TableCell className="text-end">
                <Button size="icon-xs" variant="ghost" aria-label={`Écrire à ${guest.name}`}>
                  <MessageSquareIcon />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="m-0 text-end text-xs text-muted-foreground">4 sur 128 — projection</p>
    </div>
  );
}

// ─── Section — Messagerie guest ──────────────────────────────────────────────

const CONVERSATIONS = [
  { guest: 'Amina Benali', snippet: 'Merci ! Et pour le parking à…', time: '14:21', unread: 2, channel: '#FF5A5F', active: true },
  { guest: 'Karim El Fassi', snippet: 'Le code de la boîte à clés ne…', time: '11:48', unread: 1, channel: '#14B8A6', active: false },
  { guest: 'Lea Martin', snippet: 'Parfait, à dimanche !', time: 'hier', unread: 0, channel: '#003580', active: false },
];

export function BMessagingSectionDemo() {
  const [internalNote, setInternalNote] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Messagerie"
        subtitle="3 conversations · 3 non lues"
        iconBadge={<MessageSquareIcon />}
        showBackButton={false}
        className="mb-0"
      />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[280px_1fr]">
        {/* Liste des conversations */}
        <div className="flex flex-col rounded-xl border border-border bg-card">
          {CONVERSATIONS.map((conversation, index) => (
            <button
              key={conversation.guest}
              type="button"
              className={cn(
                'flex cursor-pointer items-center gap-2.5 p-3 text-start transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
                index > 0 && 'border-t border-border',
                conversation.active && 'bg-primary-soft/50'
              )}
            >
              <GuestAvatar name={conversation.guest} size={32} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-foreground">{conversation.guest}</span>
                  <span className="inline-block size-1.5 rounded-full" style={{ backgroundColor: conversation.channel }} />
                </span>
                <span className="block truncate text-xs text-muted-foreground">{conversation.snippet}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-2xs text-faint">{conversation.time}</span>
                {conversation.unread > 0 && (
                  <Badge className="px-1.5 py-0 text-2xs">{conversation.unread}</Badge>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Fil actif */}
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2.5">
              <GuestAvatar name="Amina Benali" size={32} />
              <div>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  Amina Benali <Badge variant="success">Confirmée</Badge>
                </div>
                <div className="text-xs text-muted-foreground">RES-1042 · Riad Yasmine · arrivée ven. 25 juil.</div>
              </div>
            </div>
            <Button size="xs" variant="ghost">
              Voir la réservation
            </Button>
          </div>
          <MessageGroup>
            <Message>
              <MessageAvatar>
                <GuestAvatar name="Amina Benali" size={28} />
              </MessageAvatar>
              <MessageContent>
                Bonjour ! À quelle heure pouvons-nous arriver vendredi ? Nous aurons un bébé avec nous.
              </MessageContent>
            </Message>
            <Message align="end">
              <MessageContent>
                Bonjour Amina, le check-in est possible dès 15 h. Un lit bébé sera installé dans la chambre patio 🙂
              </MessageContent>
            </Message>
            <Message align="end">
              <Attachment className="max-w-64">
                <AttachmentMedia>
                  <FileTextIcon />
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>Guide-acces-riad.pdf</AttachmentTitle>
                  <AttachmentDescription>PDF · 1,2 Mo</AttachmentDescription>
                </AttachmentContent>
              </Attachment>
            </Message>
            <Message>
              <MessageAvatar>
                <GuestAvatar name="Amina Benali" size={28} />
              </MessageAvatar>
              <MessageContent>Merci ! Et pour le parking à proximité ?</MessageContent>
            </Message>
          </MessageGroup>
          <div className="flex flex-wrap gap-1.5">
            {['Parking Koutoubia à 5 min', 'Envoyer le guide d\'accès', 'Proposer un transfert aéroport'].map((reply) => (
              <Button key={reply} size="xs" variant="outline" className="rounded-full">
                {reply}
              </Button>
            ))}
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <Switch id="msg-internal" checked={internalNote} onCheckedChange={setInternalNote} />
              <label htmlFor="msg-internal" className={cn('flex cursor-pointer items-center gap-1 text-xs', internalNote ? 'text-warning' : 'text-muted-foreground')}>
                <StickyNoteIcon className="size-3.5" /> Note interne (invisible pour le guest)
              </label>
            </div>
            <InputGroup className={cn(internalNote && 'border-warning/50 bg-warning-soft/30')}>
              <InputGroupTextarea placeholder={internalNote ? 'Note pour l\'équipe…' : 'Répondre à Amina…'} rows={2} />
              <InputGroupAddon align="block-end">
                <InputGroupButton size="icon-xs" variant="ghost" aria-label="Joindre">
                  <PaperclipIcon />
                </InputGroupButton>
                <InputGroupButton size="icon-xs" className="ms-auto" aria-label="Envoyer">
                  <SendIcon />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section — Facturation ───────────────────────────────────────────────────

const INVOICES = [
  { id: 'FAC-2026-0203', client: 'Amina Benali', date: '19 juil. 2026', amount: 1240, status: 'ok' as const, statusLabel: 'Payée', late: false },
  { id: 'FAC-2026-0204', client: 'John Smith', date: '21 juil. 2026', amount: 380, status: 'warn' as const, statusLabel: 'En attente', late: false },
  { id: 'FAC-2026-0205', client: 'Lea Martin', date: '22 juil. 2026', amount: 2150, status: 'err' as const, statusLabel: 'En retard (12 j)', late: true },
];

export function BBillingSectionDemo() {
  const [start, setStart] = useState('2026-07-01');
  const [end, setEnd] = useState('2026-07-31');
  const [statusFilter, setStatusFilter] = useState<string | ''>('');
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Facturation"
        subtitle="Factures émises sur la période"
        iconBadge={<FileTextIcon />}
        showBackButton={false}
        className="mb-0"
        actions={
          <ExportButton
            data={INVOICES}
            columns={[
              { key: 'id', label: 'Référence' },
              { key: 'client', label: 'Client' },
              { key: 'amount', label: 'Montant' },
            ]}
            fileName="factures-juillet"
            variant="menu"
          />
        }
        filters={
          <DateRangePicker startDate={start} endDate={end} onChangeStart={setStart} onChangeEnd={setEnd} isFrench />
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile icon={<FileTextIcon />} label="Émis (juillet)" value={<Money value={3770} decimals={0} />} hint="3 factures" />
        <StatTile icon={<BanknoteIcon />} label="Encaissé" value={<Money value={1240} decimals={0} />} iconClassName="text-success" hint="33 % du montant émis" />
        <StatTile icon={<TriangleAlertIcon />} label="En retard" value={<Money value={2150} decimals={0} />} iconClassName="text-destructive" hint="1 facture · FAC-0205" />
      </div>

      <FilterChipRow
        allLabel="Toutes"
        allCount={3}
        value={statusFilter}
        onChange={setStatusFilter}
        options={[
          { value: 'paid', label: 'Payées', color: '#14B8A6', count: 1 },
          { value: 'pending', label: 'En attente', color: '#D4A574', count: 1 },
          { value: 'late', label: 'En retard', color: '#C97A7A', count: 1 },
        ]}
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Référence</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-end">Montant</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {INVOICES.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell className="font-medium">{invoice.id}</TableCell>
              <TableCell>{invoice.client}</TableCell>
              <TableCell>{invoice.date}</TableCell>
              <TableCell>
                <StatusChip tone={invoice.status} label={invoice.statusLabel} dot size="sm" />
              </TableCell>
              <TableCell className="text-end tabular-nums">
                <Money value={invoice.amount} decimals={0} />
              </TableCell>
              <TableCell className="text-end">
                {invoice.late && (
                  <Button size="xs" variant="outline">
                    Relancer
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={4}>Total période</TableCell>
            <TableCell className="text-end font-semibold tabular-nums">
              <Money value={3770} decimals={0} />
            </TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

// ─── Section — Paramètres ────────────────────────────────────────────────────

export function BSettingsSectionDemo() {
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageHeader
        title="Paramètres"
        subtitle="Préférences de votre organisation"
        iconBadge={<SettingsIcon />}
        showBackButton={false}
        className="mb-0"
      />
      <Tabs defaultValue="general">
        <TabsList variant="line">
          <TabsTrigger value="general">Général</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="billing">Facturation</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="pt-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ds-org-name">Nom de l'organisation</FieldLabel>
              <Input id="ds-org-name" defaultValue="Baitly Conciergerie" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="ds-org-tz">Fuseau horaire</FieldLabel>
                <NativeSelect id="ds-org-tz" defaultValue="africa-casablanca">
                  <NativeSelectOption value="africa-casablanca">Africa/Casablanca</NativeSelectOption>
                  <NativeSelectOption value="europe-paris">Europe/Paris</NativeSelectOption>
                  <NativeSelectOption value="asia-riyadh">Asia/Riyadh</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="ds-org-currency">Devise d'affichage</FieldLabel>
                <NativeSelect id="ds-org-currency" defaultValue="eur">
                  <NativeSelectOption value="eur">EUR — Euro</NativeSelectOption>
                  <NativeSelectOption value="mad">MAD — Dirham marocain</NativeSelectOption>
                  <NativeSelectOption value="sar">SAR — Riyal saoudien</NativeSelectOption>
                </NativeSelect>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="ds-org-lang">Langue par défaut des guests</FieldLabel>
              <NativeSelect id="ds-org-lang" defaultValue="fr">
                <NativeSelectOption value="fr">Français</NativeSelectOption>
                <NativeSelectOption value="en">English</NativeSelectOption>
                <NativeSelectOption value="ar">العربية</NativeSelectOption>
              </NativeSelect>
              <FieldDescription>Langue des emails automatiques quand celle du guest est inconnue.</FieldDescription>
            </Field>
            <Field orientation="horizontal">
              <Switch id="ds-org-sync" defaultChecked />
              <FieldLabel htmlFor="ds-org-sync">Synchronisation automatique des canaux</FieldLabel>
            </Field>
          </FieldGroup>
          <div className="mt-4 flex gap-2">
            <Button size="sm">Enregistrer</Button>
            <Button size="sm" variant="ghost">
              Annuler
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="pt-4">
          <div className="flex flex-col rounded-xl border border-border bg-card">
            {[
              { label: 'Nouvelle réservation', description: 'Email + push à chaque réservation confirmée', on: true },
              { label: 'Alerte bruit / capteurs', description: 'Push immédiat en cas de dépassement de seuil', on: true },
              { label: 'Solde en retard', description: 'Rappel quotidien tant que le solde n\'est pas perçu', on: true },
              { label: 'Digest hebdomadaire', description: 'Résumé de performance chaque lundi matin', on: false },
            ].map((notification, index) => (
              <div key={notification.label} className={cn('flex items-center gap-3 p-3.5', index > 0 && 'border-t border-border')}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{notification.label}</div>
                  <div className="text-xs text-muted-foreground">{notification.description}</div>
                </div>
                <Switch defaultChecked={notification.on} aria-label={notification.label} />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="billing" className="pt-4">
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="ds-org-if">Identifiant fiscal (IF)</FieldLabel>
                <Input id="ds-org-if" defaultValue="40482913" />
              </Field>
              <Field>
                <FieldLabel htmlFor="ds-org-ice">ICE</FieldLabel>
                <Input id="ds-org-ice" defaultValue="002481937000042" />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="ds-org-iban">IBAN de versement</FieldLabel>
              <Input id="ds-org-iban" defaultValue="MA64 •••• •••• •••• 4412" readOnly />
              <FieldDescription>Compte crédité des versements Stripe/PayZone.</FieldDescription>
            </Field>
          </FieldGroup>
          <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive-soft/40 p-4">
            <h4 className="m-0 text-sm font-semibold text-destructive">Zone dangereuse</h4>
            <p className="m-0 mt-1 text-xs text-muted-foreground">
              Supprimer l'organisation efface définitivement logements, réservations et documents.
            </p>
            <Button size="xs" variant="destructive" className="mt-2.5">
              Supprimer l'organisation
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
