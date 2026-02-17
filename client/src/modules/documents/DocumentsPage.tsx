import React, { useState, useRef } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Button,
  TextField,
  InputAdornment,
} from '@mui/material';
import { Description, History, LocalOffer, GppGood, Refresh, Add, Send, Search } from '@mui/icons-material';
import TemplatesList, { TemplatesListRef } from './TemplatesList';
import GenerationsList, { GenerationsListRef } from './GenerationsList';
import AvailableTagsReference from './AvailableTagsReference';
import ComplianceDashboard, { ComplianceDashboardRef } from './ComplianceDashboard';

const DocumentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [tagsSearch, setTagsSearch] = useState('');
  const [complianceSearch, setComplianceSearch] = useState('');
  const templatesRef = useRef<TemplatesListRef>(null);
  const generationsRef = useRef<GenerationsListRef>(null);
  const complianceRef = useRef<ComplianceDashboardRef>(null);

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            sx={{ flex: 1 }}
          >
            <Tab icon={<Description />} iconPosition="start" label="Templates" />
            <Tab icon={<History />} iconPosition="start" label="Historique" />
            <Tab icon={<LocalOffer />} iconPosition="start" label="Tags disponibles" />
            <Tab icon={<GppGood />} iconPosition="start" label="Conformité NF" />
          </Tabs>

          {/* Boutons onglet Templates */}
          {activeTab === 0 && (
            <Box sx={{ display: 'flex', gap: 1, pr: 2 }}>
              <Button startIcon={<Refresh />} size="small" onClick={() => templatesRef.current?.fetchTemplates()}>
                Rafraîchir
              </Button>
              <Button variant="contained" startIcon={<Add />} onClick={() => templatesRef.current?.openUpload()}>
                Nouveau template
              </Button>
            </Box>
          )}

          {/* Boutons onglet Historique */}
          {activeTab === 1 && (
            <Box sx={{ display: 'flex', gap: 1, pr: 2 }}>
              <Button startIcon={<Refresh />} size="small" onClick={() => generationsRef.current?.fetchGenerations()}>
                Rafraîchir
              </Button>
              <Button variant="contained" startIcon={<Send />} onClick={() => generationsRef.current?.openGenerate()}>
                Générer un document
              </Button>
            </Box>
          )}

          {/* Recherche onglet Tags disponibles */}
          {activeTab === 2 && (
            <Box sx={{ display: 'flex', gap: 1, pr: 2, alignItems: 'center' }}>
              <TextField
                size="small"
                placeholder="Rechercher un tag..."
                value={tagsSearch}
                onChange={(e) => setTagsSearch(e.target.value)}
                sx={{ minWidth: 250 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          )}

          {/* Boutons + recherche onglet Conformité NF */}
          {activeTab === 3 && (
            <Box sx={{ display: 'flex', gap: 1, pr: 2, alignItems: 'center' }}>
              <Button startIcon={<Refresh />} size="small" onClick={() => complianceRef.current?.fetchData()}>
                Rafraîchir
              </Button>
              <TextField
                size="small"
                placeholder="Ex: FAC-2025-00001"
                value={complianceSearch}
                onChange={(e) => setComplianceSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && complianceRef.current?.searchByNumber(complianceSearch)}
                sx={{ minWidth: 250 }}
                inputProps={{ 'aria-label': 'Rechercher par numéro légal' }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          )}
        </Box>
      </Paper>

      {activeTab === 0 && <TemplatesList ref={templatesRef} />}
      {activeTab === 1 && <GenerationsList ref={generationsRef} />}
      {activeTab === 2 && <AvailableTagsReference search={tagsSearch} />}
      {activeTab === 3 && <ComplianceDashboard ref={complianceRef} />}
    </Box>
  );
};

export default DocumentsPage;
