import React from 'react';
import { motion } from 'motion/react';
import { Briefcase, MapPin, Clock, ArrowLeft, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

export default function DesignIntern() {
  return (
    <div className="pt-8 pb-20 px-6 max-w-4xl mx-auto space-y-10">
      <SEO
        title="Design Intern — GatherrGo Careers"
        description="Apply for the Design Intern position at GatherrGo. Remote internship to work on UI/UX for a fast-growing group travel app built by an experienced founding team."
        canonical="/careers/design-intern"
        noIndex={true}
      />
      {/* Back to careers */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <Link to="/careers" className="inline-flex items-center text-teal-600 hover:text-teal-700 font-medium transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Careers
        </Link>
      </motion.div>

      {/* Header */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 leading-tight">
          <span className="text-teal-600">Design</span> Intern
        </h1>
        
        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/60 border border-slate-200">
            <Briefcase className="w-4 h-4 text-teal-600" />
            <span>Design</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/60 border border-slate-200">
            <MapPin className="w-4 h-4 text-teal-600" />
            <span>Remote</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/60 border border-slate-200">
            <Clock className="w-4 h-4 text-teal-600" />
            <span>Internship</span>
          </div>
        </div>
      </motion.section>

      {/* Content */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-8 md:p-12 rounded-3xl bg-white/70 backdrop-blur-md border border-white/60 shadow-xl shadow-teal-900/5 space-y-8"
      >
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0">
              <span className="w-2 h-2 rounded-full bg-teal-600" />
            </div>
            About the Role
          </h2>
          <p className="text-slate-600 text-base leading-relaxed pl-11">
            We are looking for a creative Design Intern who is passionate about visual storytelling and user experience. The role will involve working on graphic assets, social media creatives, and assisting in improving the UI/UX of our web and mobile interfaces.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0">
              <span className="w-2 h-2 rounded-full bg-teal-600" />
            </div>
            Key Responsibilities
          </h2>
          <ul className="list-disc text-slate-600 text-base leading-relaxed pl-16 space-y-2">
            <li>Design graphics for social media, marketing materials, and website content.</li>
            <li>Assist in creating and refining UI/UX for web and mobile application screens.</li>
            <li>Work closely with the product and marketing teams to maintain visual consistency.</li>
            <li>Develop simple design systems, icons, and visual elements where required.</li>
            <li>Ensure designs are user-friendly, visually appealing, and aligned with the brand.</li>
          </ul>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0">
              <span className="w-2 h-2 rounded-full bg-teal-600" />
            </div>
            Requirements
          </h2>
          <ul className="list-disc text-slate-600 text-base leading-relaxed pl-16 space-y-2">
            <li>0–2 years of experience in graphic design or UI/UX (internships or academic projects acceptable).</li>
            <li>Proficiency in design tools such as Figma, Adobe XD, Photoshop, Illustrator, or similar tools.</li>
            <li>Basic understanding of UI/UX principles and user-centered design.</li>
            <li>Creativity, attention to detail, and willingness to learn.</li>
            <li>Ability to work independently in a remote environment.</li>
          </ul>
        </div>

        <div className="pt-8 border-t border-slate-200 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Ready to join us?</h3>
            <p className="text-slate-500">We'd love to see what you can do.</p>
          </div>
          <Link 
            to="/contact" 
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-bold transition-all shadow-[0_4px_14px_0_rgba(20,184,166,0.39)] hover:-translate-y-1 flex items-center justify-center gap-2"
          >
            Apply Now
            <Send className="w-4 h-4" />
          </Link>
        </div>
      </motion.section>

    </div>
  );
}
