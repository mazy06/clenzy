import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useSiteLanguage } from '../../lib/siteLanguage';
import { BAITLY_CONTACT_MESSAGES } from '../../lib/messages/baitlyContact';
import NotFoundPage from '../NotFoundPage';
import { Badge } from '../../../src/components/ui';
import { SiteCookieSettingsButton } from '../../components/SiteCookieNotice';
// Source UNIQUE, partagee avec le PMS : les deux applications portaient chacune
// leur texte, et ils se contredisaient sur le droit applicable.
import { legalDocs, getLegalDoc } from '../../../src/modules/legal/corpus';

/** Gabarit des documents juridiques : sommaire latéral + corps typographié. */
export default function LegalPage() {
  const { slug } = useParams();
  const { language } = useSiteLanguage();
  const m = BAITLY_CONTACT_MESSAGES[language];
  const doc = getLegalDoc(slug, language);
  const { hash } = useLocation();
  useEffect(() => {
    // This route is lazy: its anchor does not exist when the shell first navigates.
    if (hash === '#cookies') document.getElementById('cookies')?.scrollIntoView?.({ behavior: 'instant' });
  }, [hash, doc]);
  if (!doc) return <NotFoundPage />;

  return (
    <section className="site-shell grid grid-cols-1 items-start gap-10 py-14 lg:grid-cols-[260px_1fr]">
      {/* Sommaire */}
      <aside className="top-24 lg:sticky">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {m.legal}
        </p>
        <nav className="mt-3 flex flex-col gap-1">
          {legalDocs(language).map((entry) => (
            <Link
              key={entry.slug}
              to={`/legal/${entry.slug}?lang=${language}`}
              aria-current={entry.slug === doc.slug ? 'page' : undefined}
              className={
                entry.slug === doc.slug
                  ? 'rounded-md bg-primary-soft px-3 py-2 text-sm font-medium text-foreground'
                  : 'rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
              }
            >
              {entry.title}
            </Link>
          ))}
          <Link
            to={`/statut?lang=${language}`}
            className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {m.status}
          </Link>
          <Link
            to={`/contact?lang=${language}`}
            className="rounded-md px-3 py-2 text-sm text-muted-foreground underline"
          >
            {m.contact}
          </Link>
        </nav>
        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          {m.reference}
        </p>
      </aside>

      {/* Corps */}
      <article className="min-w-0">
        <Badge variant="outline">{m.legalTag}</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {doc.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {m.updated} : {doc.updated}
        </p>
        <div className="mt-5 rounded-xl border border-border bg-muted p-5 text-sm leading-relaxed">
          <p className="font-medium">
            {m.known} : Sinatech · {m.location}
          </p>
          <p className="mt-2 text-muted-foreground">{m.legalPending}</p>
          <p className="mt-2 text-muted-foreground">{m.legalDraft}</p>
        </div>
        <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
          {doc.intro}
        </p>
        <div className="mt-8 flex flex-col gap-8">
          {doc.blocks.map((block) => (
            <section key={block.heading} id={block.id} className="scroll-mt-24">
              <h2 className="text-lg font-semibold tracking-tight">
                {block.heading}
              </h2>
              {block.id === 'cookies' && <SiteCookieSettingsButton />}
              {block.paragraphs?.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 40)}
                  className="mt-3 text-sm leading-relaxed text-foreground/85"
                >
                  {paragraph}
                </p>
              ))}
              {block.list && (
                <ul className="mt-3 flex flex-col gap-2">
                  {block.list.map((item) => (
                    <li
                      key={item.slice(0, 40)}
                      className="flex gap-2.5 text-sm leading-relaxed text-foreground/85"
                    >
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-primary/60" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
              {block.table && (
                <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full border-collapse bg-card text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {block.table.headers.map((header) => (
                          <th
                            key={header}
                            className="p-3 text-start text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.table.rows.map((row) => (
                        <tr
                          key={row[0]}
                          className="border-b border-border align-top last:border-0"
                        >
                          {row.map((cell, cellIndex) => (
                            <td
                              key={cellIndex}
                              className="p-3 text-xs leading-relaxed text-foreground/85"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      </article>
    </section>
  );
}
