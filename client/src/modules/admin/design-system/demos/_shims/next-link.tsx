import * as React from 'react';

/** Shim de `next/link` pour les démos copiées du site shadcn : simple <a>. */
export default function Link({
  href,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
