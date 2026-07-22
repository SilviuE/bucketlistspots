import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Discover from './pages/Discover';
import BookNow from './pages/BookNow';
import GuideProfile from './pages/GuideProfile';
import BucketList from './pages/BucketList';
import TrustHub from './pages/TrustHub';
import ForGuides from './pages/ForGuides';
import Checkout from './pages/Checkout';
import AuthPage from './pages/AuthPage';
import TravellerDashboard from './pages/TravellerDashboard';
import GuideDashboard from './pages/GuideDashboard';
import AmbassadorDashboard from './pages/AmbassadorDashboard';
import BecomeGuide from './pages/BecomeGuide';
import BecomeAmbassador from './pages/BecomeAmbassador';
import NewsFeed from './pages/NewsFeed';
import AdminApplications from './pages/AdminApplications';
import AdminPaymentReports from './pages/AdminPaymentReports';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import DestinationPage from './pages/DestinationPage';

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Discover />} />
        <Route path="/book" element={<BookNow />} />
        <Route path="/bucketlist" element={<BucketList />} />
        <Route path="/trust" element={<TrustHub />} />
        <Route path="/for-guides" element={<ForGuides />} />
        <Route path="/become-a-guide" element={<BecomeGuide />} />
        <Route path="/ambassadors" element={<BecomeAmbassador />} />
        <Route path="/admin/applications" element={<AdminApplications />} />
        <Route path="/admin/payment-reports" element={<AdminPaymentReports />} />
        <Route path="/guide/:id" element={<GuideProfile />} />
        <Route path="/checkout/:guideId" element={<Checkout />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/dashboard" element={<TravellerDashboard />} />
        <Route path="/guide-dashboard" element={<GuideDashboard />} />
        <Route path="/ambassador-dashboard" element={<AmbassadorDashboard />} />
        <Route path="/news" element={<NewsFeed />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/destination/:slug" element={<DestinationPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
