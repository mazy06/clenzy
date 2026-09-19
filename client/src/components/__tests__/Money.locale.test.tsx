import { describe, it, expect, afterAll } from 'vitest';
import { currencyDisplayPart, formatCurrency } from '../../utils/currencyUtils';
import i18n from '../../i18n/config';

/**
 * Le montant formaté et la découpe qu'en fait `Money`.
 *
 * <p>`Money` retire la devise d'une chaîne DÉJÀ formatée pour lui substituer
 * une icône (SAR, MAD). Sa position n'est pas une constante de l'application :
 * elle dépend de la langue. Une découpe qui présumait le suffixe français
 * faisait disparaître le montant en anglais.</p>
 */

afterAll(async () => {
  await i18n.changeLanguage('fr');
});

/** Reproduit la découpe de `Money` — c'est elle qu'on met à l'épreuve. */
function splitAroundCurrency(formatted: string, currency: string) {
  const token = currencyDisplayPart(currency);
  const at = formatted.lastIndexOf(token);
  if (at < 0) return null;
  return {
    before: formatted.slice(0, at).replace(/[\s  ‎‏]+$/u, ''),
    after: formatted.slice(at + token.length).replace(/^[\s  ‎‏]+/u, ''),
  };
}

describe('currencyDisplayPart', () => {
  it('rend le code en français, où il suit le nombre', async () => {
    await i18n.changeLanguage('fr');
    expect(currencyDisplayPart('SAR')).toBe('SAR');
  });

  it('rend un glyphe en arabe — le code ISO n’y apparaît pas', async () => {
    await i18n.changeLanguage('ar');
    const token = currencyDisplayPart('SAR');
    expect(token).not.toBe('SAR');
    expect(token.length).toBeGreaterThan(0);
  });
});

describe('découpe du montant autour de la devise', () => {
  it('garde le montant quand la devise SUIT le nombre (français)', async () => {
    await i18n.changeLanguage('fr');
    const split = splitAroundCurrency(formatCurrency(1234.5, 'SAR'), 'SAR');
    expect(split).not.toBeNull();
    expect(split!.before).toMatch(/1.?234/);
    expect(split!.after).toBe('');
  });

  it('garde le montant quand la devise PRÉCÈDE le nombre (anglais)', async () => {
    await i18n.changeLanguage('en');
    const formatted = formatCurrency(1234.5, 'SAR');
    const split = splitAroundCurrency(formatted, 'SAR');
    expect(split).not.toBeNull();
    // Le piège : une découpe qui ne garde que `before` rendrait ici une chaîne
    // vide — le montant disparaîtrait de l'écran.
    expect(split!.before).toBe('');
    expect(split!.after).toMatch(/1,234/);
  });

  it('retrouve la devise en arabe, où elle est rendue en glyphe', async () => {
    await i18n.changeLanguage('ar');
    const split = splitAroundCurrency(formatCurrency(1234.5, 'SAR'), 'SAR');
    expect(split).not.toBeNull();
    expect(`${split!.before}${split!.after}`).toMatch(/1,234/);
  });
});

describe('formatCurrency', () => {
  it('suit la langue active', async () => {
    await i18n.changeLanguage('fr');
    const fr = formatCurrency(1234.5, 'EUR');
    await i18n.changeLanguage('en');
    const en = formatCurrency(1234.5, 'EUR');
    expect(fr).not.toBe(en);
  });

  it('rend des chiffres latins en arabe — les montants s’alignent en tabular-nums', async () => {
    await i18n.changeLanguage('ar');
    expect(formatCurrency(1234.5, 'EUR')).toMatch(/[0-9]/);
    expect(formatCurrency(1234.5, 'EUR')).not.toMatch(/[٠-٩]/);
  });
});
