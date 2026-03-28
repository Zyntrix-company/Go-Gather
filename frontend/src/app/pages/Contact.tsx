import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Send, MessageSquare, User, AtSign, Globe, ChevronDown, Tag, AlertCircle } from 'lucide-react';
import countryList from 'country-list';
import SEO from '../components/SEO';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    country: '',
    message: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const countries = countryList.getData();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const selectedCountry = countries.find(c => c.code === formData.country);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          subject: formData.subject,
          country: selectedCountry?.name ?? formData.country,
          message: formData.message,
          to: import.meta.env.VITE_CONTACT_RECEIVER_EMAIL,
        }),
      });

      if (!res.ok) throw new Error();

      setIsSubmitted(true);
      setFormData({ name: '', email: '', subject: '', country: '', message: '' });
    } catch {
      setError('Something went wrong. Please try again or email us directly.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="pt-8 md:pt-28 pb-20 px-6 min-h-[calc(100vh-4rem)] flex flex-col justify-start">
      <SEO
        title="Contact GatherrGo — Get in Touch"
        description="Have a question or feedback? Reach out to the GatherrGo team at Hello@GatherrGo.com. We're here to help you get the most out of group travel planning."
        canonical="/contact"
      />
      <div className="max-w-3xl mx-auto w-full">
        {/* Header Section */}
        <section className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-4 mb-6"
          >
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner">
              <Mail className="w-6 h-6 text-teal-600" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900">
              Get in <span className="text-teal-600">Touch</span>
            </h1>
          </motion.div>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-base md:text-lg text-slate-600 font-normal max-w-2xl mx-auto"
          >
            Questions or feedback? Drop us a message below and our team will get back to you shortly.
          </motion.p>
        </section>

        {/* Form Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative rounded-3xl overflow-hidden bg-white/60 backdrop-blur-xl border border-white/60 shadow-lg shadow-teal-900/5 p-8 md:p-12 mb-12"
        >
          {isSubmitted ? (
            <div className="flex flex-col items-center justify-center py-12 text-center h-full min-h-[300px]">
              <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center mb-6">
                <Send className="w-8 h-8 text-teal-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Message Sent!</h3>
              <p className="text-slate-600">Thanks for reaching out. We'll be in touch soon.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-semibold text-slate-700 ml-1">Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-teal-600/50" />
                    </div>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/50 border border-teal-100 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none text-slate-700 placeholder:text-slate-400"
                      placeholder="Jane Doe"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-semibold text-slate-700 ml-1">Email</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <AtSign className="h-5 w-5 text-teal-600/50" />
                    </div>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/50 border border-teal-100 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none text-slate-700 placeholder:text-slate-400"
                      placeholder="jane@example.com"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="subject" className="text-sm font-semibold text-slate-700 ml-1">Subject</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Tag className="h-5 w-5 text-teal-600/50" />
                  </div>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/50 border border-teal-100 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none text-slate-700 placeholder:text-slate-400"
                    placeholder="Issue type"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="country" className="text-sm font-semibold text-slate-700 ml-1">Country</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Globe className="h-5 w-5 text-teal-600/50" />
                  </div>
                  <select
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    required
                    className={`w-full pl-11 pr-10 py-3 rounded-xl bg-white/50 border border-teal-100 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none appearance-none ${!formData.country ? 'text-slate-400' : 'text-slate-700'}`}
                  >
                    <option value="" disabled hidden>Select your country</option>
                    {countries.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <ChevronDown className="h-5 w-5 text-teal-600/50" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="message" className="text-sm font-semibold text-slate-700 ml-1">Message</label>
                <div className="relative">
                  <div className="absolute top-3 left-0 pl-4 flex pointer-events-none">
                    <MessageSquare className="h-5 w-5 text-teal-600/50" />
                  </div>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={5}
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/50 border border-teal-100 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none text-slate-700 placeholder:text-slate-400 resize-none"
                    placeholder="How can we help you?"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold transition-all shadow-[0_4px_14px_0_rgba(20,184,166,0.39)] hover:shadow-[0_6px_20px_rgba(20,184,166,0.23)] hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                <Send className="w-5 h-5" />
                {isLoading ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          )}
        </motion.section>

        {/* Email Footer Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <p className="text-slate-500 font-normal">
            Prefer to email us directly? Reach out at{' '}
            <a href="mailto:Hello@GatherrGo.com" className="text-teal-600 hover:text-teal-700 transition-colors underline decoration-teal-600/30 underline-offset-4 font-normal">
              Hello@GatherrGo.com
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}