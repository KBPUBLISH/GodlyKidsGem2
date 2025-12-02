import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Books from './pages/Books';
import BookForm from './pages/BookForm';
import BookEdit from './pages/BookEdit';
import Playlists from './pages/Playlists';
import PlaylistForm from './pages/PlaylistForm';
import BookReader from './pages/BookReader';
import PageEditor from './pages/PageEditor';
import Categories from './pages/Categories';
import Voices from './pages/Voices';
import Games from './pages/Games';
import Lessons from './pages/Lessons';
import LessonForm from './pages/LessonForm';
import Notifications from './pages/Notifications';
import MusicManagement from './pages/MusicManagement';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />
          
          {/* Protected Routes */}
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
            <Route path="categories" element={<Categories />} />
            <Route path="voices" element={<Voices />} />
            <Route path="games" element={<Games />} />
            <Route path="lessons" element={<Lessons />} />
            <Route path="lessons/new" element={<LessonForm />} />
            <Route path="lessons/edit/:id" element={<LessonForm />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="music" element={<MusicManagement />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
