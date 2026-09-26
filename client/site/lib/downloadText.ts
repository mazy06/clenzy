/** A local export only: no request, upload or persistence. */
export function downloadText(
  name: string,
  text: string,
  type = 'text/plain;charset=utf-8',
) {
  const url = URL.createObjectURL(new Blob(['\uFEFF', text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
