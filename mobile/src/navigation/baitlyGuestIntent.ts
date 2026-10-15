// Intention volatile Baitly, consommee une seule fois apres la connexion.
let requestProvider: { providerId: number; purpose?: 'management' } | undefined;
export function rememberRequestProvider(id: number, purpose?: 'management') { requestProvider = { providerId: id, purpose }; }
export function consumeRequestIntent() {
  const intent = requestProvider; requestProvider = undefined; return intent;
}
export function consumeRequestProvider() {
  return consumeRequestIntent()?.providerId;
}
