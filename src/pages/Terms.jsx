import { Container, Typography, Paper } from '@mui/material';
import SEO from '../components/SEO';

export default function Terms() {
  return (
    <Container maxWidth="sm" sx={{ px: 2, pt: 2, pb: 4 }}>
      <SEO title="Terms of Service" description="Terms of Service for BucketListSpots.com operated by BucketListSpots Ltd (Company No. 16595661)." path="/terms" />
      <Typography variant="h1" mb={0.5}>Terms of Service</Typography>
      <Typography variant="caption" color="text.secondary" display="block" mb={3}>Last updated: July 2026</Typography>

      <Paper elevation={0} sx={{ p: 2, border: '1px solid rgba(16,42,67,0.12)', borderRadius: 3, '& p': { fontSize: 13, lineHeight: 1.6, mb: 1.5, color: 'text.secondary' }, '& h2': { fontSize: 15, fontWeight: 700, mt: 2.5, mb: 1, color: 'text.primary' } }}>
        <h2>1. Introduction</h2>
        <p>Welcome to BucketListSpots.com (the "Platform"), operated by BucketListSpots Ltd (Company No. 16595661), a company registered in England and Wales. By accessing or using the Platform, you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Platform.</p>

        <h2>2. Definitions</h2>
        <p>"Guide" means a local tour or experience provider who lists services on the Platform. "Traveler" means a user who books a Guide's services. "Platform" means BucketListSpots.com and all related services. "Content" means all text, images, and materials submitted by users.</p>

        <h2>3. Accounts</h2>
        <p>You must be 18 or older to create an account. You are responsible for maintaining the confidentiality of your login credentials. You agree to provide accurate, current information and to update it as needed.</p>

        <h2>4. Guide Listings & Bookings</h2>
        <p>Guides are independent operators, not employees or contractors of BucketListSpots Ltd. We verify identity, licensing, and safety credentials but make no guarantees about the quality of any Guide's service. Travelers book directly with Guides. BucketListSpots facilitates the deposit payment and connection.</p>

        <h2>5. Payments</h2>
        <p>Travelers pay a 20% non-refundable deposit at booking via Stripe. This deposit serves as BucketListSpots' commission. The remaining 80% balance is paid directly to the Guide by the Traveler. All payments are processed securely by Stripe. We do not store full credit card details.</p>

        <h2>6. Cancellations & Refunds</h2>
        <p>Cancellation policies are set by each Guide and displayed on their profile. If a Guide cancels, the Traveler is entitled to a full refund of the deposit. If a Traveler cancels, the deposit is non-refundable unless otherwise stated by the Guide. Disputes should first be raised with the Guide. If unresolved, contact hello@bucketlistspots.com.</p>

        <h2>7. User Conduct</h2>
        <p>You agree not to: (a) use the Platform for any unlawful purpose; (b) harass, abuse, or harm others; (c) submit false or misleading information; (d) attempt to circumvent our payment system; (e) scrape or reproduce Platform content without permission.</p>

        <h2>8. Intellectual Property</h2>
        <p>The BucketListSpots name, logo, and design are trademarks of BucketListSpots Ltd. Content submitted by Guides (photos, text) remains their property. By submitting content, you grant us a license to display it on the Platform.</p>

        <h2>9. Limitation of Liability</h2>
        <p>BucketListSpots Ltd acts as a marketplace intermediary. We are not liable for: (a) the conduct of any Guide or Traveler; (b) accidents, injuries, or losses during booked experiences; (c) indirect or consequential damages. Our total liability is limited to the deposit amount paid.</p>

        <h2>10. Termination</h2>
        <p>We reserve the right to suspend or terminate accounts that violate these Terms, at our sole discretion. You may delete your account at any time by contacting us.</p>

        <h2>11. Changes to Terms</h2>
        <p>We may update these Terms at any time. Material changes will be notified via email or a notice on the Platform. Continued use after changes constitutes acceptance.</p>

        <h2>12. Governing Law</h2>
        <p>These Terms are governed by the laws of England and Wales. Any disputes shall be resolved in the courts of England and Wales.</p>

        <h2>13. Contact</h2>
        <p>BucketListSpots Ltd<br />Email: hello@bucketlistspots.com<br />Company No. 16595661</p>
      </Paper>
    </Container>
  );
}
