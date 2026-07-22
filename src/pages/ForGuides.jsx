import SEO from '../components/SEO';
import GuideHero from '../components/guides/GuideHero';
import GuideQualification from '../components/guides/GuideQualification';
import GuideIndustryComparison from '../components/guides/GuideIndustryComparison';
import GuideFinancialModel from '../components/guides/GuideFinancialModel';
import StandardGuideToolkit from '../components/guides/StandardGuideToolkit';
import GuideStatusPath from '../components/guides/GuideStatusPath';
import FoundingGuideProgramme from '../components/guides/FoundingGuideProgramme';
import TrustGateProcess from '../components/guides/TrustGateProcess';
import GuideJoiningTimeline from '../components/guides/GuideJoiningTimeline';
import LocalPartnerSpotlight from '../components/guides/LocalPartnerSpotlight';
import GuideFAQ from '../components/guides/GuideFAQ';
import GuideApplicationSection from '../components/guides/GuideApplicationSection';

export default function ForGuides() {
  return (
    <>
      <SEO
        title="Become a verified local adventure guide | BucketListSpots"
        description="Apply to join BucketListSpots as a verified Local Partner. Reach international travellers, receive 80% of every booking directly, and build your adventure business through a UK-registered marketplace."
        path="/for-guides"
      />
      <GuideHero />
      <GuideQualification />
      <GuideIndustryComparison />
      <GuideFinancialModel />
      <StandardGuideToolkit />
      <GuideStatusPath />
      <FoundingGuideProgramme />
      <TrustGateProcess />
      <GuideJoiningTimeline />
      <LocalPartnerSpotlight page="/for-guides" />
      <GuideFAQ />
      <GuideApplicationSection />
    </>
  );
}
