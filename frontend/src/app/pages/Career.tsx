import React from 'react';
import { motion } from 'motion/react';
import { MapPin, Briefcase, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

const jobs = [
  {
    title: "Social Media Manager",
    department: "Marketing",
    location: "Remote",
    type: "Contract",
    slug: "social-media-manager"
  },
  {
    title: "Design Intern",
    department: "Design",
    location: "Remote",
    type: "Internship",
    slug: "design-intern"
  }
];

export default function Career() {
  return (
    <div className="pt-2 md:pt-8 pb-16 px-6 max-w-7xl mx-auto space-y-8 md:space-y-12">
      <SEO
        title="Careers at GatherrGo — Join Our Team"
        description="Join the GatherrGo team. We're hiring passionate people for remote roles in Marketing, Design, and Engineering. Help us shape the future of group travel planning."
        canonical="/careers"
        noIndex={true}
      />
      
      {/* Hero */}
      <section className="text-center space-y-4 md:space-y-8 relative py-4 md:py-12">
        <div className="absolute inset-0 bg-teal-200/20 blur-[150px] rounded-full pointer-events-none" />
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl font-bold text-slate-900 leading-tight"
        >
          Join Our <span className="text-teal-600">Team</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-base md:text-lg text-slate-600 font-normal max-w-2xl mx-auto"
        >
          We're looking for brilliant minds to help us build the future of travel and event coordination.
          If you're passionate about innovation, we want to hear from you.
        </motion.p>
        
        <div className="flex justify-center mt-8">
           <button className="px-8 py-4 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-bold transition-all shadow-[0_4px_14px_0_rgba(20,184,166,0.39)] hover:-translate-y-1">
             View Openings
           </button>
        </div>
      </section>

      {/* Job Listings */}
      <section className="max-w-4xl mx-auto w-full">
        <div className="flex justify-center items-center mb-10">
          <h2 className="text-2xl font-normal text-slate-900 text-center">Open Positions</h2>
        </div>

        <div className="space-y-4">
          {jobs.map((job, index) => (
            <Link key={index} to={`/careers/${job.slug}`} className="block">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group py-4 px-6 rounded-2xl bg-white/60 border border-white/60 hover:border-teal-200 hover:bg-white/90 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:shadow-md"
              >
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-teal-600 group-hover:text-teal-500 transition-colors">
                    {job.title}
                  </h3>
                  <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" /> {job.department}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {job.location}</span>
                    <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {job.type}</span>
                  </div>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
        
        <div className="text-center mt-12 text-slate-500">
          Don't see a role that fits? <Link to="/contact" className="text-teal-600 hover:underline">Email us your resume</Link>
        </div>
      </section>

    </div>
  );
}
