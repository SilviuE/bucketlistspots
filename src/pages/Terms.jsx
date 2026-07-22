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

        <h2>5. Guide Listings &amp; Bookings</h2>
        <p>Guides are independent operators, not employees or contractors of BucketListSpots Ltd. We verify identity, licensing, and safety credentials through our Trust Gate process but make no guarantees about the quality of any Guide's service. Travelers book directly with Guides through the Platform. BucketListSpots facilitates the booking connection and collects the Platform Fee. The contract for trip delivery is solely between the Traveler and the Guide.</p>

        <h2>6. Payments</h2>
        <p>BucketListSpots Ltd acts as a booking agent and collects a Platform Fee on behalf of itself. The trip delivery contract is between the Traveler and the Guide. All payment processing is handled securely by Stripe. We do not store full credit card details.</p>

        <p><strong>6.1 Promotional Booking Lock Payment (Payment 1).</strong> During promotional periods, when a Traveler confirms a booking, BucketListSpots collects a fixed Booking Lock Payment of £50, &euro;50, or US$50 (depending on the booking currency). This amount is credited toward the total Platform Fee. The promotional Booking Lock Payment is available only while the promotional period is active, as indicated on the Platform.</p>

        <p><strong>6.2 Platform Fee Balance (Payment 2).</strong> The remaining balance of the Platform Fee (the total Platform Fee minus any Booking Lock Payment already made) is due from the Traveler before the trip departure date. Payment 2 is paid directly to the Guide, who holds it on behalf of BucketListSpots until the trip is completed, at which point it is released to the Guide as their Local Partner Balance. The Platform Fee Balance must be settled before the Guide is obligated to confirm the trip date.</p>

        <p><strong>6.3 Full Platform Fee.</strong> For bookings made outside a promotional period, or where Payment 2 is not received before the departure date, the full Platform Fee (currently 20% of the listed trip price) is due. The Platform Fee percentage is displayed at the time of booking and may change for future bookings.</p>

        <p><strong>6.4 Local Partner Balance.</strong> The Local Partner Balance (currently 80% of the listed trip price) represents the Guide's trip delivery fee. This amount is the Guide's responsibility to collect and is not held or processed by BucketListSpots Ltd. The Guide's obligation to deliver the trip is contractual with the Traveler and is independent of BucketListSpots' role as booking agent.</p>

        <p><strong>6.5 Referral Discounts.</strong> Where a valid referral or Scout code is applied, the discount reduces only the Platform Fee payable to BucketListSpots. Referral discounts do not reduce the Local Partner Balance. Referral discounts are subject to maximum limits displayed at the time of booking.</p>

        <p><strong>6.6 Currency.</strong> All amounts are displayed and charged in the currency shown at the time of booking (GBP, EUR, or USD). BucketListSpots is not responsible for exchange rate fluctuations between the booking currency and the currency in which the Guide receives payment.</p>

        <h2>7. Cancellations, Refunds &amp; Grace Period</h2>

        <p><strong>7.1 48-Hour Voluntary Grace Period.</strong> A Traveler may cancel a booking within 48 hours of the initial Booking Lock Payment and receive a full refund of the Booking Lock Payment, provided the trip departure date is more than 30 days away. Cancellation requests must be submitted through the Platform or by contacting hello@bucketlistspots.com. After the 48-hour grace period, the Booking Lock Payment is non-refundable.</p>

        <p><strong>7.2 Traveler Cancellation (After Grace Period).</strong> If a Traveler cancels after the 48-hour grace period, the Booking Lock Payment is non-refundable. Any Payment 2 amounts already made will be refunded in full. The Guide is not obligated to refund any amounts collected directly for trip services (e.g., park fees, permits) once those have been committed.</p>

        <p><strong>7.3 Guide Cancellation.</strong> If a Guide cancels a confirmed trip, the Traveler is entitled to a full refund of all amounts paid through the Platform, including the Booking Lock Payment and any Payment 2 amounts. The Guide may also be liable for reasonable, documented, direct costs incurred by the Traveler as a result of the cancellation (e.g., non-refundable flights), up to a maximum of the total trip price listed on the Platform.</p>

        <p><strong>7.4 Force Majeure.</strong> Neither party shall be liable for failure to perform where performance is prevented by circumstances beyond reasonable control, including but not limited to: natural disasters, pandemics, government-imposed travel restrictions, armed conflict, terrorism, or civil unrest. In such cases, BucketListSpots will facilitate a refund of amounts held through the Platform, and the Guide will use reasonable endeavours to assist with rebooking where possible.</p>

        <p><strong>7.5 Lifetime Deposit Credit.</strong> Where a Traveler's Booking Lock Payment is forfeited due to cancellation (after the grace period), the Traveler may be eligible for a Lifetime Deposit Credit. The Lifetime Deposit Credit allows the Traveler to apply the forfeited Booking Lock Payment toward a future booking with any Guide on the Platform, subject to conditions displayed at the time of cancellation. Lifetime Deposit Credits are non-transferable and must be used within the period specified.</p>

        <p><strong>7.6 Payment 2 Default.</strong> If Payment 2 is not received before the trip departure date, the Guide is not obligated to proceed with the trip. In this case, the Booking Lock Payment is forfeited by the Traveler and the Guide may release the trip date for other bookings. BucketListSpots will attempt to notify the Traveler of the outstanding balance before the departure date.</p>

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
        <p>BucketListSpots Ltd acts as a marketplace intermediary and booking agent. We are not liable for: (a) the conduct of any Guide or Traveler; (b) accidents, injuries, or losses during booked experiences; (c) the Guide's failure to deliver the trip; (d) indirect or consequential damages. Our total aggregate liability under or in connection with these Terms is limited to the total Platform Fee amounts collected by BucketListSpots in relation to the booking in question.</p>

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
