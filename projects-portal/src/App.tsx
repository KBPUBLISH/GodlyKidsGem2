import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleGuard from './components/RoleGuard';
import Layout from './components/Layout';
import CreatorLayout from './components/CreatorLayout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Books from './pages/Books';
import BookForm from './pages/BookForm';
import BookEdit from './pages/BookEdit';
import Playlists from './pages/Playlists';
import PlaylistForm from './pages/PlaylistForm';
import BookSeries from './pages/BookSeries';
import BookSeriesForm from './pages/BookSeriesForm';
import BookReader from './pages/BookReader';
import PageEditor from './pages/PageEditor';
import Categories from './pages/Categories';
import Voices from './pages/Voices';
import Games from './pages/Games';
import Lessons from './pages/Lessons';
import LessonForm from './pages/LessonForm';
import LessonCalendarPage from './pages/LessonCalendarPage';
import Notifications from './pages/Notifications';
import MusicManagement from './pages/MusicManagement';
import FeaturedContent from './pages/FeaturedContent';
import NewUserWelcome from './pages/NewUserWelcome';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import OnboardingAnalytics from './pages/OnboardingAnalytics';
import Radio from './pages/Radio';
import RadioHosts from './pages/RadioHosts';
import RadioLibrary from './pages/RadioLibrary';
import RadioShowBuilder from './pages/RadioShowBuilder';
import RadioPreviewPage from './pages/RadioPreviewPage';
import EmailSubscribers from './pages/EmailSubscribers';
import Campaigns from './pages/Campaigns';
import CampaignForm from './pages/CampaignForm';
import CampaignUpdates from './pages/CampaignUpdates';

// Godly Hub - Creator Portal
import CreatorLogin from './pages/CreatorLogin';
import CreatorAcceptInvite from './pages/CreatorAcceptInvite';
import CreatorDashboard from './pages/creator/CreatorDashboard';
import CreatorContent from './pages/creator/CreatorContent';
import CreatorContentForm from './pages/creator/CreatorContentForm';
import CreatorEarnings from './pages/creator/CreatorEarnings';
import CreatorProfile from './pages/creator/CreatorProfile';

// Godly Hub - Admin
import HubCreators from './pages/admin/HubCreators';
import HubReview from './pages/admin/HubReview';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Creator Portal - Public */}
          <Route path="/creator/login" element={<CreatorLogin />} />
          <Route path="/creator/accept-invite" element={<CreatorAcceptInvite />} />
          
          {/* Creator Portal - Protected */}
          <Route path="/creator" element={
            <RoleGuard allowedRoles={['creator']}>
              <CreatorLayout />
            </RoleGuard>
          }>
            <Route index element={<CreatorDashboard />} />
            <Route path="content" element={<CreatorContent />} />
            <Route path="content/new" element={<CreatorContentForm />} />
            <Route path="content/edit/:id" element={<CreatorContentForm />} />
            <Route path="earnings" element={<CreatorEarnings />} />
            <Route path="profile" element={<CreatorProfile />} />
          </Route>
          
          {/* Admin Portal - Protected */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="books" element={<Books />} />
            <Route path="books/new" element={<BookForm />} />
            <Route path="books/edit/:bookId" element={<BookEdit />} />
            <Route path="books/read/:bookId" element={<BookReader />} />
            <Route path="pages/new/:bookId" element={<PageEditor />} />
            <Route path="playlists" element={<Playlists />} />
            <Route path="playlists/new" element={<PlaylistForm />} />
            <Route path="playlists/edit/:id" element={<PlaylistForm />} />
            <Route path="book-series" element={<BookSeries />} />
            <Route path="book-series/new" element={<BookSeriesForm />} />
            <Route path="book-series/:id" element={<BookSeriesForm />} />
            <Route path="categories" element={<Categories />} />
            <Route path="voices" element={<Voices />} />
            <Route path="games" element={<Games />} />
            <Route path="lessons" element={<Lessons />} />
            <Route path="lessons/new" element={<LessonForm />} />
            <Route path="lessons/edit/:id" element={<LessonForm />} />
            <Route path="lessons/calendar" element={<LessonCalendarPage />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="music" element={<MusicManagement />} />
            <Route path="featured" element={<FeaturedContent />} />
            <Route path="new-user-welcome" element={<NewUserWelcome />} />
            <Route path="analytics" element={<AnalyticsDashboard />} />
            <Route path="onboarding-analytics" element={<OnboardingAnalytics />} />
            <Route path="radio" element={<Radio />} />
            <Route path="radio/hosts" element={<RadioHosts />} />
            <Route path="radio/library" element={<RadioLibrary />} />
            <Route path="radio/show-builder" element={<RadioShowBuilder />} />
            <Route path="radio/preview" element={<RadioPreviewPage />} />
            <Route path="email-subscribers" element={<EmailSubscribers />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="campaigns/new" element={<CampaignForm />} />
            <Route path="campaigns/:id/edit" element={<CampaignForm />} />
            <Route path="campaigns/:campaignId/updates" element={<CampaignUpdates />} />
            
            {/* Godly Hub Admin */}
            <Route path="hub/creators" element={<HubCreators />} />
            <Route path="hub/review" element={<HubReview />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
