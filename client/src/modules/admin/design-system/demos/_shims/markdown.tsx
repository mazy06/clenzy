import ReactMarkdown from 'react-markdown';

/** Shim de `@/components/markdown` du site shadcn — rend via react-markdown. */
export function Markdown({ children }: { children: string }) {
  return <ReactMarkdown>{children}</ReactMarkdown>;
}
