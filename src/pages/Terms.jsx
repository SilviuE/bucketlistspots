import { Container, Typography, Paper, Alert } from '@mui/material';
import SEO from '../components/SEO';

const TERMS_VERSION = 'draft-0.3';
const LAST_UPDATED = 'July 2026';

export default function Terms() {
  return (
    <Container maxWidth="sm" sx={{ px: 2, pt: 2, pb: 4 }}>
      <SEO title="Terms of Service" description="Terms of Service for BucketListSpots.com operated by BucketListSpots Ltd (Company No. 16595661)." path="/terms" />
      <Typography variant="h1" mb={0.5}>Terms of Service</Typography>
      <Typography variant="caption" color="text.secondary" display="block" mb={1}>Last updated: {LAST_UPDATED} | Version: {TERMS_VERSION}</Typography>
      <Alert severity="warning" sx={{ mb: 2, fontSize: 12 }}>
        <strong>Draft — pending legal review.</strong> Sections 6 and 7 are not yet finalised and must not be relied upon for live paid bookings until the review is complete.
      </Alert>

      <Paper elevation={0} sx={{ p: 2, border: '1px solid rgba(16,42,67,0.12)', borderRadius: 3, '& p': { fontSize: 13, lineHeight: 1.6, mb: 1.5, color: 'text.secondary' }, '& h2': { fontSize: 15, fontWeight: 700, mt: 2.5, mb: 1, color: 'text.primary' }, '& table': { width: '100%', borderCollapse: 'collapse', mb: 2, fontSize: 12 }, '& th, & td': { border: '1px solid rgba(16,42,67,0.12)', p: 1, textAlign: 'left', verticalAlign: 'top' }, '& th': { fontWeight: 700, bgcolor: '#F4F5F7', color: 'text.primary' } }}>
        <h2>1. Introduction</h2>
        <p>Welcome to BucketListSpots.com (the "Platform"), operated by BucketListSpots Ltd (Company No. 16595661), a company registered in England and Wales. By accessing or using the Platform, you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Platform.</p>

        <h2>2. Our Role — Booking Agent (Not Organizer)</h2>
        <p>BucketListSpots Ltd acts <strong>solely as a disclosed booking agent</strong> under the Package Travel and Linked Travel Arrangements Regulations 2018 (PTR). We are <strong>not</strong> the organizer, supplier, or principal of any trip, trek, or experience listed on the Platform.</p>
        <p>Your contract for the delivery of any trip is directly with the independent Guide (the "Supplier"). BucketListSpots Ltd facilitates the discovery, booking connection, and deposit payment process but is not a party to the contract between you and the Guide.</p>
        <p>We do <strong>not</strong> sell or bundle international flights. Any flight arrangements are made independently by the Traveler and are not part of any booking made through the Platform.</p>

        <h2>3. Definitions</h2>
        <p>"Guide" means a local tour or experience provider who lists services on the Platform. "Traveler" means a user who books a Guide's services. "Platform" means BucketListSpots.com and all related services. "Content" means all text, images, and materials submitted by users. "Booking Lock Payment" means the initial payment made by the Traveler to confirm a booking (also referred to as "Payment 1"). "Platform Fee" means BucketListSpots' commission on a booking. "Platform Fee Balance" means the outstanding portion of the Platform Fee after the Booking Lock Payment (also referred to as "Payment 2"). "Local Partner Balance" means the Guide's trip delivery fee (currently 80% of the listed trip price). "Deposit Credit" means a credit applied to a future booking, converted from a Booking Lock Payment under the conditions set out in these Terms.</p>

        <h2>4. Accounts</h2>
        <p>You must be 18 or older to create an account. You are responsible for maintaining the confidentiality of your login credentials. You agree to provide accurate, current information and to update it as needed.</p>

        <h2>5. Guide Listings &amp; Bookings</h2>
        <p>Guides are independent operators, not employees or contractors of BucketListSpots Ltd. We verify identity, licensing, and safety credentials through our Trust Gate process but make no guarantees about the quality of any Guide's service. Travelers book directly with Guides through the Platform. BucketListSpots facilitates the booking connection and collects the Platform Fee. The contract for trip delivery is solely between the Traveler and the Guide.</p>

        <h2>6. Payments</h2>
        <p>BucketListSpots Ltd acts as a booking agent and collects a Platform Fee on behalf of itself. The trip delivery contract is between the Traveler and the Guide. All payment processing is handled securely by Stripe. We do not store full credit card details.</p>

        <p><strong>6.1 Booking Lock Payment (Payment 1).</strong> When a Traveler confirms a booking, BucketListSpots collects a Booking Lock Payment. During promotional periods, this is a fixed amount of &pound;50, &euro;50, or US$50 (depending on the booking currency). Outside promotional periods, Payment 1 is the full Platform Fee (currently 20% of the listed trip price). The Booking Lock Payment is credited toward the total Platform Fee. The applicable amount is displayed at checkout before payment.</p>

        <p><strong>6.2 Platform Fee Balance (Payment 2).</strong> The remaining balance of the Platform Fee (the total Platform Fee minus any Booking Lock Payment already made) is due from the Traveler before the trip departure date. Payment 2 is collected by the Guide on behalf of BucketListSpots. The Platform Fee Balance must be settled before the Guide is obligated to confirm the trip date. Payment methods and deadlines are displayed on the Platform.</p>

        <p><strong>6.3 Full Platform Fee.</strong> For bookings made outside a promotional period, the full Platform Fee (currently 20% of the listed trip price) is due as Payment 1 at the time of booking. The Platform Fee percentage is displayed at the time of booking and may change for future bookings.</p>

        <p><strong>6.4 Local Partner Balance.</strong> The Local Partner Balance (currently 80% of the listed trip price) represents the Guide's trip delivery fee. This amount is the Guide's responsibility to collect directly from the Traveler and is not held or processed by BucketListSpots Ltd. The Guide's obligation to deliver the trip is contractual with the Traveler and is independent of BucketListSpots' role as booking agent.</p>

        <p><strong>6.5 Referral Discounts.</strong> Where a valid referral or Scout code is applied, the discount reduces only the Platform Fee payable to BucketListSpots. Referral discounts do not reduce the Local Partner Balance. Referral discounts are subject to maximum limits displayed at the time of booking. Referral discounts apply only to the booking for which the code was entered and do not transfer to future bookings unless explicitly stated.</p>

        <p><strong>6.6 Currency.</strong> All amounts are displayed and charged in the currency shown at the time of booking (GBP, EUR, or USD). BucketListSpots is not responsible for exchange rate fluctuations between the booking currency and the currency in which the Guide receives payment.</p>

        <h2>7. Cancellations, Refunds &amp; Grace Period</h2>

        <p><strong>7.1 48-Hour Voluntary Grace Period.</strong> A Traveler may cancel a booking within 48 hours of the initial Booking Lock Payment and receive a full monetary refund of the Booking Lock Payment to the original payment method, provided the applicable grace-period conditions are met. Cancellation requests must be submitted through the Platform or by contacting hello@bucketlistspots.com. After the 48-hour grace period, the Booking Lock Payment is converted into a Deposit Credit (see clause 7.5).</p>

        <p><strong>7.2 Traveler Cancellation (After Grace Period).</strong> If a Traveler cancels after the 48-hour grace period:</p>
        <p>(a) <strong>Payment 1 (Booking Lock Payment):</strong> is converted into a Deposit Credit for the Traveler (see clause 7.5);</p>
        <p>(b) <strong>Payment 2:</strong> any amounts already paid will be refunded in full to the original payment method within 14 business days;</p>
        <p>(c) <strong>Referral discounts:</strong> any referral discount applied to the original booking does not carry forward; a new referral code must be applied at the time of rebooking;</p>
        <p>(d) <strong>Local Partner Balance:</strong> is not affected, as this amount is the Guide's responsibility to collect directly;</p>
        <p>(e) <strong>Third-party costs:</strong> the Guide is not obligated to refund amounts collected directly for third-party trip services (e.g., park fees, permits) once those have been committed by the Guide;</p>
        <p>(f) <strong>Statutory rights:</strong> nothing in this clause affects the Traveler's statutory rights under the Consumer Rights Act 2015, the Package Travel and Linked Travel Arrangements Regulations 2018, or any other applicable consumer protection legislation. Where applicable law requires a monetary refund rather than a credit, the Traveler is entitled to a monetary refund of the Booking Lock Payment.</p>

        <p><strong>7.3 Guide Cancellation.</strong> If a Guide cancels a confirmed trip, the Traveler is entitled to a full monetary refund of all amounts paid through the Platform, including the Booking Lock Payment (Payment 1) and any Payment 2 amounts, to the original payment method within 14 business days. The Traveler is not converted to Deposit Credit in this scenario; a monetary refund is required. The Guide's liability for additional direct costs (such as non-refundable flights) is a matter between the Traveler and the Guide and is not covered by BucketListSpots Ltd. Travelers are strongly advised to arrange travel insurance as additional protection; insurance does not replace any refund, compensation, or statutory rights owed by BucketListSpots, a Guide, or any package organizer.</p>

        <p><strong>7.4 BucketListSpots Cancellation.</strong> If BucketListSpots cancels or discontinues a booking or the Platform's booking services, the Traveler is entitled to a full monetary refund of all amounts paid through the Platform, including Payment 1 and Payment 2, to the original payment method within 14 business days. Deposit Credit is not applied in this scenario.</p>

        <p><strong>7.5 Deposit Credit.</strong> Where a Traveler's Booking Lock Payment (Payment 1) is converted into a Deposit Credit under clauses 7.1, 7.2, or 7.6, the Traveler may apply the credit value toward a future booking with any Guide on the Platform. Deposit Credits are subject to the following conditions:</p>
        <p>(a) the credit is non-transferable and may only be used by the original Traveler;</p>
        <p>(b) the credit is applied toward the Platform Fee on the new booking and does not reduce the Local Partner Balance;</p>
        <p>(c) any referral discount on the original booking does not transfer; a new referral code must be applied at the time of rebooking;</p>
        <p>(d) the credit has no cash value and cannot be redeemed for a monetary refund, except where applicable law requires otherwise;</p>
        <p>(e) if the new booking's Platform Fee is less than the credit value, the unused portion of the credit is lost;</p>
        <p>(f) the credit is governed by the consumer rights provisions of the Consumer Rights Act 2015 to the extent applicable.</p>

        <p><strong>7.6 Payment 2 Default.</strong> If Payment 2 is not received before the trip departure date:</p>
        <p>(a) <strong>Payment 1 (Booking Lock Payment):</strong> is converted into a Deposit Credit for the Traveler (see clause 7.5);</p>
        <p>(b) <strong>Trip delivery:</strong> the Guide is not obligated to proceed with the trip and may release the trip date for other bookings;</p>
        <p>(c) <strong>Referral discounts:</strong> any referral discount applied to the original booking does not carry forward;</p>
        <p>(d) <strong>Local Partner Balance:</strong> is not affected, as this amount is the Guide's responsibility to collect directly;</p>
        <p>(e) <strong>Statutory rights:</strong> nothing in this clause affects the Traveler's statutory rights under the Consumer Rights Act 2015 or any other applicable consumer protection legislation.</p>
        <p>BucketListSpots will attempt to notify the Traveler of the outstanding Payment 2 balance before the departure date.</p>

        <p><strong>7.7 Force Majeure.</strong> Neither party shall be liable for failure to perform where performance is prevented by circumstances beyond reasonable control, including but not limited to: natural disasters, pandemics, government-imposed travel restrictions, armed conflict, terrorism, or civil unrest.</p>
        <p>Where a force majeure event prevents trip delivery:</p>
        <p>(a) <strong>Payment 1 (Booking Lock Payment):</strong> is converted into a Deposit Credit for the Traveler (see clause 7.5), except where applicable law requires a monetary refund;</p>
        <p>(b) <strong>Payment 2:</strong> any amounts already paid will be refunded in full to the original payment method within 14 business days;</p>
        <p>(c) <strong>Referral discounts:</strong> any referral discount applied to the original booking does not carry forward; a new code must be applied at rebooking;</p>
        <p>(d) <strong>Local Partner Balance:</strong> is not affected, as this amount is collected directly by the Guide and is governed by the separate trip delivery contract between the Traveler and the Guide;</p>
        <p>(e) <strong>Existing Deposit Credit:</strong> any Deposit Credit already held by the Traveler remains valid and may be applied to a future booking;</p>
        <p>(f) <strong>Statutory rights:</strong> nothing in this clause affects the Traveler's statutory rights under the Consumer Rights Act 2015, the Package Travel and Linked Travel Arrangements Regulations 2018, or any other applicable consumer protection legislation.</p>
        <p>The Guide will use reasonable endeavours to assist with rebooking where possible. BucketListSpots Ltd will facilitate refunds and credit conversions through the Platform.</p>

        <p><strong>7.8 Insolvency.</strong> In the event of the insolvency of BucketListSpots Ltd or a Guide:</p>
        <p>(a) Travelers are entitled to a refund of amounts held by the insolvent party, subject to applicable insolvency law;</p>
        <p>(b) Deposit Credits held against an insolvent BucketListSpots Ltd may not be honoured and Travelers should contact the administrator or liquidator;</p>
        <p>(c) nothing in this clause limits the Traveler's statutory rights under the Package Travel and Linked Travel Arrangements Regulations 2018, which may provide additional protections where BucketListSpots is classified as an organizer.</p>

        <p><strong>7.9 Cancellation Outcomes Summary.</strong></p>
        <table>
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Payment 1</th>
              <th>Payment 2</th>
              <th>Local Partner Balance</th>
              <th>Deposit Credit</th>
              <th>Referral</th>
              <th>Refund Timing</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Traveler cancels within 48h grace period</td>
              <td>Full monetary refund</td>
              <td>N/A or refunded if paid</td>
              <td>Not affected</td>
              <td>N/A</td>
              <td>Forfeited</td>
              <td>14 business days</td>
            </tr>
            <tr>
              <td>Traveler cancels after grace period</td>
              <td>Converted to Deposit Credit</td>
              <td>Refunded in full</td>
              <td>Not affected</td>
              <td>Issued</td>
              <td>Does not carry forward</td>
              <td>14 business days (Payment 2)</td>
            </tr>
            <tr>
              <td>Payment 2 default (Traveler)</td>
              <td>Converted to Deposit Credit</td>
              <td>N/A (not paid)</td>
              <td>Not affected</td>
              <td>Issued</td>
              <td>Does not carry forward</td>
              <td>N/A</td>
            </tr>
            <tr>
              <td>Guide cancels</td>
              <td>Full monetary refund</td>
              <td>Refunded in full</td>
              <td>Not affected</td>
              <td>N/A</td>
              <td>Forfeited</td>
              <td>14 business days</td>
            </tr>
            <tr>
              <td>BucketListSpots cancels</td>
              <td>Full monetary refund</td>
              <td>Refunded in full</td>
              <td>Not affected</td>
              <td>N/A</td>
              <td>Forfeited</td>
              <td>14 business days</td>
            </tr>
            <tr>
              <td>Force majeure (before departure)</td>
              <td>Converted to Deposit Credit *</td>
              <td>Refunded in full</td>
              <td>Not affected</td>
              <td>Issued (or existing credit retained)</td>
              <td>Does not carry forward</td>
              <td>14 business days (Payment 2)</td>
            </tr>
            <tr>
              <td>Force majeure (after departure)</td>
              <td>Converted to Deposit Credit *</td>
              <td>Refunded if not yet released</td>
              <td>Guide retains if trip commenced</td>
              <td>Issued</td>
              <td>Does not carry forward</td>
              <td>14 business days</td>
            </tr>
            <tr>
              <td>Insolvency (BucketListSpots)</td>
              <td>Subject to insolvency proceedings</td>
              <td>Subject to insolvency proceedings</td>
              <td>Not affected</td>
              <td>May not be honoured</td>
              <td>Forfeited</td>
              <td>Per administrator/liquidator</td>
            </tr>
            <tr>
              <td>Insolvency (Guide)</td>
              <td>Full monetary refund (from BLS)</td>
              <td>Refunded if held by BLS</td>
              <td>Guide's obligation ceases</td>
              <td>N/A</td>
              <td>Forfeited</td>
              <td>14 business days</td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: 11, fontStyle: 'italic' }}>* Where applicable law requires a monetary refund rather than a credit, the Traveler receives a monetary refund of Payment 1 instead of Deposit Credit.</p>

        <h2>8. Travel Insurance — Additional Protection</h2>
        <p>You are <strong>strongly advised</strong> to arrange adequate travel insurance that covers high-altitude trekking (up to 6,000m), medical evacuation, trip cancellation, and travel disruption. BucketListSpots Ltd is <strong>not</strong> authorized or regulated by the Financial Conduct Authority (FCA) to provide financial advice or recommend specific insurance products. Any insurance links or provider names on the Platform are provided for informational purposes only ("signposting") and do not constitute advice or a recommendation.</p>
        <p>Travel insurance is <strong>additional protection</strong> and does not replace any refund, compensation, or statutory rights owed by BucketListSpots Ltd, a Guide, or any package organizer under the Package Travel and Linked Travel Arrangements Regulations 2018 or the Consumer Rights Act 2015. You remain entitled to any refund or remedy to which you are entitled by law, regardless of whether you hold travel insurance.</p>
        <p>It is your sole responsibility to verify that any insurance policy you purchase is suitable for your specific trip and needs.</p>

        <h2>9. Medical Disclaimer</h2>
        <p>Content on this Platform is for general information purposes only. BucketListSpots Ltd does not provide medical advice. You should consult a qualified medical professional before undertaking any high-altitude trekking or adventure activity. Altitude sickness and other travel-related health risks are serious and can be fatal.</p>

        <h2>10. "Verified" Status</h2>
        <p>The "Verified" badge on a Guide's profile indicates that BucketListSpots Ltd has checked the Guide's identity, licensing, and safety credentials. It does <strong>not</strong> mean that BucketListSpots Ltd supervises the Guide's daily operations, guarantees the quality of their services, or assumes liability for any aspect of the trip.</p>

        <h2>11. User Conduct</h2>
        <p>You agree not to: (a) use the Platform for any unlawful purpose; (b) harass, abuse, or harm others; (c) submit false or misleading information; (d) attempt to circumvent our payment system; (e) scrape or reproduce Platform content without permission.</p>

        <h2>12. Intellectual Property</h2>
        <p>The BucketListSpots name, logo, and design are trademarks of BucketListSpots Ltd. Content submitted by Guides (photos, text) remains their property. By submitting content, you grant us a license to display it on the Platform.</p>

        <h2>13. Third-Party Links &amp; Affiliate Disclosure</h2>
        <p>This Platform contains links to third-party websites and services. Some of these links may be affiliate links, meaning BucketListSpots Ltd may earn a commission if you make a purchase, at no extra cost to you. We have no control over, and assume no responsibility for, the content, privacy policies, or practices of any third-party websites or services.</p>

        <h2>14. Limitation of Liability</h2>
        <p>BucketListSpots Ltd acts as a marketplace intermediary and booking agent. We are not liable for: (a) the conduct of any Guide or Traveler; (b) accidents, injuries, or losses during booked experiences; (c) the Guide's failure to deliver the trip; (d) indirect or consequential damages. Our total aggregate liability under or in connection with these Terms is limited to the total Platform Fee amounts collected by BucketListSpots in relation to the booking in question.</p>
        <p>Nothing in these Terms excludes or limits liability for death or personal injury caused by negligence, fraud, or any other liability that cannot be excluded by law.</p>

        <h2>15. Termination</h2>
        <p>We reserve the right to suspend or terminate accounts that violate these Terms, at our sole discretion. You may delete your account at any time by contacting us.</p>

        <h2>16. Changes to Terms</h2>
        <p>We may update these Terms at any time. Material changes will be notified via email or a notice on the Platform. Continued use after changes constitutes acceptance. The version of these Terms current at the time of your booking is the version that applies to that booking.</p>

        <h2>17. Governing Law</h2>
        <p>These Terms are governed by the laws of England and Wales. Any disputes shall be resolved in the courts of England and Wales.</p>

        <h2>18. Contact</h2>
        <p>BucketListSpots Ltd<br />Email: hello@bucketlistspots.com<br />Company No. 16595661</p>
      </Paper>
    </Container>
  );
}
