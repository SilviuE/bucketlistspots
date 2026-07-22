import { Box, Typography, Paper } from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import RouteIcon from '@mui/icons-material/Route';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ForumIcon from '@mui/icons-material/Forum';
import StarIcon from '@mui/icons-material/Star';
import PaymentIcon from '@mui/icons-material/Payment';
import CampaignIcon from '@mui/icons-material/Campaign';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import VerifiedIcon from '@mui/icons-material/Verified';
import RateReviewIcon from '@mui/icons-material/RateReview';
import CodeIcon from '@mui/icons-material/Code';

const toolkit = [
  { icon: <PublicIcon />, label: 'Verified public profile', desc: 'Shown to travellers worldwide' },
  { icon: <MenuBookIcon />, label: 'Guide biography and credentials', desc: 'Your experience, your story' },
  { icon: <RouteIcon />, label: 'Route and experience listings', desc: 'Detailed expedition pages' },
  { icon: <CalendarMonthIcon />, label: 'Availability management', desc: 'Control your schedule' },
  { icon: <ForumIcon />, label: 'Booking enquiries and traveller messaging', desc: 'Direct communication' },
  { icon: <AnalyticsIcon />, label: 'Booking dashboard', desc: 'Manage all your bookings' },
  { icon: <RateReviewIcon />, label: 'Review collection', desc: 'Build your reputation' },
  { icon: <CodeIcon />, label: 'Referral code where eligible', desc: 'Share and earn rewards' },
  { icon: <PublicIcon />, label: 'Destination visibility', desc: 'Appear in search results' },
  { icon: <VerifiedIcon />, label: 'Trust Gate status', desc: 'Verification displayed on profile' },
  { icon: <PaymentIcon />, label: 'Booking and payment records', desc: 'Full transaction history' },
  { icon: <MenuBookIcon />, label: 'BLS guidance and onboarding', desc: 'Support materials and training' },
];

export default function StandardGuideToolkit() {
  return (
    <Box sx={{ px: { xs: 2.5, md: 6 }, py: { xs: 4, md: 6 }, bgcolor: '#F4F5F7' }}>
      <Typography variant="h2" sx={{ mb: 1 }}>Your Standard Guide toolkit</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        All approved guides begin with Standard Guide status. Standard access includes:
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 1.5 }}>
        {toolkit.map((item, i) => (
          <Paper key={i} elevation={0} sx={{ p: 2, display: 'flex', gap: 1.5, alignItems: 'flex-start', border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
            <Box sx={{ color: '#2A9D8F', mt: 0.25 }}>{item.icon}</Box>
            <Box>
              <Typography variant="caption" fontWeight={700} display="block">{item.label}</Typography>
              <Typography variant="caption" color="text.secondary">{item.desc}</Typography>
            </Box>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
