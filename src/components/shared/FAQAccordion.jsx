import { useState } from 'react';
import { Box, Typography, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

export default function FAQAccordion({ faqs = [], title }) {
  const [expanded, setExpanded] = useState(null);

  const handleChange = (panel) => (_, isExpanded) => {
    setExpanded(isExpanded ? panel : null);
  };

  if (!faqs.length) return null;

  return (
    <Box>
      {title && (
        <Typography variant="h2" sx={{ mb: 2 }}>{title}</Typography>
      )}
      {faqs.map((faq, i) => (
        <Accordion
          key={i}
          expanded={expanded === `panel${i}`}
          onChange={handleChange(`panel${i}`)}
          disableGutters
          elevation={0}
          sx={{
            border: '1px solid rgba(16,42,67,0.12)',
            borderRadius: '12px !important',
            mb: 1,
            '&::before': { display: 'none' },
            '&.Mui-expanded': { margin: 0 },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon sx={{ color: '#2A9D8F' }} />}
            sx={{
              px: 2, py: 1,
              '& .MuiAccordionSummary-content': { my: 0.5 },
              '&.Mui-expanded': { minHeight: 48 },
            }}
          >
            <Typography variant="body2" fontWeight={700}>{faq.question}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
              {faq.answer}
            </Typography>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}
