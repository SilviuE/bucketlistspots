import { Box, Typography } from '@mui/material';
import GuideApplicationForm from '../applications/GuideApplicationForm';

export default function GuideApplicationSection() {
  return (
    <Box sx={{ px: { xs: 2.5, md: 6 }, py: { xs: 4, md: 6 }, bgcolor: '#F4F5F7' }}>
      <Typography variant="h2" sx={{ mb: 1 }}>Ready to build your direct-booking presence?</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 540 }}>
        Apply to join BucketListSpots as a verified Local Partner. The first application step takes only a few minutes.
      </Typography>
      <GuideApplicationForm />
    </Box>
  );
}
