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

        <h2>2. Our Role — Booking Agent (Not Organizer)</h2>
        <p>BucketListSpots Ltd acts <strong>solely as a disclosed booking agent</strong> under the Package Travel and Linked Travel Arrangements Regulations 2018 (PTR). We are <strong>not</strong> the organizer, supplier, or principal of any trip, trek, or experience listed on the Platform.</p>
        <p>Your contract for the delivery of any trip is directly with the independent Guide (the "Supplier"). BucketListSpots Ltd facilitates the discovery, booking connection, and deposit payment process but is not a party to the contract between you and the Guide.</p>
        <p>We do <strong>not</strong> sell or bundle international flights. Any flight arrangements are made independently by the Traveler and are not part of any booking made through the Platform.</p>

        <h2>3. Definitions</h2>
        <p>"Guide" means a local tour or experience provider who lists services on the Platform. "Traveler" means a user who books a Guide's services. "Platform" means BucketListSpots.com and all related services. "Content" means all text, images, and materials submitted by users.</p>

        <h2>4. Accounts</h2>
        <p>You must be 18 or older to create an account. You are responsible for maintaining the confidentiality of your login credentials. You agree to provide accurate, current information and to update it as needed.</p>

        <h2>5. Guide Listings & Bookings</h2>
        <p>Guides are independent operators, not employees or contractors of BucketListSpots Ltd. We verify identity, licensing, and safety credentials but make no guarantees about the quality of any Guide's service. Travelers book directly with Guides. BucketListSpots facilitates the deposit payment and connection.</p>

        <h2>6. Payments</h2>
        <p>Travelers pay a 20% non-refundable deposit at booking via Stripe. This deposit serves as BucketListSpots' commission. The remaining 80% balance is paid directly to the Guide by the Traveler. All payments are processed securely by Stripe. We do not store full credit card details.</p>
        <p>BucketListSpots Ltd does <strong>not</strong> hold or process the full trip balance. The 80% balance is the Guide's responsibility to collect directly from the Traveler.</p>

        <h2>7. Cancellations & Refunds</h2>
        <p>Cancellation policies are set by each Guide and displayed on their profile. If a Guide cancels, the Traveler is entitled to a full refund of the deposit. If a Traveler cancels, the deposit is non-refundable unless otherwise stated by the Guide. Disputes should first be raised with the Guide. If unresolved, contact hello@bucketlistspots.com.</p>

        <h2>8. Travel Insurance — Mandatory</h2>
        <p>You are <strong>required</strong> to arrange adequate travel insurance that covers high-altitude trekking (up to 6,000m), medical evacuation, and trip cancellation. BucketListSpots Ltd is <strong>not</strong> authorized or regulated by the Financial Conduct Authority (FCA) to provide financial advice or recommend specific insurance products. Any insurance links or provider names on the Platform are provided for informational purposes only ("signposting") and do not constitute advice or a recommendation.</p>
        <p>It is your sole responsibility to verify that any insurance policy you purchase is suitable for your specific trip and needs.</p>

        <h2>9. Medical Disclaimer</h2>
        <p>Content on this Platform is for general information purposes only. BucketListSpots Ltd does not provide medical advice. You should consult a qualified medical professional before undertaking any high-altitude trekking or adventure activity. Altitude sickness and other travel-related health risks are serious and can be fatal.</p>

        <h2>10. "Verified" Status</h2>
        <p>The "Verified" badge on a Guide's profile indicates that BucketListSpots Ltd has checked the Guide's identity, licensing, and safety credentials. It does <strong>not</strong> mean that BucketListSpots Ltd supervises the Guide's daily operations, guarantees the quality of their services, or assumes liability for any aspect of the trip.</p>

        <h2>11. User Conduct</h2>
        <p>You agree not to: (a) use the Platform for any unlawful purpose; (b) harass, abuse, or harm others; (c) submit false or misleading information; (d) attempt to circumvent our payment system; (e) scrape or reproduce Platform content without permission.</p>

        <h2>12. Intellectual Property</h2>
        <p>The BucketListSpots name, logo, and design are trademarks of BucketListSpots Ltd. Content submitted by Guides (photos, text) remains their property. By submitting content, you grant us a license to display it on the Platform.</p>

        <h2>13. Third-Party Links & Affiliate Disclosure</h2>
        <p>This Platform contains links to third-party websites and services. Some of these links may be affiliate links, meaning BucketListSpots Ltd may earn a commission if you make a purchase, at no extra cost to you. We have no control over, and assume no responsibility for, the content, privacy policies, or practices of any third-party websites or services.</p>

        <h2>14. Limitation of Liability</h2>
        <p>BucketListSpots Ltd acts as a marketplace intermediary. We are not liable for: (a) the conduct of any Guide or Traveler; (b) accidents, injuries, or losses during booked experiences; (c) indirect or consequential damages. Our total liability is limited to the deposit amount paid.</p>

        <h2>15. Termination</h2>
        <p>We reserve the right to suspend or terminate accounts that violate these Terms, at our sole discretion. You may delete your account at any time by contacting us.</p>

        <h2>16. Changes to Terms</h2>
        <p>We may update these Terms at any time. Material changes will be notified via email or a notice on the Platform. Continued use after changes constitutes acceptance.</p>

        <h2>17. Governing Law</h2>
        <p>These Terms are governed by the laws of England and Wales. Any disputes shall be resolved in the courts of England and Wales.</p>

        <h2>18. Contact</h2>
        <p>BucketListSpots Ltd<br />Email: hello@bucketlistspots.com<br />Company No. 16595661</p>
      </Paper>
    </Container>
  );
}
