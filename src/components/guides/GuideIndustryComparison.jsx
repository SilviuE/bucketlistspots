import { Box, Typography } from '@mui/material';
import ComparisonTable from '../shared/ComparisonTable';

const comparisonRows = [
  { before: 'Traveller may not know the operating guide', after: 'Named Local Partner shown before booking' },
  { before: 'Payment allocation may be unclear', after: 'BLS and Local Partner amounts shown separately' },
  { before: 'Customer relationship controlled by several intermediaries', after: 'Direct platform communication with the Local Partner' },
  { before: 'Local operator payment may be delayed', after: 'Local Partner Balance paid directly according to the booking terms' },
  { before: 'Limited independent digital presence', after: 'Professional public profile and route pages' },
  { before: 'Verification information may be hidden', after: 'Trust Gate checks displayed clearly' },
];

export default function GuideIndustryComparison() {
  return (
    <Box sx={{ px: { xs: 2.5, md: 6 }, py: { xs: 4, md: 6 }, bgcolor: '#F4F5F7' }}>
      <Typography variant="h2" sx={{ mb: 3 }}>Great local operators deserve direct access to international travellers</Typography>
      <ComparisonTable rows={comparisonRows} beforeLabel="Indirect booking structure" afterLabel="BucketListSpots structure" />
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block', fontStyle: 'italic' }}>
        The precise responsibilities and payment arrangements are shown before the traveller confirms the booking.
      </Typography>
    </Box>
  );
}
