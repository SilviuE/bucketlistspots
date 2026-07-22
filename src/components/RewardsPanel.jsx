import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Button, CircularProgress, Chip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import { supabase } from '../lib/supabaseClient';

export default function RewardsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => { fetchRewards(); }, []);

  const fetchRewards = async () => {
    setLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) return;
      const res = await fetch('/api/rewards', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (data?.referralCode) {
      navigator.clipboard.writeText(data.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) return <CircularProgress size={20} sx={{ display: 'block', mx: 'auto', my: 2 }} />;
  if (!data) return <Typography variant="body2" color="text.secondary">Could not load rewards data.</Typography>;

  return (
    <Box>
      <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2, textAlign: 'center' }}>
        <Typography variant="h2" mb={1}>Your Referral Code</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
          <Typography variant="h1" sx={{ fontSize: 28, fontWeight: 800, fontFamily: 'monospace', letterSpacing: 2, color: '#2A9D8F' }}>
            {data.referralCode}
          </Typography>
          <Button size="small" variant="outlined" startIcon={<ContentCopyIcon />} onClick={handleCopy} sx={{ fontSize: 11 }}>
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary">Share this code with travellers to earn BLS Points</Typography>
      </Paper>

      <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2, textAlign: 'center', bgcolor: '#f0faf8' }}>
        <MonetizationOnIcon sx={{ fontSize: 32, color: '#2A9D8F', mb: 0.5 }} />
        <Typography variant="h1" sx={{ fontSize: 32, fontWeight: 800, color: '#2A9D8F' }}>
          {data.balance}
        </Typography>
        <Typography variant="body2" fontWeight={600}>BLS Points</Typography>
        <Typography variant="caption" color="text.secondary">1 BLS Point = £1 value</Typography>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h2">Transaction History</Typography>
      </Box>

      {data.transactions.length === 0 ? (
        <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: 3, bgcolor: '#F4F5F7' }}>
          <Typography variant="body2" color="text.secondary">No transactions yet.</Typography>
          <Typography variant="caption" color="text.secondary">Share your referral code to start earning BLS Points.</Typography>
        </Paper>
      ) : (
        data.transactions.map(tx => (
          <Paper key={tx.id} elevation={0} sx={{ p: 1.5, mb: 1, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight={700}>
                {tx.type === 'credit' ? '+' : '-'}{tx.amount} Points
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">{tx.reason}</Typography>
              <Typography variant="caption" color="text.disabled">{new Date(tx.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Typography>
            </Box>
            <Chip label={tx.type === 'credit' ? 'Earned' : 'Spent'} size="small"
              sx={{ bgcolor: tx.type === 'credit' ? '#4CAF5020' : '#E05D3A20', color: tx.type === 'credit' ? '#4CAF50' : '#E05D3A', fontWeight: 700, fontSize: 10 }} />
          </Paper>
        ))
      )}
    </Box>
  );
}