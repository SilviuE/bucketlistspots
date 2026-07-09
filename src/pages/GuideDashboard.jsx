import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Paper, Button, Chip, IconButton, Grid, TextField, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, CircularProgress,
} from '@mui/material';
import SEO from '../components/SEO';
import LogoutIcon from '@mui/icons-material/Logout';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PaymentsIcon from '@mui/icons-material/Payments';
import PeopleIcon from '@mui/icons-material/People';
import StarIcon from '@mui/icons-material/Star';
import RouteIcon from '@mui/icons-material/Route';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

const statusColors = { draft: '#9E9E9E', pending: '#E9C46A', published: '#2A9D8F', featured: '#FFB800' };
const difficulties = ['Easy', 'Moderate', 'Challenging', 'Very Challenging'];

export default function GuideDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  const [routeDialog, setRouteDialog] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);
  const [routeForm, setRouteForm] = useState({ name: '', days: 1, difficulty: 'Moderate', price: '', description: '', image: '' });
  const [saving, setSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({ trading_name: '', bio: '', location: '', price: '', languages: '', experience: '', photo: '' });
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'guide') return;
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Not authenticated');
      const res = await fetch('/api/guide-profile', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to load profile');
      const data = await res.json();
      setGuide(data);
      if (data) {
        setProfileForm({
          trading_name: data.trading_name || '',
          bio: data.bio || '',
          location: data.location || '',
          price: data.price || '',
          languages: Array.isArray(data.languages) ? data.languages.join(', ') : data.languages || '',
          experience: data.experience || '',
          photo: data.photo || '',
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Not authenticated');
      const res = await fetch('/api/guide-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          trading_name: profileForm.trading_name,
          bio: profileForm.bio,
          location: profileForm.location,
          price: parseInt(profileForm.price) || 0,
          languages: profileForm.languages.split(',').map(s => s.trim()).filter(Boolean),
          experience: parseInt(profileForm.experience) || 0,
          photo: profileForm.photo,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Save failed');
      }
      const data = await res.json();
      setGuide(data);
      setProfileOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = async () => {
    setSaving(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Not authenticated');
      const res = await fetch('/api/guide-profile/submit', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Submit failed');
      }
      const data = await res.json();
      setGuide(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveRoute = async () => {
    if (!routeForm.name || !routeForm.price) return;
    setSaving(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Not authenticated');
      const body = {
        name: routeForm.name,
        days: parseInt(routeForm.days) || 1,
        difficulty: routeForm.difficulty,
        price: parseInt(routeForm.price) || 0,
        description: routeForm.description,
        image: routeForm.image,
      };

      const url = editingRoute
        ? `/api/guide-profile/routes/${editingRoute.id}`
        : '/api/guide-profile/routes';
      const method = editingRoute ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Save failed');
      }
      const data = await res.json();
      setGuide(data);
      setRouteDialog(false);
      setEditingRoute(null);
      setRouteForm({ name: '', days: 1, difficulty: 'Moderate', price: '', description: '', image: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteRoute = async (routeId) => {
    if (!confirm('Delete this route?')) return;
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(`/api/guide-profile/routes/${routeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Delete failed');
      }
      const data = await res.json();
      setGuide(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = () => { logout(); navigate('/'); };

  if (!user || user.role !== 'guide') {
    return (
      <Container maxWidth="sm" sx={{ px: 2, pt: 8, textAlign: 'center' }}>
        <Typography variant="h2" mb={1}>Guide Access Required</Typography>
        <Button variant="contained" onClick={() => navigate('/auth')}>Sign In</Button>
      </Container>
    );
  }

  if (loading) {
    return <Container maxWidth="sm" sx={{ px: 2, pt: 8, textAlign: 'center' }}><CircularProgress /></Container>;
  }

  const routes = guide?.routes || [];
  const profileComplete = guide?.trading_name && guide?.bio && guide?.location && guide?.price && routes.length > 0;
  const progressItems = [
    { done: !!guide?.trading_name, label: 'Set your trading name' },
    { done: !!guide?.bio, label: 'Write your bio' },
    { done: !!guide?.location, label: 'Add your location' },
    { done: !!guide?.price, label: 'Set your starting price' },
    { done: routes.length > 0, label: 'Add at least one route' },
  ];
  const progress = Math.round(progressItems.filter(p => p.done).length / progressItems.length * 100);

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'routes', label: `Routes (${routes.length})` },
    { key: 'profile', label: 'Profile' },
  ];

  return (
    <Container maxWidth="sm" sx={{ px: 2, pt: 2, pb: 4 }}>
      <SEO title="Guide Dashboard" description="Manage your guide profile, routes, and availability on BucketListSpots." path="/guide-dashboard" />
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h1" sx={{ fontSize: '20px' }}>{guide?.trading_name || user?.name || 'Guide Dashboard'}</Typography>
          {guide?.status && <Chip label={guide.status} size="small" sx={{ color: '#FFF', bgcolor: statusColors[guide.status] || '#999', fontSize: 10, mt: 0.3 }} />}
        </Box>
        <IconButton onClick={handleLogout}><LogoutIcon /></IconButton>
      </Box>

      {!profileComplete && (
        <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid rgba(16,42,67,0.12)', borderRadius: 3 }}>
          <Typography variant="body2" fontWeight={700} mb={1}>Complete Your Profile</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Box sx={{ flex: 1, height: 8, bgcolor: '#E0E0E0', borderRadius: 4, overflow: 'hidden' }}>
              <Box sx={{ width: `${progress}%`, height: '100%', bgcolor: '#2A9D8F', borderRadius: 4, transition: 'width 0.3s' }} />
            </Box>
            <Typography variant="caption" fontWeight={700}>{progress}%</Typography>
          </Box>
          {progressItems.filter(p => !p.done).slice(0, 2).map(p => (
            <Typography key={p.label} variant="caption" color="text.secondary" display="block">• {p.label}</Typography>
          ))}
          <Button size="small" variant="contained" color="primary" sx={{ mt: 1, fontSize: 12 }} onClick={() => setProfileOpen(true)}>Complete Now</Button>
        </Paper>
      )}

      <Box sx={{ display: 'flex', gap: 0.5, mb: 2 }}>
        {tabs.map(t => (
          <Chip key={t.key} label={t.label} onClick={() => setTab(t.key)}
            color={tab === t.key ? 'secondary' : 'default'}
            variant={tab === t.key ? 'filled' : 'outlined'} size="small" />
        ))}
      </Box>

      {tab === 'overview' && (
        <>
          <Typography variant="h2" mb={1.5}>Your Routes</Typography>
          {routes.length === 0 ? (
            <Paper elevation={0} sx={{ p: 3, textAlign: 'center', border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2, mb: 2 }}>
              <RouteIcon sx={{ fontSize: 48, color: 'rgba(16,42,67,0.15)', mb: 1 }} />
              <Typography variant="body2" color="text.secondary" mb={1}>No routes yet. Add your first one!</Typography>
              <Button variant="contained" color="primary" size="small" onClick={() => { setEditingRoute(null); setRouteForm({ name: '', days: 1, difficulty: 'Moderate', price: '', description: '', image: '' }); setRouteDialog(true); }}>Add Route</Button>
            </Paper>
          ) : (
            routes.map(r => (
              <Paper key={r.id} elevation={0} sx={{ p: 1.5, mb: 1, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={700}>{r.name}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block">{r.days} day(s) · {r.difficulty} · ${r.price}/person</Typography>
                    {r.description && <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.3 }}>{r.description}</Typography>}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.3 }}>
                    <IconButton size="small" onClick={() => { setEditingRoute(r); setRouteForm({ name: r.name, days: r.days, difficulty: r.difficulty, price: String(r.price), description: r.description || '', image: r.image || '' }); setRouteDialog(true); }}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                    <IconButton size="small" onClick={() => deleteRoute(r.id)}><DeleteIcon sx={{ fontSize: 16, color: '#E05D3A' }} /></IconButton>
                  </Box>
                </Box>
              </Paper>
            ))
          )}

          <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => { setEditingRoute(null); setRouteForm({ name: '', days: 1, difficulty: 'Moderate', price: '', description: '', image: '' }); setRouteDialog(true); }} sx={{ mb: 3 }}>
            Add Route
          </Button>

          <Paper elevation={0} sx={{ p: 2, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2, bgcolor: '#f0faf8' }}>
            <Typography variant="body2" fontWeight={700} sx={{ color: '#2A9D8F' }} mb={0.5}>Getting Published</Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              1. Complete your profile (bio, photo, pricing)
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              2. Add your routes with descriptions
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              3. Submit for review — an admin will publish you live
            </Typography>
          </Paper>

          {guide?.status === 'draft' && profileComplete && (
            <Button variant="contained" color="primary" size="large" fullWidth onClick={submitForReview} disabled={saving} sx={{ mt: 2 }}>
              {saving ? <CircularProgress size={24} sx={{ color: '#FFF' }} /> : 'Submit for Review'}
            </Button>
          )}
          {guide?.status === 'pending' && (
            <Paper elevation={0} sx={{ p: 2, mt: 2, border: '1px solid #E9C46A', borderRadius: 2, bgcolor: '#FFF8E1', textAlign: 'center' }}>
              <Typography variant="body2" fontWeight={700} sx={{ color: '#E9C46A' }}>Submitted for Review</Typography>
              <Typography variant="caption" color="text.secondary">An admin will review your profile shortly. You'll receive an email when you're live.</Typography>
            </Paper>
          )}
        </>
      )}

      {tab === 'routes' && (
        <>
          {routes.length === 0 ? (
            <Paper elevation={0} sx={{ p: 3, textAlign: 'center', border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
              <Typography variant="body2" color="text.secondary" mb={2}>No routes yet</Typography>
            </Paper>
          ) : (
            routes.map(r => (
              <Paper key={r.id} elevation={0} sx={{ p: 1.5, mb: 1, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={700}>{r.name}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block">{r.days} day(s) · {r.difficulty} · ${r.price}/person</Typography>
                    {r.description && <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.3 }}>{r.description}</Typography>}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.3 }}>
                    <IconButton size="small" onClick={() => { setEditingRoute(r); setRouteForm({ name: r.name, days: r.days, difficulty: r.difficulty, price: String(r.price), description: r.description || '', image: r.image || '' }); setRouteDialog(true); }}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                    <IconButton size="small" onClick={() => deleteRoute(r.id)}><DeleteIcon sx={{ fontSize: 16, color: '#E05D3A' }} /></IconButton>
                  </Box>
                </Box>
              </Paper>
            ))
          )}
          <Button variant="contained" color="primary" size="small" startIcon={<AddIcon />} onClick={() => { setEditingRoute(null); setRouteForm({ name: '', days: 1, difficulty: 'Moderate', price: '', description: '', image: '' }); setRouteDialog(true); }}>
            Add Route
          </Button>
        </>
      )}

      {tab === 'profile' && (
        <>
          <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" fontWeight={700}>Public Profile</Typography>
              <Button size="small" variant="text" onClick={() => setProfileOpen(true)}>Edit</Button>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 13 }}>
              <Typography variant="caption" color="text.secondary">Name:</Typography>
              <Typography variant="caption">{guide?.trading_name || '—'}</Typography>
              <Typography variant="caption" color="text.secondary">Location:</Typography>
              <Typography variant="caption">{guide?.location || '—'}</Typography>
              <Typography variant="caption" color="text.secondary">Price:</Typography>
              <Typography variant="caption">{guide?.price ? `$${guide.price}/person` : '—'}</Typography>
              <Typography variant="caption" color="text.secondary">Languages:</Typography>
              <Typography variant="caption">{Array.isArray(guide?.languages) ? guide.languages.join(', ') : guide?.languages || '—'}</Typography>
              <Typography variant="caption" color="text.secondary">Experience:</Typography>
              <Typography variant="caption">{guide?.experience ? `${guide.experience} years` : '—'}</Typography>
            </Box>
            {guide?.bio && (
              <>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, fontWeight: 700 }}>Bio</Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ whiteSpace: 'pre-wrap' }}>{guide.bio}</Typography>
              </>
            )}
          </Paper>

          {guide?.id && (
            <Paper elevation={0} sx={{ p: 2, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
              <Typography variant="body2" fontWeight={700} mb={1}>Preview Your Profile</Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                Travelers will see your profile at:
              </Typography>
              <Typography variant="body2" sx={{ color: '#2A9D8F' }}>
                bucketlistspots.com/guide/{guide.id}
              </Typography>
              <Button size="small" variant="outlined" sx={{ mt: 1, fontSize: 12 }} onClick={() => window.open(`/guide/${guide.id}`, '_blank')}>
                Open Preview
              </Button>
            </Paper>
          )}
        </>
      )}

      {/* Profile Edit Dialog */}
      <Dialog open={profileOpen} onClose={() => setProfileOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Profile</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Trading Name" value={profileForm.trading_name} onChange={e => setProfileForm({ ...profileForm, trading_name: e.target.value })} sx={{ mb: 2, mt: 1 }} />
          <TextField fullWidth label="Photo URL" value={profileForm.photo} onChange={e => setProfileForm({ ...profileForm, photo: e.target.value })} sx={{ mb: 2 }} placeholder="https://..." helperText="Link to your profile photo" />
          <TextField fullWidth label="Location" value={profileForm.location} onChange={e => setProfileForm({ ...profileForm, location: e.target.value })} sx={{ mb: 2 }} placeholder="e.g. Moshi, Tanzania" />
          <TextField fullWidth label="Starting Price ($)" type="number" value={profileForm.price} onChange={e => setProfileForm({ ...profileForm, price: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth label="Languages (comma-separated)" value={profileForm.languages} onChange={e => setProfileForm({ ...profileForm, languages: e.target.value })} sx={{ mb: 2 }} placeholder="English, Swahili" />
          <TextField fullWidth label="Years of Experience" type="number" value={profileForm.experience} onChange={e => setProfileForm({ ...profileForm, experience: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth label="Bio" multiline rows={4} value={profileForm.bio} onChange={e => setProfileForm({ ...profileForm, bio: e.target.value })} placeholder="Tell travelers about yourself..." inputProps={{ maxLength: 600 }} helperText={`${profileForm.bio.length}/600`} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setProfileOpen(false)}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={saveProfile} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Route Edit Dialog */}
      <Dialog open={routeDialog} onClose={() => setRouteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingRoute ? 'Edit Route' : 'Add Route'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Route Name" value={routeForm.name} onChange={e => setRouteForm({ ...routeForm, name: e.target.value })} required sx={{ mb: 2, mt: 1 }} placeholder="e.g. Machame Route" />
          <TextField fullWidth label="Days" type="number" value={routeForm.days} onChange={e => setRouteForm({ ...routeForm, days: e.target.value })} sx={{ mb: 2 }} />
          <TextField select fullWidth label="Difficulty" value={routeForm.difficulty} onChange={e => setRouteForm({ ...routeForm, difficulty: e.target.value })} sx={{ mb: 2 }}>
            {difficulties.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
          </TextField>
          <TextField fullWidth label="Price per Person ($)" type="number" value={routeForm.price} onChange={e => setRouteForm({ ...routeForm, price: e.target.value })} required sx={{ mb: 2 }} />
          <TextField fullWidth label="Description" multiline rows={2} value={routeForm.description} onChange={e => setRouteForm({ ...routeForm, description: e.target.value })} sx={{ mb: 2 }} placeholder="Brief description of the route..." />
          <TextField fullWidth label="Image URL (optional)" value={routeForm.image} onChange={e => setRouteForm({ ...routeForm, image: e.target.value })} placeholder="https://..." />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRouteDialog(false)}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={saveRoute} disabled={saving || !routeForm.name || !routeForm.price}>
            {saving ? <CircularProgress size={20} /> : editingRoute ? 'Update' : 'Add Route'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
