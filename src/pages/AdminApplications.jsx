import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Paper, Button, Chip, CircularProgress, Alert, Tabs, Tab } from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import CampaignIcon from '@mui/icons-material/Campaign';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

const statusColors = { pending: '#E9C46A', approved: '#2A9D8F', rejected: '#E05D3A' };

const typeMeta = {
  guide: { icon: GroupsIcon, label: 'Guide', color: '#2A9D8F' },
  ambassador: { icon: CampaignIcon, label: 'Ambassador', color: '#E9C46A' },
};

export default function AdminApplications() {
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeTab, setTypeTab] = useState('all');
  const [statusTab, setStatusTab] = useState('pending');

  useEffect(() => {
    if (!isLoggedIn || user?.role !== 'admin') return;
    fetchApplications();
  }, [isLoggedIn, user, typeTab]);

  const fetchApplications = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(`/api/applications?type=${typeTab}`, {
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

  const updateStatus = async (app) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch('/api/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ id: app.id, status: app.status, type: app._type }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Update failed');
      setApplications(prev => prev.map(a => a.id === app.id && a._type === app._type ? { ...a, status: app.status } : a));
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

  const pendingCount = applications.filter(a => a.status === 'pending').length;
  const filtered = applications.filter(a => statusTab === 'all' || a.status === statusTab);

  return (
    <Container maxWidth="sm" sx={{ px: 2, pt: 2, pb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h1">Applications</Typography>
        <Button size="small" onClick={fetchApplications} disabled={loading}>Refresh</Button>
      </Box>
      <Typography variant="body2" color="text.secondary" mb={2}>
        {pendingCount} pending review
      </Typography>

      <Tabs value={typeTab} onChange={(_, v) => { setTypeTab(v); setStatusTab('pending'); }} sx={{ mb: 1, '& .MuiTab-root': { fontSize: 13, textTransform: 'none', minWidth: 'auto', px: 2 } }}>
        {['all', 'guide', 'ambassador'].map(t => {
          const meta = typeMeta[t];
          return <Tab key={t} value={t} label={t === 'all' ? 'All' : meta.label} icon={meta?.icon ? <meta.icon sx={{ fontSize: 16 }} /> : undefined} iconPosition="start" />;
        })}
      </Tabs>

      <Tabs value={statusTab} onChange={(_, v) => setStatusTab(v)} sx={{ mb: 2, '& .MuiTab-root': { fontSize: 13, textTransform: 'none', minWidth: 'auto', px: 2 } }}>
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
        filtered.map(app => {
          const meta = typeMeta[app._type] || typeMeta.guide;
          return (
            <Paper key={`${app._type}_${app.id}`} elevation={0} sx={{ p: 2, mb: 2, border: '1px solid rgba(16,42,67,0.12)', borderRadius: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3 }}>
                    <meta.icon sx={{ fontSize: 14, color: meta.color }} />
                    <Typography variant="caption" sx={{ color: meta.color, fontWeight: 600 }}>{meta.label}</Typography>
                  </Box>
                  <Typography variant="body2" fontWeight={700}>{app.full_name}</Typography>
                  <Typography variant="caption" color="text.secondary">{app.email} · {app.phone || '—'}</Typography>
                </Box>
                <Chip label={app.status} size="small" sx={{ color: '#FFF', bgcolor: statusColors[app.status] || '#999', fontSize: 11, fontWeight: 600 }} />
              </Box>

              {app._type === 'guide' ? (
                <>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                    <Chip label={app.country} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                    {app.experience != null && <Chip label={`${app.experience} yr`} size="small" variant="outlined" sx={{ fontSize: 11 }} />}
                    {app.languages && <Chip label={app.languages} size="small" variant="outlined" sx={{ fontSize: 11 }} />}
                  </Box>
                  {app.specialties && <Typography variant="caption" color="text.secondary" display="block" mb={0.5}><strong>Specialties:</strong> {app.specialties}</Typography>}
                  {app.message && <Typography variant="caption" color="text.secondary" display="block" mb={1}>{app.message}</Typography>}
                </>
              ) : (
                <>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                    <Chip label={app.country} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                    <Chip label={app.platform} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                    {app.followers != null && <Chip label={`${app.followers} followers`} size="small" variant="outlined" sx={{ fontSize: 11 }} />}
                    {app.niche && <Chip label={app.niche} size="small" variant="outlined" sx={{ fontSize: 11 }} />}
                  </Box>
                  {app.handle && <Typography variant="caption" color="text.secondary" display="block" mb={0.5}><strong>Handle:</strong> {app.handle}</Typography>}
                  {app.why_you && <Typography variant="caption" color="text.secondary" display="block" mb={1}>{app.why_you}</Typography>}
                </>
              )}

              <Typography variant="caption" color="text.disabled" display="block" mb={1}>Received: {new Date(app.created_at).toLocaleDateString()} · Heard via: {app.heard_from || '—'}</Typography>

              {app.status === 'pending' && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" variant="contained" sx={{ bgcolor: '#2A9D8F', '&:hover': { bgcolor: '#238277' }, fontSize: 12 }} onClick={() => updateStatus({ ...app, status: 'approved' })}>Approve</Button>
                  <Button size="small" variant="outlined" color="error" sx={{ fontSize: 12 }} onClick={() => updateStatus({ ...app, status: 'rejected' })}>Reject</Button>
                </Box>
              )}
            </Paper>
          );
        })
      )}
    </Container>
  );
}
