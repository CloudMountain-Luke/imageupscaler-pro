import React from 'react';

export function PrivacyPolicy() {
  return (
    <div className="relative bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-6 pt-10 border border-gray-200/50 dark:border-gray-700/50 max-w-4xl mx-auto mt-[40px]">
      <div className="relative mb-6">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('show-homepage'))}
          className="hidden md:flex items-center space-x-2 text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white transition-colors absolute top-1/2 -translate-y-1/2 -mt-[30px] right-full mr-[90px]"
          aria-label="Back to homepage"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.707 14.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5A1 1 0 018.707 4.707L5.414 8H18a1 1 0 110 2H5.414l3.293 3.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
          <span className="text-lg">Back</span>
        </button>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 m-0">Privacy Policy</h2>
      </div>
      <div className="prose prose-lg dark:prose-invert text-gray-700 dark:text-gray-300 leading-relaxed space-y-4">
        <p className="italic text-gray-600 dark:text-gray-300">
          Your privacy is important to us. This Privacy Policy explains how Upscale Forge ("we", "us", or "our") collects, uses, shares, and protects information about you when you use our website and services.
        </p>

        <h3 className="text-2xl font-semibold">1. Information We Collect</h3>
        <p className="mb-2">We collect information you provide directly to us, including:</p>
        <ul className="list-disc pl-6">
          <li><strong>Account Information:</strong> Name, email address, and password when you create an account.</li>
          <li><strong>Payment Information:</strong> Billing details processed securely through our payment provider (Stripe). We do not store full credit card numbers.</li>
          <li><strong>Image Data:</strong> Images you upload for processing. See Section 4 for details on how we handle your images.</li>
          <li><strong>Usage Data:</strong> Information about how you use our services, including features accessed, processing preferences, and timestamps.</li>
          <li><strong>Device Information:</strong> Browser type, operating system, IP address, and device identifiers.</li>
          <li><strong>Communications:</strong> Information you provide when contacting support or providing feedback.</li>
        </ul>

        <h3 className="text-2xl font-semibold">2. How We Use Your Information</h3>
        <p className="mb-2">We use the information we collect to:</p>
        <ul className="list-disc pl-6">
          <li>Provide, maintain, and improve our AI image upscaling services.</li>
          <li>Process your transactions and manage your subscription.</li>
          <li>Send you technical notices, updates, security alerts, and support messages.</li>
          <li>Respond to your comments, questions, and customer service requests.</li>
          <li>Monitor and analyze trends, usage, and activities to improve user experience.</li>
          <li>Detect, investigate, and prevent fraudulent transactions and abuse.</li>
          <li>Comply with legal obligations and enforce our terms of service.</li>
        </ul>

        <h3 className="text-2xl font-semibold">3. Legal Basis for Processing (GDPR)</h3>
        <p className="mb-2">For users in the European Economic Area (EEA), UK, and Switzerland, we process your data based on:</p>
        <ul className="list-disc pl-6">
          <li><strong>Contract Performance:</strong> To provide the services you've requested.</li>
          <li><strong>Legitimate Interests:</strong> To improve our services, prevent fraud, and ensure security.</li>
          <li><strong>Consent:</strong> For optional cookies and marketing communications (which you can withdraw anytime).</li>
          <li><strong>Legal Obligation:</strong> To comply with applicable laws and regulations.</li>
        </ul>

        <h3 className="text-2xl font-semibold">4. Image Data &amp; AI Processing</h3>
        <p className="mb-2">We take special care with the images you upload:</p>
        <ul className="list-disc pl-6">
          <li><strong>Temporary Processing:</strong> Images are processed by our AI models and stored temporarily (typically deleted within 24 hours after processing completes).</li>
          <li><strong>No Training Use:</strong> We do NOT use your images to train our AI models without your explicit consent.</li>
          <li><strong>No Human Review:</strong> Your images are processed automatically. Our staff does not view your images unless required for technical support (with your permission) or legal compliance.</li>
          <li><strong>Encryption:</strong> Images are encrypted in transit (TLS) and at rest.</li>
          <li><strong>Third-Party AI:</strong> We use Replicate.com to run AI models. Their privacy policy applies to data processed through their infrastructure.</li>
        </ul>

        <h3 className="text-2xl font-semibold">5. Cookies &amp; Tracking Technologies</h3>
        <p className="mb-2">We use cookies and similar technologies:</p>
        <ul className="list-disc pl-6">
          <li><strong>Essential Cookies:</strong> Required for authentication, security, and basic functionality. Cannot be disabled.</li>
          <li><strong>Analytics Cookies:</strong> Help us understand how visitors use our site (optional, requires consent).</li>
          <li><strong>Preference Cookies:</strong> Remember your settings like theme preferences (optional, requires consent).</li>
          <li><strong>Marketing Cookies:</strong> Used for advertising purposes (optional, requires consent).</li>
        </ul>
        <p>You can manage your cookie preferences at any time through our cookie settings panel or your browser settings.</p>

        <h3 className="text-2xl font-semibold">6. Sharing of Information</h3>
        <p className="mb-2">We may share information about you:</p>
        <ul className="list-disc pl-6">
          <li><strong>Service Providers:</strong> With vendors who help us operate our business (hosting, payment processing, AI processing, analytics).</li>
          <li><strong>Legal Requirements:</strong> When required by law, court order, or government request.</li>
          <li><strong>Safety &amp; Rights:</strong> To protect the safety, rights, or property of Upscale Forge, our users, or the public.</li>
          <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets (you will be notified).</li>
          <li><strong>With Consent:</strong> When you have given us permission to share.</li>
        </ul>
        <p><strong>We do NOT sell your personal information.</strong></p>

        <h3 className="text-2xl font-semibold">7. Data Retention</h3>
        <ul className="list-disc pl-6">
          <li><strong>Account Data:</strong> Retained while your account is active and for up to 3 years after deletion for legal/audit purposes.</li>
          <li><strong>Image Data:</strong> Deleted within 24 hours after processing completes.</li>
          <li><strong>Usage Logs:</strong> Retained for up to 90 days for security and debugging.</li>
          <li><strong>Payment Records:</strong> Retained for 7 years as required by tax laws.</li>
        </ul>

        <h3 className="text-2xl font-semibold">8. Your Rights (GDPR &amp; International)</h3>
        <p className="mb-2">Depending on your location, you may have the following rights:</p>
        <ul className="list-disc pl-6">
          <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
          <li><strong>Rectification:</strong> Request correction of inaccurate or incomplete data.</li>
          <li><strong>Erasure ("Right to be Forgotten"):</strong> Request deletion of your personal data.</li>
          <li><strong>Restriction:</strong> Request that we limit how we use your data.</li>
          <li><strong>Data Portability:</strong> Receive your data in a structured, machine-readable format.</li>
          <li><strong>Object:</strong> Object to processing based on legitimate interests or for direct marketing.</li>
          <li><strong>Withdraw Consent:</strong> Withdraw consent at any time (without affecting prior processing).</li>
          <li><strong>Lodge a Complaint:</strong> File a complaint with your local data protection authority.</li>
        </ul>
        <p>To exercise these rights, contact us at <strong>privacy@upscaleforge.com</strong>.</p>

        <h3 className="text-2xl font-semibold">9. California Privacy Rights (CCPA/CPRA)</h3>
        <p className="mb-2">California residents have additional rights:</p>
        <ul className="list-disc pl-6">
          <li><strong>Right to Know:</strong> What personal information we collect, use, and share.</li>
          <li><strong>Right to Delete:</strong> Request deletion of your personal information.</li>
          <li><strong>Right to Opt-Out:</strong> Opt out of the "sale" or "sharing" of personal information. <em>Note: We do not sell your data.</em></li>
          <li><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your rights.</li>
          <li><strong>Right to Correct:</strong> Request correction of inaccurate personal information.</li>
        </ul>

        <h3 className="text-2xl font-semibold">10. International Data Transfers</h3>
        <p>
          Your data may be transferred to and processed in countries outside your residence, including the United States, where our servers and service providers are located. We use appropriate safeguards such as Standard Contractual Clauses (SCCs) approved by the European Commission to protect your data during international transfers.
        </p>

        <h3 className="text-2xl font-semibold">11. Children's Privacy</h3>
        <p>
          Our services are not intended for children under 13 years of age (or 16 in some jurisdictions). We do not knowingly collect personal information from children. If you believe we have collected data from a child, please contact us immediately and we will delete it.
        </p>

        <h3 className="text-2xl font-semibold">12. Security</h3>
        <p>
          We implement industry-standard security measures to protect your information, including encryption (TLS/SSL), secure authentication, access controls, and regular security audits. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
        </p>

        <h3 className="text-2xl font-semibold">13. Third-Party Links</h3>
        <p>
          Our website may contain links to third-party websites. We are not responsible for the privacy practices of these external sites. We encourage you to read their privacy policies.
        </p>

        <h3 className="text-2xl font-semibold">14. Changes to This Policy</h3>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of significant changes by posting a notice on our website or sending you an email. Your continued use of our services after changes become effective constitutes acceptance of the updated policy.
        </p>

        <h3 className="text-2xl font-semibold">15. Contact Us</h3>
        <p className="mb-2">If you have questions about this Privacy Policy or wish to exercise your rights, contact us at:</p>
        <ul className="list-none pl-0">
          <li><strong>Email:</strong> privacy@upscaleforge.com</li>
          <li><strong>Data Protection Officer:</strong> dpo@upscaleforge.com</li>
          <li><strong>Address:</strong> Upscale Forge, [Your Business Address]</li>
        </ul>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-8">
          Last updated: November 29, 2025
        </p>
      </div>
    </div>
  );
}
