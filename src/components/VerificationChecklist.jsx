import { Box, Typography, Paper, Stepper, Step, StepLabel } from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';
import GppGoodIcon from '@mui/icons-material/GppGood';
import SchoolIcon from '@mui/icons-material/School';
import BalanceIcon from '@mui/icons-material/Balance';
import ConnectWithoutContactIcon from '@mui/icons-material/ConnectWithoutContact';

const steps = [
  { label: 'Legal & Government Licensing', icon: GppGoodIcon, desc: 'We verify active operating licenses from national tourism authorities.' },
  { label: 'Safety & First Aid Certified', icon: VerifiedIcon, desc: 'Guides must hold current Wilderness First Aid or WFR certification.' },
  { label: 'Experience & Specialized Knowledge', icon: SchoolIcon, desc: 'We confirm route-specific experience and technical competence.' },
  { label: 'Ethical & Fair Trade Alignment', icon: BalanceIcon, desc: 'Committed to porter welfare standards and fair wages.' },
  { label: 'Technology & Communication Check', icon: ConnectWithoutContactIcon, desc: 'Tested for prompt communication and secure payment readiness.' },
];

function CustomStepIcon({ active, completed, icon: IconComponent }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', bgcolor: active || completed ? '#2A9D8F' : 'rgba(16,42,67,0.08)', color: '#FFFFFF' }}>
      <IconComponent sx={{ fontSize: 18 }} />
    </Box>
  );
}

export default function VerificationChecklist() {
  return (
    <Box sx={{ maxWidth: 600, mx: 'auto' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {steps.map((step, idx) => (
          <Paper key={step.label} elevation={0} sx={{ display: 'flex', gap: 2, p: 2, border: '1px solid rgba(16,42,67,0.08)' }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#2A9D8F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <step.icon sx={{ color: '#FFFFFF', fontSize: 20 }} />
            </Box>
            <Box>
              <Typography variant="body2" fontWeight={700}>Step {idx + 1}: {step.label}</Typography>
              <Typography variant="caption" color="text.secondary">{step.desc}</Typography>
            </Box>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
