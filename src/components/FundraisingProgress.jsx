import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Paper, LinearProgress, Avatar, IconButton, Tooltip, Alert, CircularProgress, Divider,
} from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';

const currencySymbols = { GBP: '£', USD: '$', EUR: '€' };

export default function FundraisingProgress({ compact = false }) {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(null);

  const fetchPages = () => {
    setLoading(true);
    const apiUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:3002/api/fundraising/my'
      : '/api/fundraising/my';

    import('../lib/supabaseClient').then(({ supabase }) => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) { setLoading(false); return; }
        return fetch(apiUrl, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
      }).then(r => r?.json()).then(data => {
        setPages(data?.pages || []);
        setLoading(false);
      }).catch(() => setLoading(false));
    });
  };

  useEffect(() => { if (!compact) fetchPages(); }, []);

  const handleSync = async (pageId) => {
    setSyncing(pageId);
    const apiUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:3002/api/fundraising/sync'
      : '/api/fundraising/sync';

    try {
      const { supabase } = await import('../lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ pageId }),
      });
      const data = await res.json();
      if (!data.error) {
        setPages(prev => prev.map(p => p.id === pageId ? { ...p, ...data } : p));
      }
    } catch {}
    setSyncing(null);
  };

  const handleShare = (page) => {
    const text = `I'm climbing ${page.page_title} to support ${page.charity_name}! Donate here: ${page.page_url}`;
    if (navigator.share) {
      navigator.share({ title: page.page_title, text, url: page.page_url });
    } else {
      navigator.clipboard.writeText(text);
    }
  };

  const handleCopyLink = (url) => {
    navigator.clipboard.writeText(url);
  };

  // Simulate donation (mock mode only)
  const handleSimulateDonation = async (page) => {
    const apiUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:3002/api/fundraising/simulate-donation'
      : '/api/fundraising/simulate-donation';

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageShortName: page.page_short_name,
          amount: 50,
          donorName: 'Test Donor',
        }),
      });
      const data = await res.json();
      if (!data.error) {
        setPages(prev => prev.map(p => p.id === page.id ? {
          ...p,
          total_raised: data.totalRaised,
          donor_count: data.donorCount,
        } : p));
      }
    } catch {}
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <CircularProgress size={24} sx={{ color: '#2A9D8F' }} />
      </Box>
    );
  }

  if (!pages.length) {
    return compact ? null : (
      <Paper elevation={0} sx={{ p: 3, textAlign: 'center', border: '2px dashed rgba(16,42,67,0.15)', borderRadius: 3, bgcolor: '#F4F5F7' }}>
        <VolunteerActivismIcon sx={{ fontSize: 48, color: 'rgba(16,42,67,0.2)', mb: 1 }} />
        <Typography variant="body2" color="text.secondary" gutterBottom>
          No active charity challenges
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          After booking a trip, you can create a fundraising page to support a local cause.
        </Typography>
      </Paper>
    );
  }

  if (compact) {
    return (
      <Box>
        {pages.map(page => {
          const pct = page.target_amount > 0 ? Math.min(100, (page.total_raised / page.target_amount) * 100) : 0;
          const symbol = currencySymbols[page.currency] || '£';
          return (
            <Paper key={page.id} elevation={0} sx={{ p: 1.5, mb: 1, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <VolunteerActivismIcon sx={{ color: '#2A9D8F', fontSize: 20 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700} noWrap>{page.page_title}</Typography>
                  <Typography variant="caption" color="text.secondary">{page.charity_name}</Typography>
                </Box>
                <Typography variant="body2" fontWeight={800} sx={{ color: '#2A9D8F' }}>
                  {symbol}{page.total_raised}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={pct}
                sx={{
                  mt: 1, height: 6, borderRadius: 3, bgcolor: 'rgba(16,42,67,0.08)',
                  '& .MuiLinearProgress-bar': { bgcolor: '#2A9D8F', borderRadius: 3 },
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {symbol}{page.total_raised} of {symbol}{page.target_amount} · {page.donor_count} donor{page.donor_count !== 1 ? 's' : ''}
              </Typography>
            </Paper>
          );
        })}
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h2">My Charity Challenges</Typography>
        <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={fetchPages}>
          Refresh
        </Button>
      </Box>

      {pages.map(page => {
        const pct = page.target_amount > 0 ? Math.min(100, (page.total_raised / page.target_amount) * 100) : 0;
        const symbol = currencySymbols[page.currency] || '£';

        return (
          <Paper key={page.id} elevation={0} sx={{ p: 2, mb: 2, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 3 }}>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mb: 1.5 }}>
              <VolunteerActivismIcon sx={{ color: '#2A9D8F', fontSize: 24, mt: 0.5 }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={700}>{page.page_title}</Typography>
                <Typography variant="caption" color="text.secondary">{page.charity_name}</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Tooltip title="Sync progress">
                  <IconButton size="small" onClick={() => handleSync(page.id)} disabled={syncing === page.id}>
                    {syncing === page.id ? <CircularProgress size={14} /> : <RefreshIcon sx={{ fontSize: 16 }} />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Copy link">
                  <IconButton size="small" onClick={() => handleCopyLink(page.page_url)}>
                    <ContentCopyIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Share">
                  <IconButton size="small" onClick={() => handleShare(page)}>
                    <ShareIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Progress bar */}
            <Box sx={{ mb: 1 }}>
              <LinearProgress
                variant="determinate"
                value={pct}
                sx={{
                  height: 8, borderRadius: 4, bgcolor: 'rgba(16,42,67,0.08)',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: pct >= 100 ? '#4CAF50' : '#2A9D8F',
                    borderRadius: 4,
                  },
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="body2" fontWeight={700} sx={{ color: '#2A9D8F' }}>
                {symbol}{page.total_raised.toLocaleString()} raised
              </Typography>
              <Typography variant="caption" color="text.secondary">
                of {symbol}{page.target_amount.toLocaleString()} goal
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {page.donor_count} donor{page.donor_count !== 1 ? 's' : ''}
              </Typography>
              {page.event_date && (
                <Typography variant="caption" color="text.secondary">
                  · Event: {new Date(page.event_date).toLocaleDateString()}
                </Typography>
              )}
            </Box>

            <Divider sx={{ my: 1.5 }} />

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained" color="primary" size="small" fullWidth
                href={page.page_url}
                target="_blank"
                rel="noopener noreferrer"
                endIcon={<OpenInNewIcon />}
              >
                Donate / Share Page
              </Button>
            </Box>

            {pct >= 50 && pct < 100 && (
              <Alert severity="success" sx={{ mt: 1.5, borderRadius: 2 }}>
                <Typography variant="caption" fontWeight={700}>Amazing progress! You're over {Math.round(pct)}% of the way there.</Typography>
              </Alert>
            )}
            {pct >= 100 && (
              <Alert severity="success" sx={{ mt: 1.5, borderRadius: 2 }}>
                <Typography variant="caption" fontWeight={700}>Congratulations! You've hit your fundraising goal!</Typography>
              </Alert>
            )}

            {/* Mock mode: simulate donation button */}
            {page.page_url?.includes('mock') && (
              <Button
                size="small" variant="outlined" fullWidth
                onClick={() => handleSimulateDonation(page)}
                sx={{ mt: 1, fontSize: 11, color: '#9E9E9E', borderColor: '#E0E0E0' }}
              >
                [Dev] Simulate £50 Donation
              </Button>
            )}
          </Paper>
        );
      })}
    </Box>
  );
}
