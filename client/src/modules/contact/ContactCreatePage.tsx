import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ContactForm from './ContactForm';

const ContactCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Vérifier si on a des paramètres de pré-remplissage
    const recipient = searchParams.get('recipient');
    const subject = searchParams.get('subject');
    
    if (recipient || subject) {
    }
  }, [searchParams]);

  return (
    <ContactForm />
  );
};

export default ContactCreatePage;
