import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Paper, Button, Chip, IconButton, Grid, Avatar, TextField,
  Divider, LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PaymentsIcon from '@mui/icons-material/Payments';
import PeopleIcon from '@mui/icons-material/People';
import StarIcon from '@mui/icons-material/Star';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useAuth } from '../context/AuthContext';
import guidesData from '../data/guides';

export default function GuideDashboard() {
  const navigate = useNavigate();
  const { user, logout, guideBookings, guideEarnings, guideAvailability, updateAvailability, confirmGuideBooking, completeGuideBooking } = useAuth();
  const [tab, setTab] = useState('overview');
  const [availOpen, setAvailOpen] = useState(false);
  const [availForm, setAvailForm] = useState(guideAvailability || '');

  const handleLogout = () => { logout(); navigate('/'); };

  const guide = guidesData.find(g => g.tradingName?.includes('KilimanjaroJoy')) || guidesData[0];
  const totalEarnings = guideEarnings.reduce((sum, e) => sum + e.amount, 0);
  const pendingBookings = guideBookings.filter(b => b.status === 'pending');
  const confirmedBookings = guideBookings.filter(b => b.status === 'confirmed');

  const handleSaveAvailability = () => {
    updateAvailability(availForm);
    setAvailOpen(false);
  };

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'bookings', label: 'Bookings' },
    { key: 'earnings', label: 'Earnings' },
    { key: 'profile', label: 'Profile' },
  ];

  return (
    <Container maxWidth="sm" sx={{ px: 2, pt: 2, pb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Avatar src={guide?.photo} sx={{ width: 44, height: 44, border: '2px solid #2A9D8F' }} />
          <Box>
            <Typography variant="h1" sx={{ fontSize: '20px' }}>{user?.name || 'Guide'}</Typography>
            <Typography variant="caption" color="text.secondary">{guide?.tradingName}</Typography>
          </Box>
        </Box>
        <IconButton onClick={handleLogout} sx={{ color: 'text.secondary' }}><LogoutIcon /></IconButton>
      </Box>

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        {[
          { label: 'Total Earned', value: `$${totalEarnings.toLocaleString()}`, icon: PaymentsIcon, color: '#2A9D8F' },
          { label: 'Pending', value: pendingBookings.length, icon: PeopleIcon, color: '#E05D3A' },
          { label: 'Confirmed', value: confirmedBookings.length, icon: CheckCircleIcon, color: '#4CAF50' },
          { label: 'Rating', value: `${guide?.rating || 0}`, icon: StarIcon, color: '#FFB800' },
        ].map(s => (
          <Grid item xs={6} key={s.label}>
            <Paper elevation={0} sx={{ p: 1.5, textAlign: 'center', border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
              <s.icon sx={{ color: s.color, fontSize: 24, mb: 0.5 }} />
              <Typography fontWeight={800} sx={{ fontSize: 20, color: s.color }}>{s.value}</Typography>
              <Typography variant="caption" color="text.secondary">{s.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ display: 'flex', gap: 0.5, mb: 2 }}>
        {tabs.map(t => (
          <Chip key={t.key} label={t.label} onClick={() => setTab(t.key)}
            color={tab === t.key ? 'secondary' : 'default'}
            variant={tab === t.key ? 'filled' : 'outlined'} size="small" />
        ))}
      </Box>

      {tab === 'overview' && (
        <>
          <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" fontWeight={700}>Availability</Typography>
              <Button size="small" variant="text" onClick={() => setAvailOpen(true)} sx={{ fontSize: 12 }}>
                {guideAvailability ? 'Update' : 'Set'}
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {guideAvailability || 'Not set yet. Update your availability.'}
            </Typography>
          </Paper>

          <Typography variant="h2" mb={1.5}>Recent Bookings</Typography>
          {guideBookings.length === 0 ? (
            <Paper elevation={0} sx={{ p: 3, textAlign: 'center', border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
              <Typography variant="body2" color="text.secondary">No bookings received yet</Typography>
            </Paper>
          ) : (
            guideBookings.slice(0, 3).map((b, i) => (
              <Paper key={i} elevation={0} sx={{ p: 1.5, mb: 1, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="body2" fontWeight={700}>{b.guestName || 'Guest'}</Typography>
                    <Typography variant="caption" color="text.secondary">{b.route} · {b.date} · {b.travelers} travelers</Typography>
                  </Box>
                  <Chip label={b.status} size="small"
                    sx={{ bgcolor: b.status === 'pending' ? '#E05D3A20' : b.status === 'confirmed' ? '#4CAF5020' : '#9E9E9E20', color: b.status === 'pending' ? '#E05D3A' : b.status === 'confirmed' ? '#4CAF50' : '#9E9E9E', fontWeight: 700, fontSize: 10 }} />
                </Box>
              </Paper>
            ))
          )}

          {/* Quick actions */}
          <Typography variant="h2" mt={3} mb={1.5}>Quick Actions</Typography>
          <Grid container spacing={1}>
            {[
              { label: 'View My Profile', action: () => navigate('/guide/david-bakari'), color: '#2A9D8F' },
              { label: 'Browse Marketplace', action: () => navigate('/book'), color: '#102A43' },
              { label: 'Apply for Premium', action: () => navigate('/guides'), color: '#E05D3A' },
            ].map(a => (
              <Grid item xs={4} key={a.label}>
                <Paper elevation={0} sx={{ p: 1.5, textAlign: 'center', border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2, cursor: 'pointer' }} onClick={a.action}>
                  <Typography variant="caption" fontWeight={700} sx={{ color: a.color }}>{a.label}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {tab === 'bookings' && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h2">All Bookings</Typography>
          </Box>
          {guideBookings.length === 0 ? (
            <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: 3, bgcolor: '#F4F5F7' }}>
              <PeopleIcon sx={{ fontSize: 48, color: 'rgba(16,42,67,0.2)', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">No bookings yet</Typography>
            </Paper>
          ) : (
            guideBookings.map((b, i) => (
              <Paper key={i} elevation={0} sx={{ p: 1.5, mb: 1.5, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Avatar sx={{ bgcolor: '#102A43', width: 40, height: 40 }}>{b.guestName?.[0] || 'G'}</Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={700}>{b.guestName || 'Guest'}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block">{b.route} · {b.date}</Typography>
                    <Typography variant="caption" color="text.secondary">{b.travelers} traveler(s) · Deposit: ${b.deposit}</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                      {b.status === 'pending' && (
                        <>
                          <Button size="small" variant="contained" color="primary" startIcon={<CheckCircleIcon />}
                            onClick={() => confirmGuideBooking(b.id)} sx={{ fontSize: 10, py: 0.3 }}>Confirm</Button>
                          <Button size="small" variant="outlined" color="error" startIcon={<CancelIcon />} sx={{ fontSize: 10, py: 0.3 }}>Decline</Button>
                        </>
                      )}
                      {b.status === 'confirmed' && (
                        <Button size="small" variant="contained" color="success" onClick={() => completeGuideBooking(b.id)} sx={{ fontSize: 10, py: 0.3 }}>
                          Mark Completed
                        </Button>
                      )}
                      {b.status === 'completed' && <Chip label="Completed" size="small" color="success" />}
                    </Box>
                  </Box>
                </Box>
              </Paper>
            ))
          )}
        </>
      )}

      {tab === 'earnings' && (
        <>
          <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">Total Earnings</Typography>
            <Typography variant="h1" sx={{ fontSize: 36, color: '#2A9D8F', my: 0.5 }}>${totalEarnings.toLocaleString()}</Typography>
            <Typography variant="caption" color="text.secondary">
              {guideEarnings.length} completed booking(s)
            </Typography>
          </Paper>

          <Typography variant="h2" mb={1.5}>Payment History</Typography>
          {guideEarnings.length === 0 ? (
            <Paper elevation={0} sx={{ p: 3, textAlign: 'center', border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
              <Typography variant="body2" color="text.secondary">No earnings recorded yet</Typography>
            </Paper>
          ) : (
            guideEarnings.map((e, i) => (
              <Paper key={i} elevation={0} sx={{ p: 1.5, mb: 1, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2" fontWeight={700}>${e.amount.toLocaleString()}</Typography>
                  <Typography variant="caption" color="text.secondary">{new Date(e.date).toLocaleDateString()}</Typography>
                </Box>
                <Chip label="Paid" size="small" color="success" sx={{ fontSize: 10 }} />
              </Paper>
            ))
          )}

          <Paper elevation={0} sx={{ p: 2, mt: 2, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2, bgcolor: '#f0faf8' }}>
            <Typography variant="body2" fontWeight={700} sx={{ color: '#2A9D8F' }} mb={0.5}>
              How You Get Paid
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              1. Traveler pays 20% deposit via Stripe (held by BLS as agent commission)
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              2. You receive traveler's contact details
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              3. Balance (80%) paid directly to you via Wise, bank transfer, or cash on arrival
            </Typography>
          </Paper>
        </>
      )}

      {tab === 'profile' && (
        <GuideProfileEdit guide={guide} user={user} />
      )}

      <Dialog open={availOpen} onClose={() => setAvailOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Set Your Availability</DialogTitle>
        <DialogContent>
          <TextField fullWidth multiline rows={3} value={availForm}
            onChange={(e) => setAvailForm(e.target.value)}
            placeholder="e.g., Available year-round. Best months: June-October, December-February. Limited availability in April-May (rainy season)."
            sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAvailOpen(false)}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={handleSaveAvailability}>Save</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

function GuideProfileEdit({ guide, user }) {
  const { updateProfile } = useAuth();
  const [bio, setBio] = useState(guide?.bio?.split('\n')[0] || '');
  const [price, setPrice] = useState(guide?.price || 1900);

  const handleSave = () => {
    updateProfile({ bio, price: Number(price) });
  };

  return (
    <>
      <Typography variant="h2" mb={1.5}>Public Profile</Typography>
      <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
          <Avatar src={guide?.photo} sx={{ width: 64, height: 64 }} />
          <Box>
            <Typography variant="body1" fontWeight={700}>{user?.name || guide?.name}</Typography>
            <Typography variant="caption" color="text.secondary">{guide?.tradingName}</Typography>
          </Box>
        </Box>
        <TextField fullWidth label="Short Bio" multiline rows={2} value={bio} onChange={(e) => setBio(e.target.value)} sx={{ mb: 2 }} />
        <TextField fullWidth label="Starting Price ($)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} sx={{ mb: 2 }} />
        <Button variant="contained" color="primary" onClick={handleSave}>Save Profile</Button>
      </Paper>

      <Paper elevation={0} sx={{ p: 2, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
        <Typography variant="body2" fontWeight={700} mb={1}>Routes You Offer</Typography>
        {guide?.routes?.map((r, i) => (
          <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.8, borderBottom: i < guide.routes.length - 1 ? '1px solid rgba(16,42,67,0.06)' : 'none' }}>
            <Typography variant="body2">{r.name}</Typography>
            <Typography variant="body2" fontWeight={700}>${r.price}/person</Typography>
          </Box>
        ))}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Contact BLS admin to update your routes.
        </Typography>
      </Paper>
    </>
  );
}
