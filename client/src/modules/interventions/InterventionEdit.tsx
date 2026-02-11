import React from 'react';
import { useParams } from 'react-router-dom';
import InterventionForm from './InterventionForm';

export default function InterventionEdit() {
  const { id } = useParams<{ id: string }>();

  return (
    <InterventionForm
      interventionId={Number(id)}
      mode="edit"
    />
  );
}
