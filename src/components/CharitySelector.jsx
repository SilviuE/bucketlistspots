import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Paper, Avatar, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert, Radio, RadioGroup, FormControlLabel, FormControl, Divider, Chip,
} from '@mui/material';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export default function CharitySelector({ open, onClose, destination, guideName, onCreated }) {
  const [charities, setCharities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCharity, setSelectedCharity] = useState(null);
  const [pageTitle, setPageTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [createdPage, setCreatedPage] = useState(null);
  const [mockMode, setMockMode] = useState(false);

  useEffect(() => {
    if (!open || !destination) return;
    setLoading(true);
    setError('');
    setCharities([]);
    setSelectedCharity(null);
    setCreated(false);
    setCreatedPage(null);

    const apiUrl = window.location.hostname === 'localhost'
      ? `http://localhost:3002/api/charities?destination=${destination}`
      : `/api/charities?destination=${destination}`;

    fetch(apiUrl)
      .then(r => r.json())
      .then(data => {
        setCharities(data.charities || []);
        setMockMode(data.mockMode || false);
        setLoading(false);
      })
      .catch(() => {
        setError('Could not load charities. Please try again.');
        setLoading(false);
      });
  }, [open, destination]);

  const handleCreate = async () => {
    if (!selectedCharity || !pageTitle || !targetAmount) return;
    setCreating(true);
    setError('');

    try {
      const apiUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:3002/api/fundraising/create'
        : '/api/fundraising/create';

      // Get auth token
      const { supabase } = await import('../lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('You must be logged in to create a fundraising page.');
        setCreating(false);
        return;
      }

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          charityId: selectedCharity.id,
          charityApiId: selectedCharity.charity_api_id,
          charityName: selectedCharity.charity_name,
          pageTitle,
          targetAmount: parseFloat(targetAmount),
          currency: 'GBP',
          eventDate: eventDate || null,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setCreating(false);
        return;
      }

      setCreatedPage(data);
      setCreated(true);
      if (onCreated) onCreated(data);
    } catch {
      setError('Could not create fundraising page. Please try again.');
    }
    setCreating(false);
  };

  if (created && createdPage) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogContent sx={{ textAlign: 'center', py: 4 }}>
          <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: '#2A9D8F15', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
            <CheckCircleIcon sx={{ color: '#2A9D8F', fontSize: 32 }} />
          </Box>
          <Typography variant="h2" sx={{ mb: 1 }}>Challenge Created!</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Your fundraising page for <strong>{createdPage.charityName}</strong> is live.
          </Typography>

          <Paper elevation={0} sx={{ p: 2, bgcolor: '#F4F5F7', borderRadius: 2, mb: 2 }}>
            <Typography variant="caption" fontWeight={700} display="block" mb={0.5}>{createdPage.pageTitle}</Typography>
            <Typography variant="caption" color="text.secondary">Target: £{createdPage.targetAmount} · Currency: {createdPage.currency}</Typography>
          </Paper>

          <Button
            variant="outlined"
            size="small"
            href={createdPage.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<OpenInNewIcon />}
            sx={{ mb: 2 }}
          >
            View on JustGiving
          </Button>

          {mockMode && (
            <Alert severity="info" sx={{ textAlign: 'left', borderRadius: 2 }}>
              <Typography variant="caption" fontWeight={700}>Mock Mode</Typography>
              <Typography variant="caption" display="block">
                This is a simulated fundraising page. In production, your page will be live on JustGiving.
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Close</Button>
          <Button variant="contained" color="primary" onClick={onClose}>Done</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <VolunteerActivismIcon sx={{ color: '#2A9D8F' }} />
        <Box>
          <Typography variant="h2" sx={{ fontSize: '18px' }}>Turn Your Climb Into a Charity Challenge</Typography>
          <Typography variant="caption" color="text.secondary">
            Support a cause linked to {destination ? destination.charAt(0).toUpperCase() + destination.slice(1) : 'your destination'}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={28} sx={{ color: '#2A9D8F' }} />
            <Typography variant="caption" display="block" mt={1}>Loading charities...</Typography>
          </Box>
        ) : error && !charities.length ? (
          <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
        ) : charities.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            No charities available for this destination yet. Check back soon!
          </Alert>
        ) : (
          <>
            <Typography variant="body2" fontWeight={700} mb={1.5}>
              Choose a vetted charity for {destination?.charAt(0).toUpperCase() + destination?.slice(1)}:
            </Typography>

            <FormControl component="fieldset" sx={{ width: '100%' }}>
              <RadioGroup value={selectedCharity?.id || ''} onChange={(e) => {
                const c = charities.find(ch => ch.id === e.target.value);
                setSelectedCharity(c || null);
              }}>
                {charities.map(c => (
                  <Paper
                    key={c.id}
                    elevation={0}
                    sx={{
                      p: 1.5, mb: 1.5, cursor: 'pointer', display: 'flex', gap: 1.5, alignItems: 'flex-start',
                      border: selectedCharity?.id === c.id ? '2px solid #2A9D8F' : '1px solid rgba(16,42,67,0.12)',
                      bgcolor: selectedCharity?.id === c.id ? '#f0faf8' : '#FFF',
                      borderRadius: 2, transition: 'all 0.2s',
                      '&:hover': { borderColor: '#2A9D8F' },
                    }}
                  >
                    <Radio
                      checked={selectedCharity?.id === c.id}
                      sx={{ color: 'rgba(16,42,67,0.3)', '&.Mui-checked': { color: '#2A9D8F' }, mt: -0.5 }}
                    />
                    <Avatar src={c.logo_url || c.justgiving?.logoUrl} sx={{ width: 40, height: 40, flexShrink: 0 }} />
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                        <Typography variant="body2" fontWeight={700}>{c.charity_name}</Typography>
                        <Chip label="Verified" size="small" sx={{ height: 18, fontSize: 9, bgcolor: '#2A9D8F', color: '#FFF' }} />
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {c.charity_description || c.justgiving?.description}
                      </Typography>
                      {c.website_url && (
                        <Typography variant="caption" component="a" href={c.website_url} target="_blank" rel="noopener noreferrer"
                          sx={{ color: '#2A9D8F', display: 'inline-flex', alignItems: 'center', gap: 0.25, mt: 0.5, textDecoration: 'none' }}>
                          Visit website <OpenInNewIcon sx={{ fontSize: 11 }} />
                        </Typography>
                      )}
                    </Box>
                  </Paper>
                ))}
              </RadioGroup>
            </FormControl>

            {selectedCharity && (
              <Box sx={{ mt: 2 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="body2" fontWeight={700} mb={1.5}>Set Up Your Challenge</Typography>

                <TextField
                  fullWidth size="small" label="Challenge Title"
                  placeholder={`My ${guideName || 'Kilimanjaro'} Challenge`}
                  value={pageTitle}
                  onChange={(e) => setPageTitle(e.target.value)}
                  sx={{ mb: 1.5 }}
                />

                <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
                  <TextField
                    size="small" label="Fundraising Target" type="number"
                    placeholder="500"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    InputProps={{ startAdornment: <Typography variant="caption" mr={0.5}>£</Typography> }}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    size="small" label="Event Date" type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ flex: 1 }}
                  />
                </Box>

                {error && <Alert severity="error" sx={{ borderRadius: 2, mb: 1 }}>{error}</Alert>}

                {mockMode && (
                  <Alert severity="info" sx={{ borderRadius: 2, mb: 1 }}>
                    <Typography variant="caption">Mock Mode — a simulated page will be created for testing.</Typography>
                  </Alert>
                )}
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Skip for Now</Button>
        <Button
          variant="contained" color="primary"
          onClick={handleCreate}
          disabled={!selectedCharity || !pageTitle || !targetAmount || creating}
        >
          {creating ? <CircularProgress size={18} /> : 'Create Challenge'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
