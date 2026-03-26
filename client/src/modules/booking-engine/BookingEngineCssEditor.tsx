import React from 'react';
import CodeEditor from './components/CodeEditor';

interface BookingEngineCssEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const BookingEngineCssEditor: React.FC<BookingEngineCssEditorProps> = ({ value, onChange }) => (
  <CodeEditor value={value} onChange={onChange} language="css" />
);

export default BookingEngineCssEditor;
