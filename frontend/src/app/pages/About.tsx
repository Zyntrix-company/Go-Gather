import React from 'react';
import { motion } from 'motion/react';
import { Linkedin, Twitter, Github, Users, Target, Heart, MapPin } from 'lucide-react';
import ankanImage from '../../assets/3d50851ea3a7044f8fbcb90a8e61eb6b754774e3.png';
import akashImage from '../../assets/878f090182ab234a55dac737db84e4fad1d4c7ae.png';
import SEO from '../components/SEO';

const teamMembers = [
  {
    name: "Ankan Nandi",
    role: "Founder",
    location: "Bangalore, India",
    image: ankanImage,
    imagePosition: "object-[center_20%]"
  },
  {
    name: "Akash Yadav",
    role: "Head of Technology",
    location: "Seattle, United States",
    image: akashImage,
    imagePosition: "object-[45%_30%]"
  }
];

export default function About() {
  return (
    <div className="pt-8 pb-16 px-6 max-w-7xl mx-auto space-y-16">
      <SEO
        title="About GatherrGo — Our Story, Mission & Team"
        description="Meet the team behind GatherrGo — founded by Ankan Nandi and Akash Yadav with 30+ years of MAANG experience, building the future of group travel."
        canonical="/about"
      />
      
      {/* Header Section */}
      <section className="text-center space-y-4">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl font-bold text-slate-900"
        >
          About <span className="text-teal-600">GatherrGo</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-base md:text-lg text-slate-600 font-normal max-w-3xl mx-auto"
        >
          We are a small, passionate team committed to making gatherings special and easy to reflect on. After all, the greatest memories aren't made solo.
        </motion.p>
      </section>

      {/* Story Section - Moved to Top */}
      <section className="relative rounded-3xl overflow-hidden bg-white/60 border border-white/60 shadow-lg shadow-teal-900/5">
        <div className="p-8 md:p-12 flex flex-col justify-center items-center text-center space-y-6 max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-teal-600">Our Story</h2>
          <div className="space-y-4 text-base md:text-lg text-slate-600 font-normal">
            <p>
              GatherrGo was born from a simple observation: planning trips with friends often becomes messy and scattered across multiple chats and documents. We built a collaborative space where travel groups can seamlessly plan, coordinate, and relive their journeys together in one place.
            </p>
            <p>
              Our founders bring close to 30 years of combined experience, having been associated with leading MAANG companies. They truly understand what it means to build customer-obsessed products that deliver exceptional experiences. Our focus is on creating a simple, trustworthy platform that makes shared moments easier to organize. We are committed to keeping GatherrGo free for as long as possible while prioritizing user privacy, protecting personal data, and earning the trust of every traveler.
            </p>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { icon: <Target className="w-8 h-8 text-teal-600" />, title: "Our Vision", text: "To make group travel planning effortless by bringing people, plans, and memories together in one trusted digital space." },
          { icon: <Users className="w-8 h-8 text-teal-600" />, title: "Our Culture", text: "We believe in curiosity, simplicity, and building thoughtfully—creating tools that genuinely improve how people travel together." },
          { icon: <Heart className="w-8 h-8 text-teal-600" />, title: "Our Values", text: "We value customer trust, respect user privacy and data security, and strive to build technology that people can rely on with confidence." }
        ].map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            className="px-6 py-5 md:px-8 md:py-6 rounded-3xl bg-white/60 border border-white/60 hover:bg-white/80 hover:border-teal-200 transition-all group shadow-sm hover:shadow-md"
          >
            <div className="flex items-center gap-4 mb-3">
              <div className="p-2.5 rounded-2xl bg-teal-50 shrink-0 group-hover:bg-teal-100 transition-colors">
                {item.icon}
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-slate-900">{item.title}</h3>
            </div>
            <p className="text-sm md:text-base text-slate-600 leading-relaxed">{item.text}</p>
          </motion.div>
        ))}
      </section>

      {/* Team Grid */}
      <section>
        <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-12 text-center">Meet the <span className="text-teal-600">Team</span></h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {teamMembers.map((member, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group relative rounded-3xl overflow-hidden bg-white/60 backdrop-blur-sm border border-white/60 shadow-sm hover:shadow-md transition-all"
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img 
                  src={member.image} 
                  alt={member.name} 
                  className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${member.imagePosition}`}
                />
              </div>
              <div className="p-6 flex flex-col items-center text-center">
                <h3 className="text-xl font-bold text-slate-900">{member.name}</h3>
                <p className="text-teal-600 text-sm mb-1 font-medium">{member.role}</p>
                <div className="flex items-center justify-center gap-1.5 text-slate-500 text-sm">
                  <MapPin size={14} className="text-teal-500" />
                  <span>{member.location}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

    </div>
  );
}