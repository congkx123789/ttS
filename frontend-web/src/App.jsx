import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LangProvider } from './contexts/LangContext';
import { ReaderSettingsProvider } from './contexts/ReaderSettingsContext';
import Discover from './pages/Discover';
import Bookshelf from './pages/Bookshelf';
import HistoryPage from './pages/HistoryPage';
import BookDetail from './pages/BookDetail';
import Reader from './pages/Reader';
import Developer from './pages/Developer';
import LocalReader from './pages/LocalReader';
import Settings from './pages/Settings';
import AuthorDetail from './pages/AuthorDetail';
import Messages from './pages/Messages';
import Sects from './pages/Sects';

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <ReaderSettingsProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Discover />} />
              <Route path="/bookshelf" element={<Bookshelf />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/developer" element={<Developer />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/sects" element={<Sects />} />
              <Route path="/book/:bookId" element={<BookDetail />} />
              <Route path="/book/:bookId/read/:chapterIdx" element={<Reader />} />
              <Route path="/author/:authorName" element={<AuthorDetail />} />
              <Route path="/embed" element={<LocalReader />} />
            </Routes>
          </Router>
        </ReaderSettingsProvider>
      </AuthProvider>
    </LangProvider>
  );
}
