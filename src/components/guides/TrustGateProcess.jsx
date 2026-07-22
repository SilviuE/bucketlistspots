import { Box, Typography, Paper, Stepper, Step, StepLabel, StepContent } from '@mui/material';
import { useEffect, useState } from 'react';

const defaultChecks = [
  { key: 'identity', label: 'Identity Review', description: 'BLS confirms the identity of the applicant.' },
  { key: 'licence', label: 'Licence and Documentation', description: 'Relevant operating documents are reviewed according to the destination.' },
  { key: 'references', label: 'Experience and References', description: 'Route experience, references and supporting evidence are assessed.' },
  { key: 'interview', label: 'Safety and Operational Interview', description: 'Guide explains emergency procedures, communication practices and operating standards.' },
  { key: 'approval', label: 'Profile Approval', description: 'Approved information is published with a verification date.' },
];

export default function TrustGateProcess() {
  const [checks, setChecks] = useState(defaultChecks);

  useEffect(() => {
    const apiBase = window.location.hostname === 'localhost'
      ? 'http://localhost:3002'
      : '';
    fetch(`${apiBase}/api/public-platform-settings`)
      .then(r => r.json())
      .then(data => {
        if (data.trustGateChecks && data.trustGateChecks.length) {
          setChecks(data.trustGateChecks);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <Box>
      <Stepper orientation="vertical" activeStep={-1}>
        {checks.map((check) => (
          <Step key={check.key} expanded>
            <StepLabel
              sx={{
                '& .MuiStepLabel-label': { fontWeight: 700, fontSize: '14px' },
                '& .MuiStepIcon-root': { color: '#2A9D8F' },
              }}
            >
              {check.label}
            </StepLabel>
            <StepContent sx={{ borderLeft: '2px solid #2A9D8F', ml: 1.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ py: 0.5 }}>
                {check.description}
              </Typography>
            </StepContent>
          </Step>
        ))}
      </Stepper>

      <Paper elevation={0} sx={{ mt: 2, p: 1.5, bgcolor: '#F4F5F7', borderRadius: 2 }}>
        <Typography variant="caption" fontWeight={600} display="block" mb={0.5}>Example verification display:</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {checks.map(c => (
            <Typography key={c.key} variant="caption" sx={{ bgcolor: '#E8F5E9', color: '#2E7D32', px: 1, py: 0.25, borderRadius: 1 }}>
              {c.label}: Verified
            </Typography>
          ))}
        </Box>
      </Paper>
    </Box>
  );
}
