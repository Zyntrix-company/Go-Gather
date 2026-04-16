import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Menu, X, Twitter, Linkedin, Heart, Instagram, Youtube } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import logoIcon from '../imports/logo-icon.svg';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Logo = () => (
  <div className="flex items-end gap-[6.4px] select-none font-sans">
    <img src={logoIcon} alt="GatherrGo Icon" className="w-[34px] h-[34px]" />
    <div className="flex items-center" style={{ fontFamily: 'Nunito, sans-serif' }}>
      <span className="text-[25.5px] font-extrabold text-teal-600 tracking-tight leading-none">Gatherr</span>
      <span className="text-[25.5px] font-extrabold text-teal-600 tracking-tight leading-none">Go</span>
    </div>
  </div>
);

const Navbar = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const location = useLocation();

  const links = [
    { name: 'Home', path: '/' },
    { name: 'About', path: '/about' },
    { name: 'Careers', path: '/careers' },
    { name: 'Blogs', path: '/blogs' },
    { name: 'Contact', path: '/contact' },
  ];

  return (
    <nav className="fixed top-1 left-0 right-0 z-50 px-6 py-2">
      <div className="max-w-7xl mx-auto">
        <div className="relative rounded-2xl bg-white/70 backdrop-blur-xl border border-white/60 px-6 py-2 flex items-center justify-between shadow-lg shadow-teal-900/5">
          <Link to="/" className="flex items-center gap-2 group hover:opacity-90 transition-opacity">
            <Logo />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-teal-600 relative",
                  location.pathname === link.path ? "text-teal-700 font-semibold" : "text-slate-600"
                )}
              >
                {link.name}
                {location.pathname === link.path && (
                  <motion.div
                    layoutId="navbar-indicator"
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.4)]"
                  />
                )}
              </Link>
            ))}
            <button className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-semibold transition-all shadow-[0_4px_14px_0_rgba(20,184,166,0.39)] hover:shadow-[0_6px_20px_rgba(20,184,166,0.23)] hover:-translate-y-0.5">
              Get Started
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-slate-600 hover:text-teal-700"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-[4.5rem] left-6 right-6 p-4 rounded-2xl bg-white/90 backdrop-blur-xl border border-white/60 md:hidden flex flex-col gap-2 shadow-xl shadow-teal-900/10 z-50"
          >
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "py-2 px-3 rounded-lg hover:bg-teal-50 transition-colors text-center",
                  location.pathname === link.path ? "text-teal-700 bg-teal-50 font-semibold" : "text-slate-600"
                )}
              >
                {link.name}
              </Link>
            ))}
            <button className="w-full mt-2 py-2.5 rounded-xl bg-teal-500 text-white font-semibold shadow-lg shadow-teal-500/20">
              Get Started
            </button>
          </motion.div>
        )}
      </div>
    </nav>
  );
};

const Footer = () => {
  return (
    <footer className="relative z-10 border-t border-teal-100 bg-white/60 backdrop-blur-xl pt-10 pb-6 mt-auto">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-x-8 gap-y-6 md:gap-y-0 mb-8">
          
          <div className="col-span-2 md:col-span-4 md:col-start-2 flex mb-4 md:mb-4">
            <Link to="/" className="flex items-center gap-2 w-fit">
              <Logo />
            </Link>
          </div>

          <div className="col-span-1 md:col-span-2 md:col-start-2">
            <ul className="space-y-3 text-sm">
              <li><Link to="/contact" className="text-slate-500 hover:text-teal-600 transition-colors flex items-center h-5">Contact</Link></li>
              <li><Link to="/careers" className="text-slate-500 hover:text-teal-600 transition-colors flex items-center h-5">Careers</Link></li>
              <li><Link to="/blogs" className="text-slate-500 hover:text-teal-600 transition-colors flex items-center h-5">Blog</Link></li>
              <li><Link to="/privacy" className="text-slate-500 hover:text-teal-600 transition-colors flex items-center h-5">Privacy</Link></li>
              <li><Link to="/terms" className="text-slate-500 hover:text-teal-600 transition-colors flex items-center h-5">Terms</Link></li>
              <li><Link to="/data-deletion" className="text-slate-500 hover:text-teal-600 transition-colors flex items-center h-5">Data Deletion</Link></li>
            </ul>
          </div>

          <div className="col-span-1 md:col-span-2 md:col-start-4 md:flex md:justify-end">
            <div className="w-fit">
              <ul className="space-y-3 text-sm">
                <li>
                  <a href="https://www.instagram.com/GatherrGo" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-slate-500 hover:text-teal-600 transition-colors w-max h-5">
                    <Instagram className="w-4 h-4" />
                    <span>Instagram</span>
                  </a>
                </li>
                <li>
                  <a href="https://x.com/GatherrGo" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-slate-500 hover:text-teal-600 transition-colors w-max h-5">
                    <Twitter className="w-4 h-4" />
                    <span>Twitter / X</span>
                  </a>
                </li>
                <li>
                  <a href="https://www.linkedin.com/company/gatherrgo/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-slate-500 hover:text-teal-600 transition-colors w-max h-5">
                    <Linkedin className="w-4 h-4" />
                    <span>LinkedIn</span>
                  </a>
                </li>
                <li>
                  <a href="https://www.youtube.com/@GatherrGo" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-slate-500 hover:text-teal-600 transition-colors w-max h-5">
                    <Youtube className="w-4 h-4" />
                    <span>YouTube</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="border-t border-slate-200 pt-6 flex flex-col md:flex-row justify-center items-center gap-4 text-[13px] text-slate-500">
          <p>© 2026 GatherrGo. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 selection:bg-teal-200 selection:text-teal-900 font-sans flex flex-col overflow-hidden">
      <style>{`
        ::-webkit-scrollbar {
          width: 0px;
          background: transparent;
        }
        html {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
      `}</style>
      {/* Light Theme Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {/* Main soft gradient background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-teal-100 via-slate-50 to-slate-50 opacity-70" />
        
        {/* Floating color blobs */}
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-cyan-200/40 rounded-full blur-[100px]" />
        <div className="absolute bottom-[10%] left-[-10%] w-[600px] h-[600px] bg-teal-200/30 rounded-full blur-[120px]" />
        <div className="absolute top-[40%] left-[30%] w-[800px] h-[800px] bg-white/60 rounded-full blur-[80px]" />
      </div>

      <Navbar />
      
      <main className="relative z-10 pt-24 flex-grow">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}