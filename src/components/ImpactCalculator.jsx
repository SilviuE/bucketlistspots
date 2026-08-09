import { Box, Typography, Paper } from '@mui/material';
import SavingsIcon from '@mui/icons-material/Savings';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { formatGuidePrice, getStoredCurrency } from '../lib/currency';

export default function ImpactCalculator({ guidePrice, agencyPrice, priceCurrency }) {
  const currency = getStoredCurrency();
  const hasAgency = agencyPrice > 0;
  const savings = hasAgency ? (agencyPrice - guidePrice) : null;
  const percentSavings = hasAgency ? Math.round((1 - guidePrice / agencyPrice) * 100) : null;
  const localRetention = guidePrice * 0.75;

  return (
    <Paper elevation={0} sx={{ p: 2, bgcolor: '#E9D8A6', borderRadius: 3, border: '1px solid rgba(16,42,67,0.08)' }}>
      <Typography variant="body2" fontWeight={700} color="text.primary" gutterBottom>
        Where Your Money Goes
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
        <Box sx={{ flex: 1, textAlign: 'center', p: 1.5, bgcolor: '#FFFFFF', borderRadius: 2 }}>
          <SavingsIcon sx={{ color: '#2A9D8F', fontSize: 28 }} />
          <Typography variant="h3" fontWeight={800} sx={{ mt: 0.5 }}>
            {formatGuidePrice(guidePrice, priceCurrency, currency)}
          </Typography>
          {hasAgency && (
            <Typography variant="caption" fontWeight={600} color="text.secondary">
              You save ({percentSavings}%)
            </Typography>
          )}
        </Box>
        <Box sx={{ flex: 1, textAlign: 'center', p: 1.5, bgcolor: '#FFFFFF', borderRadius: 2 }}>
          <AccountBalanceIcon sx={{ color: '#102A43', fontSize: 28 }} />
          <Typography variant="h3" fontWeight={800} sx={{ mt: 0.5 }}>
            {formatGuidePrice(localRetention, priceCurrency, currency)}
          </Typography>
          <Typography variant="caption" fontWeight={600} color="text.secondary">
            Stays in local economy
          </Typography>
        </Box>
      </Box>
      {hasAgency && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
          By booking direct, an extra {formatGuidePrice(savings, priceCurrency, currency)} stays with the guide's community vs. a standard agency.
        </Typography>
      )}
    </Paper>
  );
}
