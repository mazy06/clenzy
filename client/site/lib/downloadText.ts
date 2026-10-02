/** A local export only: no request, upload or persistence. */
export function downloadText(
  name: string,
  text: string,
  type = 'text/plain;charset=utf-8',
) {
  downloadBlob(name, new Blob(['\uFEFF', text], { type }));
}

/** Same local-only export, for a document already built in the browser. */
export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
