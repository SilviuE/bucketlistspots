import { Box, Typography } from '@mui/material';
import FAQAccordion from '../shared/FAQAccordion';

const guideFAQs = [
  {
    question: 'Who can apply?',
    answer: 'Legally authorised guides and local operators with proven destination experience, appropriate licensing, responsible working practices and a commitment to traveller safety and transparent service delivery.',
  },
  {
    question: 'What does Trust Gate verify?',
    answer: 'Trust Gate reviews identity, operating licence or authority, relevant qualifications, references, route experience, safety and emergency procedures, insurance documentation, and communication practices. Verification indicates that specified evidence was reviewed — it is not a guarantee that an expedition is risk-free.',
  },
  {
    question: 'Does BucketListSpots employ the guide?',
    answer: 'No. BucketListSpots is a marketplace. The Local Partner is an independent operator who is solely responsible for delivering the expedition, employing crew, and meeting all legal and licensing obligations.',
  },
  {
    question: 'Who operates the expedition?',
    answer: 'The named Local Partner operates and delivers the expedition. BucketListSpots facilitates discovery, booking records and the BLS payment process.',
  },
  {
    question: 'Who sets the Listed Trip Price?',
    answer: 'The Local Partner sets the Listed Trip Price. BucketListSpots does not dictate pricing — the Local Partner remains responsible for setting an economically viable trip price.',
  },
  {
    question: 'How is the 20/80 split calculated?',
    answer: 'The BLS Platform Fee is 20% of the Listed Trip Price. The Local Partner Balance is 80% and is paid directly to the Local Partner. The exact payment schedule is shown before the traveller confirms the booking.',
  },
  {
    question: 'When does the guide receive the Local Partner Balance?',
    answer: 'The Local Partner Balance is paid directly to the Local Partner according to the booking terms. BucketListSpots does not hold the Local Partner Balance after the relevant payment is due.',
  },
  {
    question: 'Does BucketListSpots hold the Local Partner Balance?',
    answer: 'No. The BLS Platform Fee is collected through Stripe. The Local Partner Balance is paid directly to the Local Partner as specified in the booking terms.',
  },
  {
    question: 'Do referral discounts reduce guide earnings?',
    answer: 'No. Traveller referral discounts are funded from the BLS Platform Fee. They never reduce the Local Partner Balance.',
  },
  {
    question: 'What is Standard Guide status?',
    answer: 'All approved guides begin with Standard Guide status, which includes the full toolkit: verified profile, route listings, availability management, booking dashboard, messaging, reviews and Trust Gate status.',
  },
  {
    question: 'How can a guide apply for an upgrade?',
    answer: 'Eligible guides may apply for an upgraded status based on documented experience, qualifications, traveller feedback, operational standards and platform performance. Upgrades are not automatic.',
  },
  {
    question: 'What happens after the first six months?',
    answer: 'After the Founding Guide promotional period, guide participation will follow the BucketListSpots Fair Access Programme, using Global Pricing Zones based on local economic conditions. Pricing will be communicated before the Founding Guide period ends.',
  },
  {
    question: 'What are Global Pricing Zones?',
    answer: 'Global Pricing Zones are a fair-access pricing model that adjusts guide participation terms based on local economic conditions. Three zones (A, B, C) will apply after the promotional period. Specific pricing has not yet been published.',
  },
  {
    question: 'Is the guide exclusive to BucketListSpots?',
    answer: 'No. Guides are free to list on other platforms and operate independently. BucketListSpots does not require exclusivity.',
  },
  {
    question: 'Who is responsible for licences, permits, taxes and insurance?',
    answer: 'The Local Partner is solely responsible for all licences, permits, local taxes, park charges, insurance, staff payments and legal obligations related to operating the expedition.',
  },
  {
    question: 'Can BucketListSpots suspend or remove a profile?',
    answer: 'Yes. BucketListSpots reserves the right to suspend or remove profiles that violate the Local Partner Agreement, fail to meet ongoing requirements, or receive substantiated complaints. The applicable terms govern the process.',
  },
];

export default function GuideFAQ() {
  return (
    <Box sx={{ px: { xs: 2.5, md: 6 }, py: { xs: 4, md: 6 } }}>
      <Typography variant="h2" sx={{ mb: 3 }}>Frequently asked questions</Typography>
      <FAQAccordion faqs={guideFAQs} />
    </Box>
  );
}
