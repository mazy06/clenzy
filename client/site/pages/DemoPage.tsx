import { CheckIcon, MessageCircleIcon } from 'lucide-react';
import {
  Badge,
  Button,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
  NativeSelect,
  NativeSelectOption,
} from '../../src/components/ui';
import Reveal from '../components/Reveal';

const EXPECTATIONS = [
  '30 minutes, sur vos propres logements si vous le souhaitez',
  'En français, en darija ou en anglais',
  'Vos questions conformité (fiche police, taxe de séjour, Go Siyaha) traitées en direct',
  'Aucun engagement — et pas de relance harcelante',
];

export default function DemoPage() {
  return (
    <section className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-12 px-4 py-16 lg:grid-cols-2">
      <Reveal>
        <Badge variant="outline">Démo</Badge>
        <h1 className="mt-4 text-4xl leading-tight font-semibold tracking-tight">
          Voyez Baitly tourner. En vrai.
        </h1>
        <p className="mt-4 max-w-lg text-lg text-muted-foreground">
          Une démo guidée par un humain qui connaît le métier — pas un webinaire enregistré.
        </p>
        <ul className="mt-6 flex flex-col gap-3">
          {EXPECTATIONS.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                <CheckIcon className="size-3" />
              </span>
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted-foreground">
          Pressé ?{' '}
          <a
            href="https://wa.me/212600000000"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-foreground underline"
          >
            <MessageCircleIcon className="size-3.5" /> Écrivez-nous sur WhatsApp
          </a>
        </p>
      </Reveal>
      <Reveal delay={2}>
        <form
          className="rounded-2xl border border-border bg-card p-6 shadow-brand"
          onSubmit={(event) => event.preventDefault()}
        >
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="demo-name">Votre nom</FieldLabel>
                <Input id="demo-name" placeholder="Salma Bennani" />
              </Field>
              <Field>
                <FieldLabel htmlFor="demo-phone">Téléphone / WhatsApp</FieldLabel>
                <Input id="demo-phone" placeholder="+212 6…" />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="demo-email">Email</FieldLabel>
              <Input id="demo-email" type="email" placeholder="salma@medina-stays.ma" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="demo-size">Nombre de logements</FieldLabel>
                <NativeSelect id="demo-size" defaultValue="5-20">
                  <NativeSelectOption value="1-4">1 à 4</NativeSelectOption>
                  <NativeSelectOption value="5-20">5 à 20</NativeSelectOption>
                  <NativeSelectOption value="21-50">21 à 50</NativeSelectOption>
                  <NativeSelectOption value="50+">Plus de 50</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="demo-tool">Outil actuel</FieldLabel>
                <NativeSelect id="demo-tool" defaultValue="none">
                  <NativeSelectOption value="none">Extranets + Excel</NativeSelectOption>
                  <NativeSelectOption value="superhote">Superhote</NativeSelectOption>
                  <NativeSelectOption value="smoobu">Smoobu</NativeSelectOption>
                  <NativeSelectOption value="guesty">Guesty / Hostaway</NativeSelectOption>
                  <NativeSelectOption value="other">Autre</NativeSelectOption>
                </NativeSelect>
              </Field>
            </div>
            <Button size="lg" type="submit" className="w-full">
              Réserver ma démo
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Réponse sous 24 h ouvrées. Vos données restent chez Baitly (RGPD / Loi 09-08).
            </p>
          </FieldGroup>
        </form>
      </Reveal>
    </section>
  );
}
