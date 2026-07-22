import { Box, Typography, Paper } from '@mui/material';
import AppRegistrationIcon from '@mui/icons-material/AppRegistration';
import BadgeIcon from '@mui/icons-material/Badge';
import FolderIcon from '@mui/icons-material/Folder';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import MapIcon from '@mui/icons-material/Map';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import PaidIcon from '@mui/icons-material/Paid';

const steps = [
  { icon: <AppRegistrationIcon />, label: 'Create a Local Partner account', desc: 'Sign up with your email and basic details.' },
  { icon: <BadgeIcon />, label: 'Submit the initial application', desc: 'Tell us about your experience and operations.' },
  { icon: <FolderIcon />, label: 'Upload requested documentation', desc: 'Licence, insurance, certifications and references.' },
  { icon: <VideoCallIcon />, label: 'Complete the Trust Gate interview', desc: 'A structured conversation about safety and operations.' },
  { icon: <CheckCircleIcon />, label: 'Review and approve your public profile', desc: 'Check everything is accurate before going live.' },
  { icon: <MapIcon />, label: 'Add routes, prices and availability', desc: 'List your expeditions with detailed information.' },
  { icon: <ChatBubbleIcon />, label: 'Receive traveller enquiries and bookings', desc: 'Communicate directly and manage your calendar.' },
  { icon: <PaidIcon />, label: 'Deliver the expedition and collect payment', desc: 'The Local Partner Balance is paid directly to you.' },
];

export default function GuideJoiningTimeline() {
  return (
    <Box sx={{ px: { xs: 2.5, md: 6 }, py: { xs: 4, md: 6 }, bgcolor: '#F4F5F7' }}>
      <Typography variant="h2" sx={{ mb: 3 }}>From application to your first booking</Typography>

      <Box sx={{ position: 'relative' }}>
        {/* Vertical line */}
        <Box sx={{ position: 'absolute', left: { xs: 19, md: 23 }, top: 0, bottom: 0, width: 2, bgcolor: '#2A9D8F', opacity: 0.3 }} />

        {steps.map((step, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 2, mb: 2, position: 'relative' }}>
            <Paper
              elevation={0}
              sx={{
                width: { xs: 40, md: 48 }, height: { xs: 40, md: 48 }, borderRadius: '50%',
                bgcolor: '#2A9D8F', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, zIndex: 1, fontWeight: 700, fontSize: '14px',
              }}
            >
              {i + 1}
            </Paper>
            <Paper elevation={0} sx={{ p: 1.5, flex: 1, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Box sx={{ color: '#2A9D8F', mt: 0.25, display: { xs: 'none', sm: 'block' } }}>{step.icon}</Box>
              <Box>
                <Typography variant="body2" fontWeight={700}>{step.label}</Typography>
                <Typography variant="caption" color="text.secondary">{step.desc}</Typography>
              </Box>
            </Paper>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
