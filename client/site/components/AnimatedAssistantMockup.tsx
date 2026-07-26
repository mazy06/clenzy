import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BotIcon, CheckIcon, SendIcon, XIcon } from 'lucide-react';
import {
  Badge,
  Button,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
  Message,
  MessageAvatar,
  MessageContent,
  MessageGroup,
} from '../../src/components/ui';
import StatusChip from '../../src/components/baitly/StatusChip';
import { Money } from '../../src/components/baitly/Money';
import { cn } from '../../src/utils/cn';
import ProjectionRuntime from './ProjectionRuntime';
import { Cursor, useReducedMotion, useScriptedCursor, useTimeline } from './mockupKit';
import hostPhoto from '../assets/photos/host.jpg';

/**
 * Mockup animé — Assistant Baitly. Rejoue une VRAIE conversation : questions
 * saisies au clavier, appels d'outils, réponses, et cartes HITL validées par le
 * curseur. Les composants sont ceux de la projection `BAssistantSectionDemo`
 * (Message/StatusChip/InputGroup/carte HITL) — rien n'est réinventé ; seul
 * l'enchaînement est scripté, ce que la projection statique ne peut pas faire.
 *
 * Conteneur à hauteur fixe + défilement interne : la page ne bouge jamais.
 * prefers-reduced-motion → conversation complète affichée d'emblée, sans curseur.
 */

const WINDOW_HEIGHT = 460;

/** Cadence de frappe d'un caractère (ms) — rythme de saisie humaine. */
const TYPING_MS = 46;

/** Temps d'affichage de la conversation terminée avant de relancer la boucle. */
const END_PAUSE_MS = 9000;

/* ─── Script de la conversation ─────────────────────────────────────────────── */

interface HitlDef {
  id: string;
  title: string;
  left: React.ReactNode;
  right: React.ReactNode;
  done: string;
}

interface TurnDef {
  /** Question posée : tapée au clavier, ou choisie parmi les suggestions. */
  ask: string;
  viaSuggestion?: boolean;
  answer: React.ReactNode;
  /** Précision envoyée juste après la réponse : donne à lire, et laisse le
      temps de suivre l'échange avant la carte à décider. */
  detail?: React.ReactNode;
  hitl?: HitlDef;
  /** Réponse de l'assistant après validation de la carte. */
  after?: string;
}

const TURNS: TurnDef[] = [
  {
    ask: "Quel est mon taux d'occupation en août ?",
    answer: (
      <>
        Ton occupation d'août est à <b>72 %</b> (+6 pts vs juillet). Il reste 9 nuits creuses sur le
        Riad Yasmine entre le 18 et le 27 : une baisse ciblée de 12 % devrait les combler.
      </>
    ),
    detail: (
      <>
        Dans le détail : 4 nuits en semaine, 5 sur les week-ends. Les biens comparables du quartier
        sont à <b>1 180 MAD</b> en moyenne sur la période — tu es 6 % au-dessus.
      </>
    ),
    hitl: {
      id: 'yield',
      title: 'Baisse −12 % · 18 → 27 août',
      left: (
        <>
          <Money value={1250} decimals={0} /> →{' '}
          <b className="text-primary">
            <Money value={1100} decimals={0} />
          </b>{' '}
          /nuit
        </>
      ),
      right: (
        <>
          revenu estimé{' '}
          <b className="text-success">
            +<Money value={6800} decimals={0} />
          </b>
        </>
      ),
      done: 'Proposition appliquée',
    },
    after: "C'est fait — les 9 nuits sont à 1 100 MAD. Je te préviens dès la première réservation captée.",
  },
  {
    ask: 'Prépare le digest du lundi',
    viaSuggestion: true,
    answer: (
      <>
        Semaine 30 : <b>14 arrivées</b>, 11 départs, 2 avis reçus (4,6 ★). Un ménage reste à
        replanifier — Fatima est en congé lundi sur le Riad Kasbah.
      </>
    ),
    detail: (
      <>
        À surveiller aussi : 3 arrivées après 20 h à préparer, et le stock de linge du Riad Yasmine
        passe sous le seuil jeudi.
      </>
    ),
    hitl: {
      id: 'ops',
      title: 'Réassigner le ménage · Riad Kasbah',
      left: <>Fatima Z. → <b className="text-primary">Samira B.</b></>,
      right: <>lundi 10:00 · 2 h</>,
      done: 'Mission réassignée',
    },
    after: 'Samira est notifiée sur WhatsApp, la check-list photo est déjà attachée à la mission.',
  },
  {
    ask: "Réponds à l'avis 3★ de Julien",
    answer: (
      <>
        Julien reproche le bruit de la rue le samedi soir. Je propose une réponse publique qui
        reconnaît la gêne et mentionne les bouchons d'oreilles désormais fournis.
      </>
    ),
    detail: (
      <>
        Brouillon : « Merci Julien pour ce retour honnête. Le bruit du samedi soir est réel — nous
        fournissons désormais des bouchons d'oreilles et proposons la chambre côté patio. »
      </>
    ),
    hitl: {
      id: 'review',
      title: 'Publier la réponse à l’avis',
      left: <>Ton : <b className="text-primary">empathique</b></>,
      right: <>FR · 412 signes</>,
      done: 'Réponse publiée',
    },
  },
];

const SUGGESTIONS = ['Montre les nuits creuses', 'Prépare le digest du lundi', 'Compare à 2025'];

/* ─── Éléments de conversation ──────────────────────────────────────────────── */

type Bubble =
  | { kind: 'ask'; text: string }
  | { kind: 'answer'; turn: number }
  | { kind: 'detail'; turn: number }
  | { kind: 'hitl'; turn: number }
  | { kind: 'after'; text: string };

function Avatar() {
  return (
    <MessageAvatar>
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary-soft text-primary">
        <BotIcon className="size-4" />
      </span>
    </MessageAvatar>
  );
}

/**
 * Bulles de conversation. Le kit n'en fournit pas (`MessageContent` occupe
 * toute la largeur, d'où des questions qui semblaient alignées à gauche) : on
 * contraint donc la largeur au contenu et on distingue les deux locuteurs par
 * la surface, pas par la couleur — teinte de marque très diluée côté hôte,
 * carte bordée côté agent. Le petit coin redressé côté avatar fait office
 * d'amorce, sans queue dessinée.
 */
const ASK_BUBBLE = 'w-fit max-w-[82%] rounded-2xl rounded-br-md bg-primary-soft px-3 py-2';
const BOT_BUBBLE = 'w-fit max-w-[88%] rounded-2xl rounded-bl-md border border-border bg-card px-3 py-2';

/** Avatar de l'hôte qui dialogue avec l'agent (aligné à droite via `align="end"`). */
function HostAvatar() {
  return (
    <MessageAvatar>
      <img src={hostPhoto} alt="" className="size-7 rounded-full object-cover" loading="lazy" />
    </MessageAvatar>
  );
}

/** Carte HITL — même structure que la projection (bordure warning, 2 actions). */
function HitlBubble({ hitl, applied }: { hitl: HitlDef; applied: boolean }) {
  return (
    <div className="ms-9 flex max-w-sm flex-col gap-2.5 rounded-xl border border-warning/40 bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">{hitl.title}</span>
        <Badge variant="outline">{applied ? 'Validé' : 'En attente'}</Badge>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{hitl.left}</span>
        <span>{hitl.right}</span>
      </div>
      {applied ? (
        <div className="flex items-center gap-1.5 rounded-md bg-success-soft px-2 py-1.5 text-xs text-success">
          <CheckIcon className="size-3.5" /> {hitl.done}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button size="xs" data-apply={hitl.id}>
            <CheckIcon /> Appliquer
          </Button>
          <Button size="xs" variant="ghost" className="text-muted-foreground">
            <XIcon /> Refuser
          </Button>
        </div>
      )}
    </div>
  );
}

/** Trois points animés pendant que l'assistant « réfléchit ». */
function Thinking() {
  return (
    <Message>
      <Avatar />
      <MessageContent className={BOT_BUBBLE}>
        <span className="flex items-center gap-1 py-0.5" aria-label="L'assistant rédige">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
              style={{ animationDelay: `${dot * 140}ms` }}
            />
          ))}
        </span>
      </MessageContent>
    </Message>
  );
}

/* ─── Scène ─────────────────────────────────────────────────────────────────── */

export default function AnimatedAssistantMockup() {
  const [cycle, setCycle] = useState(0);
  return <AssistantScene key={cycle} onCycleEnd={() => setCycle((current) => current + 1)} />;
}

function AssistantScene({ onCycleEnd }: { onCycleEnd: () => void }) {
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { cursor, moveTo, park, hide } = useScriptedCursor(containerRef);

  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [applied, setApplied] = useState<Record<string, boolean>>({});

  /* Reduced motion : tout est déjà là, rien ne bouge. */
  useLayoutEffect(() => {
    if (!reduced) return;
    const all: Bubble[] = [];
    TURNS.forEach((turn, index) => {
      all.push({ kind: 'ask', text: turn.ask });
      all.push({ kind: 'answer', turn: index });
      if (turn.hitl) all.push({ kind: 'hitl', turn: index });
      if (turn.after) all.push({ kind: 'after', text: turn.after });
    });
    setBubbles(all);
    setApplied(Object.fromEntries(TURNS.filter((t) => t.hitl).map((t) => [t.hitl!.id, true])));
  }, [reduced]);

  /* La conversation grandit → on suit toujours le dernier message. */
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  }, [bubbles, thinking]);

  const find = (selector: string) =>
    containerRef.current?.querySelector<HTMLElement>(selector) ?? null;

  useTimeline(!reduced, (at) => {
    let clock = 900;
    at(clock, park);

    TURNS.forEach((turn, index) => {
      const hitl = turn.hitl;

      if (turn.viaSuggestion) {
        // Question posée en cliquant une suggestion.
        clock += 1100;
        at(clock, () => moveTo(find(`[data-suggestion="${turn.ask}"]`), 0, 0));
        clock += 1300;
        at(clock, () => setBubbles((list) => [...list, { kind: 'ask', text: turn.ask }]));
      } else {
        // Question tapée caractère par caractère, puis envoyée.
        clock += 900;
        at(clock, () => moveTo(find('[data-composer]'), -40, 0));
        clock += 700;
        for (let i = 1; i <= turn.ask.length; i += 1) {
          at(clock + i * TYPING_MS, () => setDraft(turn.ask.slice(0, i)));
        }
        clock += turn.ask.length * TYPING_MS + 600;
        at(clock, () => moveTo(find('[data-send]'), 0, 0));
        clock += 1000;
        at(clock, () => {
          setDraft('');
          setBubbles((list) => [...list, { kind: 'ask', text: turn.ask }]);
        });
      }

      // Réflexion, puis réponse.
      clock += 500;
      at(clock, () => setThinking(true));
      clock += 2200;
      at(clock, () => {
        setThinking(false);
        setBubbles((list) => [...list, { kind: 'answer', turn: index }]);
      });

      // Précision : laisse le temps de lire avant la décision.
      if (turn.detail) {
        clock += 1100;
        at(clock, () => setThinking(true));
        clock += 1700;
        at(clock, () => {
          setThinking(false);
          setBubbles((list) => [...list, { kind: 'detail', turn: index }]);
        });
      }

      if (hitl) {
        clock += 1400;
        at(clock, () => setBubbles((list) => [...list, { kind: 'hitl', turn: index }]));
        clock += 1600;
        at(clock, () => moveTo(find(`[data-apply="${hitl.id}"]`), 0, 0));
        clock += 1300;
        at(clock, () => setApplied((state) => ({ ...state, [hitl.id]: true })));
      }

      if (turn.after) {
        clock += 900;
        at(clock, () => setThinking(true));
        clock += 1600;
        at(clock, () => {
          setThinking(false);
          setBubbles((list) => [...list, { kind: 'after', text: turn.after! }]);
        });
      }

      // Respiration entre deux échanges.
      clock += 2800;
    });

    /* Fin de boucle : le curseur se retire, puis la conversation complète reste
       affichée un long moment — sans cette pause, le fil se vide brutalement
       alors qu'on est encore en train de lire le dernier échange. */
    at(clock + 900, hide);
    at(clock + END_PAUSE_MS, onCycleEnd);
  });

  return (
    <div className="relative" ref={containerRef}>
      <div className="hero-grid absolute -inset-8 -z-10" aria-hidden />
      <div className="shadow-brand overflow-hidden rounded-xl border border-border bg-card">
        {/* Barre fenêtre */}
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="ms-3 text-xs text-muted-foreground">app.baitly — Assistant</span>
        </div>

        <ProjectionRuntime>
          <div className="flex flex-col gap-3 p-4">
            {/* En-tête compact + chips de contexte (comme la projection) */}
            <div className="flex items-center gap-2.5">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <BotIcon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Assistant Baitly</p>
                <p className="text-xs text-muted-foreground">Analyse, actions et réponses sur vos données</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <StatusChip tone="accent" label="Occupation août : 72 %" size="sm" />
              <StatusChip tone="warn" label="2 propositions HITL" size="sm" />
              <StatusChip tone="info" label="3 arrivées demain" size="sm" />
            </div>

            {/* Fil de conversation — hauteur fixe, défilement interne */}
            <div
              ref={scrollRef}
              className="overflow-y-auto rounded-xl border border-border bg-background p-3"
              style={{ height: WINDOW_HEIGHT }}
            >
              <MessageGroup>
                {bubbles.map((bubble, index) => {
                  if (bubble.kind === 'ask') {
                    return (
                      <Message key={index} align="end">
                        <HostAvatar />
                        <MessageContent className={ASK_BUBBLE}>{bubble.text}</MessageContent>
                      </Message>
                    );
                  }
                  if (bubble.kind === 'after') {
                    return (
                      <Message key={index}>
                        <Avatar />
                        <MessageContent className={BOT_BUBBLE}>{bubble.text}</MessageContent>
                      </Message>
                    );
                  }
                  if (bubble.kind === 'hitl') {
                    const hitl = TURNS[bubble.turn].hitl!;
                    return (
                      <Message key={index}>
                        <HitlBubble hitl={hitl} applied={!!applied[hitl.id]} />
                      </Message>
                    );
                  }
                  if (bubble.kind === 'detail') {
                    return (
                      <Message key={index}>
                        <Avatar />
                        <MessageContent className={BOT_BUBBLE}>
                          {TURNS[bubble.turn].detail}
                        </MessageContent>
                      </Message>
                    );
                  }
                  return (
                    <Message key={index}>
                      <Avatar />
                      <MessageContent className={BOT_BUBBLE}>{TURNS[bubble.turn].answer}</MessageContent>
                    </Message>
                  );
                })}
                {thinking && <Thinking />}
              </MessageGroup>
            </div>

            {/* Suggestions cliquables (cibles du curseur) */}
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  size="xs"
                  variant="outline"
                  className="rounded-full"
                  data-suggestion={suggestion}
                >
                  {suggestion}
                </Button>
              ))}
            </div>

            {/* Composeur : le texte s'y écrit pendant l'animation */}
            <InputGroup data-composer>
              <InputGroupTextarea
                placeholder="Demande une analyse, une action, un chiffre…"
                rows={2}
                value={draft}
                readOnly
              />
              <InputGroupAddon align="block-end">
                <span className="text-2xs text-faint">
                  L'assistant agit sur vos tarifs après confirmation.
                </span>
                <InputGroupButton
                  size="icon-xs"
                  className={cn('ms-auto', draft && 'bg-primary text-primary-foreground')}
                  aria-label="Envoyer"
                  data-send
                >
                  <SendIcon />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>
        </ProjectionRuntime>
      </div>

      {!reduced && <Cursor cursor={cursor} />}
    </div>
  );
}
