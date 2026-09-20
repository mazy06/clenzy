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
import { useSiteLanguage } from '../lib/siteLanguage';
import { PAGE_MESSAGES } from '../lib/messages/pages';

export default function DemoPage() {
  const { language } = useSiteLanguage();
  const m = PAGE_MESSAGES[language].demo;
  // Le formulaire garde une largeur de saisie confortable même en très grand
  // écran ; c'est la colonne de discours qui absorbe l'espace restant.
  return (
    <section className="site-shell grid grid-cols-1 items-start gap-12 py-16 lg:grid-cols-[1fr_minmax(0,480px)]">
      <Reveal>
        <Badge variant="outline">{m.eyebrow}</Badge>
        <h1 className="mt-4 text-4xl leading-tight font-semibold tracking-tight">
          {m.title}
        </h1>
        <p className="mt-4 max-w-lg text-lg text-muted-foreground">
          {m.intro}
        </p>
        <ul className="mt-6 flex flex-col gap-3">
          {m.expectations.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                <CheckIcon className="size-3" />
              </span>
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted-foreground">
          {m.hurry}{' '}
          <a
            href="https://wa.me/212600000000"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-foreground underline"
          >
            <MessageCircleIcon className="size-3.5" /> {m.whatsapp}
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
                <FieldLabel htmlFor="demo-name">{m.fields.name}</FieldLabel>
                <Input id="demo-name" placeholder={m.fields.namePlaceholder} />
              </Field>
              <Field>
                <FieldLabel htmlFor="demo-phone">{m.fields.phone}</FieldLabel>
                <Input id="demo-phone" placeholder="+212 6…" />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="demo-email">{m.fields.email}</FieldLabel>
              <Input id="demo-email" type="email" placeholder="salma@medina-stays.ma" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="demo-size">{m.fields.size}</FieldLabel>
                <NativeSelect id="demo-size" defaultValue="5-20">
                  <NativeSelectOption value="1-4">{m.sizes.s1}</NativeSelectOption>
                  <NativeSelectOption value="5-20">{m.sizes.s2}</NativeSelectOption>
                  <NativeSelectOption value="21-50">{m.sizes.s3}</NativeSelectOption>
                  <NativeSelectOption value="50+">{m.sizes.s4}</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="demo-tool">{m.fields.tool}</FieldLabel>
                <NativeSelect id="demo-tool" defaultValue="none">
                  <NativeSelectOption value="none">{m.tools.none}</NativeSelectOption>
                  <NativeSelectOption value="superhote">Superhote</NativeSelectOption>
                  <NativeSelectOption value="smoobu">Smoobu</NativeSelectOption>
                  <NativeSelectOption value="guesty">Guesty / Hostaway</NativeSelectOption>
                  <NativeSelectOption value="other">{m.tools.other}</NativeSelectOption>
                </NativeSelect>
              </Field>
            </div>
            <Button size="lg" type="submit" className="w-full">
              {m.submit}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {m.legal}
            </p>
          </FieldGroup>
        </form>
      </Reveal>
    </section>
  );
}
