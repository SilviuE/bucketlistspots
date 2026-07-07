import { Box, Container, Typography, Button, Paper, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WebIcon from '@mui/icons-material/Web';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PaymentsIcon from '@mui/icons-material/Payments';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import VerifiedIcon from '@mui/icons-material/Verified';

const benefits = [
  { icon: WebIcon, title: 'Professional Website', desc: 'Get a beautiful, mobile-optimized website with booking engine included.' },
  { icon: TrendingUpIcon, title: 'Global Visibility', desc: 'Appear in our curated marketplace and reach travelers from 50+ countries.' },
  { icon: PaymentsIcon, title: 'Secure Payments', desc: 'Accept credit card deposits easily. We handle the tech; you keep the balance.' },
  { icon: SupportAgentIcon, title: 'Business Tools', desc: 'Availability calendar, pricing intelligence, and training to grow your business.' },
  { icon: VerifiedIcon, title: 'Trust Badge', desc: 'Our "Verified Local" badge proves your credentials to nervous Western travelers.' },
];

export default function ForGuides() {
  return (
    <Box sx={{ bgcolor: '#102A43', minHeight: '100vh', pb: 4 }}>
      <Container maxWidth="sm" sx={{ px: 2, pt: 4 }}>
        <Typography
          variant="h1"
          sx={{ color: '#FFFFFF', mb: 1, fontSize: { xs: '26px', sm: '32px' } }}
        >
          Take Control of Your Expeditions.
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 16, mb: 3 }}>
          Keep 100% of your local rate. We just help you get found.
        </Typography>

        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3, border: '2px solid #2A9D8F', background: 'linear-gradient(135deg, #FFFFFF 0%, #f0faf8 100%)' }}>
          <Typography variant="h2" sx={{ color: '#2A9D8F', mb: 0.5 }}>
            Founding Member Offer
          </Typography>
          <Typography variant="body1" fontWeight={700} mb={1}>
            Free Enrollment — First 3 Months
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            No setup fee. No monthly charge for your first 3 months. Pay only the 20% commission when you get booked.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            size="large"
            fullWidth
            href="mailto:hello@bucketlistspots.com?subject=Founding%20Guide%20Application"
          >
            Apply for Verification
          </Button>
        </Paper>

        <Typography variant="h2" sx={{ color: '#FFFFFF', mb: 2 }}>What You Get</Typography>
        <Paper elevation={0} sx={{ p: 2, borderRadius: 3, mb: 3, bgcolor: 'rgba(255,255,255,0.95)' }}>
          <List disablePadding>
            {benefits.map((b, idx) => (
              <ListItem key={b.title} disableGutters sx={{ borderBottom: idx < benefits.length - 1 ? '1px solid rgba(16,42,67,0.06)' : 'none', py: 1 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <b.icon sx={{ color: '#2A9D8F', fontSize: 24 }} />
                </ListItemIcon>
                <ListItemText
                  primary={<Typography variant="body2" fontWeight={700}>{b.title}</Typography>}
                  secondary={<Typography variant="caption" color="text.secondary">{b.desc}</Typography>}
                />
              </ListItem>
            ))}
          </List>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, borderRadius: 3, mb: 3, bgcolor: 'rgba(255,255,255,0.95)' }}>
          <Typography variant="body2" fontWeight={700} mb={1}>How It Works</Typography>
          {[
            'Apply: Fill out our short application form.',
            'Verify: We check your license, ID, and safety certifications.',
            'Profile: We build your professional listing (you just send photos).',
            'Get Booked: Travelers find you on BucketListSpots.com.',
            'Get Paid: We take 20% deposit. You keep 80% balance directly.',
          ].map((step, idx) => (
            <Box key={idx} sx={{ display: 'flex', gap: 1.5, py: 0.8, alignItems: 'flex-start' }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: '#2A9D8F', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700 }}>
                {idx + 1}
              </Box>
              <Typography variant="body2" color="text.secondary">{step}</Typography>
            </Box>
          ))}
        </Paper>

        <Paper elevation={0} sx={{ p: 2, borderRadius: 3, mb: 3, bgcolor: 'rgba(255,255,255,0.95)' }}>
          <Typography variant="body2" fontWeight={700} mb={1}>Pricing</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1, p: 1.5, bgcolor: '#F4F5F7', borderRadius: 2, textAlign: 'center' }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary">Standard</Typography>
              <Typography variant="h3" fontWeight={800}>Free</Typography>
              <Typography variant="caption" color="text.secondary">first 3 months</Typography>
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                Then £15/yr + 20% commission
              </Typography>
            </Box>
            <Box sx={{ flex: 1, p: 1.5, bgcolor: '#e8f5f3', borderRadius: 2, textAlign: 'center', border: '1px solid #2A9D8F' }}>
              <Typography variant="caption" fontWeight={700} sx={{ color: '#2A9D8F' }}>Premium</Typography>
              <Typography variant="h3" fontWeight={800}>Free</Typography>
              <Typography variant="caption" color="text.secondary">first 3 months</Typography>
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                Then £30/yr + 15% commission*
              </Typography>
            </Box>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
            *Premium rate requires 4.8+ star rating and 3+ bookings/quarter.
          </Typography>
        </Paper>

        <Button
          variant="contained"
          color="primary"
          size="large"
          fullWidth
          href="mailto:hello@bucketlistspots.com?subject=Founding%20Guide%20Application"
          sx={{ mb: 2 }}
        >
          Apply for Verification
        </Button>

        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block', textAlign: 'center' }}>
          BucketListSpots Ltd · Company No. 16595661
        </Typography>
      </Container>
    </Box>
  );
}
