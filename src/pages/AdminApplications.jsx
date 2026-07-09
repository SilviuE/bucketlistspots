import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Paper, Button, Chip, CircularProgress, Alert, Tabs, Tab } from '@mui/material';
import SEO from '../components/SEO';
import GroupsIcon from '@mui/icons-material/Groups';
import CampaignIcon from '@mui/icons-material/Campaign';
import RouteIcon from '@mui/icons-material/Route';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

const statusColors = { pending: '#E9C46A', approved: '#2A9D8F', rejected: '#E05D3A', published: '#2A9D8F', draft: '#9E9E9E' };

const typeMeta = {
  guide: { icon: GroupsIcon, label: 'Guide Apps', color: '#2A9D8F' },
  ambassador: { icon: CampaignIcon, label: 'Ambassador Apps', color: '#E9C46A' },
  'pending-guide': { icon: RouteIcon, label: 'Pending Guides', color: '#E9C46A' },
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
      const data = await res.json();
      if (app._type === 'pending-guide') {
        setApplications(prev => prev.filter(a => !(a.id === app.id && a._type === 'pending-guide')));
      } else {
        setApplications(prev => prev.map(a => a.id === app.id && a._type === app._type ? { ...a, status: app.status } : a));
      }
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

  const isPendingGuides = typeTab === 'pending-guide';
  const pendingCount = applications.filter(a => a.status === 'pending' || a.status === 'draft').length;
  const filtered = applications.filter(a => statusTab === 'all' || a.status === statusTab);

  return (
    <Container maxWidth="sm" sx={{ px: 2, pt: 2, pb: 4 }}>
      <SEO title="Admin Dashboard" description="Review and manage guide applications, ambassador applications, and pending guide profiles." path="/admin/applications" />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h1">Applications</Typography>
        <Button size="small" onClick={fetchApplications} disabled={loading}>Refresh</Button>
      </Box>
      <Typography variant="body2" color="text.secondary" mb={2}>
        {pendingCount} pending review
      </Typography>

      <Tabs value={typeTab} onChange={(_, v) => { setTypeTab(v); setStatusTab('pending'); }} sx={{ mb: 1, '& .MuiTab-root': { fontSize: 12, textTransform: 'none', minWidth: 'auto', px: 1.5 } }}>
        {['all', 'guide', 'ambassador', 'pending-guide'].map(t => {
          const meta = typeMeta[t];
          if (t === 'all') return <Tab key={t} value={t} label="All" />;
          return <Tab key={t} value={t} label={meta.label} icon={<meta.icon sx={{ fontSize: 16 }} />} iconPosition="start" />;
        })}
      </Tabs>

      <Tabs value={statusTab} onChange={(_, v) => setStatusTab(v)} sx={{ mb: 2, '& .MuiTab-root': { fontSize: 13, textTransform: 'none', minWidth: 'auto', px: 2 } }}>
        {isPendingGuides
          ? ['pending', 'published', 'all'].map(t => (
              <Tab key={t} label={t.charAt(0).toUpperCase() + t.slice(1)} value={t} />
            ))
          : ['pending', 'approved', 'rejected', 'all'].map(t => (
              <Tab key={t} label={t.charAt(0).toUpperCase() + t.slice(1)} value={t} />
            ))
        }
      </Tabs>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No applications yet.</Typography>
      ) : (
        filtered.map(app => {
          const meta = typeMeta[app._type] || typeMeta.guide;
          const isGuideProfile = app._type === 'pending-guide';

          return (
            <Paper key={`${app._type}_${app.id}`} elevation={0} sx={{ p: 2, mb: 2, border: '1px solid rgba(16,42,67,0.12)', borderRadius: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3 }}>
                    <meta.icon sx={{ fontSize: 14, color: meta.color }} />
                    <Typography variant="caption" sx={{ color: meta.color, fontWeight: 600 }}>{meta.label}</Typography>
                  </Box>
                  {isGuideProfile ? (
                    <>
                      <Typography variant="body2" fontWeight={700}>{app.trading_name || 'Unnamed Guide'}</Typography>
                      <Typography variant="caption" color="text.secondary">{app.location || '—'} · {app.routes?.length || 0} route(s)</Typography>
                    </>
                  ) : (
                    <>
                      <Typography variant="body2" fontWeight={700}>{app.full_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{app.email} · {app.phone || '—'}</Typography>
                    </>
                  )}
                </Box>
                <Chip label={app.status} size="small" sx={{ color: '#FFF', bgcolor: statusColors[app.status] || '#999', fontSize: 11, fontWeight: 600 }} />
              </Box>

              {isGuideProfile ? (
                <>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                    {app.experience && <Chip label={`${app.experience} yr`} size="small" variant="outlined" sx={{ fontSize: 11 }} />}
                    {app.price && <Chip label={`$${app.price}/person`} size="small" variant="outlined" sx={{ fontSize: 11 }} />}
                    {Array.isArray(app.languages) && app.languages.map(l => <Chip key={l} label={l} size="small" variant="outlined" sx={{ fontSize: 11 }} />)}
                  </Box>
                  {app.bio && <Typography variant="caption" color="text.secondary" display="block" mb={1} sx={{ maxHeight: 60, overflow: 'hidden' }}>{app.bio}</Typography>}
                  {app.routes?.length > 0 && (
                    <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                      <strong>Routes:</strong> {app.routes.map(r => r.name).join(', ')}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <Button size="small" variant="contained" sx={{ bgcolor: '#2A9D8F', '&:hover': { bgcolor: '#238277' }, fontSize: 12 }}
                      onClick={() => updateStatus({ ...app, status: 'published' })} disabled={app.status === 'published'}>
                      Publish Profile
                    </Button>
                    <Button size="small" variant="outlined" color="error" sx={{ fontSize: 12 }}
                      onClick={() => updateStatus({ ...app, status: 'draft' })} disabled={app.status === 'draft'}>
                      Reject
                    </Button>
                    {app.id && (
                      <Button size="small" variant="text" sx={{ fontSize: 12 }} startIcon={<VisibilityIcon />}
                        onClick={() => window.open(`/guide/${app.id}`, '_blank')}>
                        Preview
                      </Button>
                    )}
                  </Box>
                </>
              ) : app._type === 'guide' ? (
                <>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                    <Chip label={app.country} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                    {app.experience != null && <Chip label={`${app.experience} yr`} size="small" variant="outlined" sx={{ fontSize: 11 }} />}
                    {app.languages && <Chip label={app.languages} size="small" variant="outlined" sx={{ fontSize: 11 }} />}
                  </Box>
                  {app.specialties && <Typography variant="caption" color="text.secondary" display="block" mb={0.5}><strong>Specialties:</strong> {app.specialties}</Typography>}
                  {app.message && <Typography variant="caption" color="text.secondary" display="block" mb={1}>{app.message}</Typography>}
                  <Typography variant="caption" color="text.disabled" display="block" mb={1}>Received: {new Date(app.created_at).toLocaleDateString()} · Heard via: {app.heard_from || '—'}</Typography>
                  {app.status === 'pending' && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button size="small" variant="contained" sx={{ bgcolor: '#2A9D8F', '&:hover': { bgcolor: '#238277' }, fontSize: 12 }} onClick={() => updateStatus({ ...app, status: 'approved' })}>Approve</Button>
                      <Button size="small" variant="outlined" color="error" sx={{ fontSize: 12 }} onClick={() => updateStatus({ ...app, status: 'rejected' })}>Reject</Button>
                    </Box>
                  )}
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
                  <Typography variant="caption" color="text.disabled" display="block" mb={1}>Received: {new Date(app.created_at).toLocaleDateString()} · Heard via: {app.heard_from || '—'}</Typography>
                  {app.status === 'pending' && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button size="small" variant="contained" sx={{ bgcolor: '#2A9D8F', '&:hover': { bgcolor: '#238277' }, fontSize: 12 }} onClick={() => updateStatus({ ...app, status: 'approved' })}>Approve</Button>
                      <Button size="small" variant="outlined" color="error" sx={{ fontSize: 12 }} onClick={() => updateStatus({ ...app, status: 'rejected' })}>Reject</Button>
                    </Box>
                  )}
                </>
              )}
            </Paper>
          );
        })
      )}
    </Container>
  );
}
