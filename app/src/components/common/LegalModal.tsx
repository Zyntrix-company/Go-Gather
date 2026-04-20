import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { X } from 'lucide-react-native';

type LegalType = 'terms' | 'privacy';

interface Props {
  visible: boolean;
  type: LegalType;
  onClose: () => void;
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionHeading({ number, title }: { number: string; title: string }) {
  return (
    <View style={s.sectionHeading}>
      <View style={s.sectionBadge}>
        <Text style={s.sectionBadgeText}>{number}</Text>
      </View>
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  return <Text style={s.para}>{children}</Text>;
}

function Bold({ children }: { children: React.ReactNode }) {
  return <Text style={s.bold}>{children}</Text>;
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={s.bulletRow}>
      <Text style={s.bulletDot}>{'\u2022'}</Text>
      <Text style={s.bulletText}>{text}</Text>
    </View>
  );
}

function SubBullet({ text }: { text: string }) {
  return (
    <View style={s.subBulletRow}>
      <Text style={s.bulletDot}>{'◦'}</Text>
      <Text style={s.bulletText}>{text}</Text>
    </View>
  );
}

function SectionDivider() {
  return <View style={s.sectionDivider} />;
}

// ─── Terms & Conditions content ───────────────────────────────────────────────

function TermsContent() {
  return (
    <>
      <Para>Welcome to GatherrGo's Terms and Conditions ("Terms" or "Agreement").</Para>
      <Para>
        GatherrGo (the "App" or "we", "us", "our") is a mobile application that enables users to
        collaboratively plan group trips, events, expenses, reminders, photos, and memories in one
        private or shared space. These Terms govern your access to and use of the App and any
        services provided through it ("Services").
      </Para>
      <Para>
        By downloading, installing, accessing, or using the App, you agree to be bound by these
        Terms. If you do not agree, you must not use the App or Services.
      </Para>
      <Para>
        Please read these Terms carefully together with our Privacy Policy (available in the App or
        at https://www.gatherrgo.com/privacy).
      </Para>

      <SectionDivider />

      <SectionHeading number="1" title="Acceptance of Terms" />
      <Para>
        By using the Services, you confirm that you have read, understood, and agree to be bound by
        these Terms and consent to the practices described herein. If you are using the App on
        behalf of an entity, you represent that you have authority to bind that entity.
      </Para>

      <SectionDivider />

      <SectionHeading number="2" title="Eligibility" />
      <Para>
        You must be at least 13 years old (or the minimum age required in your country) to use the
        App. If you are between 13 and the age of majority in your jurisdiction, you must have
        parental or legal guardian consent. Users under 13 are not permitted. We may suspend or
        terminate access if eligibility requirements are not met.
      </Para>

      <SectionDivider />

      <SectionHeading number="3" title="User Accounts & Security" />
      <Para>
        To use certain features, you must create an account. You are responsible for maintaining
        the confidentiality of your login credentials and for all activities under your account.
        Notify us immediately of any unauthorised use. We are not liable for losses arising from
        your failure to secure your account.
      </Para>

      <SectionDivider />

      <SectionHeading number="4" title="User Content & Conduct" />
      <Para>
        You retain ownership of any content you upload or post (photos, itineraries, notes,
        messages, comments). By submitting content, you grant us a worldwide, non-exclusive,
        royalty-free, sublicensable, transferable licence to store, display, reproduce, distribute,
        and make available such content within the App and Services (including to group members or
        publicly if you choose to make it public).
      </Para>
      <Para>You agree not to:</Para>
      <Bullet text="Upload illegal, harmful, offensive, or infringing content" />
      <Bullet text="Harass, impersonate, spam, or abuse others" />
      <Bullet text="Interfere with the App's operation or security" />
      <Bullet text="Scrape, reverse-engineer, or extract data without permission" />
      <Para>We may remove or disable content that violates these Terms.</Para>

      <SectionDivider />

      <SectionHeading number="5" title="Intellectual Property" />
      <Para>
        All rights, title, and interest in the App, its design, code, logos, features, and content
        (except User Content) are owned by GatherrGo or its licensors. You may not copy, modify,
        distribute, or create derivative works without our written permission.
      </Para>

      <SectionDivider />

      <SectionHeading number="6" title="Third-Party Services & Affiliates" />
      <Para>
        The App integrates third-party services (e.g., Google Maps for location, Gemini AI for
        suggestions, AWS for storage, affiliate partners like Booking.com for bookings). Their
        terms and privacy policies apply. We are not responsible for their actions, availability,
        or content. We may earn commissions from affiliate referrals.
      </Para>

      <SectionDivider />

      <SectionHeading number="7" title="Payments & Subscriptions" />
      <Para>
        Certain features may require payment (premium exports, advanced AI, ad-free). Payments are
        processed by third-party providers (e.g., Stripe, Razorpay). You authorise recurring
        charges if you subscribe. Prices and features may change. No refunds except as required by
        law.
      </Para>

      <SectionDivider />

      <SectionHeading number="8" title="Limitation of Liability" />
      <Para>The App is provided "as is" without warranties of any kind. We are not liable for:</Para>
      <Bullet text="Inaccurate itineraries, missed reminders, or travel-related issues" />
      <Bullet text="Data loss, interruptions, or security breaches" />
      <Bullet text="Indirect, incidental, or consequential damages" />
      <Para>
        Our total liability shall not exceed the amount you paid us (if any) in the 12 months
        prior to the claim.
      </Para>

      <SectionDivider />

      <SectionHeading number="9" title="Termination" />
      <Para>
        We may suspend or terminate your access for violation of these Terms, illegal activity, or
        at our discretion. You may delete your account at any time. Upon termination, your licence
        to use the App ends.
      </Para>

      <SectionDivider />

      <SectionHeading number="10" title="Governing Law & Dispute Resolution" />
      <Para>
        These Terms are governed by the laws of India. Any disputes shall be subject to the
        exclusive jurisdiction of courts in Bengaluru, Karnataka.
      </Para>

      <SectionDivider />

      <SectionHeading number="11" title="Changes to Terms" />
      <Para>
        We may update these Terms. We will notify you of material changes via in-app notice or
        email. Continued use after changes constitutes acceptance.
      </Para>

      <SectionDivider />

      <SectionHeading number="12" title="Contact" />
      <Para>For questions or support, you can reach out to us at:</Para>
      <View style={s.contactBox}>
        <Text style={s.contactText}>Email: Hello@GatherrGo.com</Text>
      </View>
    </>
  );
}

// ─── Privacy Policy content ───────────────────────────────────────────────────

function PrivacyContent() {
  return (
    <>
      <Para>Welcome to GatherrGo's privacy policy ("Privacy Policy" or "Policy").</Para>
      <Para>
        GatherrGo (the "App" or "we", "us", "our") is a mobile application that enables users to
        collaboratively plan group trips, events, expenses, reminders, photos, and memories in one
        private or shared space. This Policy outlines our practices in relation to the collection,
        storage, usage, processing, and disclosure of personal data that you have consented to
        share with us when you access, use, or otherwise interact with our mobile application
        'GatherrGo' (the "Platform") or avail products or services that GatherrGo offers you on
        or through the Platform (collectively, the "Services").
      </Para>
      <Para>
        At GatherrGo, we are committed to protecting your personal data and respecting your
        privacy. In order to provide you with access to the Services, we have to collect and
        otherwise process certain data about you. This Policy explains how we process and use
        personal data about you.
      </Para>
      <Para>
        Please note that unless specifically defined in this Policy, capitalised terms shall have
        the same meaning ascribed to them in our Terms and Conditions, available in the App or at
        https://www.gatherrgo.com/terms ("Terms"). Please read this Policy in consonance with the
        Terms.
      </Para>
      <Para>
        By using the Services, you confirm that you have read and agree to be bound by this Policy
        and consent to the processing activities described under this Policy. Please refer to
        Section 1 to understand how the terms of this Policy apply to you.
      </Para>

      <SectionDivider />

      <SectionHeading number="1" title="Background and Key Information" />
      <Para>
        <Bold>(a) How this Policy applies:{'\n'}</Bold>
        This Policy applies to individuals who access or use the Services. For the avoidance of
        doubt, references to "you" across this Policy are to an end user that uses the Platform. By
        using the Platform, you consent to the collection, storage, usage, and disclosure of your
        personal data, as described in and collected by us in accordance with this Policy.
      </Para>
      <Para>
        <Bold>(b) Review and Updates:{'\n'}</Bold>
        We regularly review and update our Privacy Policy, and we request you to regularly review
        this Policy. It is important that the personal data we hold about you is accurate and
        current. Please let us know if your personal data changes during your relationship with us.
      </Para>
      <Para>
        <Bold>(c) Third-Party Services:{'\n'}</Bold>
        The Platform may include links to third-party websites, plug-ins, services, and
        applications ("Third-Party Services"). Clicking on those links or enabling those connections
        may allow third parties to collect or share data about you. We neither control nor endorse
        these Third-Party Services and are not responsible for their privacy statements. When you
        leave the Platform or access third-party links through the Platform, we encourage you to
        read the privacy policy of such third-party service providers.
      </Para>

      <SectionDivider />

      <SectionHeading number="2" title="Personal Data That We Collect" />
      <Para>
        <Bold>(a) We collect different types of personal data about you. This includes, but is not
        limited to:</Bold>
      </Para>
      <Bullet text="(i) Contact Data, such as your email addresses, phone numbers, and location (if enabled for reminders)." />
      <Bullet text="(ii) Identity and Profile Data, such as your name, username or similar identifiers, photographs, and gender (optional)." />
      <Bullet text="(iii) Trip and Travel Data, such as itineraries, dates, locations, expenses, receipts, photos, notes, group members, chat messages, and AI assistant (Swee) interactions." />
      <Bullet text="(iv) Marketing and Communications Data, such as your preferences in receiving marketing communications from us and our third parties, and your communication preferences. We also collect your chat records when you communicate with Swee or group members through the Platform." />
      <Bullet text="(v) Technical Data, which includes your IP address, browser type, Internet Service Provider, details of operating system, access time, page views, device ID, device type, frequency of visiting the App and use of the Platform, app activity, clicks, date and time stamps, location data, and other technology on the devices that you use to access the Platform." />
      <Bullet text="(vi) Transaction Data, such as details of premium features or in-app purchases you have availed, a limited portion of your credit or debit card details for tracking transactions that are provided to us by payment processors, and UPI IDs for processing payments (India only)." />
      <Bullet text="(vii) Usage Data, which includes information about how you use the Services, your activity on the Platform, trip history, user taps and clicks, user interests, time spent on the Platform, details about user journey on the mobile application, and page views." />
      <Para>
        <Bold>(b)</Bold>{' '}We also collect, use, and share aggregated data such as statistical or
        demographic data for any purpose. Aggregated data could be derived from your personal data
        but is not considered personal data under law as it does not directly or indirectly reveal
        your identity. However, if we combine or connect aggregated data with your personal data so
        that it can directly or indirectly identify you, we treat the combined data as personal data
        which will be used in accordance with this Policy.
      </Para>
      <Para>
        <Bold>(c) What happens if I refuse to provide my personal data?{'\n'}</Bold>
        Where we need to collect personal data by law, or under the terms of a contract, and you
        fail to provide that data when requested, we may not be able to perform the contract (for
        example, to provide you with the Services). In this case, we may have to cancel or limit
        your access to the Services.
      </Para>

      <SectionDivider />

      <SectionHeading number="3" title="How Do We Collect Personal Data?" />
      <Para>We use different methods to collect personal data from and about you including through:</Para>
      <Para>
        <Bold>(a) Direct Interactions.</Bold>{' '}You provide us your personal data when you interact
        with us. This includes personal data you provide when you:
      </Para>
      <Bullet text="(i) create an account or profile with us;" />
      <Bullet text="(ii) use our Services or carry out other activities in connection with the Services;" />
      <Bullet text="(iii) enter a promotion, user poll, or online surveys;" />
      <Bullet text="(iv) request marketing communications to be sent to you; or" />
      <Bullet text="(v) report a problem with the Platform and/or our Services, give us feedback or contact us." />
      <Para>
        <Bold>(b) Automated technologies or interactions.</Bold>{' '}Each time you visit or use the
        Platform, we will automatically collect Technical Data about your equipment, browsing
        actions, and patterns. We collect this personal data by using cookies, web beacons, pixel
        tags, server logs, and other similar technologies. We may also receive Technical Data about
        you if you visit other websites or apps that employ our cookies.
      </Para>
      <Para>
        <Bold>(c) Third parties or publicly available sources.</Bold>{' '}We will receive personal
        data about you from various third parties:
      </Para>
      <Bullet text="(i) Technical data from analytics providers such as Google;" />
      <Bullet text="(ii) Identity and profile-related Data and Contact Data from social login providers (Google, Apple, Facebook);" />
      <Bullet text="(iii) Personal data about you from our affiliate entities." />

      <SectionDivider />

      <SectionHeading number="4" title="How Do We Use Your Personal Data?" />
      <Para>
        <Bold>(a)</Bold>{' '}We will only use your personal data when the law allows us to. Most
        commonly, we will use your personal data where we need to perform a contract with you,
        where you have given us permission to do so, where processing your personal information is
        in our legitimate interests, or where we need to comply with the law. We use your personal
        data for the following purposes:
      </Para>
      <Bullet text="(i) to verify your identity to register you as a user, and create your user account with us on the Platform;" />
      <Bullet text="(ii) to provide the Services to you;" />
      <Bullet text="(iii) to enable real-time collaboration and AI assistance (Swee);" />
      <Bullet text="(iv) to monitor trends and personalise your experience;" />
      <Bullet text="(v) to improve the functionality of our Services based on the information and feedback we receive from you;" />
      <Bullet text="(vi) to improve customer service to effectively respond to your Service requests and support needs;" />
      <Bullet text="(vii) to track transactions and process payments;" />
      <Bullet text="(viii) to send periodic notifications to manage our relationship with you including to notify you of changes to the Services, send you information and updates pertaining to the Services you have availed, and to receive occasional company news and updates related to us or the Services;" />
      <Bullet text="(ix) to assist with the facilitation of the Services offered to you, including to send you information and updates about the Services you have availed;" />
      <Bullet text="(x) to market and advertise the Services to you;" />
      <Bullet text="(xi) to comply with legal obligations;" />
      <Bullet text="(xii) to administer and protect our business and the Services, including for troubleshooting, data analysis, system testing, and performing internal operations;" />
      <Bullet text="(xiii) to improve our business and delivery models;" />
      <Bullet text="(xiv) to perform our obligations that arise out of the arrangement we are about to enter or have entered with you;" />
      <Bullet text="(xv) to enforce our Terms; and" />
      <Bullet text="(xvi) to respond to court orders, establish or exercise our legal rights, or defend ourselves against legal claims." />
      <Para>
        <Bold>(b)</Bold>{' '}You agree and acknowledge that by using our Services and creating an
        account with us on the Platform, you authorise us, our service providers, and affiliates to
        contact you via email, push notification, or otherwise. This is to provide the Services to
        you and ensure that you are aware of all the features of the Services and for related
        purposes.
      </Para>
      <Para>
        <Bold>(c)</Bold>{' '}You agree and acknowledge that any and all information pertaining to you,
        whether or not you directly provide it to us (via the Services or otherwise), including but
        not limited to personal correspondence such as messages with Swee, may be collected,
        compiled, and shared by us in order to render the Services to you. This may include but not
        be limited to service providers that provide or seek to provide services for us or on our
        behalf. We may also share this information with other entities in connection with the
        above-mentioned purposes.
      </Para>
      <Para>
        <Bold>(d)</Bold>{' '}You agree and acknowledge that we may share data without your consent,
        when it is required by law or by any court or government agency or authority to disclose
        such information. Such disclosures are made in good faith and belief that it is reasonably
        necessary to do so for enforcing this Policy or the Terms, or in order to comply with any
        applicable laws and regulations.
      </Para>

      <SectionDivider />

      <SectionHeading number="5" title="Cookies" />
      <Para>
        <Bold>(a)</Bold>{' '}Cookies are small files that a site or its service provider transfers to
        your device's hard drive through your web browser (if you permit it to) that enables the
        sites or service providers' systems to recognise your browser and capture and remember
        certain information.
      </Para>
      <Para>
        <Bold>(b)</Bold>{' '}We use cookies to help us distinguish you from other users of the
        Platform, understand and save your preferences for future visits, keep track of
        advertisements and compile aggregate data about site traffic and site interaction so that we
        can offer you a seamless user experience. We may contact third-party service providers to
        assist us in better understanding our users. These service providers are not permitted to
        use the information collected on our behalf except to help us conduct and improve our
        business.
      </Para>
      <Para>
        <Bold>(c)</Bold>{' '}Additionally, you may encounter cookies or other similar devices on
        certain pages of the Platform that are placed by third parties. We do not control the use
        of cookies by third parties. If you send us personal correspondence, such as emails, or if
        other users or third parties send us correspondence about your activities or postings on the
        Platform, we may collect such information within a file specific to you.
      </Para>

      <SectionDivider />

      <SectionHeading number="6" title="Disclosures of Your Personal Data" />
      <Para>
        <Bold>(a)</Bold>{' '}We may share your personal data with third parties set out below for the
        purposes set out in Section 4:
      </Para>
      <Bullet text="(i) Group members to enable collaboration (trip-related data only);" />
      <Bullet text="(ii) Internal third parties, which are other companies within our group of companies (if any);" />
      <Bullet text="(iii) External third parties such as:" />
      <SubBullet text="trusted third parties such as our associate partners, and service providers that provide services for us or on our behalf. This includes hosting and operating our Platform, providing marketing assistance, conducting our business, processing payments and transaction-related processes, transmitting content, and providing our Services to you;" />
      <SubBullet text="analytic service providers and advertising networks that conduct web analytics for us to help us improve the Platform. These analytics providers may use cookies and other technologies to perform their services;" />
      <SubBullet text="regulators and other bodies, as required by law or regulation." />
      <Para>
        <Bold>(b)</Bold>{' '}We require all third parties to respect the security of your personal
        data and to treat it in accordance with the law. We do not allow our third-party service
        providers to use your personal data for their own purposes and only permit them to process
        your personal data for specified purposes and in accordance with our instructions.
      </Para>

      <SectionDivider />

      <SectionHeading number="7" title="Your Rights in Relation to Your Personal Data" />
      <Para>
        <Bold>(a) Access and Updating your Personal Data:{'\n'}</Bold>
        You hereby warrant that all personal data that you provide us with is accurate, up-to-date,
        and true. When you use our Services, we make best efforts to provide you with the ability
        to access and correct inaccurate or deficient data, subject to any legal requirements. You
        can request GatherrGo for a copy of your personal data by sending an email to
        Hello@GatherrGo.com. GatherrGo may take up to 30 days to respond to such a request.
      </Para>
      <Para>
        <Bold>(b) Opting-out of Marketing and Promotional Communications:{'\n'}</Bold>
        When we send you marketing and promotional content through push notification or email, we
        make best efforts to provide you with the ability to opt-out of such communications by
        using the opt-out instructions provided in such communications. You understand and
        acknowledge that it may take us up to 10 business days to give effect to your opt-out
        request. Please note that we may still send you emails about your user account or any
        Services you have requested or received from us.
      </Para>

      <SectionDivider />

      <SectionHeading number="8" title="Deletion of Account and Personal Data" />
      <Para>
        <Bold>(a)</Bold>{' '}Notwithstanding anything contained in the Terms, you may delete your
        account as well as your personal data stored with GatherrGo by sending an email to
        Hello@GatherrGo.com. GatherrGo may take up to 30 days to process your request. Once your
        account is deleted, you will lose access to all Services. For avoidance of doubt, it is
        hereby clarified that all data with respect to transactions performed by you on the
        Platform will be retained in accordance with applicable law.
      </Para>

      <SectionDivider />

      <SectionHeading number="9" title="Transfers of Your Personal Data" />
      <Para>
        <Bold>(a)</Bold>{' '}We comply with applicable laws in respect of storage and transfers of
        personal data. As a part of your use of the Services, the information and personal data you
        provide to us may be transferred to and stored in countries other than the country you are
        based in. This may happen if any of our servers are from time to time located in a country
        other than the one you are based, or one of our vendors, partners, or service providers is
        located in a country other than one you are based in.
      </Para>
      <Para>
        <Bold>(b)</Bold>{' '}By submitting your information and personal data to us, you agree to the
        transfer, storage, and processing of such information and personal data in the manner
        described above.
      </Para>

      <SectionDivider />

      <SectionHeading number="10" title="Data Security" />
      <Para>
        <Bold>(a)</Bold>{' '}We implement appropriate security measures and privacy-protective
        features on our Platform including encryption, password protection, and physical security
        measures to protect your personal data from unauthorised access and disclosure, and follow
        standards prescribed by applicable law.
      </Para>
      <Para>
        <Bold>(b)</Bold>{' '}Where you have chosen a password that enables you to access certain parts
        of the Services, you are responsible for keeping this password secret and confidential. We
        will not be responsible for any unauthorised use of your information, or for any lost,
        stolen, or compromised passwords, or for any activity on your user account due to such
        unauthorised disclosure of your password. In the event your password has been compromised
        in any manner whatsoever, you should promptly notify us to enable us to initiate a change
        of password.
      </Para>

      <SectionDivider />

      <SectionHeading number="11" title="Data Retention" />
      <Para>
        <Bold>(a)</Bold>{' '}You agree and acknowledge that your personal data will continue to be
        stored and retained by us for as long as necessary to fulfil our stated purpose(s) and for
        a reasonable period after the termination of your account on the Platform or access to the
        Services to comply with our legal rights and obligations.
      </Para>
      <Para>
        <Bold>(b)</Bold>{' '}In some circumstances, we may aggregate your personal data (so that it
        can no longer be associated with you) for research or statistical purposes, in which case we
        may use this information indefinitely without further notice to you.
      </Para>

      <SectionDivider />

      <SectionHeading number="12" title="Business Transitions" />
      <Para>
        You are aware that in the event we go through a business transition, such as a merger,
        acquisition by another organisation, or sale of all or a portion of our assets, your
        personal data might be among the assets transferred.
      </Para>

      <SectionDivider />

      <SectionHeading number="13" title="User Generated Content" />
      <Para>
        We invite you to post content on our Platform, including your comments, feedback, pictures,
        or any other information that you would like to be made available on our Platform. Please
        note that such content will be available to all visitors to our Platform and may become
        public. We cannot prevent such information from being used in a manner that is contrary to
        this Policy, applicable laws, or your personal privacy, and we disclaim all liability
        (express or implied) in this regard. Further, you agree to comply with all applicable laws
        in relation to the content uploaded or otherwise shared by you on our Platform. You
        understand and acknowledge that you will be solely responsible for any information published
        by you on our Platform that violates applicable laws.
      </Para>

      <SectionDivider />

      <SectionHeading number="14" title="Updates to This Policy" />
      <Para>
        <Bold>(a)</Bold>{' '}We may occasionally update this Policy. If we make changes to this
        Policy, we will upload the revised policy on the Platform or share it with you through
        other means, such as email or in-app notification. To the extent permitted under applicable
        law, by using our Platform after such notice, you consent to updates made to this Policy.
      </Para>
      <Para>
        <Bold>(b)</Bold>{' '}We encourage you to periodically review this Policy for the latest
        information on our privacy practices.
      </Para>

      <SectionDivider />

      <SectionHeading number="15" title="Grievance Officer" />
      <Para>
        If you have any questions about this Policy, how we process or handle your personal data,
        or otherwise, you may reach out to us, with your queries, grievances, feedback, and
        comments at Hello@GatherrGo.com or contact our grievance officer whose contact details are
        provided below:
      </Para>
      <View style={s.contactBox}>
        <Text style={s.contactLabel}>Grievance Officer</Text>
        <Text style={s.contactText}>Name: Ankan Nandi</Text>
        <Text style={s.contactText}>Email: ankan.nandi@outlook.com</Text>
      </View>
    </>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function LegalModal({ visible, type, onClose }: Props) {
  const title = type === 'terms' ? 'Terms & Conditions' : 'Privacy Policy';
  const lastUpdated = 'Last updated: 16 April 2026';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView style={s.safeArea}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft} />
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>{title}</Text>
            <Text style={s.headerSub}>{lastUpdated}</Text>
          </View>
          <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <X size={22} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={s.headerDivider} />

        {/* Content */}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}>
          {type === 'terms' ? <TermsContent /> : <PrivacyContent />}
          <View style={s.bottomSpacer} />
        </ScrollView>

        {/* Done button */}
        <View style={s.footer}>
          <TouchableOpacity style={s.doneBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={s.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
  },
  headerLeft: { width: 36 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a', letterSpacing: 0.1 },
  headerSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDivider: { height: 1, backgroundColor: '#e2e8f0' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  bottomSpacer: { height: 16 },

  sectionDivider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 20 },

  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  sectionBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  sectionBadgeText: { fontSize: 12, fontWeight: '700', color: '#0d9488' },
  sectionTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#0f172a', lineHeight: 22 },

  para: { fontSize: 14, color: '#475569', lineHeight: 22, marginBottom: 10 },
  bold: { fontWeight: '700', color: '#334155' },

  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, paddingLeft: 4 },
  subBulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, paddingLeft: 20 },
  bulletDot: { fontSize: 14, color: '#0d9488', marginRight: 8, marginTop: 4, lineHeight: 18 },
  bulletText: { flex: 1, fontSize: 14, color: '#475569', lineHeight: 22 },

  contactBox: {
    backgroundColor: '#f0fdfa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#99f6e4',
    padding: 16,
    marginTop: 8,
  },
  contactLabel: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  contactText: { fontSize: 14, color: '#0d9488', lineHeight: 22 },

  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  doneBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  doneBtnText: { fontSize: 16, fontWeight: '600', color: '#ffffff', letterSpacing: 0.1 },
});
