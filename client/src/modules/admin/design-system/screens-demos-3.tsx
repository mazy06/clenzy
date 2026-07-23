import { useState } from 'react';
import {
  BellIcon,
  BotIcon,
  CalendarCheckIcon,
  CheckIcon,
  CopyIcon,
  CircleCheckIcon,
  CreditCardIcon,
  DownloadIcon,
  EyeIcon,
  FileSignatureIcon,
  FileTextIcon,
  HistoryIcon,
  LinkIcon,
  MessageSquareIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  PlugZapIcon,
  RefreshCwIcon,
  SendIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SparklesIcon,
  ThermometerIcon,
  UploadIcon,
  VolumeXIcon,
  WrenchIcon,
  XIcon,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupTextarea,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
  Message,
  MessageAvatar,
  MessageContent,
  MessageGroup,
  Spinner,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
} from '../../../components/ui';
import PageHeader from '../../../components/baitly/PageHeader';
import StatusChip from '../../../components/baitly/StatusChip';
import FilterChipRow from '../../../components/baitly/FilterChipRow';
import StatTile from '../../../components/baitly/StatTile';
import GuestAvatar from '../../../components/baitly/GuestAvatar';
import { Money } from '../../../components/baitly/Money';
import { cn } from '../../../utils/cn';

/**
 * Projections d'écrans PMS (vague 7, enrichies) — galerie uniquement.
 */

// ─── Section — Intégrations ──────────────────────────────────────────────────

const INTEGRATION_TABS = [
  { value: 'channels', label: 'Canaux' },
  { value: 'iot', label: 'Objets connectés' },
  { value: 'payments', label: 'Paiements' },
];

const CHANNEL_INTEGRATIONS = [
  {
    name: 'Airbnb',
    color: '#FF5A5F',
    description: 'Réservations, tarifs et disponibilités en two-way.',
    connected: true,
    lastSync: 'il y a 12 min',
    properties: 3,
  },
  {
    name: 'Booking.com',
    color: '#003580',
    description: 'Via Channex — ARI et réservations.',
    connected: true,
    lastSync: 'il y a 25 min',
    properties: 3,
  },
  {
    name: 'Vrbo',
    color: '#14B8A6',
    description: 'Via Channex — ARI et réservations.',
    connected: false,
    properties: 0,
  },
];

const IOT_INTEGRATIONS = [
  { name: 'Minut', color: '#14B8A6', description: 'Capteurs de bruit et température.', connected: false, icon: <VolumeXIcon /> },
  { name: 'Nuki', color: '#2563EB', description: 'Serrures connectées et codes d\'accès.', connected: false, icon: <ThermometerIcon /> },
];

export function BIntegrationsSectionDemo() {
  const [tab, setTab] = useState('channels');
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Intégrations"
        subtitle="Canaux de distribution, objets connectés et paiements"
        iconBadge={<PlugZapIcon />}
        showBackButton={false}
        className="mb-0"
      />

      <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success-soft/40 p-3">
        <span className="inline-flex size-9 items-center justify-center rounded-lg bg-success-soft text-success">
          <CircleCheckIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-semibold text-foreground">Channel manager opérationnel</div>
          <div className="text-xs text-muted-foreground">
            Webhooks Channex actifs · 0 erreur sur 24 h · 214 mises à jour ARI aujourd'hui
          </div>
        </div>
        <Button size="xs" variant="ghost">
          Journal de sync
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line">
          {INTEGRATION_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tab === 'channels' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CHANNEL_INTEGRATIONS.map((integration) => (
            <div key={integration.name} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className="inline-flex size-9 items-center justify-center rounded-lg text-white [&>svg]:size-4"
                    style={{ backgroundColor: integration.color }}
                  >
                    <LinkIcon className="size-4" />
                  </span>
                  <div>
                    <h3 className="m-0 text-sm font-semibold text-foreground">{integration.name}</h3>
                    <p className="m-0 text-xs text-muted-foreground">{integration.description}</p>
                  </div>
                </div>
                {integration.connected ? (
                  <Badge variant="success">Connecté</Badge>
                ) : (
                  <Badge variant="outline">Non connecté</Badge>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                {integration.connected ? (
                  <>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <RefreshCwIcon className="size-3.5" /> {integration.lastSync} · {integration.properties} logements
                    </span>
                    <div className="flex items-center gap-2">
                      <Button size="xs" variant="ghost">
                        Configurer
                      </Button>
                      <Switch defaultChecked aria-label={`Activer ${integration.name}`} />
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-faint">Aucun logement relié</span>
                    <Button size="xs" variant="outline">
                      <LinkIcon /> Connecter
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'iot' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {IOT_INTEGRATIONS.map((integration) => (
            <div key={integration.name} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className="inline-flex size-9 items-center justify-center rounded-lg text-white [&>svg]:size-4"
                    style={{ backgroundColor: integration.color }}
                  >
                    {integration.icon}
                  </span>
                  <div>
                    <h3 className="m-0 text-sm font-semibold text-foreground">{integration.name}</h3>
                    <p className="m-0 text-xs text-muted-foreground">{integration.description}</p>
                  </div>
                </div>
                <Badge variant="outline">Non connecté</Badge>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs text-faint">Aucun appareil relié</span>
                <Button size="xs" variant="outline">
                  <LinkIcon /> Connecter
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'payments' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex size-9 items-center justify-center rounded-lg bg-[#635BFF] text-white">
                  <CreditCardIcon className="size-4" />
                </span>
                <div>
                  <h3 className="m-0 text-sm font-semibold text-foreground">Stripe</h3>
                  <p className="m-0 text-xs text-muted-foreground">Paiements carte, cautions et versements.</p>
                </div>
              </div>
              <Badge variant="success">Connecté</Badge>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-xs text-muted-foreground">
                Compte vérifié · versements J+3
              </span>
              <Button size="xs" variant="ghost">
                Tableau Stripe
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex size-9 items-center justify-center rounded-lg bg-foreground text-background">
                  <CreditCardIcon className="size-4" />
                </span>
                <div>
                  <h3 className="m-0 text-sm font-semibold text-foreground">PayZone / CMI</h3>
                  <p className="m-0 text-xs text-muted-foreground">Encaissement carte au Maroc (MAD).</p>
                </div>
              </div>
              <Badge variant="outline">Non connecté</Badge>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-xs text-faint">Recommandé pour les organisations marocaines</span>
              <Button size="xs" variant="outline">
                <LinkIcon /> Connecter
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section — Documents & Communications ────────────────────────────────────

const DOC_CATALOG = [
  {
    stage: 'Avant le séjour',
    templates: [
      { name: 'Bienvenue & infos pratiques', mode: 'Auto · J-7', channels: ['Email'], active: true },
      { name: 'Instructions de check-in', mode: 'Auto · J-1', channels: ['Email', 'WhatsApp'], active: true },
      { name: 'Solde à régler', mode: 'Auto · J-7', channels: ['Email'], active: true },
    ],
  },
  {
    stage: 'Pendant le séjour',
    templates: [
      { name: 'Message de mi-séjour', mode: 'Auto · J+2', channels: ['In-app'], active: false },
      { name: 'Alerte bruit (capteurs)', mode: 'Auto · évènement', channels: ['WhatsApp'], active: true },
    ],
  },
  {
    stage: 'Fin du séjour',
    templates: [
      { name: 'Instructions de check-out', mode: 'Auto · J-1', channels: ['Email'], active: true },
      { name: 'Merci & demande d\'avis', mode: 'Auto · J+1', channels: ['Email'], active: true },
    ],
  },
  {
    stage: 'Documents commerciaux',
    templates: [
      { name: 'Facture de séjour (NF)', mode: 'Auto · au paiement', channels: ['Document'], active: true },
      { name: 'Attestation de séjour', mode: 'Manuel', channels: ['Document'], active: true },
    ],
  },
];

const DOC_VARIABLES = [
  { tag: '{{guest.first_name}}', label: 'Prénom du voyageur', example: 'Amina', group: 'Guest' },
  { tag: '{{guest.full_name}}', label: 'Nom complet', example: 'Amina Benali', group: 'Guest' },
  { tag: '{{property.name}}', label: 'Nom du logement', example: 'Riad Yasmine', group: 'Propriété' },
  { tag: '{{property.wifi_password}}', label: 'Mot de passe WiFi', example: 'yasmine2026', group: 'Propriété' },
  { tag: '{{stay.checkin_date}}', label: 'Date d\'arrivée', example: '12 août 2026', group: 'Séjour' },
  { tag: '{{stay.access_code}}', label: 'Code d\'accès', example: '4482', group: 'Séjour' },
];

export function BDocumentsSectionDemo() {
  const [tab, setTab] = useState('catalog');
  const [historyFilter, setHistoryFilter] = useState<string | ''>('');
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Documents & Communications"
        subtitle="Templates, historique et conformité réglementaire"
        iconBadge={<FileTextIcon />}
        titleAdornment={<Badge variant="destructive">2 échecs</Badge>}
        showBackButton={false}
        className="mb-0"
        actions={
          <>
            <Button size="sm" variant="outline">
              <RefreshCwIcon /> Rafraîchir
            </Button>
            <Button size="sm">
              <SparklesIcon /> Générer un document
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<FileTextIcon />} label="Templates actifs" value="24" hint="9 messages · 6 WhatsApp · 9 documents" />
        <StatTile icon={<SendIcon />} label="Envois (30 j)" value="312" iconClassName="text-success" hint={<><b>98,7 %</b> délivrés</>} />
        <StatTile icon={<XIcon />} label="Échecs à traiter" value="2" iconClassName="text-destructive" hint="1 email · 1 WhatsApp" />
        <StatTile icon={<ShieldCheckIcon />} label="Conformité" value="2/3" iconClassName="text-warning" hint="e-facturation KSA à vérifier" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line" className="flex-wrap">
          <TabsTrigger value="catalog">Catalogue</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="templates">Documents</TabsTrigger>
          <TabsTrigger value="history">
            Historique <Badge variant="destructive" className="px-1.5 py-0 text-2xs">2</Badge>
          </TabsTrigger>
          <TabsTrigger value="variables">Variables</TabsTrigger>
          <TabsTrigger value="compliance">Conformité</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ── Catalogue : parcours voyageur en accordéons ── */}
      {tab === 'catalog' && (
        <Accordion type="single" collapsible defaultValue="Avant le séjour" className="rounded-xl border border-border bg-card px-4">
          {DOC_CATALOG.map((stage) => (
            <AccordionItem key={stage.stage} value={stage.stage}>
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  {stage.stage}
                  <Badge variant="secondary" className="px-1.5 py-0 text-2xs">{stage.templates.length}</Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-2">
                  {stage.templates.map((template) => (
                    <div key={template.name} className="flex items-center gap-2.5 rounded-lg border border-border p-2.5">
                      <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{template.name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <StatusChip tone={template.mode.startsWith('Auto') ? 'accent' : 'neutral'} label={template.mode} size="sm" />
                          {template.channels.map((channel) => (
                            <StatusChip key={channel} tone="info" label={channel} size="sm" />
                          ))}
                        </div>
                      </div>
                      <Button size="icon-xs" variant="ghost" aria-label="Modifier">
                        <PencilIcon />
                      </Button>
                      <Switch defaultChecked={template.active} aria-label={`Activer ${template.name}`} />
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* ── Templates de messages ── */}
      {tab === 'messages' && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
            <Button size="sm">
              <PlusIcon /> Créer un template
            </Button>
          </div>
          <ItemGroup className="rounded-xl border border-border bg-card">
            {[
              { name: 'Bienvenue & infos pratiques', trigger: 'Réservation confirmée', type: 'Bienvenue', sent: 84 },
              { name: 'Instructions de check-in', trigger: 'J-1 avant arrivée', type: 'Check-in', sent: 78 },
              { name: 'Merci & demande d\'avis', trigger: 'J+1 après départ', type: 'Check-out', sent: 71 },
              { name: 'Relance solde impayé', trigger: 'J-7 si solde dû', type: 'Personnalisé', sent: 12 },
            ].map((template, index) => (
              <div key={template.name}>
                {index > 0 && <ItemSeparator />}
                <Item>
                  <ItemMedia variant="icon">
                    <MessageSquareIcon />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{template.name}</ItemTitle>
                    <ItemDescription>
                      Déclencheur : {template.trigger} · {template.sent} envois sur 30 j
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <StatusChip tone="accent" label={template.type} size="sm" />
                    <Button size="icon-xs" variant="ghost" aria-label="Modifier">
                      <PencilIcon />
                    </Button>
                  </ItemActions>
                </Item>
              </div>
            ))}
          </ItemGroup>
        </div>
      )}

      {/* ── Templates WhatsApp (approbation Meta) ── */}
      {tab === 'whatsapp' && (
        <ItemGroup className="rounded-xl border border-border bg-card">
          {[
            { name: 'baitly_checkin_instructions_v2', lang: 'fr · ar', category: 'Utility', status: { tone: 'ok' as const, label: 'Approuvé par Meta' } },
            { name: 'baitly_noise_alert_v1', lang: 'fr · en', category: 'Utility', status: { tone: 'ok' as const, label: 'Approuvé par Meta' } },
            { name: 'baitly_upsell_late_checkout', lang: 'fr', category: 'Marketing', status: { tone: 'warn' as const, label: 'En review Meta' } },
          ].map((template, index) => (
            <div key={template.name}>
              {index > 0 && <ItemSeparator />}
              <Item>
                <ItemMedia variant="icon">
                  <MessageSquareIcon />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>
                    <code className="text-xs">{template.name}</code>
                  </ItemTitle>
                  <ItemDescription>
                    {template.lang} · catégorie {template.category}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <StatusChip tone={template.status.tone} label={template.status.label} dot size="sm" />
                  <Button size="icon-xs" variant="ghost" aria-label="Aperçu">
                    <EyeIcon />
                  </Button>
                </ItemActions>
              </Item>
            </div>
          ))}
        </ItemGroup>
      )}

      {/* ── Templates de documents PDF ── */}
      {tab === 'templates' && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border p-4 text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <UploadIcon className="size-5" />
            <span className="text-sm font-medium">Importer un template .odt</span>
            <span className="text-2xs">Variables {'{{...}}'} remplacées à la génération · 10 Mo max</span>
          </button>
          <ItemGroup className="rounded-xl border border-border bg-card">
            {[
              { name: 'Facture de séjour (NF)', meta: 'v4 · .odt · générée automatiquement au paiement', active: true, badge: { tone: 'ok' as const, label: 'Conforme NF' } },
              { name: 'Attestation de séjour', meta: 'v2 · .odt · génération manuelle (référence : réservation)', active: true, badge: null },
              { name: 'État des lieux d\'entrée', meta: 'v1 · .odt · référence : intervention', active: false, badge: null },
            ].map((template, index) => (
              <div key={template.name}>
                {index > 0 && <ItemSeparator />}
                <Item>
                  <ItemMedia variant="icon">
                    <FileSignatureIcon />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{template.name}</ItemTitle>
                    <ItemDescription>{template.meta}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    {template.badge && <StatusChip tone={template.badge.tone} label={template.badge.label} dot size="sm" />}
                    {!template.active && <StatusChip tone="neutral" label="Inactif" size="sm" />}
                    <Button size="xs" variant="outline">
                      Générer
                    </Button>
                    <Switch defaultChecked={template.active} aria-label={`Activer ${template.name}`} />
                  </ItemActions>
                </Item>
              </div>
            ))}
          </ItemGroup>
        </div>
      )}

      {/* ── Historique unifié ── */}
      {tab === 'history' && (
        <div className="flex flex-col gap-3">
          <FilterChipRow
            allLabel="Tout"
            allCount={312}
            value={historyFilter}
            onChange={setHistoryFilter}
            options={[
              { value: 'messages', label: 'Messages', color: '#2563EB', count: 248 },
              { value: 'documents', label: 'Documents', color: '#14B8A6', count: 64 },
            ]}
          />
          <ItemGroup className="rounded-xl border border-border bg-card">
            {[
              { title: 'Instructions de check-in → Amina Benali', meta: 'Email · RES-1042 · il y a 2 h', icon: <SendIcon />, status: { tone: 'ok' as const, label: 'Délivré' }, failed: false },
              { title: 'Alerte bruit → John Smith', meta: 'WhatsApp · RES-1043 · hier 23 h 41', icon: <MessageSquareIcon />, status: { tone: 'err' as const, label: 'Échec (numéro invalide)' }, failed: true },
              { title: 'Facture FAC-2026-0203', meta: 'PDF · RES-1042 · générée hier 09 h 12', icon: <FileTextIcon />, status: { tone: 'ok' as const, label: 'Générée' }, failed: false },
              { title: 'Bienvenue & infos pratiques → Lea Martin', meta: 'Email · RES-1044 · hier 08 h 00', icon: <SendIcon />, status: { tone: 'err' as const, label: 'Échec (boîte pleine)' }, failed: true },
            ].map((entry, index) => (
              <div key={entry.title}>
                {index > 0 && <ItemSeparator />}
                <Item>
                  <ItemMedia variant="icon">{entry.icon}</ItemMedia>
                  <ItemContent>
                    <ItemTitle>{entry.title}</ItemTitle>
                    <ItemDescription>{entry.meta}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <StatusChip tone={entry.status.tone} label={entry.status.label} dot size="sm" />
                    {entry.failed ? (
                      <Button size="xs" variant="outline">
                        <RefreshCwIcon /> Réessayer
                      </Button>
                    ) : (
                      <Button size="icon-xs" variant="ghost" aria-label="Aperçu">
                        <EyeIcon />
                      </Button>
                    )}
                  </ItemActions>
                </Item>
              </div>
            ))}
          </ItemGroup>
        </div>
      )}

      {/* ── Variables & tags ── */}
      {tab === 'variables' && (
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-xs text-muted-foreground">
            Copiez une variable dans vos templates — elle sera remplacée à l'envoi par la valeur du séjour.
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variable</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Exemple</TableHead>
                <TableHead>Groupe</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {DOC_VARIABLES.map((variable) => (
                <TableRow key={variable.tag}>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-primary">{variable.tag}</code>
                  </TableCell>
                  <TableCell>{variable.label}</TableCell>
                  <TableCell className="text-muted-foreground">{variable.example}</TableCell>
                  <TableCell>
                    <StatusChip tone="neutral" label={variable.group} size="sm" />
                  </TableCell>
                  <TableCell className="text-end">
                    <Button size="icon-xs" variant="ghost" aria-label={`Copier ${variable.tag}`}>
                      <CopyIcon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Conformité ── */}
      {tab === 'compliance' && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { name: 'Factures NF (France)', detail: 'Numérotation séquentielle · archivage 10 ans', status: { tone: 'ok' as const, label: 'Conforme' }, action: null },
              { name: 'CGI Maroc', detail: 'IF/ICE présents · TVA 10 % hébergement', status: { tone: 'ok' as const, label: 'Conforme' }, action: null },
              { name: 'e-Facturation (Arabie Saoudite)', detail: 'ZATCA phase 2 — QR code requis', status: { tone: 'warn' as const, label: 'Non vérifié' }, action: 'Relancer la vérification' },
            ].map((rule) => (
              <div key={rule.name} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="m-0 text-sm font-semibold text-foreground">{rule.name}</h4>
                  <StatusChip tone={rule.status.tone} label={rule.status.label} dot size="sm" />
                </div>
                <p className="m-0 text-xs text-muted-foreground">{rule.detail}</p>
                {rule.action && (
                  <Button size="xs" variant="outline" className="mt-auto self-start">
                    <RefreshCwIcon /> {rule.action}
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="m-0 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Recherche par numéro de document
            </h4>
            <InputGroup className="max-w-md">
              <InputGroupInput placeholder="FAC-2026-0203, AT-2026-0012…" />
              <InputGroupAddon align="inline-end">
                <InputGroupButton>Rechercher</InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <p className="m-0 mt-2 text-2xs text-muted-foreground">
              Vérifie l'intégrité et retrouve le PDF archivé d'un document émis.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section — Notifications ─────────────────────────────────────────────────

const NOTIFICATION_GROUPS = [
  {
    day: "Aujourd'hui",
    items: [
      {
        title: 'Nouvelle réservation Airbnb',
        description: 'RES-1045 · Villa Palmeraie · 2 150 € · 20 → 27 août',
        time: 'il y a 8 min',
        icon: <CalendarCheckIcon />,
        accent: 'text-success bg-success-soft',
        unread: true,
      },
      {
        title: 'Alerte bruit — Riad Yasmine',
        description: '82 dB détectés à 23 h 40 (seuil 75 dB). Message auto envoyé au guest.',
        time: 'il y a 2 h',
        icon: <VolumeXIcon />,
        accent: 'text-warning bg-warning-soft',
        unread: true,
      },
    ],
  },
  {
    day: 'Hier',
    items: [
      {
        title: 'Intervention terminée',
        description: 'Ménage post check-out — Duplex Guéliz (Fatima Z., 2 h 20).',
        time: '17 h 05',
        icon: <WrenchIcon />,
        accent: 'text-info bg-info-soft',
        unread: false,
      },
      {
        title: 'Versement Stripe reçu',
        description: '1 240 € — RES-1042 (acompte + solde).',
        time: '09 h 12',
        icon: <CreditCardIcon />,
        accent: 'text-success bg-success-soft',
        unread: false,
      },
    ],
  },
];

export function BNotificationsSectionDemo() {
  const [filter, setFilter] = useState('all');
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <PageHeader
        title="Notifications"
        subtitle="2 non lues"
        iconBadge={<BellIcon />}
        showBackButton={false}
        className="mb-0"
        actions={
          <>
            <Button size="sm" variant="ghost">
              <CheckIcon /> Tout marquer lu
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Préférences de notifications">
              <SettingsIcon />
            </Button>
          </>
        }
      />
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList variant="line">
          <TabsTrigger value="all">Toutes</TabsTrigger>
          <TabsTrigger value="unread">
            Non lues <Badge className="px-1.5 py-0 text-2xs">2</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-col gap-4">
        {NOTIFICATION_GROUPS.map((group) => {
          const items = filter === 'unread' ? group.items.filter((n) => n.unread) : group.items;
          if (items.length === 0) return null;
          return (
            <div key={group.day} className="flex flex-col gap-2">
              <h3 className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {group.day}
              </h3>
              {items.map((notification) => (
                <button
                  key={notification.title}
                  type="button"
                  className={cn(
                    'group/notification flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-start transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    notification.unread ? 'border-primary/25 bg-card' : 'border-border bg-card/60'
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg [&>svg]:size-4',
                      notification.accent
                    )}
                  >
                    {notification.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {notification.title}
                      </span>
                      {notification.unread && (
                        <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {notification.description}
                    </span>
                  </span>
                  <span className="shrink-0 text-2xs text-faint">{notification.time}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Section — Assistant IA ──────────────────────────────────────────────────

export function BAssistantSectionDemo() {
  const [hitlDecision, setHitlDecision] = useState<string | null>(null);
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_240px]">
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Assistant Baitly"
          subtitle="Analyse, actions et réponses sur vos données"
          iconBadge={<BotIcon />}
          showBackButton={false}
          className="mb-0"
        />

        <div className="flex flex-wrap gap-1.5">
          <StatusChip tone="accent" label="Occupation août : 72 %" size="sm" />
          <StatusChip tone="warn" label="2 propositions HITL" size="sm" />
          <StatusChip tone="info" label="3 arrivées demain" size="sm" />
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
          <MessageGroup>
            <Message align="end">
              <MessageContent>Quel est mon taux d'occupation en août, et que me conseilles-tu ?</MessageContent>
            </Message>
            <Message>
              <MessageAvatar>
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <BotIcon className="size-4" />
                </span>
              </MessageAvatar>
              <MessageContent>
                <span className="mb-1.5 flex flex-wrap gap-1.5">
                  <StatusChip tone="info" label="get_kpis" size="sm" />
                  <StatusChip tone="info" label="get_calendar" size="sm" />
                </span>
                Ton occupation d'août est à <b>72 %</b> (+6 pts vs juillet). Il reste 9 nuits creuses
                sur le Riad Yasmine entre le 18 et le 27 : une baisse ciblée de 12 % devrait les
                combler. Voici la proposition :
              </MessageContent>
            </Message>
            <Message>
              <div className="ms-9 flex max-w-sm flex-col gap-2.5 rounded-xl border border-warning/40 bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground">Baisse −12 % · 18 → 27 août</span>
                  <Badge variant="outline">HITL</Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    80 € → <b className="text-primary"><Money value={70} decimals={0} /></b> /nuit
                  </span>
                  <span>
                    revenu estimé <b className="text-success">+<Money value={680} decimals={0} /></b>
                  </span>
                </div>
                {hitlDecision ? (
                  <div
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs',
                      hitlDecision === 'appliquée' ? 'bg-success-soft text-success' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <CheckIcon className="size-3.5" /> Proposition {hitlDecision}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button size="xs" onClick={() => setHitlDecision('appliquée')}>
                      <CheckIcon /> Appliquer
                    </Button>
                    <Button size="xs" variant="ghost" className="text-muted-foreground" onClick={() => setHitlDecision('refusée')}>
                      <XIcon /> Refuser
                    </Button>
                  </div>
                )}
              </div>
            </Message>
            {hitlDecision === 'appliquée' && (
              <Message>
                <MessageAvatar>
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <BotIcon className="size-4" />
                  </span>
                </MessageAvatar>
                <MessageContent>
                  C'est fait ✅ — les 9 nuits sont à 70 €. Je te préviendrai dès la première
                  réservation captée sur cette plage.
                </MessageContent>
              </Message>
            )}
          </MessageGroup>
          <div className="flex flex-wrap gap-1.5">
            {['Montre les nuits creuses', 'Compare à 2025', 'Prépare le digest du lundi'].map((suggestion) => (
              <Button key={suggestion} size="xs" variant="outline" className="rounded-full">
                {suggestion}
              </Button>
            ))}
          </div>
          <InputGroup>
            <InputGroupTextarea placeholder="Demande une analyse, une action, un chiffre…" rows={2} />
            <InputGroupAddon align="block-end">
              <span className="text-2xs text-faint">L'assistant agit sur vos tarifs après confirmation.</span>
              <InputGroupButton size="icon-xs" className="ms-auto" aria-label="Envoyer">
                <SendIcon />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <GuestAvatar name="Toufik Mazy" size={20} />
          Connecté en tant que Toufik — l'assistant voit vos 4 logements.
        </div>
      </div>

      {/* Historique */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="m-0 mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <HistoryIcon className="size-3.5" /> Conversations récentes
        </h3>
        <div className="flex flex-col gap-1">
          {[
            { title: 'Occupation août + yield', time: 'maintenant', active: true },
            { title: 'Rédiger réponse avis 3★', time: 'hier' },
            { title: 'Analyse annulations Q2', time: 'lun.' },
            { title: 'Digest semaine 29', time: 'lun.' },
          ].map((conversation) => (
            <button
              key={conversation.title}
              type="button"
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-start text-xs transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
                conversation.active ? 'bg-primary-soft font-medium text-primary' : 'text-foreground'
              )}
            >
              <span className="min-w-0 flex-1 truncate">{conversation.title}</span>
              <span className="shrink-0 text-2xs text-faint">{conversation.time}</span>
            </button>
          ))}
        </div>
        <Button size="xs" variant="outline" className="mt-3 w-full">
          Nouvelle conversation
        </Button>
      </div>
    </div>
  );
}
