import React from 'react';
import CodeEditor from './components/CodeEditor';

interface BookingEngineJsEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const BookingEngineJsEditor: React.FC<BookingEngineJsEditorProps> = ({ value, onChange }) => (
  <CodeEditor value={value} onChange={onChange} language="js" />
);

export default BookingEngineJsEditor;
