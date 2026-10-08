import React from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LegalLayout from './LegalLayout';
import { getLegalDoc, type LegalSlug } from './corpus';

/**
 * Rend un document du corpus juridique dans le PMS.
 *
 * <p>Le PMS servait ses propres CGU — un brouillon de dix articles — pendant
 * que la landing publiait un corpus abouti. Les deux se contredisaient sur le
 * droit applicable, l'editeur, l'autorite de controle et le role RGPD, et
 * c'est le brouillon que la case obligatoire de l'inscription faisait
 * accepter. Cet ecran rend desormais le MEME texte que la landing.</p>
 *
 * <p>Le lecteur choisit sa langue dans l'en-tete ({@link LegalLayout}) : un
 * document qui engage doit pouvoir se lire dans la langue de son lecteur, et
 * non dans celle de son adresse IP.</p>
 */
export default function LegalDocPage({ slug }: { slug: LegalSlug }) {
  const { i18n } = useTranslation();
  const doc = getLegalDoc(slug, i18n.language);

  // Le corpus porte les trois langues : un document introuvable signalerait un
  // slug errone dans une route, pas une traduction manquante.
  if (!doc) return <Navigate to="/login" replace />;

  return (
    <LegalLayout title={doc.title} updated={doc.updated}>
      <p className="mb-6 border-s-2 border-border ps-4 text-sm leading-relaxed text-muted-foreground">
        {doc.intro}
      </p>

      {doc.blocks.map((block) => (
        <section key={block.heading} id={block.id}>
          <h2>{block.heading}</h2>

          {block.paragraphs?.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}

          {block.list && (
            <ul>
              {block.list.map((item) => (
                <li key={item.slice(0, 40)}>{item}</li>
              ))}
            </ul>
          )}

          {block.table && (
            // Un tableau juridique deborde sur telephone : il defile pour
            // lui-meme plutot que d'etirer la page (contrat Baitly UI).
            <div className="my-3 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-start text-xs">
                <thead>
                  <tr>
                    {block.table.headers.map((header) => (
                      <th
                        key={header}
                        scope="col"
                        className="border-b border-border pb-2 pe-3 text-start font-semibold text-foreground"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.table.rows.map((row) => (
                    <tr key={row[0]}>
                      {row.map((cell) => (
                        <td
                          key={cell.slice(0, 30)}
                          className="border-b border-border py-2 pe-3 align-top leading-relaxed text-muted-foreground"
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
    </LegalLayout>
  );
}
