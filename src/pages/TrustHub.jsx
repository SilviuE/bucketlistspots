import { Box, Container, Typography, Paper } from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';
import GppGoodIcon from '@mui/icons-material/GppGood';
import PaymentIcon from '@mui/icons-material/Payment';
import PeopleIcon from '@mui/icons-material/People';
import TrustBadge from '../components/TrustBadge';
import VerificationChecklist from '../components/VerificationChecklist';
import guides from '../data/guides';

const values = [
  {
    icon: VerifiedIcon,
    title: 'Verified Local Guides',
    desc: 'Every guide on our platform passes our rigorous 5-step Trust Gate verification process.',
  },
  {
    icon: GppGoodIcon,
    title: 'Secure Payments',
    desc: 'Your deposit is processed securely via Stripe. The balance is paid directly to your guide.',
  },
  {
    icon: PeopleIcon,
    title: 'Direct Booking Model',
    desc: 'We connect you directly with the guide. No hidden layers of middlemen inflating prices.',
  },
  {
    icon: PaymentIcon,
    title: 'Traveler Protection',
    desc: 'As a UK registered company, we provide legal and financial recourse if things go wrong.',
  },
];

export default function TrustHub() {
  return (
    <Container maxWidth="sm" sx={{ px: 2, pt: 2, pb: 4 }}>
      <Typography variant="h1" mb={0.5}>Trust Hub</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        How we ensure every adventure is safe, fair, and authentic.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }}>
        {values.map(v => (
          <Paper key={v.title} elevation={0} sx={{ display: 'flex', gap: 2, p: 2, border: '1px solid rgba(16,42,67,0.08)' }}>
            <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: '#102A43', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <v.icon sx={{ color: '#FFFFFF', fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="body2" fontWeight={700}>{v.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>{v.desc}</Typography>
            </Box>
          </Paper>
        ))}
      </Box>

      <Typography variant="h2" mb={2}>Our Verification Process</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        We don't just list guides — we curate local legends. Every "Verified Local" badge is earned through rigorous vetting.
      </Typography>
      <VerificationChecklist />

      <Box sx={{ mt: 4, mb: 3, p: 3, bgcolor: '#102A43', borderRadius: 4, textAlign: 'center' }}>
        <Typography variant="h2" sx={{ color: '#FFFFFF', mb: 1 }}>
          Why Trust Matters
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>
          We are a UK registered company (No. 16595661) bound by UK consumer protection laws, GDPR, and strict data handling standards. Your booking is protected.
        </Typography>
      </Box>

      <Typography variant="h2" mb={2}>Meet Our Verified Guides</Typography>
      <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1, '&::-webkit-scrollbar': { display: 'none' } }}>
        {guides.map(guide => (
          <Box key={guide.id} sx={{ minWidth: 200, p: 1.5, bgcolor: '#FFFFFF', borderRadius: 3, border: '1px solid rgba(16,42,67,0.12)' }}>
            <TrustBadge guide={guide} />
            <Typography variant="body2" fontWeight={700} mt={1}>{guide.name}</Typography>
            <Typography variant="caption" color="text.secondary">{guide.location}</Typography>
          </Box>
        ))}
      </Box>
    </Container>
  );
}
