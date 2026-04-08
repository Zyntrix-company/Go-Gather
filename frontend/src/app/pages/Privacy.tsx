import React from 'react';
import { motion } from 'motion/react';
import { Shield, FileText, Database, Download, Activity, Cookie, Share2, UserCheck, Trash2, Globe, ShieldCheck, Clock, Briefcase, Users, RefreshCw, Mail } from 'lucide-react';
import SEO from '../components/SEO';

export default function Privacy() {
  return (
    <div className="max-w-4xl mx-auto px-6 pt-8 md:pt-28 pb-20">
      <SEO
        title="Privacy Policy — GatherrGo"
        description="Read GatherrGo's Privacy Policy to understand how we collect, use, and protect your personal data. Your privacy and data security are our top priorities."
        canonical="/privacy"
        noIndex={true}
      />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-12 text-center"
      >
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
            <Shield className="w-8 h-8 text-teal-600" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900">
            Privacy <span className="text-teal-600">Policy</span>
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
            Welcome to GatherrGo's privacy policy ("Privacy Policy" or "Policy").
          </p>
          <p>
            GatherrGo (the "App" or "we", "us", "our") is a mobile application that enables users to collaboratively plan group trips, events, expenses, reminders, photos, and memories in one private or shared space. This Policy outlines our practices in relation to the collection, storage, usage, processing, and disclosure of personal data that you have consented to share with us when you access, use, or otherwise interact with our mobile application 'GatherrGo' (the "Platform") or avail products or services that GatherrGo offers you on or through the Platform (collectively, the "Services").
          </p>
          <p>
            At GatherrGo, we are committed to protecting your personal data and respecting your privacy. In order to provide you with access to the Services, we have to collect and otherwise process certain data about you. This Policy explains how we process and use personal data about you.
          </p>
          <p>
            Please note that unless specifically defined in this Policy, capitalised terms shall have the same meaning ascribed to them in our Terms and Conditions, available in the App or at <a href="https://www.gatherrgo.com/terms" className="text-teal-600 hover:text-teal-700 transition-colors">https://www.gatherrgo.com/terms</a> ("Terms"). Please read this Policy in consonance with the Terms.
          </p>
          <p>
            By using the Services, you confirm that you have read and agree to be bound by this Policy and consent to the processing activities described under this Policy. Please refer to Section 1 to understand how the terms of this Policy apply to you.
          </p>
        </div>

        {/* Section 1 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <FileText className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">1. Background and Key Information</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p><strong className="text-slate-900 font-semibold">(a) How this Policy applies:</strong><br />
            This Policy applies to individuals who access or use the Services. For the avoidance of doubt, references to “you” across this Policy are to an end user that uses the Platform. By using the Platform, you consent to the collection, storage, usage, and disclosure of your personal data, as described in and collected by us in accordance with this Policy.</p>
            <p><strong className="text-slate-900 font-semibold">(b) Review and Updates:</strong><br />
            We regularly review and update our Privacy Policy, and we request you to regularly review this Policy. It is important that the personal data we hold about you is accurate and current. Please let us know if your personal data changes during your relationship with us.</p>
            <p><strong className="text-slate-900 font-semibold">(c) Third-Party Services:</strong><br />
            The Platform may include links to third-party websites, plug-ins, services, and applications (“Third-Party Services”). Clicking on those links or enabling those connections may allow third parties to collect or share data about you. We neither control nor endorse these Third-Party Services and are not responsible for their privacy statements. When you leave the Platform or access third-party links through the Platform, we encourage you to read the privacy policy of such third-party service providers.</p>
          </div>
        </section>

        {/* Section 2 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <Database className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">2. Personal Data That We Collect</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p><strong className="text-slate-900 font-semibold">(a) We collect different types of personal data about you. This includes, but is not limited to:</strong></p>
            <ul className="list-disc pl-6 space-y-2">
              <li>(i) Contact Data, such as your email addresses, phone numbers, and location (if enabled for reminders).</li>
              <li>(ii) Identity and Profile Data, such as your name, username or similar identifiers, photographs, and gender (optional).</li>
              <li>(iii) Trip and Travel Data, such as itineraries, dates, locations, expenses, receipts, photos, notes, group members, chat messages, and AI assistant (Swee) interactions.</li>
              <li>(iv) Marketing and Communications Data, such as your preferences in receiving marketing communications from us and our third parties, and your communication preferences. We also collect your chat records when you communicate with Swee or group members through the Platform.</li>
              <li>(v) Technical Data, which includes your IP address, browser type, Internet Service Provider, details of operating system, access time, page views, device ID, device type, frequency of visiting the App and use of the Platform, app activity, clicks, date and time stamps, location data, and other technology on the devices that you use to access the Platform.</li>
              <li>(vi) Transaction Data, such as details of premium features or in-app purchases you have availed, a limited portion of your credit or debit card details for tracking transactions that are provided to us by payment processors, and UPI IDs for processing payments (India only).</li>
              <li>(vii) Usage Data, which includes information about how you use the Services, your activity on the Platform, trip history, user taps and clicks, user interests, time spent on the Platform, details about user journey on the mobile application, and page views.</li>
            </ul>
            <p><strong className="text-slate-900 font-semibold">(b)</strong> We also collect, use, and share aggregated data such as statistical or demographic data for any purpose. Aggregated data could be derived from your personal data but is not considered personal data under law as it does not directly or indirectly reveal your identity. However, if we combine or connect aggregated data with your personal data so that it can directly or indirectly identify you, we treat the combined data as personal data which will be used in accordance with this Policy.</p>
            <p><strong className="text-slate-900 font-semibold">(c) What happens if I refuse to provide my personal data?</strong><br />
            Where we need to collect personal data by law, or under the terms of a contract, and you fail to provide that data when requested, we may not be able to perform the contract (for example, to provide you with the Services). In this case, we may have to cancel or limit your access to the Services.</p>
          </div>
        </section>

        {/* Section 3 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <Download className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">3. How Do We Collect Personal Data?</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p>We use different methods to collect personal data from and about you including through:</p>
            <p><strong className="text-slate-900 font-semibold">(a) Direct Interactions.</strong> You provide us your personal data when you interact with us. This includes personal data you provide when you:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>(i) create an account or profile with us;</li>
              <li>(ii) use our Services or carry out other activities in connection with the Services;</li>
              <li>(iii) enter a promotion, user poll, or online surveys;</li>
              <li>(iv) request marketing communications to be sent to you; or</li>
              <li>(v) report a problem with the Platform and/or our Services, give us feedback or contact us.</li>
            </ul>
            <p><strong className="text-slate-900 font-semibold">(b) Automated technologies or interactions.</strong> Each time you visit or use the Platform, we will automatically collect Technical Data about your equipment, browsing actions, and patterns. We collect this personal data by using cookies, web beacons, pixel tags, server logs, and other similar technologies. We may also receive Technical Data about you if you visit other websites or apps that employ our cookies.</p>
            <p><strong className="text-slate-900 font-semibold">(c) Third parties or publicly available sources.</strong> We will receive personal data about you from various third parties:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>(i) Technical data from analytics providers such as Google;</li>
              <li>(ii) Identity and profile-related Data and Contact Data from social login providers (Google, Apple, Facebook);</li>
              <li>(iii) Personal data about you from our affiliate entities.</li>
            </ul>
          </div>
        </section>

        {/* Section 4 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <Activity className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">4. How Do We Use Your Personal Data?</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p><strong className="text-slate-900 font-semibold">(a)</strong> We will only use your personal data when the law allows us to. Most commonly, we will use your personal data where we need to perform a contract with you, where you have given us permission to do so, where processing your personal information is in our legitimate interests, or where we need to comply with the law. We use your personal data for the following purposes:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>(i) to verify your identity to register you as a user, and create your user account with us on the Platform;</li>
              <li>(ii) to provide the Services to you;</li>
              <li>(iii) to enable real-time collaboration and AI assistance (Swee);</li>
              <li>(iv) to monitor trends and personalise your experience;</li>
              <li>(v) to improve the functionality of our Services based on the information and feedback we receive from you;</li>
              <li>(vi) to improve customer service to effectively respond to your Service requests and support needs;</li>
              <li>(vii) to track transactions and process payments;</li>
              <li>(viii) to send periodic notifications to manage our relationship with you including to notify you of changes to the Services, send you information and updates pertaining to the Services you have availed, and to receive occasional company news and updates related to us or the Services;</li>
              <li>(ix) to assist with the facilitation of the Services offered to you, including to send you information and updates about the Services you have availed;</li>
              <li>(x) to market and advertise the Services to you;</li>
              <li>(xi) to comply with legal obligations;</li>
              <li>(xii) to administer and protect our business and the Services, including for troubleshooting, data analysis, system testing, and performing internal operations;</li>
              <li>(xiii) to improve our business and delivery models;</li>
              <li>(xiv) to perform our obligations that arise out of the arrangement we are about to enter or have entered with you;</li>
              <li>(xv) to enforce our Terms; and</li>
              <li>(xvi) to respond to court orders, establish or exercise our legal rights, or defend ourselves against legal claims.</li>
            </ul>
            <p><strong className="text-slate-900 font-semibold">(b)</strong> You agree and acknowledge that by using our Services and creating an account with us on the Platform, you authorise us, our service providers, and affiliates to contact you via email, push notification, or otherwise. This is to provide the Services to you and ensure that you are aware of all the features of the Services and for related purposes.</p>
            <p><strong className="text-slate-900 font-semibold">(c)</strong> You agree and acknowledge that any and all information pertaining to you, whether or not you directly provide it to us (via the Services or otherwise), including but not limited to personal correspondence such as messages with Swee, may be collected, compiled, and shared by us in order to render the Services to you. This may include but not be limited to service providers that provide or seek to provide services for us or on our behalf. We may also share this information with other entities in connection with the above-mentioned purposes.</p>
            <p><strong className="text-slate-900 font-semibold">(d)</strong> You agree and acknowledge that we may share data without your consent, when it is required by law or by any court or government agency or authority to disclose such information. Such disclosures are made in good faith and belief that it is reasonably necessary to do so for enforcing this Policy or the Terms, or in order to comply with any applicable laws and regulations.</p>
          </div>
        </section>

        {/* Section 5 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <Cookie className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">5. Cookies</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p><strong className="text-slate-900 font-semibold">(a)</strong> Cookies are small files that a site or its service provider transfers to your device’s hard drive through your web browser (if you permit it to) that enables the sites or service providers’ systems to recognise your browser and capture and remember certain information.</p>
            <p><strong className="text-slate-900 font-semibold">(b)</strong> We use cookies to help us distinguish you from other users of the Platform, understand and save your preferences for future visits, keep track of advertisements and compile aggregate data about site traffic and site interaction so that we can offer you a seamless user experience. We may contact third-party service providers to assist us in better understanding our users. These service providers are not permitted to use the information collected on our behalf except to help us conduct and improve our business.</p>
            <p><strong className="text-slate-900 font-semibold">(c)</strong> Additionally, you may encounter cookies or other similar devices on certain pages of the Platform that are placed by third parties. We do not control the use of cookies by third parties. If you send us personal correspondence, such as emails, or if other users or third parties send us correspondence about your activities or postings on the Platform, we may collect such information within a file specific to you.</p>
          </div>
        </section>

        {/* Section 6 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <Share2 className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">6. Disclosures of Your Personal Data</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p><strong className="text-slate-900 font-semibold">(a)</strong> We may share your personal data with third parties set out below for the purposes set out in Section 4:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>(i) Group members to enable collaboration (trip-related data only);</li>
              <li>(ii) Internal third parties, which are other companies within our group of companies (if any);</li>
              <li>(iii) External third parties such as:
                <ul className="list-[circle] pl-6 mt-2 space-y-2">
                  <li>trusted third parties such as our associate partners, and service providers that provide services for us or on our behalf. This includes hosting and operating our Platform, providing marketing assistance, conducting our business, processing payments and transaction-related processes, transmitting content, and providing our Services to you;</li>
                  <li>analytic service providers and advertising networks that conduct web analytics for us to help us improve the Platform. These analytics providers may use cookies and other technologies to perform their services;</li>
                  <li>regulators and other bodies, as required by law or regulation.</li>
                </ul>
              </li>
            </ul>
            <p><strong className="text-slate-900 font-semibold">(b)</strong> We require all third parties to respect the security of your personal data and to treat it in accordance with the law. We do not allow our third-party service providers to use your personal data for their own purposes and only permit them to process your personal data for specified purposes and in accordance with our instructions.</p>
          </div>
        </section>

        {/* Section 7 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <UserCheck className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">7. Your Rights in Relation to Your Personal Data</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p><strong className="text-slate-900 font-semibold">(a) Access and Updating your Personal Data:</strong> You hereby warrant that all personal data that you provide us with is accurate, up-to-date, and true. When you use our Services, we make best efforts to provide you with the ability to access and correct inaccurate or deficient data, subject to any legal requirements. You can request GatherrGo for a copy of your personal data by sending an email to Support@GatherrGo.com. GatherrGo may take up to 30 days to respond to such a request.</p>
            <p><strong className="text-slate-900 font-semibold">(b) Opting-out of Marketing and Promotional Communications:</strong> When we send you marketing and promotional content through push notification or email, we make best efforts to provide you with the ability to opt-out of such communications by using the opt-out instructions provided in such communications. You understand and acknowledge that it may take us up to 10 business days to give effect to your opt-out request. Please note that we may still send you emails about your user account or any Services you have requested or received from us.</p>
          </div>
        </section>

        {/* Section 8 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <Trash2 className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">8. Deletion of Account and Personal Data</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p><strong className="text-slate-900 font-semibold">(a)</strong> Notwithstanding anything contained in the Terms, you may delete your account as well as your personal data stored with GatherrGo by sending an email to Support@GatherrGo.com. GatherrGo may take up to 30 days to process your request. Once your account is deleted, you will lose access to all Services. For avoidance of doubt, it is hereby clarified that all data with respect to transactions performed by you on the Platform will be retained in accordance with applicable law.</p>
          </div>
        </section>

        {/* Section 9 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <Globe className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">9. Transfers of Your Personal Data</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p><strong className="text-slate-900 font-semibold">(a)</strong> We comply with applicable laws in respect of storage and transfers of personal data. As a part of your use of the Services, the information and personal data you provide to us may be transferred to and stored in countries other than the country you are based in. This may happen if any of our servers are from time to time located in a country other than the one you are based, or one of our vendors, partners, or service providers is located in a country other than one you are based in.</p>
            <p><strong className="text-slate-900 font-semibold">(b)</strong> By submitting your information and personal data to us, you agree to the transfer, storage, and processing of such information and personal data in the manner described above.</p>
          </div>
        </section>

        {/* Section 10 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <ShieldCheck className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">10. Data Security</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p><strong className="text-slate-900 font-semibold">(a)</strong> We implement appropriate security measures and privacy-protective features on our Platform including encryption, password protection, and physical security measures to protect your personal data from unauthorised access and disclosure, and follow standards prescribed by applicable law.</p>
            <p><strong className="text-slate-900 font-semibold">(b)</strong> Where you have chosen a password that enables you to access certain parts of the Services, you are responsible for keeping this password secret and confidential. We will not be responsible for any unauthorised use of your information, or for any lost, stolen, or compromised passwords, or for any activity on your user account due to such unauthorised disclosure of your password. In the event your password has been compromised in any manner whatsoever, you should promptly notify us to enable us to initiate a change of password.</p>
          </div>
        </section>

        {/* Section 11 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <Clock className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">11. Data Retention</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p><strong className="text-slate-900 font-semibold">(a)</strong> You agree and acknowledge that your personal data will continue to be stored and retained by us for as long as necessary to fulfil our stated purpose(s) and for a reasonable period after the termination of your account on the Platform or access to the Services to comply with our legal rights and obligations.</p>
            <p><strong className="text-slate-900 font-semibold">(b)</strong> In some circumstances, we may aggregate your personal data (so that it can no longer be associated with you) for research or statistical purposes, in which case we may use this information indefinitely without further notice to you.</p>
          </div>
        </section>

        {/* Section 12 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <Briefcase className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">12. Business Transitions</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p>You are aware that in the event we go through a business transition, such as a merger, acquisition by another organisation, or sale of all or a portion of our assets, your personal data might be among the assets transferred.</p>
          </div>
        </section>

        {/* Section 13 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <Users className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">13. User Generated Content</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p>We invite you to post content on our Platform, including your comments, feedback, pictures, or any other information that you would like to be made available on our Platform. Please note that such content will be available to all visitors to our Platform and may become public. We cannot prevent such information from being used in a manner that is contrary to this Policy, applicable laws, or your personal privacy, and we disclaim all liability (express or implied) in this regard. Further, you agree to comply with all applicable laws in relation to the content uploaded or otherwise shared by you on our Platform. You understand and acknowledge that you will be solely responsible for any information published by you on our Platform that violates applicable laws.</p>
          </div>
        </section>

        {/* Section 14 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <RefreshCw className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">14. Updates to This Policy</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p><strong className="text-slate-900 font-semibold">(a)</strong> We may occasionally update this Policy. If we make changes to this Policy, we will upload the revised policy on the Platform or share it with you through other means, such as email or in-app notification. To the extent permitted under applicable law, by using our Platform after such notice, you consent to updates made to this Policy.</p>
            <p><strong className="text-slate-900 font-semibold">(b)</strong> We encourage you to periodically review this Policy for the latest information on our privacy practices.</p>
          </div>
        </section>

        {/* Section 15 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
              <Mail className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">15. Grievance Officer</h2>
          </div>
          <div className="space-y-4 text-base text-slate-600 font-normal pl-4 border-l-2 border-teal-100">
            <p>If you have any questions about this Policy, how we process or handle your personal data, or otherwise, you may reach out to us, with your queries, grievances, feedback, and comments at Support@GatherrGo.com or contact our grievance officer whose contact details are provided below:</p>
            <div className="mt-4 p-6 bg-teal-50/50 rounded-2xl border border-teal-100">
              <h3 className="font-bold text-slate-900 mb-2">Grievance Officer</h3>
              <p>Name: Ankan Nandi</p>
              <p>Email: <a href="mailto:Support@GatherrGo.com" className="text-teal-600 hover:text-teal-700 transition-colors">Support@GatherrGo.com</a></p>
            </div>
          </div>
        </section>

      </motion.div>
    </div>
  );
}