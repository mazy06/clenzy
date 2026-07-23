import * as React from 'react';

/**
 * Shim de `next/image` pour les démos copiées du site shadcn (app Next.js).
 * Rend un <img> simple ; `fill` reproduit le comportement absolu de Next.
 */
export default function Image({
  fill,
  className,
  style,
  alt = '',
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) {
  return (
    <img
      alt={alt}
      className={className}
      style={fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%', ...style } : style}
      {...props}
    />
  );
}
