import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Box, Container, Typography, TextField, Button, Paper, Alert, CircularProgress, MenuItem, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InstagramIcon from '@mui/icons-material/Instagram';
import YouTubeIcon from '@mui/icons-material/YouTube';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import WebIcon from '@mui/icons-material/Web';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PaymentsIcon from '@mui/icons-material/Payments';
import CampaignIcon from '@mui/icons-material/Campaign';

const benefits = [
  { icon: CampaignIcon, title: 'Earn Commissions', desc: 'Get paid for every guide you refer who gets booked.' },
  { icon: TrendingUpIcon, title: 'Grow Your Brand', desc: 'Featured on our site with your social links and bio.' },
  { icon: WebIcon, title: 'Early Access', desc: 'Be first to know about new destinations and experiences.' },
  { icon: PaymentsIcon, title: 'Free Perks', desc: 'Complimentary experiences and exclusive ambassador trips.' },
];

const platforms = ['Instagram', 'TikTok', 'YouTube', 'Blog', 'Facebook', 'Twitter/X', 'Other'];
const niches = ['Travel', 'Hiking & Trekking', 'Adventure Sports', 'Photography', 'Food & Culture', 'Lifestyle', 'Other'];

export default function BecomeAmbassador() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', country: '',
    platform: '', handle: '', followers: '', niche: '',
    whyYou: '', heardFrom: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/apply-ambassador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      setDone(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <Container maxWidth="sm" sx={{ px: 2, pt: 8, textAlign: 'center' }}>
        <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: '#2A9D8F', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
          <CheckCircleIcon sx={{ color: '#FFF', fontSize: 36 }} />
        </Box>
        <Typography variant="h2" sx={{ color: '#2A9D8F', mb: 1 }}>You're In!</Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Welcome to the BucketListSpots Ambassador Program. We'll reach out within 48 hours with next steps.
        </Typography>
        <Button variant="contained" color="primary" onClick={() => navigate('/')}>
          Back to Home
        </Button>
      </Container>
    );
  }

  return (
    <Box sx={{ bgcolor: '#102A43', minHeight: '100vh', pb: 4 }}>
      <Container maxWidth="sm" sx={{ px: 2, pt: 4 }}>
        <Typography variant="h1" sx={{ color: '#FFFFFF', mb: 1, fontSize: { xs: '26px', sm: '32px' } }}>
          Become an Ambassador
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 16, mb: 3 }}>
          Love travel? Share your adventures, refer guides, and earn commissions.
        </Typography>

        <Paper elevation={0} sx={{ p: 2, borderRadius: 3, mb: 3, bgcolor: 'rgba(255,255,255,0.95)' }}>
          <List disablePadding>
            {benefits.map((b, idx) => (
              <ListItem key={b.title} disableGutters sx={{ borderBottom: idx < benefits.length - 1 ? '1px solid rgba(16,42,67,0.06)' : 'none', py: 1 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <b.icon sx={{ color: '#2A9D8F', fontSize: 24 }} />
                </ListItemIcon>
                <ListItemText
                  primary={<Typography variant="body2" fontWeight={700}>{b.title}</Typography>}
                  secondary={<Typography variant="caption" color="text.secondary">{b.desc}</Typography>}
                />
              </ListItem>
            ))}
          </List>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, borderRadius: 3, mb: 3, bgcolor: 'rgba(255,255,255,0.95)' }}>
          <Typography variant="body2" fontWeight={700} mb={1}>How It Works</Typography>
          {[
            'Sign up with your social media or blog details.',
            'Share your unique referral link with your audience.',
            'Earn commission when a guide you referred gets booked.',
            'Grow with us — top ambassadors unlock free trips.',
          ].map((step, idx) => (
            <Box key={idx} sx={{ display: 'flex', gap: 1.5, py: 0.8, alignItems: 'flex-start' }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: '#2A9D8F', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700 }}>
                {idx + 1}
              </Box>
              <Typography variant="body2" color="text.secondary">{step}</Typography>
            </Box>
          ))}
        </Paper>

        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

        <Paper component="form" onSubmit={handleSubmit} elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.95)' }}>
          <Typography variant="body2" fontWeight={700} mb={2}>Apply Now</Typography>
          <TextField fullWidth label="Full Name" value={form.fullName} onChange={handleChange('fullName')} required sx={{ mb: 2 }} />
          <TextField fullWidth label="Email Address" type="email" value={form.email} onChange={handleChange('email')} required sx={{ mb: 2 }} />
          <TextField fullWidth label="Phone (WhatsApp)" value={form.phone} onChange={handleChange('phone')} required sx={{ mb: 2 }} placeholder="+44..." />
          <TextField select fullWidth label="Country" value={form.country} onChange={handleChange('country')} required sx={{ mb: 2 }}>
            {['Tanzania', 'Kenya', 'Nepal', 'Peru', 'Romania', 'Norway', 'Ecuador', 'Bolivia', 'India', 'Morocco', 'Indonesia', 'UK', 'USA', 'Spain', 'Mexico', 'Colombia', 'Argentina', 'Chile', 'Other'].map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <TextField select fullWidth label="Main Platform" value={form.platform} onChange={handleChange('platform')} required sx={{ mb: 2 }}>
            {platforms.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
          </TextField>
          <TextField fullWidth label="Your Handle / Channel / Blog URL" value={form.handle} onChange={handleChange('handle')} required sx={{ mb: 2 }} placeholder="@yourhandle or youtube.com/..." />
          <TextField fullWidth label="Followers / Subscribers" type="number" value={form.followers} onChange={handleChange('followers')} required sx={{ mb: 2 }} />
          <TextField select fullWidth label="Your Niche" value={form.niche} onChange={handleChange('niche')} required sx={{ mb: 2 }}>
            {niches.map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
          </TextField>
          <TextField fullWidth label="Why do you want to partner with us?" multiline rows={3} value={form.whyYou} onChange={handleChange('whyYou')} sx={{ mb: 2 }} placeholder="Tell us about your audience and why you love travel..." />
          <TextField fullWidth label="How Did You Hear About Us?" value={form.heardFrom} onChange={handleChange('heardFrom')} sx={{ mb: 3 }} />

          <Button type="submit" variant="contained" color="primary" size="large" fullWidth disabled={submitting}>
            {submitting ? <CircularProgress size={24} sx={{ color: '#FFF' }} /> : 'Become an Ambassador'}
          </Button>
        </Paper>

        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block', textAlign: 'center', mt: 2 }}>
          Already have an account? <Link to="/auth" style={{ color: '#2A9D8F' }}>Sign in</Link> · 
          Want to become a guide? <Link to="/guides" style={{ color: '#2A9D8F' }}>Learn more</Link>
        </Typography>
      </Container>
    </Box>
  );
}
