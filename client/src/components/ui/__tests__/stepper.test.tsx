import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Stepper, Step, StepLabel } from '../stepper';

/** Le Stepper remplace celui de MUI sur sept ecrans : ce test fixe son contrat. */
const rendu = (actif: number) =>
  render(
    <Stepper activeStep={actif}>
      <Step><StepLabel>Logement</StepLabel></Step>
      <Step><StepLabel>Service</StepLabel></Step>
      <Step><StepLabel>Chiffrage</StepLabel></Step>
    </Stepper>,
  );

describe('Stepper', () => {
  it('marque l etape courante pour les lecteurs d ecran', () => {
    rendu(1);
    const etapes = screen.getAllByRole('listitem');
    expect(etapes[1]).toHaveAttribute('aria-current', 'step');
    expect(etapes[0]).not.toHaveAttribute('aria-current');
  });

  it('distingue franchi / courant / a venir', () => {
    rendu(1);
    const e = screen.getAllByRole('listitem');
    expect(e[0]).toHaveAttribute('data-state', 'done');
    expect(e[1]).toHaveAttribute('data-state', 'active');
    expect(e[2]).toHaveAttribute('data-state', 'todo');
  });

  it('numerote les etapes non franchies, coche les franchies', () => {
    rendu(1);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.queryByText('1')).toBeNull();
  });

  it('rend les libelles', () => {
    rendu(0);
    expect(screen.getByText('Logement')).toBeInTheDocument();
    expect(screen.getByText('Chiffrage')).toBeInTheDocument();
  });
});
