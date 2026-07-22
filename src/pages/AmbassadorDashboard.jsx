import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Paper, Button, Chip, IconButton, TextField,
  Avatar, Dialog, DialogTitle, DialogContent, DialogActions, Grid, Divider, Alert,
} from '@mui/material';
import SEO from '../components/SEO';
import LogoutIcon from '@mui/icons-material/Logout';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import PeopleIcon from '@mui/icons-material/People';
import SchoolIcon from '@mui/icons-material/School';
import YouTubeIcon from '@mui/icons-material/YouTube';
import InstagramIcon from '@mui/icons-material/Instagram';
import LanguageIcon from '@mui/icons-material/Language';
import UpdateFeed from '../components/UpdateFeed';
import RewardsPanel from '../components/RewardsPanel';
import VerifiedIcon from '@mui/icons-material/Verified';
import { useAuth } from '../context/AuthContext';

export default function AmbassadorDashboard() {
  const navigate = useNavigate();
  const { user, logout, scoutedGuides, addScoutedGuide, updateScoutedGuide, ambassadorCommissions } = useAuth();

  const [tab, setTab] = useState('overview');
  const [scoutOpen, setScoutOpen] = useState(false);
  const [form, setForm] = useState({ guideName: '', location: '', email: '', socialLink: '', whyRecommended: '' });
  const [socialLinks, setSocialLinks] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bls_ambassador_social') || '{}'); }
    catch { return {}; }
  });
  const [saved, setSaved] = useState(false);

  if (!user || user.role !== 'ambassador') {
    return (
      <Container maxWidth="sm" sx={{ px: 2, pt: 4, pb: 4 }}>
        <SEO title="Access Denied" description="" path="/ambassador-dashboard" />
        <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: 3, bgcolor: '#F4F5F7' }}>
          <Typography variant="h1" sx={{ fontSize: 22, mb: 1 }}>Access Denied</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            You need an ambassador account to access this page.
          </Typography>
          <Button variant="contained" color="primary" onClick={() => navigate('/ambassadors')}>
            Apply to become an Ambassador
          </Button>
        </Paper>
      </Container>
    );
  }

  const handleLogout = () => { logout(); navigate('/'); };

  const handleScoutSubmit = () => {
    if (!form.guideName) return;
    addScoutedGuide({ ...form, ambassadorId: user?.id, ambassadorName: user?.name });
    setForm({ guideName: '', location: '', email: '', socialLink: '', whyRecommended: '' });
    setScoutOpen(false);
  };

  const totalCommissions = ambassadorCommissions.reduce((s, c) => s + (c.amount || 0), 0);
  const nominatedCount = scoutedGuides.filter(s => s.status === 'nominated').length;
  const verifiedCount = scoutedGuides.filter(s => s.status === 'verified').length;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'scouts', label: 'My Scouts' },
    { key: 'commissions', label: 'Commissions' },
    { key: 'rewards', label: 'Rewards' },
    { key: 'updates', label: 'Updates' },
    { key: 'content', label: 'Content' },
  ];

  return (
    <Container maxWidth="sm" sx={{ px: 2, pt: 2, pb: 4 }}>
      <SEO title="Ambassador Dashboard" description="Track your referrals, commissions, and ambassador perks on BucketListSpots." path="/ambassador-dashboard" />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h1" sx={{ fontSize: '22px' }}>
            {user?.name || 'Ambassador'}
          </Typography>
          <Typography variant="caption" color="text.secondary">BucketList Scout</Typography>
        </Box>
        <IconButton onClick={handleLogout} sx={{ color: 'text.secondary' }}><LogoutIcon /></IconButton>
      </Box>

      <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: '#102A43', borderRadius: 3, color: '#FFF' }}>
        <Typography variant="body2" fontWeight={700} mb={1}>Your Impact</Typography>
        <Grid container spacing={2}>
          <Grid item xs={4} sx={{ textAlign: 'center' }}>
            <Typography fontWeight={800} sx={{ fontSize: 24, color: '#2A9D8F' }}>{scoutedGuides.length}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Guides Scouted</Typography>
          </Grid>
          <Grid item xs={4} sx={{ textAlign: 'center' }}>
            <Typography fontWeight={800} sx={{ fontSize: 24, color: '#4CAF50' }}>{verifiedCount}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Verified</Typography>
          </Grid>
          <Grid item xs={4} sx={{ textAlign: 'center' }}>
            <Typography fontWeight={800} sx={{ fontSize: 24, color: '#FFB800' }}>${totalCommissions}</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Earned</Typography>
          </Grid>
        </Grid>
      </Paper>

      <Box sx={{ display: 'flex', gap: 0.5, mb: 2, overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' } }}>
        {tabs.map(t => (
          <Chip key={t.key} label={t.label} onClick={() => setTab(t.key)}
            color={tab === t.key ? 'secondary' : 'default'}
            variant={tab === t.key ? 'filled' : 'outlined'} size="small" />
        ))}
      </Box>

      {tab === 'overview' && (
        <>
          <Paper elevation={0} sx={{ p: 2, mb: 2, border: '2px solid #2A9D8F', borderRadius: 3, bgcolor: '#f0faf8' }}>
            <Typography variant="body2" fontWeight={700} sx={{ color: '#2A9D8F' }} mb={1}>
              How It Works
            </Typography>
            {[
              'Travel with an amazing local guide? Nominate them as a BucketList Scout.',
              'We verify their credentials and build their booking profile.',
                  'Get a unique referral link to share with your audience.',
              'Earn 5% commission on every booking generated through your link.',
            ].map((s, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1, mb: 0.5, alignItems: 'flex-start' }}>
                <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: '#2A9D8F', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 700 }}>{i + 1}</Box>
                <Typography variant="caption" color="text.secondary">{s}</Typography>
              </Box>
            ))}
          </Paper>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="h2">Your Referral Link</Typography>
          </Box>
          <Paper elevation={0} sx={{ p: 1.5, mb: 2, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2, display: 'flex', gap: 1, alignItems: 'center', bgcolor: '#F4F5F7' }}>
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
              <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                bucketlistspots.com/ambassador/{user?.id || 'your-id'}
              </Typography>
            </Box>
            <Button size="small" variant="text" onClick={() => navigator.clipboard?.writeText(`bucketlistspots.com/ambassador/${user?.id || 'your-id'}`)} sx={{ fontSize: 11 }}>Copy</Button>
          </Paper>

          <Button variant="contained" color="primary" fullWidth size="large" startIcon={<AddIcon />} onClick={() => setScoutOpen(true)} sx={{ mb: 3 }}>
            Nominate a Guide
          </Button>

          {scoutedGuides.length > 0 && (
            <>
              <Typography variant="h2" mb={1.5}>Recently Scouted</Typography>
              {scoutedGuides.slice(0, 3).map(s => (
                <Paper key={s.id} elevation={0} sx={{ p: 1.5, mb: 1, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2, display: 'flex', gap: 1.5, alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: '#102A43', width: 40, height: 40 }}>{s.guideName[0]}</Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={700}>{s.guideName}</Typography>
                    <Typography variant="caption" color="text.secondary">{s.location}</Typography>
                  </Box>
                  <Chip label={s.status} size="small"
                    sx={{ bgcolor: s.status === 'verified' ? '#4CAF5020' : '#FFB80020', color: s.status === 'verified' ? '#4CAF50' : '#FFB800', fontWeight: 700, fontSize: 10 }} />
                </Paper>
              ))}
            </>
          )}
        </>
      )}

      {tab === 'scouts' && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h2">My Scouted Guides</Typography>
            <Button size="small" variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => setScoutOpen(true)}>
              New Nomination
            </Button>
          </Box>
          {scoutedGuides.length === 0 ? (
            <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: 3, bgcolor: '#F4F5F7' }}>
              <PeopleIcon sx={{ fontSize: 48, color: 'rgba(16,42,67,0.2)', mb: 1 }} />
              <Typography variant="body2" color="text.secondary" gutterBottom>No guides nominated yet</Typography>
              <Button variant="contained" color="primary" size="small" startIcon={<AddIcon />} onClick={() => setScoutOpen(true)}>
                Nominate Your First Guide
              </Button>
            </Paper>
          ) : (
            scoutedGuides.map(s => (
              <Paper key={s.id} elevation={0} sx={{ p: 1.5, mb: 1.5, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Avatar sx={{ bgcolor: '#102A43', width: 44, height: 44, fontSize: 18 }}>{s.guideName[0]}</Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Typography variant="body2" fontWeight={700}>{s.guideName}</Typography>
                      <Chip label={s.status} size="small"
                        sx={{ bgcolor: s.status === 'verified' ? '#4CAF5020' : s.status === 'nominated' ? '#FFB80020' : '#E05D3A20', color: s.status === 'verified' ? '#4CAF50' : s.status === 'nominated' ? '#FFB800' : '#E05D3A', fontWeight: 700, fontSize: 10 }} />
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block">{s.location}</Typography>
                    {s.whyRecommended && <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontStyle: 'italic' }}>"{s.whyRecommended}"</Typography>}
                    {s.socialLink && <Chip label="YouTube Video" icon={<YouTubeIcon sx={{ fontSize: 12 }} />} size="small" variant="outlined" sx={{ mt: 0.5, fontSize: 10 }} />}
                  </Box>
                </Box>
              </Paper>
            ))
          )}
        </>
      )}

      {tab === 'commissions' && (
        <>
          <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">Total Commissions Earned</Typography>
            <Typography variant="h1" sx={{ fontSize: 36, color: '#2A9D8F', my: 0.5 }}>${totalCommissions}</Typography>
            <Typography variant="caption" color="text.secondary">From {ambassadorCommissions.length} referral(s)</Typography>
          </Paper>

          {ambassadorCommissions.length === 0 ? (
            <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: 3, bgcolor: '#F4F5F7' }}>
              <MonetizationOnIcon sx={{ fontSize: 48, color: 'rgba(16,42,67,0.2)', mb: 1 }} />
              <Typography variant="body2" color="text.secondary" gutterBottom>No commissions yet</Typography>
              <Typography variant="caption" color="text.secondary">Start nominating guides to earn 5% lifetime commission on their bookings</Typography>
            </Paper>
          ) : (
            ambassadorCommissions.map(c => (
              <Paper key={c.id} elevation={0} sx={{ p: 1.5, mb: 1, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2" fontWeight={700}>${c.amount}</Typography>
                  <Typography variant="caption" color="text.secondary">{c.source} · {new Date(c.date).toLocaleDateString()}</Typography>
                </Box>
                <Chip label="Pending" size="small" sx={{ bgcolor: '#FFB80020', color: '#FFB800', fontSize: 10 }} />
              </Paper>
            ))
          )}

          <Paper elevation={0} sx={{ p: 2, mt: 2, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2, bgcolor: '#f0faf8' }}>
            <Typography variant="body2" fontWeight={700} sx={{ color: '#2A9D8F' }} mb={0.5}>
              Commission Structure
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">• 5% of platform fee for every booking through your referral</Typography>
            <Typography variant="caption" color="text.secondary" display="block">• 1% lifetime commission on guide's future bookings</Typography>
            <Typography variant="caption" color="text.secondary" display="block">• Payouts processed monthly via Wise or bank transfer</Typography>
          </Paper>
        </>
      )}

      {tab === 'updates' && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="h2" mb={1.5}>Your Updates</Typography>
          <UpdateFeed userId={user?.id} showCreate />
        </Box>
      )}

      {tab === 'rewards' && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="h2" mb={1.5}>BLS Rewards</Typography>
          <RewardsPanel />
        </Box>
      )}

      {tab === 'content' && (
        <>
          <Typography variant="h2" mb={1.5}>Your Content Hub</Typography>

          <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1.5 }}>
              <YouTubeIcon sx={{ color: '#FF0000', fontSize: 32 }} />
              <Box>
                <Typography variant="body2" fontWeight={700}>Creator Academy</Typography>
                <Typography variant="caption" color="text.secondary">Earn by selling content products</Typography>
              </Box>
            </Box>
            <Divider sx={{ mb: 1.5 }} />
            {[
              { title: 'Field Playbooks', desc: 'Sell downloadable PDF guides (£30-50)', icon: SchoolIcon, color: '#2A9D8F' },
              { title: 'Live Masterclass', desc: 'Host paid Zoom workshops (£100/seat)', icon: PeopleIcon, color: '#E05D3A' },
              { title: 'Creator Expedition', desc: 'Lead a 7-day content bootcamp (£3,000+)', icon: LanguageIcon, color: '#102A43' },
            ].map(p => (
              <Box key={p.title} sx={{ display: 'flex', gap: 1.5, py: 1, borderBottom: '1px solid rgba(16,42,67,0.06)', '&:last-child': { borderBottom: 0 } }}>
                <p.icon sx={{ color: p.color, fontSize: 24 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight={600}>{p.title}</Typography>
                  <Typography variant="caption" color="text.secondary">{p.desc}</Typography>
                </Box>
                <Button size="small" variant="outlined" sx={{ fontSize: 10 }}>Coming Soon</Button>
              </Box>
            ))}
          </Paper>

          <Paper elevation={0} sx={{ p: 2, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
            <Typography variant="body2" fontWeight={700} mb={1.5}>Connect Your Social Media</Typography>
            {[
              { key: 'youtube', icon: YouTubeIcon, label: 'YouTube', color: '#FF0000', placeholder: 'https://youtube.com/@...' },
              { key: 'instagram', icon: InstagramIcon, label: 'Instagram', color: '#E4405F', placeholder: 'https://instagram.com/...' },
              { key: 'website', icon: LanguageIcon, label: 'Website', color: '#102A43', placeholder: 'https://...' },
            ].map(s => (
              <Box key={s.key} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                <s.icon sx={{ color: s.color, fontSize: 20 }} />
                <TextField fullWidth size="small" placeholder={s.placeholder} variant="outlined"
                  value={socialLinks[s.key] || ''}
                  onChange={(e) => { setSocialLinks(prev => ({ ...prev, [s.key]: e.target.value })); setSaved(false); }}
                  sx={{ '& .MuiInputBase-root': { fontSize: 12 } }} />
              </Box>
            ))}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <Button size="small" variant="contained" color="primary" onClick={() => {
                localStorage.setItem('bls_ambassador_social', JSON.stringify(socialLinks));
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
              }}>Save Links</Button>
              {saved && <Typography variant="caption" sx={{ color: '#2A9D8F' }}>Saved!</Typography>}
            </Box>
          </Paper>

          <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
            <Typography variant="caption">
              The Creator Academy will launch in Phase 2. As a Founding Ambassador, you'll get early access and reduced platform fees.
            </Typography>
          </Alert>
        </>
      )}

      <Dialog open={scoutOpen} onClose={() => setScoutOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nominate a Guide</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2, borderRadius: 2, fontSize: 12 }}>
            Know an amazing local guide? Nominate them for verification. You'll earn 5% commission on every booking they receive.
          </Alert>
          <TextField fullWidth label="Guide Name" value={form.guideName} onChange={(e) => setForm({ ...form, guideName: e.target.value })} sx={{ mb: 2, mt: 1 }} />
          <TextField fullWidth label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} sx={{ mb: 2 }} placeholder="e.g., Moshi, Tanzania" />
          <TextField fullWidth label="Guide Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth label="Link to your video/content about this guide" value={form.socialLink} onChange={(e) => setForm({ ...form, socialLink: e.target.value })} sx={{ mb: 2 }} placeholder="YouTube or Instagram link" />
          <TextField fullWidth label="Why do you recommend this guide?" multiline rows={3} value={form.whyRecommended} onChange={(e) => setForm({ ...form, whyRecommended: e.target.value })} placeholder="What made your experience special?" />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setScoutOpen(false)}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={handleScoutSubmit} disabled={!form.guideName}>Submit Nomination</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
