import { Box, Typography, Alert } from '@mui/material';
import PricingCalculator from '../pricing/PricingCalculator';

export default function GuideFinancialModel() {
  return (
    <Box sx={{ px: { xs: 2.5, md: 6 }, py: { xs: 4, md: 6 } }} id="financial-model">
      <Typography variant="h2" sx={{ mb: 1 }}>Transparent earnings on every booking</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 640, lineHeight: 1.7 }}>
        The Listed Trip Price is divided into two clearly identified amounts:
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5, mb: 3 }}>
        <Box sx={{ p: 2, bgcolor: '#FFF5F2', borderRadius: 2, textAlign: 'center' }}>
          <Typography variant="h3" sx={{ color: '#E05D3A', mb: 0.5 }}>20%</Typography>
          <Typography variant="caption" fontWeight={700}>BLS Platform Fee</Typography>
        </Box>
        <Box sx={{ p: 2, bgcolor: '#F0FAF8', borderRadius: 2, textAlign: 'center' }}>
          <Typography variant="h3" sx={{ color: '#2A9D8F', mb: 0.5 }}>80%</Typography>
          <Typography variant="caption" fontWeight={700}>Local Partner Balance — paid directly to you</Typography>
        </Box>
      </Box>

      <PricingCalculator initialPrice={2500} initialCurrency="gbp" />

      <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
        <Typography variant="caption" fontWeight={700}>Mandatory disclosure: </Typography>
        <Typography variant="caption">
          Traveller referral discounts are funded from the BLS Platform Fee. They never reduce your Local Partner Balance.
        </Typography>
      </Alert>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 2, lineHeight: 1.7 }}>
        The Local Partner remains responsible for setting an economically viable trip price, operating costs, staff and crew payments, permits, park charges, local taxes, insurance, and legal and licensing obligations. The 80% is the platform payment allocation, not a statement of personal profit.
      </Typography>
    </Box>
  );
}
