import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Paper, Button, Chip, CircularProgress, Alert, Tabs, Tab } from '@mui/material';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

const statusColors = { pending: '#E9C46A', approved: '#2A9D8F', rejected: '#E05D3A' };

export default function AdminApplications() {
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('pending');

  useEffect(() => {
    if (!isLoggedIn || user?.role !== 'admin') return;
    fetchApplications();
  }, [isLoggedIn, user]);

  const fetchApplications = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch('/api/applications', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load');
      setApplications(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch('/api/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Update failed');
      setApplications(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    } catch (err) {
      setError(err.message);
    }
  };

  if (!isLoggedIn || user?.role !== 'admin') {
    return (
      <Container maxWidth="sm" sx={{ px: 2, pt: 8, textAlign: 'center' }}>
        <Typography variant="h2" mb={1}>Access Denied</Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>Admin access required.</Typography>
        <Button variant="contained" onClick={() => navigate('/auth')}>Sign In</Button>
      </Container>
    );
  }

  const filtered = applications.filter(a => tab === 'all' || a.status === tab);

  return (
    <Container maxWidth="sm" sx={{ px: 2, pt: 2, pb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h1">Applications</Typography>
        <Button size="small" onClick={fetchApplications} disabled={loading}>Refresh</Button>
      </Box>
      <Typography variant="body2" color="text.secondary" mb={2}>
        {applications.filter(a => a.status === 'pending').length} pending review
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, '& .MuiTab-root': { fontSize: 13, textTransform: 'none', minWidth: 'auto', px: 2 } }}>
        {['pending', 'approved', 'rejected', 'all'].map(t => (
          <Tab key={t} label={t.charAt(0).toUpperCase() + t.slice(1)} value={t} />
        ))}
      </Tabs>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No applications yet.</Typography>
      ) : (
        filtered.map(app => (
          <Paper key={app.id} elevation={0} sx={{ p: 2, mb: 2, border: '1px solid rgba(16,42,67,0.12)', borderRadius: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Box>
                <Typography variant="body2" fontWeight={700}>{app.full_name}</Typography>
                <Typography variant="caption" color="text.secondary">{app.email} · {app.phone}</Typography>
              </Box>
              <Chip label={app.status} size="small" sx={{ color: '#FFF', bgcolor: statusColors[app.status] || '#999', fontSize: 11, fontWeight: 600 }} />
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
              <Chip label={app.country} size="small" variant="outlined" sx={{ fontSize: 11 }} />
              <Chip label={`${app.experience} yr`} size="small" variant="outlined" sx={{ fontSize: 11 }} />
              {app.languages && <Chip label={app.languages} size="small" variant="outlined" sx={{ fontSize: 11 }} />}
            </Box>
            {app.specialties && <Typography variant="caption" color="text.secondary" display="block" mb={0.5}><strong>Specialties:</strong> {app.specialties}</Typography>}
            {app.message && <Typography variant="caption" color="text.secondary" display="block" mb={1}>{app.message}</Typography>}
            <Typography variant="caption" color="text.disabled" display="block" mb={1}>Received: {new Date(app.created_at).toLocaleDateString()} · Heard via: {app.heard_from || '—'}</Typography>
            {app.status === 'pending' && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" variant="contained" sx={{ bgcolor: '#2A9D8F', '&:hover': { bgcolor: '#238277' }, fontSize: 12 }} onClick={() => updateStatus(app.id, 'approved')}>Approve</Button>
                <Button size="small" variant="outlined" color="error" sx={{ fontSize: 12 }} onClick={() => updateStatus(app.id, 'rejected')}>Reject</Button>
              </Box>
            )}
          </Paper>
        ))
      )}
    </Container>
  );
}
