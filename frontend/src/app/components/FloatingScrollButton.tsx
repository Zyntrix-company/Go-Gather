import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUp, ArrowDown } from 'lucide-react';

export function FloatingScrollButton() {
  const [isNearBottom, setIsNearBottom] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Check if user is scrolled past half the page height to toggle direction
      const scrollPosition = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      if (scrollPosition + windowHeight >= documentHeight / 2) {
        setIsNearBottom(true);
      } else {
        setIsNearBottom(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    // Initial check
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence mode="wait">
        {isNearBottom ? (
          <motion.button
            key="up"
            initial={{ opacity: 0, scale: 0.8, rotate: 180 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.8, rotate: -180 }}
            transition={{ duration: 0.3 }}
            onClick={scrollToTop}
            className="w-14 h-14 rounded-full bg-teal-500 hover:bg-teal-600 text-white flex items-center justify-center shadow-lg shadow-teal-500/30 hover:-translate-y-1 transition-transform border border-teal-400 backdrop-blur-md"
            aria-label="Scroll to top"
          >
            <ArrowUp className="w-6 h-6" />
          </motion.button>
        ) : (
          <motion.button
            key="down"
            initial={{ opacity: 0, scale: 0.8, rotate: -180 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.8, rotate: 180 }}
            transition={{ duration: 0.3 }}
            onClick={scrollToBottom}
            className="w-14 h-14 rounded-full bg-teal-500 hover:bg-teal-600 text-white flex items-center justify-center shadow-lg shadow-teal-500/30 hover:translate-y-1 transition-transform border border-teal-400 backdrop-blur-md"
            aria-label="Scroll to bottom"
          >
            <ArrowDown className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
