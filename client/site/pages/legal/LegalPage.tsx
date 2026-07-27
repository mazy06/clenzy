import { Link, Navigate, useParams } from 'react-router-dom';
import { Badge } from '../../../src/components/ui';
import { LEGAL_DOCS, getLegalDoc } from './legalContent';

/** Gabarit des documents juridiques : sommaire latéral + corps typographié. */
export default function LegalPage() {
  const { slug } = useParams();
  const doc = getLegalDoc(slug);
  if (!doc) return <Navigate to="/" replace />;

  return (
    <section className="site-shell grid grid-cols-1 items-start gap-10 py-14 lg:grid-cols-[260px_1fr]">
      {/* Sommaire */}
      <aside className="top-24 lg:sticky">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Documents
        </p>
        <nav className="mt-3 flex flex-col gap-1">
          {LEGAL_DOCS.map((entry) => (
            <Link
              key={entry.slug}
              to={`/legal/${entry.slug}`}
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
            to="/statut"
            className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Statut du service
          </Link>
        </nav>
        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          Les champs 〔…〕 seront complétés à l'immatriculation. Documents à faire relire par un
          conseil avant publication.
        </p>
      </aside>

      {/* Corps */}
      <article>
        <Badge variant="outline">Juridique</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{doc.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dernière mise à jour : {doc.updated}
        </p>
        <p className="mt-5 border-s-2 border-border ps-4 text-sm leading-relaxed text-muted-foreground">
          {doc.intro}
        </p>
        <div className="mt-8 flex flex-col gap-8">
          {doc.blocks.map((block) => (
            <section key={block.heading}>
              <h2 className="text-lg font-semibold tracking-tight">{block.heading}</h2>
              {block.paragraphs?.map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="mt-3 text-sm leading-relaxed text-foreground/85">
                  {paragraph}
                </p>
              ))}
              {block.list && (
                <ul className="mt-3 flex flex-col gap-2">
                  {block.list.map((item) => (
                    <li key={item.slice(0, 40)} className="flex gap-2.5 text-sm leading-relaxed text-foreground/85">
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
                          <th key={header} className="p-3 text-start text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.table.rows.map((row) => (
                        <tr key={row[0]} className="border-b border-border align-top last:border-0">
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="p-3 text-xs leading-relaxed text-foreground/85">
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
