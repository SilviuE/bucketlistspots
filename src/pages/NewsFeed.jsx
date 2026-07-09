import { Box, Container, Typography, Chip } from '@mui/material';
import SEO from '../components/SEO';
import UpdateFeed from '../components/UpdateFeed';

const roleColors = { guide: '#2A9D8F', ambassador: '#E9C46A' };

export default function NewsFeed() {
  return (
    <Container maxWidth="sm" sx={{ px: 2, pt: 2, pb: 4 }}>
      <SEO title="News & Updates" description="Latest news and updates from guides and ambassadors on BucketListSpots." path="/news" />
      <Typography variant="h1" sx={{ fontSize: '22px', mb: 0.5 }}>News & Updates</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Latest from our guides and ambassadors
      </Typography>
      <UpdateFeed />
    </Container>
  );
}