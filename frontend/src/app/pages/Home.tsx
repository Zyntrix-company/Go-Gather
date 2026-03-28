import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Zap, Plus, Smile, DollarSign, CheckCircle2, PlayCircle, Map, Calendar, FileText, Users, MapPin, Bell, Image as ImageIcon, CheckSquare, StickyNote, LayoutGrid, Camera, Download, Lock, UserCircle, Globe, Volleyball, Music, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FloatingScrollButton } from '../components/FloatingScrollButton';
import { PhoneMockup } from '../components/PhoneMockup';
import { SweeIcon } from '../components/SweeIcon';
import SEO from '../components/SEO';
import sweeDemoImage from '../../assets/3f5d071af92f156dd91cfea6f56f3f4142f883d1.png';
import sweeAvatarIcon from '../../assets/32aaf81826658483566c7e0c6e49568473964d07.png';
import organizeImage from '../../assets/23f3ba64d412985f40b1c229908cae4d3247693d.png';
import expensesImage from '../../assets/b9b19f824c62d7d6261dbc98e5722b85466ac468.png';
import balancesImage from '../../assets/df7fabf4ec70bc6b64296646e5bb8685aa6833d6.png';
import profileImage1 from '../../assets/99410f13f9d94e3bde83452943e0c6f6dcc4eace.png';
import profileImage2 from '../../assets/044b6feab45444c11604dc4cf5cb9943e8487615.png';
import feed1 from '../../assets/c9cd1b820be0a46a5b4ed487873eef62796e8d5b.png';
import feed2 from '../../assets/e9ecf5d5f09461d2bc15158749019ab1d38dfdb2.png';
import feed3 from '../../assets/f21a1ba61f871e75788befbcbbebd88882801765.png';
import feed4 from '../../assets/9d2abac71047cb68d66260af97ce5d646500fc97.png';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
};

export default function Home() {
  return (
    <div className="relative flex flex-col gap-8 pb-16 overflow-x-hidden bg-transparent -mt-24 pt-24">
      <SEO
        title="GatherrGo — Group Travel Planning App | Organize Trips & Split Expenses"
        description="GatherrGo is the all-in-one group travel app. Plan trips, coordinate itineraries, split expenses, and capture memories — all in one private space for your group."
        canonical="/"
      />
      <FloatingScrollButton />
      
      {/* Background Blobs */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#008E82]/15 blur-[120px] rounded-full pointer-events-none -z-10 translate-x-1/3 -translate-y-1/4" />
      <div className="absolute top-[20%] left-0 w-[600px] h-[600px] bg-teal-400/10 blur-[100px] rounded-full pointer-events-none -z-10 -translate-x-1/3" />
      
      {/* Hero Section */}
      <section className="relative px-6 pt-10 pb-6 md:pt-20 md:pb-12 overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center relative z-10">
          <div className="flex flex-col gap-6 text-center lg:text-left items-center lg:items-start lg:pl-32 xl:pl-44">
            <h1 className="w-full text-left text-5xl md:text-7xl font-bold tracking-tight text-slate-900 leading-[1.1]">
              <span className="whitespace-nowrap">Group Travel,</span><br />
              Organized.<br />
              <span className="text-teal-600">Finally.</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 max-w-lg leading-relaxed font-normal mt-2">
              All your trips, events, expenses, memories, and group plans — in one private space.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <button className="px-8 py-4 rounded-full bg-cyan-50 text-slate-800 font-bold transition-all shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] hover:shadow-[0_8px_25px_-4px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 flex items-center justify-center gap-3 border border-cyan-100 group min-w-[180px]">
                <PlayCircle className="w-6 h-6 text-teal-600 fill-teal-50/50" />
                Watch Demo
              </button>
              <button className="px-8 py-4 rounded-full bg-teal-500 hover:bg-teal-600 text-white font-bold transition-all shadow-[0_4px_14px_0_rgba(20,184,166,0.39)] hover:shadow-[0_6px_20px_rgba(20,184,166,0.23)] hover:-translate-y-0.5 min-w-[180px]">
                Get Started
              </button>
            </div>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative flex justify-center lg:justify-center xl:pr-12"
          >
            <div className="relative z-10 transform hover:scale-[1.02] transition-transform duration-700 ease-out">
              <PhoneMockup />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature 1: Create Trips */}
      <section className="px-6 py-12 relative">
        <div className="max-w-4xl mx-auto flex flex-col items-center text-center gap-12">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-8 w-full"
          >
            <div className="space-y-4 flex flex-col items-start md:items-center text-left md:text-center w-full">
              <div className="flex flex-row items-center justify-start md:justify-center gap-4 mb-6 md:mb-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-600 backdrop-blur-md border border-teal-200 shrink-0">
                  <Plus className="w-6 h-6" />
                </div>
                <h2 className="text-3xl md:text-5xl font-bold text-slate-900">
                  Create trips in <span className="text-teal-600">Seconds</span>
                </h2>
              </div>
              <p className="text-lg md:text-xl text-slate-600 font-normal leading-relaxed">
                Kickstart your adventure effortlessly. Upload documents, invite your squad, set the location, 
                and toggle reminders—all in one tap.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { 
                  icon: <FileText className="w-5 h-5" />, 
                  title: "Extract Details", 
                  color: "bg-orange-100 text-orange-600"
                },
                { 
                  icon: <Users className="w-5 h-5" />, 
                  title: "Add Members", 
                  color: "bg-blue-100 text-blue-600"
                },
                { 
                  icon: <MapPin className="w-5 h-5" />, 
                  title: "Select Location", 
                  color: "bg-pink-100 text-pink-600"
                },
                { 
                  icon: <Bell className="w-5 h-5" />, 
                  title: "Add Reminders", 
                  color: "bg-violet-100 text-violet-600"
                }
              ].map((card, i) => (
                <div key={i} className="bg-white/60 p-4 sm:px-6 sm:py-4 rounded-xl border border-white/60 hover:border-teal-300 shadow-sm transition-all group flex flex-col sm:flex-row items-center sm:justify-start justify-center gap-3 h-24 sm:h-20">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ${card.color}`}>
                    {card.icon}
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base text-center sm:text-left leading-tight">{card.title}</h3>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature 2: AI Buddy Swee */}
      <section className="px-6 py-12 relative">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
           <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <div className="flex flex-row items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-600 backdrop-blur-md border border-teal-200 shrink-0">
                <Smile className="w-6 h-6" />
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-slate-900">
                <span className="text-teal-600">Swee</span> - AI Buddy
              </h2>
            </div>
            <p className="text-lg md:text-xl text-slate-600 font-normal leading-relaxed">
              Planning a trip has never been easier. Swee learns your preferences and builds the perfect itinerary in seconds.
            </p>
             <div className="grid grid-cols-1 gap-6 mt-8">
              {[
                { 
                  title: "Personalized Planning", 
                  desc: "Ask Swee to plan your entire trip, from hotels to hidden gems.",
                  color: "bg-indigo-100 text-indigo-600"
                },
                { 
                  title: "Group Chat Collaboration", 
                  desc: "Add Swee to your group chat to suggest spots and settle debates.",
                  color: "bg-rose-100 text-rose-600"
                },
                { 
                  title: "Smart Recommendations", 
                  desc: "Get real-time suggestions based on your budget and style.",
                  color: "bg-amber-100 text-amber-600"
                }
              ].map((item, i) => (
                <div key={i} className="flex gap-4 p-4 rounded-xl bg-white/60 border border-white/60 hover:border-teal-300 shadow-sm transition-colors">
                   <div className="mt-1 min-w-[24px]">
                     <div className={`w-6 h-6 rounded-full flex items-center justify-center ${item.color}`}>
                       <Zap className="w-3 h-3" />
                     </div>
                   </div>
                   <div>
                     <h4 className="font-bold text-slate-900">{item.title}</h4>
                     <p className="text-sm text-slate-500 mt-1">{item.desc}</p>
                   </div>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative min-h-[600px] md:min-h-[700px] flex items-center justify-center"
          >
            {/* Main Container with Grid Layout */}
            <div className="relative w-full max-w-[450px] mx-auto px-4">
              
              {/* Top Row - User Message */}
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="mb-5"
              >
                <div className="bg-teal-500 text-white rounded-2xl rounded-tr-md px-3.5 py-2.5 shadow-lg max-w-[250px] ml-auto">
                  <p className="text-xs">Plan a 3-day trip to Bali for me and 3 friends. We love nature and beaches! 🌴</p>
                </div>
              </motion.div>

              {/* Swee Response with Avatar */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="mb-5 flex items-start gap-2.5"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shrink-0 p-1">
                  <SweeIcon className="w-full h-full" />
                </div>
                <div className="bg-slate-100 rounded-2xl rounded-tl-md px-3.5 py-2.5 shadow-lg max-w-[250px]">
                  <p className="text-xs text-slate-900">Perfect! Here's your tropical getaway itinerary 🏝️</p>
                </div>
              </motion.div>

              {/* Day 1 Card - Uluwatu */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="mb-3.5"
              >
                <div className="bg-white rounded-2xl overflow-hidden shadow-xl border-2 border-white hover:scale-[1.02] transition-transform">
                  <div className="flex gap-3.5 p-3.5">
                    <img 
                      src="https://images.unsplash.com/photo-1772508405878-bd5d7388d474?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxVbHV3YXR1JTIwdGVtcGxlJTIwQmFsaSUyMGNsaWZmc2lkZXxlbnwxfHx8fDE3NzM2NzcwNDl8MA&ixlib=rb-4.1.0&q=80&w=1080" 
                      alt="Uluwatu Temple" 
                      className="w-20 h-20 rounded-xl object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-xs font-bold rounded-full">
                          Day 1
                        </div>
                      </div>
                      <h4 className="font-bold text-slate-900 mb-1 text-sm">Uluwatu Temple</h4>
                      <p className="text-xs text-slate-600 mb-1.5">Monkey Forest • Rice Terraces • Traditional Dinner</p>
                      <p className="text-sm text-teal-600 font-semibold">$450/group</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Day 2 Card - Seminyak Beach */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 }}
                className="mb-3.5"
              >
                <div className="bg-white rounded-2xl overflow-hidden shadow-xl border-2 border-white hover:scale-[1.02] transition-transform">
                  <div className="flex gap-3.5 p-3.5">
                    <img 
                      src="https://images.unsplash.com/photo-1717501787981-d5f28eb2df5f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxTZW1pbnlhayUyMGJlYWNoJTIwQmFsaSUyMHN1bnNldHxlbnwxfHx8fDE3NzM2NzcwNTB8MA&ixlib=rb-4.1.0&q=80&w=1080" 
                      alt="Seminyak Beach" 
                      className="w-20 h-20 rounded-xl object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="px-2 py-0.5 bg-rose-100 text-rose-600 text-xs font-bold rounded-full">
                          Day 2
                        </div>
                      </div>
                      <h4 className="font-bold text-slate-900 mb-1 text-sm">Seminyak Beach</h4>
                      <p className="text-xs text-slate-600 mb-1.5">Beach Club • Snorkeling • Sunset Vibes</p>
                      <p className="text-sm text-teal-600 font-semibold">$520/group</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Day 3 & Day 4 - Two Column Grid */}
              <div className="grid grid-cols-2 gap-3.5">
                {/* Day 3 Card - Tanah Lot */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.6 }}
                >
                  <div className="bg-white rounded-xl overflow-hidden shadow-lg border-2 border-white hover:scale-[1.02] transition-transform h-full">
                    <img 
                      src="https://images.unsplash.com/photo-1724568834710-d5db3faab7e8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxUYW5haCUyMExvdCUyMHRlbXBsZSUyMEJhbGl8ZW58MXx8fHwxNzczNjc1MDc0fDA&ixlib=rb-4.1.0&q=80&w=1080" 
                      alt="Tanah Lot" 
                      className="w-full h-24 object-cover"
                    />
                    <div className="p-2.5">
                      <div className="px-2 py-0.5 bg-amber-100 text-amber-600 text-xs font-bold rounded-full inline-block mb-1.5">
                        Day 3
                      </div>
                      <h4 className="font-bold text-xs text-slate-900">Tanah Lot</h4>
                      <p className="text-xs text-slate-600 mb-1.5">Ocean Temple</p>
                      <p className="text-xs text-teal-600 font-semibold">$380/group</p>
                    </div>
                  </div>
                </motion.div>

                {/* Day 4 Card - Waterfall */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.7 }}
                >
                  <div className="bg-white rounded-xl overflow-hidden shadow-lg border-2 border-white hover:scale-[1.02] transition-transform h-full">
                    <img 
                      src="https://images.unsplash.com/photo-1728051767862-1df8f34ca2c3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxCYWxpJTIwd2F0ZXJmYWxsJTIwdHJvcGljYWx8ZW58MXx8fHwxNzczNjc3MDUwfDA&ixlib=rb-4.1.0&q=80&w=1080" 
                      alt="Waterfall Trek" 
                      className="w-full h-24 object-cover"
                    />
                    <div className="p-2.5">
                      <div className="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-xs font-bold rounded-full inline-block mb-1.5">
                        Bonus
                      </div>
                      <h4 className="font-bold text-xs text-slate-900">Waterfall Trek</h4>
                      <p className="text-xs text-slate-600 mb-1.5">Hidden Gem</p>
                      <p className="text-xs text-teal-600 font-semibold">$200/group</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature 3: Organize Your Way */}
      <section className="px-6 py-12 relative">
        <div className="max-w-4xl mx-auto flex flex-col items-center text-center gap-12">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-8 w-full"
          >
            <div className="space-y-4 flex flex-col items-start md:items-center text-left md:text-center w-full">
              <div className="flex flex-row items-center justify-start md:justify-center gap-4 mb-6 md:mb-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-600 backdrop-blur-md border border-teal-200 shrink-0">
                  <LayoutGrid className="w-6 h-6" />
                </div>
                <h2 className="text-3xl md:text-5xl font-bold text-slate-900">
                  Organize <span className="text-teal-600">your way</span>
                </h2>
              </div>
              <p className="text-lg md:text-xl text-slate-600 font-normal leading-relaxed">
                Upload docs, take notes, track expenses, and share moments—manage every detail exactly how you want.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { 
                  icon: <FileText className="w-5 h-5" />, 
                  title: "Import Docs", 
                  color: "bg-orange-100 text-orange-600 group-hover:bg-orange-200"
                },
                { 
                  icon: <ImageIcon className="w-5 h-5" />, 
                  title: "Share Photos", 
                  color: "bg-pink-100 text-pink-600 group-hover:bg-pink-200"
                },
                { 
                  icon: <CheckSquare className="w-5 h-5" />, 
                  title: "Group Polls", 
                  color: "bg-violet-100 text-violet-600 group-hover:bg-violet-200"
                },
                { 
                  icon: <Plus className="w-5 h-5" />, 
                  title: "Add Activities", 
                  color: "bg-cyan-100 text-cyan-600 group-hover:bg-cyan-200"
                },
                { 
                  icon: <DollarSign className="w-5 h-5" />, 
                  title: "Track Expenses", 
                  color: "bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200"
                },
                { 
                  icon: <StickyNote className="w-5 h-5" />, 
                  title: "Keep Notes", 
                  color: "bg-yellow-100 text-yellow-600 group-hover:bg-yellow-200"
                }
              ].map((card, i) => (
                <div key={i} className="bg-white/60 p-4 sm:px-6 sm:py-4 rounded-xl border border-white/60 hover:border-teal-300 shadow-sm transition-all group flex flex-col sm:flex-row items-center sm:justify-start justify-center gap-3 h-24 sm:h-20">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ${card.color}`}>
                    {card.icon}
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base text-center sm:text-left leading-tight">{card.title}</h3>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature 4: Money */}
      <section className="px-6 py-12 relative">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="order-2 md:order-1 relative w-full h-[550px] sm:h-[650px] md:h-[700px] flex items-center justify-center [perspective:1000px] mt-8 md:mt-0"
          >
            {/* Background Image (Balances) */}
            <div className="absolute top-0 right-[5%] md:right-[15%] w-[65%] sm:w-[55%] md:w-[60%] lg:w-[50%] rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)] border-[3px] border-slate-900 overflow-hidden bg-slate-900 transition-transform duration-700 hover:-translate-y-4 hover:rotate-2 z-10">
              <img 
                src={balancesImage} 
                alt="Balances Screen" 
                className="w-full h-auto block object-cover scale-[1.06]"
              />
            </div>
            
            {/* Foreground Image (Expenses) */}
            <div className="absolute bottom-0 left-[5%] md:left-[5%] w-[65%] sm:w-[55%] md:w-[60%] lg:w-[50%] rounded-[2rem] shadow-[0_30px_50px_-15px_rgba(0,142,130,0.3)] border-[3px] border-slate-900 overflow-hidden bg-slate-900 transition-transform duration-700 hover:-translate-y-4 hover:-rotate-2 z-20">
              <img 
                src={expensesImage} 
                alt="Expenses Screen" 
                className="w-full h-auto block object-cover scale-[1.06]"
              />
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-1 md:order-2 space-y-6"
          >
            <div className="flex flex-row items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-600 backdrop-blur-md border border-teal-200 shrink-0">
                <DollarSign className="w-6 h-6" />
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-slate-900">
                Money Where <span className="text-teal-600">It Belongs</span>
              </h2>
            </div>
            <p className="text-lg md:text-xl text-slate-600 font-normal leading-relaxed">
              Add expenses to an activity or the trip. Scan receipts. Split instantly. Zero awkwardness.
            </p>
             <ul className="space-y-4 pt-4">
              {[
                "Multi-currency support", 
                "Auto-balance calculation (who owes who)", 
                "Receipt scanning for quick entry"
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-slate-700">
                  <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 text-xs">
                     <CheckCircle2 className="w-4 h-4" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section>

       {/* Feature 5: Memories */}
      <section className="px-6 py-12 relative">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20 items-center">
           <motion.div 
             initial={{ opacity: 0, x: -50 }}
             whileInView={{ opacity: 1, x: 0 }}
             viewport={{ once: true }}
             className="space-y-6"
           >
            <div className="flex flex-row items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-600 backdrop-blur-md border border-teal-200 shrink-0">
                <ImageIcon className="w-6 h-6" />
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-slate-900">Share <span className="text-teal-600">Memories</span></h2>
            </div>
             <p className="text-lg md:text-xl text-slate-600 font-normal leading-relaxed">
              Capture moments and upload photos directly to specific trip activities in seconds.
            </p>
            <div className="grid grid-cols-1 gap-6 mt-8">
              {[
                { 
                  title: "Snap & Sync Instantly", 
                  desc: "No more chasing photos in group chats. Everything is organized by activity.",
                  color: "bg-indigo-100 text-indigo-600",
                  icon: <Camera className="w-3 h-3" />
                },
                { 
                  title: "Export Your Way", 
                  desc: "Download your entire journey or select specific collections.",
                  color: "bg-rose-100 text-rose-600",
                  icon: <Download className="w-3 h-3" />
                },
                { 
                  title: "Public or Private", 
                  desc: "Keep memories intimate within the group or share your adventure with the world.",
                  color: "bg-amber-100 text-amber-600",
                  icon: <Lock className="w-3 h-3" />
                }
              ].map((item, i) => (
                <div key={i} className="flex gap-4 p-4 rounded-xl bg-white/60 border border-white/60 hover:border-teal-300 shadow-sm transition-colors">
                   <div className="mt-1 min-w-[24px]">
                     <div className={`w-6 h-6 rounded-full flex items-center justify-center ${item.color}`}>
                       {item.icon}
                     </div>
                   </div>
                   <div>
                     <h4 className="font-bold text-slate-900">{item.title}</h4>
                     <p className="text-sm text-slate-500 mt-1">{item.desc}</p>
                   </div>
                </div>
              ))}
            </div>
           </motion.div>
           <motion.div 
             initial={{ opacity: 0, scale: 0.95 }}
             whileInView={{ opacity: 1, scale: 1 }}
             viewport={{ once: true }}
             className="relative grid grid-cols-2 gap-4 md:gap-6 px-2 md:px-0"
           >
              <div className="flex flex-col gap-4 md:gap-6 mt-8 md:mt-12">
                <img 
                  src="https://images.unsplash.com/photo-1758272959533-201492a5d36c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmllbmRzJTIwaGlraW5nJTIwb3V0ZG9vcnN8ZW58MXx8fHwxNzczMDY0OTY0fDA&ixlib=rb-4.1.0&q=80&w=1080" 
                  alt="Friends Hiking" 
                  className="w-full aspect-[4/5] object-cover rounded-3xl shadow-xl shadow-teal-900/10 border-[6px] border-white -rotate-3 hover:rotate-0 transition-all duration-300 hover:scale-105 hover:z-10 relative" 
                />
                <img 
                  src="https://images.unsplash.com/photo-1758272959073-f2be51626e04?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxncm91cCUyMHNlbGZpZSUyMHZhY2F0aW9ufGVufDF8fHx8MTc3MzA2NDk2NHww&ixlib=rb-4.1.0&q=80&w=1080" 
                  alt="Vacation Selfie" 
                  className="w-full aspect-square object-cover rounded-3xl shadow-xl shadow-teal-900/10 border-[6px] border-white rotate-2 hover:rotate-0 transition-all duration-300 hover:scale-105 hover:z-10 relative" 
                />
              </div>
              <div className="flex flex-col gap-4 md:gap-6 mb-8 md:mb-12">
                <img 
                  src="https://images.unsplash.com/photo-1753351051905-8b341bdbd3aa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmllbmRzJTIwbGF1Z2hpbmclMjBkaW5uZXJ8ZW58MXx8fHwxNzczMDY0OTYzfDA&ixlib=rb-4.1.0&q=80&w=1080" 
                  alt="Friends Dinner" 
                  className="w-full aspect-square object-cover rounded-3xl shadow-xl shadow-teal-900/10 border-[6px] border-white rotate-3 hover:rotate-0 transition-all duration-300 hover:scale-105 hover:z-10 relative" 
                />
                <img 
                  src="https://images.unsplash.com/photo-1752650143569-fdde2123653d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmllbmRzJTIwbG9va2luZyUyMGF0JTIwbWFwfGVufDF8fHx8MTc3MzA2NDk2Nnww&ixlib=rb-4.1.0&q=80&w=1080" 
                  alt="Looking at Map" 
                  className="w-full aspect-[4/5] object-cover rounded-3xl shadow-xl shadow-teal-900/10 border-[6px] border-white -rotate-2 hover:rotate-0 transition-all duration-300 hover:scale-105 hover:z-10 relative" 
                />
              </div>
           </motion.div>
        </div>
      </section>
      
      {/* Feature 5.5: Profiles */}
      <section className="px-6 py-12 md:py-24 relative">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 lg:gap-20 items-center">
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-6 order-1 md:order-2"
          >
            <div className="space-y-4 flex flex-col items-start w-full">
              <div className="flex flex-row items-center gap-4 mb-6 md:mb-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-600 backdrop-blur-md border border-teal-200 shrink-0">
                  <UserCircle className="w-6 h-6" />
                </div>
                <h2 className="text-3xl md:text-5xl font-bold text-slate-900">
                  Your <span className="text-teal-600">Album</span>
                </h2>
              </div>
              <p className="text-lg md:text-xl text-slate-600 font-normal leading-relaxed">
                Maintain a beautifully organized profile containing albums of all your past trips and unforgettable events. Relive your favorite moments anytime.
              </p>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative flex flex-row items-center justify-center gap-4 order-2 md:order-1 px-2"
          >
            {/* Phone 1 */}
            <div className="relative w-[45%] max-w-[260px] h-auto bg-white/20 backdrop-blur-xl rounded-[28px] sm:rounded-[36px] md:rounded-[40px] shadow-2xl border-[3px] sm:border-[4px] border-slate-900 overflow-hidden transform -translate-y-4 md:-translate-y-6 rotate-2 hover:rotate-0 hover:z-10 transition-all duration-500">
               <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[35%] h-[18px] sm:h-5 md:h-6 bg-slate-900 rounded-b-xl sm:rounded-b-2xl z-20"></div>
               <img 
                  src={profileImage1}
                  alt="Profile View 1" 
                  className="w-full h-auto block"
               />
            </div>
            
            {/* Phone 2 */}
            <div className="relative w-[45%] max-w-[260px] h-auto bg-white/20 backdrop-blur-xl rounded-[28px] sm:rounded-[36px] md:rounded-[40px] shadow-2xl border-[3px] sm:border-[4px] border-slate-900 overflow-hidden transform translate-y-6 md:translate-y-10 -rotate-3 hover:rotate-0 hover:z-10 transition-all duration-500">
               <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[35%] h-[18px] sm:h-5 md:h-6 bg-slate-900 rounded-b-xl sm:rounded-b-2xl z-20"></div>
               <img 
                  src={profileImage2}
                  alt="Profile View 2" 
                  className="w-full h-auto block"
               />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature 5.75: Feeds */}
      <section className="px-6 py-12 md:py-24 relative">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col items-start lg:items-center text-left lg:text-center mb-16"
          >
            <div className="flex flex-row items-center justify-start lg:justify-center gap-4 mb-6 w-full">
              <div className="w-12 h-12 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-600 backdrop-blur-md border border-teal-200 shrink-0">
                <Globe className="w-6 h-6" />
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-slate-900">
                <span className="text-teal-600">Explore</span> Adventures
              </h2>
            </div>
            <p className="text-lg md:text-xl text-slate-600 font-normal leading-relaxed max-w-3xl text-left lg:text-center lg:mx-auto">
              Discover breathtaking journeys from travelers around the world. Explore their detailed itineraries, transparent expenses, and connect to follow their future adventures.
            </p>
          </motion.div>

          <div className="columns-2 lg:columns-4 gap-4 md:gap-6 lg:gap-8">
            {[feed1, feed2, feed3, feed4].map((feedImg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1, duration: 0.5 }}
                className="break-inside-avoid mb-4 md:mb-6 lg:mb-8 group relative rounded-2xl md:rounded-3xl overflow-hidden shadow-lg shadow-slate-200/50 border-[2px] md:border-[3px] border-white/80 bg-white hover:-translate-y-2 hover:shadow-2xl hover:shadow-teal-900/10 transition-all duration-300 cursor-pointer"
              >
                <img 
                  src={feedImg} 
                  alt={`Community Feed ${idx + 1}`} 
                  className="w-full h-auto block transform group-hover:scale-[1.02] transition-transform duration-500" 
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature 6: More Than Trips */}
       <section className="px-6 py-12 relative">
        <div className="max-w-7xl mx-auto mb-12 flex flex-col items-center text-center">
            <div className="flex flex-row items-center justify-center gap-4 mb-6 w-full">
              <div className="w-12 h-12 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-600 backdrop-blur-md border border-teal-200 shrink-0">
                <LayoutGrid className="w-6 h-6" />
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-slate-900">More Than <span className="text-teal-600">Trips</span></h2>
            </div>
            <p className="text-lg md:text-xl text-slate-600 font-normal max-w-2xl text-center mx-auto">
              Plan, organize, split costs, and share memories. The same powerful tools that simplify your travels work perfectly for every celebration.
            </p>
        </div>
        <div className="max-w-4xl mx-auto grid grid-cols-2 gap-4 md:gap-6">
           {[
             { title: "Birthdays", color: "bg-pink-100 text-pink-600", icon: <Smile className="w-5 h-5" /> },
             { title: "Sports", color: "bg-indigo-100 text-indigo-600", icon: <Volleyball className="w-5 h-5" /> },
             { title: "Concerts", color: "bg-amber-100 text-amber-600", icon: <Music className="w-5 h-5" /> },
             { title: "Weddings", color: "bg-rose-100 text-rose-600", icon: <Calendar className="w-5 h-5" /> }
           ].map((item, i) => (
             <motion.div
               key={i}
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               transition={{ delay: i * 0.1 }}
               className="flex items-center gap-4 p-4 rounded-xl bg-white/60 border border-white/60 hover:border-teal-300 shadow-sm transition-colors cursor-pointer group"
             >
               <div className="min-w-[40px]">
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.color} group-hover:scale-110 transition-transform`}>
                   {item.icon}
                 </div>
               </div>
               <div className="text-left">
                 <h4 className="font-bold text-base md:text-base text-slate-900">{item.title}</h4>
               </div>
             </motion.div>
           ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-12">
        <div className="max-w-5xl mx-auto text-center relative p-12 rounded-3xl overflow-hidden border border-teal-100 shadow-2xl shadow-teal-900/10">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-50 to-white backdrop-blur-xl" />
          
          <div className="relative z-10">
            <h2 className="text-[30px] sm:text-4xl md:text-5xl font-bold text-slate-900 mb-4 md:mb-6 whitespace-nowrap md:whitespace-normal tracking-tight">Ready to <span className="text-teal-600">Gatherr</span>?</h2>
            <p className="text-sm md:text-lg text-slate-600 mb-8 mx-auto leading-relaxed max-w-[280px] md:max-w-none">
              <span className="block md:hidden">
                Join thousands of travelers and event planners who are building memories with GatherrGo.
              </span>
              <span className="hidden md:block">
                Join thousands of travelers and event planners who are<br />
                building memories with GatherrGo.
              </span>
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button className="px-8 py-4 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-bold transition-all shadow-[0_4px_14px_0_rgba(20,184,166,0.39)] hover:-translate-y-1">
                Get Started Now
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}