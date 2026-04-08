import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Trash2, Mail, ShieldCheck, Clock, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Send } from 'lucide-react';
import SEO from '../components/SEO';

const steps = [
  {
    number: '01',
    title: 'Send a Deletion Request',
    description: (
      <>
        Email us at{' '}
        <a
          href="mailto:Support@GatherrGo.com?subject=Data Deletion Request"
          className="text-teal-600 hover:text-teal-700 underline underline-offset-4 decoration-teal-600/30 transition-colors"
        >
          Support@GatherrGo.com
        </a>{' '}
        with the subject line <span className="font-semibold text-slate-700">"Data Deletion Request"</span>.
      </>
    ),
  },
  {
    number: '02',
    title: 'Include Your Account Details',
    description: (
      <>
        In your email, include the email address or phone number associated with your GatherrGo account so we can locate and verify your data.
      </>
    ),
  },
  {
    number: '03',
    title: 'We Verify & Process',
    description: (
      <>
        Our team will verify your identity and begin processing your deletion request. You will receive a confirmation email once the process starts.
      </>
    ),
  },
  {
    number: '04',
    title: 'Data Deleted Within 30 Days',
    description: (
      <>
        All personal data associated with your account — including profile information, trip data, and uploaded content — will be permanently deleted within <span className="font-semibold text-slate-700">30 days</span> of your verified request.
      </>
    ),
  },
];

const faqs = [
  {
    question: 'What data gets deleted?',
    answer:
      'All personal data we hold about you will be deleted, including your account profile, trip plans, expense records, uploaded photos, and any other content you created within GatherrGo.',
  },
  {
    question: 'Is the deletion permanent?',
    answer:
      'Yes. Once your data is deleted, it cannot be recovered. We recommend exporting any trip memories or records you wish to keep before submitting your request.',
  },
  {
    question: 'Will my data be deleted from backups too?',
    answer:
      'Your data will be removed from active systems within 30 days. Encrypted backup copies are automatically purged within 90 days as part of our standard backup rotation policy.',
  },
  {
    question: 'What if I signed up through a third-party (e.g. Google, Facebook)?',
    answer:
      'Deleting your GatherrGo account removes the data we hold. You should also review and revoke app permissions directly within your Google or Facebook account settings.',
  },
  {
    question: 'Can I delete only some of my data?',
    answer:
      'Yes. If you would like to delete specific content (such as a particular trip or uploaded photo) rather than your full account, mention the details in your email and we will handle it accordingly.',
  },
];

export default function DataDeletion() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [formData, setFormData] = useState({ email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ email: '', message: '' });
    }, 3500);
  };

  return (
    <div className="pt-8 pb-20 px-6 max-w-4xl mx-auto space-y-14">
      <SEO
        title="Data Deletion Instructions — GatherrGo"
        description="Learn how to request deletion of your personal data from GatherrGo. Submit a request by email and we will permanently delete your account data within 30 days."
        canonical="/data-deletion"
      />

      {/* Header */}
      <motion.section
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-50 border border-red-100 shadow-inner mb-2">
          <Trash2 className="w-7 h-7 text-red-500" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900">
          Data <span className="text-teal-600">Deletion</span> Instructions
        </h1>
        <p className="text-base md:text-lg text-slate-600 font-normal max-w-2xl mx-auto">
          You have the right to request that your personal data be permanently deleted from GatherrGo at any time. Follow the steps below to submit your request.
        </p>
      </motion.section>

      {/* Quick info pills */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap justify-center gap-4"
      >
        {[
          { icon: <Clock className="w-4 h-4" />, text: 'Processed within 30 days' },
          { icon: <ShieldCheck className="w-4 h-4" />, text: 'Permanently & securely deleted' },
          { icon: <Mail className="w-4 h-4" />, text: 'No account login required' },
        ].map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-50 border border-teal-100 text-teal-700 text-sm font-medium"
          >
            {item.icon}
            {item.text}
          </span>
        ))}
      </motion.div>

      {/* Step-by-step */}
      <section className="space-y-4">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900">How to Delete Your Data</h2>
        <div className="space-y-4">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
              className="flex gap-5 p-6 rounded-2xl bg-white/60 border border-white/60 hover:border-teal-200 hover:bg-white/80 transition-all shadow-sm"
            >
              <span className="text-2xl font-black text-teal-200 shrink-0 leading-none pt-0.5">{step.number}</span>
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-1">{step.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* What gets deleted */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="rounded-3xl bg-white/60 border border-white/60 shadow-sm p-8 space-y-5"
      >
        <h2 className="text-2xl font-bold text-slate-900">What Data Will Be Deleted</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            'Account profile & personal information',
            'Trip plans, itineraries & event data',
            'Expense records & split history',
            'Uploaded photos & media',
            'Group memberships & connections',
            'Messages & activity history',
            'Device identifiers & session data',
            'Any other user-generated content',
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-slate-600">
              <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" />
              {item}
            </div>
          ))}
        </div>
        <div className="flex items-start gap-3 mt-2 p-4 rounded-xl bg-amber-50 border border-amber-100">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Note:</span> Deletion is permanent and irreversible. We recommend saving any trip memories or records you wish to keep before submitting your request.
          </p>
        </div>
      </motion.section>

      {/* Quick request form */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="rounded-3xl bg-white/60 border border-white/60 shadow-lg shadow-teal-900/5 p-8 md:p-10 space-y-6"
      >
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Submit a Deletion Request</h2>
          <p className="text-sm text-slate-500 mt-1">Fill out the form below or email us directly at <a href="mailto:Support@GatherrGo.com?subject=Data Deletion Request" className="text-teal-600 hover:underline">Support@GatherrGo.com</a></p>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center mb-4">
              <Send className="w-7 h-7 text-teal-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-1">Request Received</h3>
            <p className="text-slate-500 text-sm">We'll process your deletion request and confirm via email within 30 days.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="del-email" className="text-sm font-semibold text-slate-700">Email address on your account</label>
              <input
                id="del-email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl bg-white/50 border border-teal-100 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none text-slate-700 placeholder:text-slate-400 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="del-message" className="text-sm font-semibold text-slate-700">Additional details <span className="font-normal text-slate-400">(optional)</span></label>
              <textarea
                id="del-message"
                rows={3}
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                placeholder="e.g. delete only specific trips, or full account deletion"
                className="w-full px-4 py-3 rounded-xl bg-white/50 border border-teal-100 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none text-slate-700 placeholder:text-slate-400 text-sm resize-none"
              />
            </div>
            <button
              type="submit"
              className="px-8 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold transition-all shadow-[0_4px_14px_0_rgba(239,68,68,0.3)] hover:-translate-y-0.5 flex items-center gap-2 text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Submit Deletion Request
            </button>
          </form>
        )}
      </motion.section>

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="rounded-2xl bg-white/60 border border-white/60 hover:border-teal-200 transition-all overflow-hidden shadow-sm"
            >
              <button
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="w-full flex items-center justify-between px-6 py-4 text-left"
              >
                <span className="text-sm font-semibold text-slate-800">{faq.question}</span>
                {openFaq === index
                  ? <ChevronUp className="w-4 h-4 text-teal-500 shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
              </button>
              {openFaq === index && (
                <div className="px-6 pb-5 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                  {faq.answer}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Contact fallback */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="text-center text-slate-500 text-sm"
      >
        Still have questions?{' '}
        <a href="mailto:Support@GatherrGo.com" className="text-teal-600 hover:text-teal-700 underline underline-offset-4 transition-colors">
          Email us at Support@GatherrGo.com
        </a>
      </motion.div>
    </div>
  );
}
