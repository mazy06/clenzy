import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  FormControl,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  portfolioId?: string;
}

interface Property {
  id: string;
  address: string;
  type: string;
  status: string;
  clientId: string;
  portfolioId?: string;
}

interface Portfolio {
  id: string;
  name: string;
  description?: string;
}

const ClientAssignmentPage: React.FC = () => {
  const { user } = useAuth();
  
  const [clients, setClients] = useState<Client[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingClient, setEditingClient] = useState<string | null>(null);
  const [editingProperty, setEditingProperty] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);



  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // TODO: Remplacer par de vrais appels API
        // const clientsData = await api.getClients();
        // const propertiesData = await api.getProperties();
        // const portfoliosData = await api.getPortfolios();
        
        // Données temporaires pour la démo
        const mockClients: Client[] = [
          { id: '1', name: 'Client A', email: 'clienta@example.com', phone: '0123456789' },
          { id: '2', name: 'Client B', email: 'clientb@example.com', phone: '0987654321' },
          { id: '3', name: 'Client C', email: 'clientc@example.com', phone: '0555666777' },
        ];
        
        const mockProperties: Property[] = [
          { id: '1', address: '123 Rue de la Paix, Paris', type: 'Bureau', status: 'Actif', clientId: '1' },
          { id: '2', address: '456 Avenue des Champs, Lyon', type: 'Commerce', status: 'Actif', clientId: '1' },
          { id: '3', address: '789 Boulevard Central, Marseille', type: 'Résidentiel', status: 'Actif', clientId: '2' },
          { id: '4', address: '321 Rue du Commerce, Toulouse', type: 'Bureau', status: 'Inactif', clientId: '3' },
        ];
        
        const mockPortfolios: Portfolio[] = [
          { id: '1', name: 'Portefeuille Nord', description: 'Clients du nord de la France' },
          { id: '2', name: 'Portefeuille Sud', description: 'Clients du sud de la France' },
          { id: '3', name: 'Portefeuille Est', description: 'Clients de l\'est de la France' },
        ];
        
        setClients(mockClients);
        setProperties(mockProperties);
        setPortfolios(mockPortfolios);
      } catch (err) {
        setError('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleClientPortfolioChange = async (clientId: string, portfolioId: string) => {
    try {
      // TODO: Appel API pour associer le client au portefeuille
      // await api.assignClientToPortfolio(clientId, portfolioId);
      
      setClients(prev => prev.map(client => 
        client.id === clientId 
          ? { ...client, portfolioId } 
          : client
      ));
      
      setSuccess('Client associé au portefeuille avec succès');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Erreur lors de l\'association du client');
    }
  };

  const handlePropertyPortfolioChange = async (propertyId: string, portfolioId: string) => {
    try {
      // TODO: Appel API pour associer la propriété au portefeuille
      // await api.assignPropertyToPortfolio(propertyId, portfolioId);
      
      setProperties(prev => prev.map(property => 
        property.id === propertyId 
          ? { ...property, portfolioId } 
          : property
      ));
      
      setSuccess('Propriété associée au portefeuille avec succès');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Erreur lors de l\'association de la propriété');
    }
  };

  const getPortfolioName = (portfolioId?: string) => {
    if (!portfolioId) return 'Non assigné';
    const portfolio = portfolios.find(p => p.id === portfolioId);
    return portfolio ? portfolio.name : 'Non assigné';
  };

  if (loading) {
    return (
      <Box>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Association Clients & Propriétés"
        subtitle="Associez vos clients et leurs propriétés aux portefeuilles"
        backPath="/portfolios"
        showBackButton={true}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Section Clients */}
      <Paper sx={{ width: '100%', mb: 3 }}>
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" gutterBottom>
            Clients
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Associez vos clients aux portefeuilles appropriés
          </Typography>
        </Box>
        
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nom</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Téléphone</TableCell>
                <TableCell>Portefeuille actuel</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>{client.name}</TableCell>
                  <TableCell>{client.email}</TableCell>
                  <TableCell>{client.phone || '-'}</TableCell>
                  <TableCell>
                    {editingClient === client.id ? (
                      <FormControl size="small" sx={{ minWidth: 200 }}>
                        <Select
                          value={client.portfolioId || ''}
                          onChange={(e) => handleClientPortfolioChange(client.id, e.target.value)}
                          displayEmpty
                        >
                          <MenuItem value="">
                            <em>Sélectionner un portefeuille</em>
                          </MenuItem>
                          {portfolios.map((portfolio) => (
                            <MenuItem key={portfolio.id} value={portfolio.id}>
                              {portfolio.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (
                      <Chip 
                        label={getPortfolioName(client.portfolioId)} 
                        color={client.portfolioId ? 'primary' : 'default'}
                        variant={client.portfolioId ? 'filled' : 'outlined'}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {editingClient === client.id ? (
                      <Box display="flex" gap={1}>
                        <IconButton size="small" color="primary">
                          <SaveIcon />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          onClick={() => setEditingClient(null)}
                        >
                          <CancelIcon />
                        </IconButton>
                      </Box>
                    ) : (
                      <IconButton 
                        size="small" 
                        onClick={() => setEditingClient(client.id)}
                      >
                        <EditIcon />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Section Propriétés */}
      <Paper sx={{ width: '100%', mb: 3 }}>
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" gutterBottom>
            Propriétés
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Associez les propriétés de vos clients aux portefeuilles appropriés
          </Typography>
        </Box>
        
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Adresse</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Portefeuille actuel</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {properties.map((property) => {
                const client = clients.find(c => c.id === property.clientId);
                return (
                  <TableRow key={property.id}>
                    <TableCell>{property.address}</TableCell>
                    <TableCell>{property.type}</TableCell>
                    <TableCell>
                      <Chip 
                        label={property.status} 
                        color={property.status === 'Actif' ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{client?.name || '-'}</TableCell>
                    <TableCell>
                      {editingProperty === property.id ? (
                        <FormControl size="small" sx={{ minWidth: 200 }}>
                          <Select
                            value={property.portfolioId || ''}
                            onChange={(e) => handlePropertyPortfolioChange(property.id, e.target.value)}
                            displayEmpty
                          >
                            <MenuItem value="">
                              <em>Sélectionner un portefeuille</em>
                            </MenuItem>
                            {portfolios.map((portfolio) => (
                              <MenuItem key={portfolio.id} value={portfolio.id}>
                                {portfolio.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <Chip 
                          label={getPortfolioName(property.portfolioId)} 
                          color={property.portfolioId ? 'primary' : 'default'}
                          variant={property.portfolioId ? 'filled' : 'outlined'}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {editingProperty === property.id ? (
                        <Box display="flex" gap={1}>
                          <IconButton size="small" color="primary">
                            <SaveIcon />
                          </IconButton>
                          <IconButton 
                            size="small" 
                            onClick={() => setEditingProperty(null)}
                          >
                            <CancelIcon />
                          </IconButton>
                        </Box>
                      ) : (
                        <IconButton 
                          size="small" 
                          onClick={() => setEditingProperty(property.id)}
                        >
                          <EditIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default ClientAssignmentPage;
