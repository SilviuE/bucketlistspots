import { Box, Typography, Paper } from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import LanguageIcon from '@mui/icons-material/Language';
import { formatGuidePrice, getStoredCurrency } from '../lib/currency';

// Shows the disclosed 80/20 allocation of the trip price (DECISION-009).
// No "savings vs agency" comparisons are shown (DECISION-010).
export default function ImpactCalculator({ guidePrice }) {
  const currency = getStoredCurrency();
  const price = Number(guidePrice) || 0;
  const local = Math.round(price * 0.8);
  const platform = price - local;

  return (
    <Paper elevation={0} sx={{ p: 2, bgcolor: '#E9D8A6', borderRadius: 3, border: '1px solid rgba(16,42,67,0.08)' }}>
      <Typography variant="body2" fontWeight={700} color="text.primary" gutterBottom>
        Where your money goes
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
        <Box sx={{ flex: 1, textAlign: 'center', p: 1.5, bgcolor: '#FFFFFF', borderRadius: 2 }}>
          <AccountBalanceIcon sx={{ color: '#2A9D8F', fontSize: 28 }} />
          <Typography variant="h3" fontWeight={800} sx={{ mt: 0.5 }}>
            {price ? formatGuidePrice(local, currency) : '80%+'}
          </Typography>
          <Typography variant="caption" fontWeight={600} color="text.secondary">
            At least 80% to the local operator
          </Typography>
        </Box>
        <Box sx={{ flex: 1, textAlign: 'center', p: 1.5, bgcolor: '#FFFFFF', borderRadius: 2 }}>
          <LanguageIcon sx={{ color: '#102A43', fontSize: 28 }} />
          <Typography variant="h3" fontWeight={800} sx={{ mt: 0.5 }}>
            {price ? formatGuidePrice(platform, currency) : '≤20%'}
          </Typography>
          <Typography variant="caption" fontWeight={600} color="text.secondary">
            Max 20% platform fee
          </Typography>
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
        Based on the lowest listed trip price. The operator pays its own crew, park fees and permits from its share.
      </Typography>
    </Paper>
  );
}
