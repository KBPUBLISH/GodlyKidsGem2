import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Books from './pages/Books';
import BookForm from './pages/BookForm';
import BookEdit from './pages/BookEdit';
import Playlists from './pages/Playlists';
import BookReader from './pages/BookReader';
import PageEditor from './pages/PageEditor';
import Categories from './pages/Categories';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="books" element={<Books />} />
          <Route path="books/new" element={<BookForm />} />
          <Route path="books/edit/:bookId" element={<BookEdit />} />
          <Route path="books/read/:bookId" element={<BookReader />} />
          <Route path="pages/new/:bookId" element={<PageEditor />} />
          <Route path="playlists" element={<Playlists />} />
          <Route path="categories" element={<Categories />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
