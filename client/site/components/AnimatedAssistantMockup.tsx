import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BotIcon, CheckIcon, SendIcon, XIcon } from '../../src/icons/glyphs';
import {
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
import Money from './SiteMoney';
import { useSiteLanguage } from '../lib/siteLanguage';
import {
  ASSISTANT_MESSAGES,
  type AssistantMessages,
} from '../lib/messages/assistant';
import { richText } from '../lib/richText';
import { cn } from '../../src/utils/cn';
import ProjectionRuntime from './ProjectionRuntime';
import {
  Cursor,
  useReducedMotion,
  useScriptedCursor,
  useTimeline,
} from './mockupKit';
import { SiteAssistantPortrait, SiteDemoStatus } from './SiteProductVisuals';
import { SITE_ACTION_ARTWORK } from '../data/actionArtwork';
import hostPhoto from '../assets/photos/host.jpg';

/**
 * Mockup animé — Assistant Baitly. Rejoue une VRAIE conversation : questions
 * saisies au clavier, appels d'outils, réponses, et cartes HITL validées par le
 * curseur. La conversation réutilise les primitives du PMS, son portrait
 * d'assistant et les illustrations des actions HITL.
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

/**
 * Ce que le scenario a de non traduisible : l'identifiant de la carte (il
 * relie le clic scripte a son bouton) et le fait que la question soit posee
 * en cliquant une suggestion plutot qu'en la tapant.
 */
const TURN_META = [
  { id: 'yield', viaSuggestion: false },
  { id: 'ops', viaSuggestion: true },
  { id: 'review', viaSuggestion: false },
];

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
        <SiteAssistantPortrait size={40} />
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
const ASK_BUBBLE =
  'w-fit max-w-[82%] rounded-2xl rounded-br-md bg-primary-soft px-3 py-2';
const BOT_BUBBLE =
  'w-fit max-w-[88%] rounded-2xl rounded-bl-md border border-border bg-card px-3 py-2';

/** Avatar de l'hôte qui dialogue avec l'agent (aligné à droite via `align="end"`). */
function HostAvatar() {
  return (
    <MessageAvatar>
      <img
        src={hostPhoto}
        alt=""
        className="size-7 rounded-full object-cover"
        loading="lazy"
      />
    </MessageAvatar>
  );
}

/** Carte HITL — même structure que la projection (bordure warning, 2 actions). */
function HitlBubble({
  hitl,
  id,
  applied,
  m,
}: {
  hitl: AssistantMessages['turns'][number]['hitl'];
  id: string;
  applied: boolean;
  m: AssistantMessages;
}) {
  const { language } = useSiteLanguage();
  return (
    <div className="ms-9 flex max-w-sm flex-col gap-2.5 rounded-xl border border-primary/30 bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <img src={id === 'yield' ? SITE_ACTION_ARTWORK.pricingOptimization : id === 'ops' ? SITE_ACTION_ARTWORK.cleaning : SITE_ACTION_ARTWORK.reviews} alt="" width={40} height={40} />
        <span className="text-xs font-semibold text-foreground">
          {hitl.title}
        </span>
        <SiteDemoStatus done={applied} label={applied ? m.applied : m.pending} />
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {hitl.left ? (
            richText(hitl.left)
          ) : (
            <>
              <Money
                from={language === 'ar' ? 'SAR' : 'MAD'}
                value={m.yield.from}
                decimals={0}
              />{' '}
              →{' '}
              <b className="text-primary">
                <Money
                  from={language === 'ar' ? 'SAR' : 'MAD'}
                  value={m.yield.to}
                  decimals={0}
                />
              </b>{' '}
              {m.perNight}
            </>
          )}
        </span>
        <span>
          {hitl.right ?? (
            <>
              {m.estimatedRevenue}{' '}
              <b className="text-success">
                +
                <Money
                  from={language === 'ar' ? 'SAR' : 'MAD'}
                  value={m.yield.revenue}
                  decimals={0}
                />
              </b>
            </>
          )}
        </span>
      </div>
      {applied ? (
        <div className="flex items-center gap-1.5 rounded-md bg-success-soft px-2 py-1.5 text-xs text-success">
          <CheckIcon className="size-3.5" /> {hitl.done}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button size="xs" data-apply={id}>
            <CheckIcon /> {m.apply}
          </Button>
          <Button size="xs" variant="ghost" className="text-muted-foreground">
            <XIcon /> {m.refuse}
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
        <span className="flex items-center gap-1 py-0.5">
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
  return (
    <AssistantScene
      key={cycle}
      onCycleEnd={() => setCycle((current) => current + 1)}
    />
  );
}

function AssistantScene({ onCycleEnd }: { onCycleEnd: () => void }) {
  const { language } = useSiteLanguage();
  const m = ASSISTANT_MESSAGES[language];
  const TURNS = m.turns;
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
      all.push({ kind: 'hitl', turn: index });
      if (turn.after) all.push({ kind: 'after', text: turn.after });
    });
    setBubbles(all);
    setApplied(Object.fromEntries(TURN_META.map((meta) => [meta.id, true])));
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
      const meta = TURN_META[index];

      if (meta.viaSuggestion) {
        // Question posée en cliquant une suggestion.
        clock += 1100;
        at(clock, () => moveTo(find(`[data-suggestion="${turn.ask}"]`), 0, 0));
        clock += 1300;
        at(clock, () =>
          setBubbles((list) => [...list, { kind: 'ask', text: turn.ask }]),
        );
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

      clock += 1400;
      at(clock, () =>
        setBubbles((list) => [...list, { kind: 'hitl', turn: index }]),
      );
      clock += 1600;
      at(clock, () => moveTo(find(`[data-apply="${meta.id}"]`), 0, 0));
      clock += 1300;
      at(clock, () => setApplied((state) => ({ ...state, [meta.id]: true })));

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
          <span className="ms-3 text-xs text-muted-foreground">
            {m.windowTitle}
          </span>
        </div>

        <ProjectionRuntime>
          <div className="flex flex-col gap-3 p-4">
            {/* En-tête compact + chips de contexte (comme la projection) */}
            <div className="flex items-center gap-2.5">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <SiteAssistantPortrait size={40} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.tagline}</p>
              </div>
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
                        <MessageContent className={ASK_BUBBLE}>
                          {bubble.text}
                        </MessageContent>
                      </Message>
                    );
                  }
                  if (bubble.kind === 'after') {
                    return (
                      <Message key={index}>
                        <Avatar />
                        <MessageContent className={BOT_BUBBLE}>
                          {bubble.text}
                        </MessageContent>
                      </Message>
                    );
                  }
                  if (bubble.kind === 'hitl') {
                    const hitl = TURNS[bubble.turn].hitl;
                    return (
                      <Message key={index}>
                        <HitlBubble
                          hitl={hitl}
                          id={TURN_META[bubble.turn].id}
                          applied={!!applied[TURN_META[bubble.turn].id]}
                          m={m}
                        />
                      </Message>
                    );
                  }
                  if (bubble.kind === 'detail') {
                    return (
                      <Message key={index}>
                        <Avatar />
                        <MessageContent className={BOT_BUBBLE}>
                          {richText(TURNS[bubble.turn].detail)}
                        </MessageContent>
                      </Message>
                    );
                  }
                  return (
                    <Message key={index}>
                      <Avatar />
                      <MessageContent className={BOT_BUBBLE}>
                        {richText(TURNS[bubble.turn].answer)}
                      </MessageContent>
                    </Message>
                  );
                })}
                {thinking && <Thinking />}
              </MessageGroup>
            </div>

            {/* Suggestions cliquables (cibles du curseur) */}
            <div className="flex flex-wrap gap-1.5">
              {m.suggestions.map((suggestion) => (
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
                placeholder={m.placeholder}
                rows={2}
                value={draft}
                readOnly
              />
              <InputGroupAddon align="block-end">
                <span className="text-2xs text-faint">{m.disclaimer}</span>
                <InputGroupButton
                  size="icon-xs"
                  className={cn(
                    'ms-auto',
                    draft && 'bg-primary text-primary-foreground',
                  )}
                  aria-label={m.send}
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
