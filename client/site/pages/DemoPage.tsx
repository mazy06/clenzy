import ContactPage from './ContactPage';
export default function DemoPage({ disabled = false }: { disabled?: boolean }) {
  return <ContactPage intent="demo" disabled={disabled} />;
}
