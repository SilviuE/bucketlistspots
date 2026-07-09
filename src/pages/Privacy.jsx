import { Container, Typography, Paper } from '@mui/material';
import SEO from '../components/SEO';

export default function Privacy() {
  return (
    <Container maxWidth="sm" sx={{ px: 2, pt: 2, pb: 4 }}>
      <SEO title="Privacy Policy" description="Privacy Policy for BucketListSpots.com — how we collect, use, and protect your personal data in compliance with UK GDPR." path="/privacy" />
      <Typography variant="h1" mb={0.5}>Privacy Policy</Typography>
      <Typography variant="caption" color="text.secondary" display="block" mb={3}>Last updated: July 2026</Typography>

      <Paper elevation={0} sx={{ p: 2, border: '1px solid rgba(16,42,67,0.12)', borderRadius: 3, '& p': { fontSize: 13, lineHeight: 1.6, mb: 1.5, color: 'text.secondary' }, '& h2': { fontSize: 15, fontWeight: 700, mt: 2.5, mb: 1, color: 'text.primary' } }}>
        <h2>1. Who We Are</h2>
        <p>BucketListSpots Ltd (Company No. 16595661) operates BucketListSpots.com. We are the data controller for personal information collected through the Platform.</p>

        <h2>2. Information We Collect</h2>
        <p><strong>Account information:</strong> name, email address, phone number, and password when you register.<br />
        <strong>Profile information:</strong> photos, bio, location, languages, certifications, and route details (for Guides).<br />
        <strong>Booking information:</strong> traveler names, contact details, booking dates, and payment confirmations.<br />
        <strong>Technical information:</strong> IP address, browser type, device information, and cookies.<br />
        <strong>Social media handles:</strong> if you apply as an Ambassador.</p>

        <h2>3. How We Use Your Information</h2>
        <p>We use your information to: (a) operate and improve the Platform; (b) facilitate bookings and payments; (c) verify Guide credentials; (d) send booking confirmations and service emails; (e) send marketing communications (with your consent); (f) comply with legal obligations.</p>

        <h2>4. Legal Basis (GDPR)</h2>
        <p>We process your data under the following lawful bases: (a) performance of a contract (to facilitate bookings); (b) legitimate interests (to operate our marketplace); (c) consent (for marketing emails). You may withdraw consent at any time.</p>

        <h2>5. Data Sharing</h2>
        <p>We share information with: (a) Guides — to fulfill bookings (name, contact details, date); (b) Stripe — to process payments (payment data, no full card numbers stored by us); (c) Resend — to send transactional emails. We do not sell your personal data to third parties.</p>

        <h2>6. Data Retention</h2>
        <p>We retain your personal data for as long as your account is active, plus 6 years after account deletion to comply with UK tax and legal obligations. Booking records are retained for 6 years.</p>

        <h2>7. Your Rights</h2>
        <p>Under UK GDPR, you have the right to: (a) access your personal data; (b) correct inaccurate data; (c) delete your data; (d) restrict processing; (e) data portability; (f) object to processing. To exercise these rights, email hello@bucketlistspots.com. We will respond within 30 days.</p>

        <h2>8. Cookies</h2>
        <p>We use essential cookies for authentication and platform functionality. We use analytics cookies (via Netlify) to understand usage patterns. You can control cookies through your browser settings.</p>

        <h2>9. Security</h2>
        <p>We implement industry-standard security measures including HTTPS encryption, secure password hashing, and regular security audits. Payment processing is handled entirely by Stripe, which is PCI DSS Level 1 compliant.</p>

        <h2>10. International Transfers</h2>
        <p>Your data may be transferred to and processed in countries outside the UK (including the US, where our hosting providers are based). We ensure appropriate safeguards are in place through Standard Contractual Clauses.</p>

        <h2>11. Third-Party Links</h2>
        <p>The Platform may contain links to third-party websites (e.g., TripAdvisor, Instagram). We are not responsible for their privacy practices. We encourage you to read their privacy policies.</p>

        <h2>12. Changes to This Policy</h2>
        <p>We may update this Privacy Policy. Material changes will be notified via email or a notice on the Platform.</p>

        <h2>13. Contact</h2>
        <p>For privacy inquiries, contact:<br />
        BucketListSpots Ltd<br />
        Email: hello@bucketlistspots.com<br />
        Company No. 16595661</p>
      </Paper>
    </Container>
  );
}
