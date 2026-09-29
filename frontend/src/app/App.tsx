import React from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Layout from './Layout';
import Home from './pages/Home';
import About from './pages/About';
import Career from './pages/Career';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Contact from './pages/Contact';
import SocialMediaManager from './pages/SocialMediaManager';
import DesignIntern from './pages/DesignIntern';
import DataDeletion from './pages/DataDeletion';
import Blogs from './pages/Blogs';
import BlogDetail from './pages/BlogDetail';
import Invite from './pages/Invite';

// ScrollToTop component to handle scroll position on route change
function ScrollToTop() {
  const { pathname } = useLocation();

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <HelmetProvider>
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="about" element={<About />} />
          <Route path="careers" element={<Career />} />
          <Route path="careers/social-media-manager" element={<SocialMediaManager />} />
          <Route path="careers/design-intern" element={<DesignIntern />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="terms" element={<Terms />} />
          <Route path="blogs" element={<Blogs />} />
          <Route path="blogs/:id" element={<BlogDetail />} />
          <Route path="contact" element={<Contact />} />
          <Route path="data-deletion" element={<DataDeletion />} />
          <Route path="invite/:type/:token" element={<Invite />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </HelmetProvider>
  );
}
