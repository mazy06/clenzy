import * as React from 'react';

/** Hook copier/coller (port du use-copy-to-clipboard des démos shadcn). */
export function useCopyToClipboard({ timeout = 2000 }: { timeout?: number } = {}) {
  const [isCopied, setIsCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout>>();

  const copyToClipboard = React.useCallback(
    (value: string) => {
      navigator.clipboard?.writeText(value).then(() => {
        setIsCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setIsCopied(false), timeout);
      });
    },
    [timeout]
  );

  React.useEffect(() => () => clearTimeout(timer.current), []);

  return { isCopied, copyToClipboard };
}
