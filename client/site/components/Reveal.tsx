import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../../src/utils/cn';

/**
 * Révélation à l'entrée dans le viewport (opacity + translateY, une seule fois).
 * `delay` échelonne les éléments d'une même rangée (1 → 4).
 */
export default function Reveal({
  children,
  delay,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  delay?: 1 | 2 | 3 | 4;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'span';
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    /* Bloc neutre : la direction/le layout viennent du className passé par le
       consommateur. Pour une carte à hauteur égale dans une grille, passer
       `flex flex-col` sur ce Reveal et `flex-1` sur la carte. */
    <Tag ref={ref as never} className={cn('reveal', delay && `reveal-d${delay}`, className)}>
      {children}
    </Tag>
  );
}
