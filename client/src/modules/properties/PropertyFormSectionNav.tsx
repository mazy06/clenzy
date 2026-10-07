import { useEffect, useState } from 'react';

export interface PropertyFormNavSection {
  id: string;
  art: string;
  title: string;
}

/**
 * Sommaire du formulaire de logement : une entrée illustrée par section, celle
 * qu'on lit est marquée au fil du défilement, un clic y amène.
 */
export default function PropertyFormSectionNav({ sections, label }: { sections: PropertyFormNavSection[]; label: string }) {
  const [active, setActive] = useState(sections[0]?.id);
  const ids = sections.map((section) => section.id).join('|');

  useEffect(() => {
    const elements = ids.split('|').map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (!elements.length || typeof IntersectionObserver === 'undefined') return undefined;
    const visible = new Map<string, boolean>();
    // Une section compte comme « lue » tant qu'elle occupe le haut de la zone.
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => visible.set(entry.target.id, entry.isIntersecting));
      const first = elements.find((el) => visible.get(el.id));
      if (first) setActive(first.id);
    }, { rootMargin: '0px 0px -55% 0px' });
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);

  const go = (id: string) => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    setActive(id);
  };

  return (
    <nav className="pf-nav" aria-label={label}>
      <p className="pf-nav__title">{label}</p>
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          aria-current={active === section.id ? 'location' : undefined}
          onClick={() => go(section.id)}
        >
          <img src={section.art} alt="" width={28} height={28} />
          <span>{section.title}</span>
        </button>
      ))}
    </nav>
  );
}
