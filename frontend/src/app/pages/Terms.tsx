import React from 'react';
import { motion } from 'motion/react';
import { Scale, CheckCircle, UserPlus, Lock, FileText, Award, Globe, CreditCard, AlertTriangle, XOctagon, Gavel, RefreshCw, Mail } from 'lucide-react';
import SEO from '../components/SEO';

export default function Terms() {
  return (
    <div className="max-w-4xl mx-auto px-6 pt-8 md:pt-28 pb-20">
      <SEO
        title="Terms & Conditions — GatherrGo"
        description="Review GatherrGo's Terms and Conditions. Understand your rights and responsibilities when using our group travel planning platform."
        canonical="/terms"
        noIndex={true}
      />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-12 text-center"
      >
        <div className="flex items-center justify-center gap-3 md:gap-4 mb-6">
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
            <Scale className="w-6 h-6 md:w-8 md:h-8 text-teal-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-slate-900 whitespace-nowrap">
            Terms & <span className="text-teal-600">Conditions</span>
          </h1>
        </div>
        <p className="text-base text-slate-600 font-normal">
          Last updated: 11 March 2026
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="p-8 md:p-12 rounded-3xl bg-white/70 backdrop-blur-md border border-white/60 shadow-xl shadow-teal-900/5 space-y-12"
      >
        <div className="space-y-6 text-base text-slate-600 font-normal">
          <p>
            Welcome to GatherrGo's Terms and Conditions ("Terms" or "Agreement").
          </p>
          <p>
            GatherrGo (the "App" or "we", "us", "our") is a mobile application that enables users to collaboratively plan group trips, events, expenses, reminders, photos, and memories in one private or shared space. These Terms govern your access to and use of the App and any services provided through it ("Services").
          </p>
          <p>
            By downloading, installing, accessing, or using the App, you agree to be bound by these Terms. If you do not agree, you must not use the App or Services.
          </p>
          <p>
            Please read these Terms carefully together with our Privacy Policy (available in the App or at [yourwebsite.com/privacy]).
          </p>
        </div>

        {/* Section 1 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <CheckCircle className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">1. Acceptance of Terms</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p>
              By using the Services, you confirm that you have read, understood, and agree to be bound by these Terms and consent to the practices described herein. If you are using the App on behalf of an entity, you represent that you have authority to bind that entity.
            </p>
          </div>
        </section>

        {/* Section 2 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <UserPlus className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">2. Eligibility</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p>
              You must be at least 13 years old (or the minimum age required in your country) to use the App. If you are between 13 and the age of majority in your jurisdiction, you must have parental or legal guardian consent. Users under 13 are not permitted. We may suspend or terminate access if eligibility requirements are not met.
            </p>
          </div>
        </section>

        {/* Section 3 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <Lock className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">3. User Accounts & Security</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p>
              To use certain features, you must create an account. You are responsible for maintaining the confidentiality of your login credentials and for all activities under your account. Notify us immediately of any unauthorised use. We are not liable for losses arising from your failure to secure your account.
            </p>
          </div>
        </section>

        {/* Section 4 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <FileText className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">4. User Content & Conduct</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p>
              You retain ownership of any content you upload or post (photos, itineraries, notes, messages, comments). By submitting content, you grant us a worldwide, non-exclusive, royalty-free, sublicensable, transferable licence to store, display, reproduce, distribute, and make available such content within the App and Services (including to group members or publicly if you choose to make it public).
            </p>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Upload illegal, harmful, offensive, or infringing content</li>
              <li>Harass, impersonate, spam, or abuse others</li>
              <li>Interfere with the App’s operation or security</li>
              <li>Scrape, reverse-engineer, or extract data without permission</li>
            </ul>
            <p>We may remove or disable content that violates these Terms.</p>
          </div>
        </section>

        {/* Section 5 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <Award className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">5. Intellectual Property</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p>
              All rights, title, and interest in the App, its design, code, logos, features, and content (except User Content) are owned by GatherrGo or its licensors. You may not copy, modify, distribute, or create derivative works without our written permission.
            </p>
          </div>
        </section>

        {/* Section 6 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <Globe className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">6. Third-Party Services & Affiliates</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p>
              The App integrates third-party services (e.g., Google Maps for location, Gemini AI for suggestions, AWS for storage, affiliate partners like Booking.com for bookings). Their terms and privacy policies apply. We are not responsible for their actions, availability, or content. We may earn commissions from affiliate referrals.
            </p>
          </div>
        </section>

        {/* Section 7 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <CreditCard className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">7. Payments & Subscriptions</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p>
              Certain features may require payment (premium exports, advanced AI, ad-free). Payments are processed by third-party providers (e.g., Stripe, Razorpay). You authorise recurring charges if you subscribe. Prices and features may change. No refunds except as required by law.
            </p>
          </div>
        </section>

        {/* Section 8 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <AlertTriangle className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">8. Limitation of Liability</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p>The App is provided “as is” without warranties of any kind. We are not liable for:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Inaccurate itineraries, missed reminders, or travel-related issues</li>
              <li>Data loss, interruptions, or security breaches</li>
              <li>Indirect, incidental, or consequential damages</li>
            </ul>
            <p>
              Our total liability shall not exceed the amount you paid us (if any) in the 12 months prior to the claim.
            </p>
          </div>
        </section>

        {/* Section 9 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <XOctagon className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">9. Termination</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p>
              We may suspend or terminate your access for violation of these Terms, illegal activity, or at our discretion. You may delete your account at any time. Upon termination, your licence to use the App ends.
            </p>
          </div>
        </section>

        {/* Section 10 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <Gavel className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">10. Governing Law & Dispute Resolution</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p>
              These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in Bengaluru, Karnataka.
            </p>
          </div>
        </section>

        {/* Section 11 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <RefreshCw className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">11. Changes to Terms</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p>
              We may update these Terms. We will notify you of material changes via in-app notice or email. Continued use after changes constitutes acceptance.
            </p>
          </div>
        </section>

        {/* Section 12 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <Mail className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">12. Contact</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p>For questions or support, you can reach out to us at:</p>
            <div className="mt-4 p-6 bg-teal-50/50 rounded-2xl border border-teal-100">
              <p>Email: <a href="mailto:Hello@GatherrGo.com" className="text-teal-600 hover:text-teal-700 transition-colors">Hello@GatherrGo.com</a></p>
            </div>
          </div>
        </section>

      </motion.div>
    </div>
  );
}