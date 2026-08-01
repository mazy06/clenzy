import React from 'react';
import { IconButton } from '@mui/material';
import { ArrowBack } from '../../../icons';

interface PanelSubViewHeaderProps {
  title: string;
  onBack: () => void;
}

const PanelSubViewHeader: React.FC<PanelSubViewHeaderProps> = ({ title, onBack }) => (
  <div className="flex items-center gap-1.5 min-h-[40px] px-1.5 border-b border-[var(--line)]">
    <IconButton size="small" onClick={onBack} sx={{ p: 0.5 }}>
      <ArrowBack size={18} strokeWidth={1.75} />
    </IconButton>
    <h6 className="cn-text-subtitle2 font-bold text-[0.75rem] uppercase tracking-[0.03em] overflow-hidden text-ellipsis whitespace-nowrap">
      {title}
    </h6>
  </div>
);

export default PanelSubViewHeader;
