interface I18n {
  tArray: (key: string) => string[];
}

export function createStepper(currentStep: number, i18n: I18n): HTMLElement {
  const container = document.createElement('div');
  container.className = 'cb-stepper';
  container.setAttribute('role', 'navigation');
  container.setAttribute('aria-label', 'Booking progress');

  const labels = i18n.tArray('stepLabels');

  labels.forEach((_, index) => {
    if (index > 0) {
      const line = document.createElement('span');
      line.className = 'cb-step__line';
      container.appendChild(line);
    }

    const step = document.createElement('span');
    step.className = 'cb-step';

    if (index < currentStep) step.classList.add('cb-completed');
    if (index === currentStep) step.classList.add('cb-active');

    const dot = document.createElement('span');
    dot.className = 'cb-step__dot';
    dot.setAttribute('aria-label', labels[index]);

    step.appendChild(dot);
    container.appendChild(step);
  });

  return container;
}
