import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Paper, Button, CircularProgress, Alert, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import SEO from '../components/SEO';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

const currencySymbol = { usd: '$', gbp: '\u00a3', eur: '\u20ac' };

export default function AdminPaymentReports() {
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('all');

  useEffect(() => {
    if (!isLoggedIn || user?.role !== 'admin') return;
    fetchReports();
  }, [isLoggedIn, user]);

  const fetchReports = async (currency) => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      let url = '/api/admin/payment-reports';
      if (currency && currency !== 'all') url += `?currency=${currency}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load');
      const data = await res.json();
      setReports(data.reports);
      setSummary(data.summary);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCurrencyFilter = (_, v) => {
    setCurrencyFilter(v);
    fetchReports(v);
  };

  const downloadCSV = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      let url = '/api/admin/payment-reports?format=csv';
      if (currencyFilter !== 'all') url += `&currency=${currencyFilter}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'payment-reports.csv';
      a.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError('CSV download failed: ' + err.message);
    }
  };

  const fmt = (amount, currency) => {
    const sym = currencySymbol[currency] || '$';
    return `${sym}${Number(amount || 0).toFixed(2)}`;
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

  return (
    <Container maxWidth="lg" sx={{ px: 2, pt: 2, pb: 4 }}>
      <SEO title="Payment Reports" description="Multi-currency payment reports and Stripe settlement reconciliation." path="/admin/payment-reports" />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h1">Payment Reports</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" onClick={() => fetchReports(currencyFilter)} disabled={loading}>Refresh</Button>
          <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={downloadCSV} disabled={loading || reports.length === 0}>
            Export CSV
          </Button>
        </Box>
      </Box>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Multi-currency Stripe settlement data. Fee breakdowns from actual balance transactions.
      </Typography>

      <Tabs value={currencyFilter} onChange={handleCurrencyFilter} sx={{ mb: 2, '& .MuiTab-root': { fontSize: 13, textTransform: 'none', minWidth: 'auto', px: 2 } }}>
        {['all', 'usd', 'gbp', 'eur'].map(c => (
          <Tab key={c} value={c} label={c === 'all' ? 'All Currencies' : c.toUpperCase()} />
        ))}
      </Tabs>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      {summary && (
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Paper elevation={0} sx={{ p: 2, flex: '1 1 200px', border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2, textAlign: 'center' }}>
            <Typography variant="h1" sx={{ fontSize: 28, fontWeight: 800, color: '#102A43' }}>{summary.totalTransactions}</Typography>
            <Typography variant="caption" color="text.secondary">Total Transactions</Typography>
          </Paper>
          <Paper elevation={0} sx={{ p: 2, flex: '1 1 200px', border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2, textAlign: 'center' }}>
            <Typography variant="h1" sx={{ fontSize: 28, fontWeight: 800, color: '#E05D3A' }}>{fmt(summary.totalStripeFees, 'usd')}</Typography>
            <Typography variant="caption" color="text.secondary">Total Stripe Fees</Typography>
          </Paper>
          <Paper elevation={0} sx={{ p: 2, flex: '1 1 200px', border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2, textAlign: 'center' }}>
            <Typography variant="h1" sx={{ fontSize: 28, fontWeight: 800, color: '#2A9D8F' }}>{fmt(summary.totalReferralDiscounts, 'usd')}</Typography>
            <Typography variant="caption" color="text.secondary">Total Referral Discounts</Typography>
          </Paper>
        </Box>
      )}

      {summary && summary.byCurrency && Object.keys(summary.byCurrency).length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h2" mb={1}>By Currency</Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {Object.entries(summary.byCurrency).map(([cur, stats]) => (
              <Paper key={cur} elevation={0} sx={{ p: 2, flex: '1 1 250px', border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" fontWeight={700}>{cur.toUpperCase()}</Typography>
                  <Chip label={`${stats.count} tx`} size="small" sx={{ fontSize: 11 }} />
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">Gross:</Typography>
                  <Typography variant="caption" fontWeight={600}>{fmt(stats.grossAmount, cur)}</Typography>
                  <Typography variant="caption" color="text.secondary">Stripe Fees:</Typography>
                  <Typography variant="caption" fontWeight={600} color="#E05D3A">{fmt(stats.stripeFees, cur)}</Typography>
                  <Typography variant="caption" color="text.secondary">Net Settlement:</Typography>
                  <Typography variant="caption" fontWeight={600} color="#2A9D8F">{fmt(stats.netSettlement, cur)}</Typography>
                  <Typography variant="caption" color="text.secondary">Referral Discounts:</Typography>
                  <Typography variant="caption" fontWeight={600}>{fmt(stats.referralDiscounts, cur)}</Typography>
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>
      )}

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
      ) : reports.length === 0 ? (
        <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: 3, bgcolor: '#F4F5F7' }}>
          <Typography variant="body2" color="text.secondary">No payment records yet.</Typography>
          <Typography variant="caption" color="text.secondary">Data will appear here after successful bookings.</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#F4F5F7' }}>
                <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Route</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Guest</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Guide</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Charged</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Settled</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Stripe Fee</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Referral</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reports.map((row) => (
                <TableRow key={row.id}>
                  <TableCell sx={{ fontSize: 11 }}>{row.created_at ? new Date(row.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</TableCell>
                  <TableCell sx={{ fontSize: 11 }}>{row.route_name || '—'}</TableCell>
                  <TableCell sx={{ fontSize: 11 }}>{row.guest_name || row.guest_email || '—'}</TableCell>
                  <TableCell sx={{ fontSize: 11 }}>{row.guide_id || '—'}</TableCell>
                  <TableCell sx={{ fontSize: 11, fontWeight: 600 }}>{fmt(row.presentment_amount, row.presentment_currency)} {row.presentment_currency?.toUpperCase()}</TableCell>
                  <TableCell sx={{ fontSize: 11, color: '#2A9D8F', fontWeight: 600 }}>{row.settlement_amount ? fmt(row.settlement_amount, row.settlement_currency) : '—'}</TableCell>
                  <TableCell sx={{ fontSize: 11, color: '#E05D3A' }}>{row.total_stripe_fee ? fmt(row.total_stripe_fee, row.presentment_currency) : '—'}</TableCell>
                  <TableCell sx={{ fontSize: 11 }}>{row.referral_discount_amount > 0 ? fmt(row.referral_discount_amount, row.presentment_currency) : '—'}</TableCell>
                  <TableCell>
                    <Chip label={row.stripe_balance_transaction_id ? 'Settled' : 'Pending'} size="small"
                      sx={{ fontSize: 10, fontWeight: 600, bgcolor: row.stripe_balance_transaction_id ? '#2A9D8F20' : '#E9C46A20', color: row.stripe_balance_transaction_id ? '#2A9D8F' : '#E9C46A' }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
}
