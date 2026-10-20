import { BAITLY_JOURNEY_TEMPLATES } from '../../src/modules/booking-engine/studio/grapes/import/baitlyJourneyTemplates';
import { baitlyTemplateLogoSource } from '../../src/modules/booking-engine/studio/grapes/import/baitlyTemplateLogos';

const selectedId = new URLSearchParams(location.search).get('template');
const selected = BAITLY_JOURNEY_TEMPLATES.find((model) => model.id === selectedId);
if (selected) {
  document.head.querySelector('style')?.remove();
  const style = document.createElement('style');style.textContent = selected.pages[0].css;document.head.append(style);
  document.body.innerHTML = selected.pages[0].html;
  document.title = `Logo ${selected.name}`;
} else for (const model of BAITLY_JOURNEY_TEMPLATES) {
  const list = document.getElementById('logos')!;
  const specimen = document.createElement('section');specimen.className = 'specimen';
  specimen.style.setProperty('--paper', model.designVars!['--bt-color-background']);
  const image = document.createElement('img');image.src = baitlyTemplateLogoSource(model.id)!;image.alt = `Symbole ${model.name}`;
  const copy = document.createElement('div');
  const title = document.createElement('h2');title.textContent = model.name;title.style.fontFamily = model.theme!.headingFontFamily!;title.style.color = model.designVars!['--bt-color-text'];
  const label = document.createElement('p');label.textContent = model.description?.split(' · ')[1] || '';
  copy.append(title, label);specimen.append(image, copy);list.append(specimen);
}
