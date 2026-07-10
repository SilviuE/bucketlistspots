import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Container, Typography, TextField, Button, Paper, ToggleButtonGroup, ToggleButton,
  Alert, IconButton, InputAdornment,
} from '@mui/material';
import SEO from '../components/SEO';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import PersonIcon from '@mui/icons-material/Person';
import ExploreIcon from '@mui/icons-material/Explore';
import VerifiedIcon from '@mui/icons-material/Verified';
import CampaignIcon from '@mui/icons-material/Campaign';
import { useAuth } from '../context/AuthContext';

const roles = [
  { value: 'traveller', label: 'Traveller', icon: ExploreIcon, desc: 'Plan adventures, book guides, share your journey' },
  { value: 'guide', label: 'Guide', icon: VerifiedIcon, desc: 'Manage bookings, showcase your expertise' },
  { value: 'ambassador', label: 'Ambassador', icon: CampaignIcon, desc: 'Scout guides, earn commissions, grow your brand' },
];

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirectTo');
  const { register, login } = useAuth();
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('traveller');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'register') {
        if (!name || !email || !password) { setError('All fields required'); setSubmitting(false); return; }
        const result = await register({ name, email, password, role, avatar: '' });
        if (result.error) { setError(result.error); setSubmitting(false); return; }
        navigate(redirectTo || (role === 'admin' ? '/admin/applications' : role === 'guide' ? '/guide-dashboard' : role === 'ambassador' ? '/ambassador-dashboard' : '/dashboard'));
      } else {
        if (!email || !password) { setError('Email and password required'); setSubmitting(false); return; }
        const result = await login(email, password);
        if (result.error) { setError(result.error); setSubmitting(false); return; }
        const u = JSON.parse(localStorage.getItem('bls_user'));
        navigate(redirectTo || (u?.role === 'admin' ? '/admin/applications' : u?.role === 'guide' ? '/guide-dashboard' : u?.role === 'ambassador' ? '/ambassador-dashboard' : '/dashboard'));
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    }
    setSubmitting(false);
  };

  return (
    <Container maxWidth="sm" sx={{ px: 2, pt: 4, pb: 4 }}>
      <SEO title={mode === 'login' ? 'Sign In' : 'Create Account'} description="Sign in or create an account on BucketListSpots. Access your dashboard, saved guides, and bookings." path="/auth" />
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="h1" sx={{ fontSize: '28px' }}>
          {mode === 'login' ? 'Welcome Back' : 'Join BucketListSpots'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {mode === 'login' ? 'Sign in to your account' : 'Create your account and start your adventure'}
        </Typography>
      </Box>

      <Paper elevation={0} sx={{ p: 2.5, border: '1px solid rgba(16,42,67,0.12)', borderRadius: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

        {mode === 'register' && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" fontWeight={700} gutterBottom display="block">
              I am a...
            </Typography>
            <ToggleButtonGroup
              value={role} exclusive onChange={(_, val) => val && setRole(val)}
              fullWidth size="small"
              sx={{ '& .MuiToggleButton-root': { py: 1, flexDirection: 'column', gap: 0.3, fontSize: 11, lineHeight: 1.2 } }}
            >
              {roles.map(r => (
                <ToggleButton key={r.value} value={r.value}>
                  <r.icon sx={{ fontSize: 20 }} />
                  {r.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <TextField fullWidth label="Full Name" value={name} onChange={(e) => setName(e.target.value)}
              sx={{ mb: 2 }} InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon fontSize="small" /></InputAdornment> }} />
          )}
          <TextField fullWidth label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            sx={{ mb: 2 }} InputProps={{ startAdornment: <InputAdornment position="start"><EmailIcon fontSize="small" /></InputAdornment> }} />
          <TextField fullWidth label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            sx={{ mb: 3 }} InputProps={{ startAdornment: <InputAdornment position="start"><LockIcon fontSize="small" /></InputAdornment> }} />

          <Button variant="contained" color="primary" fullWidth size="large" type="submit" disabled={submitting}>
            {submitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>
        </Box>

        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <Box component="span" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
              sx={{ color: '#2A9D8F', fontWeight: 700, cursor: 'pointer' }}>
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </Box>
          </Typography>
        </Box>
      </Paper>

      {mode === 'register' && (
        <Paper elevation={0} sx={{ mt: 2, p: 2, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 3, bgcolor: '#f0faf8' }}>
          <Typography variant="caption" fontWeight={700} sx={{ color: '#2A9D8F' }}>Why create an account?</Typography>
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {['Build your personal bucket list and track progress', 'Book adventures with verified local guides', 'Share your journey with journals and galleries', 'Earn ambassador rewards by recommending guides'].map((t, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: '#2A9D8F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.2, color: '#FFF', fontSize: 10 }}>✓</Box>
                <Typography variant="caption" color="text.secondary">{t}</Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      )}

      <Button variant="text" fullWidth sx={{ mt: 2 }} onClick={() => navigate(-1)}>
        Continue Browsing
      </Button>
    </Container>
  );
}
