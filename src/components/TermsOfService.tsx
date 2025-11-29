import React from 'react';

export function TermsOfService() {
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
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 m-0">Terms of Service</h2>
      </div>
      <div className="prose prose-lg dark:prose-invert text-gray-700 dark:text-gray-300 leading-relaxed space-y-4">
        <p className="italic text-gray-600 dark:text-gray-300">
          Welcome to Upscale Forge. These Terms of Service ("Terms") govern your access to and use of our website, applications, and AI image upscaling services (collectively, the "Services"). By accessing or using our Services, you agree to be bound by these Terms.
        </p>

        <h3 className="text-2xl font-semibold">1. Acceptance of Terms</h3>
        <p>
          By creating an account or using our Services, you confirm that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you do not agree to these Terms, you must not use our Services.
        </p>
        <p>
          If you are using the Services on behalf of an organization, you represent and warrant that you have the authority to bind that organization to these Terms.
        </p>

        <h3 className="text-2xl font-semibold">2. Eligibility</h3>
        <p className="mb-2">To use our Services, you must:</p>
        <ul className="list-disc pl-6">
          <li>Be at least 13 years old (or 16 in the European Union and certain other jurisdictions).</li>
          <li>Have the legal capacity to enter into a binding agreement.</li>
          <li>Not be prohibited from using the Services under applicable law.</li>
        </ul>
        <p>
          By using the Services, you represent and warrant that you meet these eligibility requirements.
        </p>

        <h3 className="text-2xl font-semibold">3. Account Registration</h3>
        <p className="mb-2">When you create an account, you agree to:</p>
        <ul className="list-disc pl-6">
          <li>Provide accurate, current, and complete information.</li>
          <li>Maintain the security of your password and account.</li>
          <li>Promptly update your account information if it changes.</li>
          <li>Accept responsibility for all activities that occur under your account.</li>
          <li>Notify us immediately of any unauthorized access or security breach.</li>
        </ul>
        <p>
          We reserve the right to suspend or terminate accounts that violate these Terms or for any other reason at our discretion.
        </p>

        <h3 className="text-2xl font-semibold">4. Subscription Plans &amp; Payments</h3>
        <p className="mb-2">Our Services are offered under various subscription plans:</p>
        <ul className="list-disc pl-6">
          <li><strong>Free Tier:</strong> Limited upscales with restricted features.</li>
          <li><strong>Paid Plans:</strong> Monthly or annual subscriptions with varying limits and features.</li>
        </ul>
        <p className="mb-2">Payment terms:</p>
        <ul className="list-disc pl-6">
          <li>Payments are processed securely through Stripe.</li>
          <li>Subscriptions automatically renew unless cancelled before the renewal date.</li>
          <li>Prices may change with 30 days' notice for existing subscribers.</li>
          <li>Unused credits or upscales do not roll over to the next billing period.</li>
          <li>Refunds are provided at our discretion and in accordance with applicable law.</li>
        </ul>

        <h3 className="text-2xl font-semibold">5. Acceptable Use Policy</h3>
        <p className="mb-2">You agree NOT to use our Services to:</p>
        <ul className="list-disc pl-6">
          <li>Upload, process, or distribute illegal content, including child sexual abuse material (CSAM).</li>
          <li>Infringe on intellectual property rights of others.</li>
          <li>Upload content depicting violence, gore, or harm to individuals.</li>
          <li>Process images for fraudulent purposes (e.g., creating fake IDs or documents).</li>
          <li>Harass, threaten, or harm other users or individuals.</li>
          <li>Attempt to bypass usage limits, security measures, or access controls.</li>
          <li>Reverse engineer, decompile, or extract source code from our Services.</li>
          <li>Use automated systems (bots, scrapers) without our written permission.</li>
          <li>Resell or redistribute our Services without authorization.</li>
          <li>Violate any applicable laws or regulations.</li>
        </ul>
        <p>
          We reserve the right to remove content and terminate accounts that violate this policy without notice or refund.
        </p>

        <h3 className="text-2xl font-semibold">6. Intellectual Property</h3>
        <h4 className="text-xl font-medium">Our Content</h4>
        <p>
          All content on our website—including text, graphics, logos, icons, images, software, and the AI models—is the property of Upscale Forge or our licensors and is protected by copyright, trademark, and other intellectual property laws.
        </p>
        <h4 className="text-xl font-medium">Your Content</h4>
        <p>
          You retain ownership of the images you upload. By using our Services, you grant us a limited, non-exclusive license to process your images solely for the purpose of providing the upscaling service. This license terminates when we delete your images.
        </p>
        <h4 className="text-xl font-medium">Output</h4>
        <p>
          You own the upscaled images generated from your original content, subject to any third-party rights in the original images.
        </p>

        <h3 className="text-2xl font-semibold">7. DMCA &amp; Copyright Infringement</h3>
        <p>
          We respect intellectual property rights and expect our users to do the same. If you believe content on our platform infringes your copyright, please submit a DMCA takedown notice to:
        </p>
        <ul className="list-none pl-0">
          <li><strong>Email:</strong> dmca@upscaleforge.com</li>
          <li><strong>Subject:</strong> DMCA Takedown Request</li>
        </ul>
        <p className="mb-2">Your notice must include:</p>
        <ul className="list-disc pl-6">
          <li>Identification of the copyrighted work claimed to be infringed.</li>
          <li>Identification of the infringing material and its location.</li>
          <li>Your contact information (name, address, phone, email).</li>
          <li>A statement that you have a good faith belief the use is not authorized.</li>
          <li>A statement, under penalty of perjury, that the information is accurate and you are authorized to act.</li>
          <li>Your physical or electronic signature.</li>
        </ul>

        <h3 className="text-2xl font-semibold">8. Disclaimer of Warranties</h3>
        <p>
          THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
        </p>
        <p>
          We do not guarantee that the Services will be uninterrupted, error-free, or completely secure. AI-generated results may vary and are not guaranteed to meet your expectations.
        </p>

        <h3 className="text-2xl font-semibold">9. Limitation of Liability</h3>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, UPSCALE FORGE AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR:
        </p>
        <ul className="list-disc pl-6">
          <li>Any indirect, incidental, special, consequential, or punitive damages.</li>
          <li>Loss of profits, revenue, data, use, goodwill, or other intangible losses.</li>
          <li>Damages resulting from unauthorized access to or alteration of your data.</li>
          <li>Any third-party conduct or content on the Services.</li>
        </ul>
        <p>
          Our total liability for any claims arising from these Terms or your use of the Services shall not exceed the amount you paid us in the 12 months preceding the claim, or $100, whichever is greater.
        </p>

        <h3 className="text-2xl font-semibold">10. Indemnification</h3>
        <p>
          You agree to indemnify, defend, and hold harmless Upscale Forge and its affiliates from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from:
        </p>
        <ul className="list-disc pl-6">
          <li>Your use of the Services.</li>
          <li>Your violation of these Terms.</li>
          <li>Your violation of any third-party rights.</li>
          <li>Content you upload or process through our Services.</li>
        </ul>

        <h3 className="text-2xl font-semibold">11. Dispute Resolution</h3>
        <p>
          <strong>Informal Resolution:</strong> Before filing any claim, you agree to contact us at legal@upscaleforge.com to attempt to resolve the dispute informally for at least 30 days.
        </p>
        <p>
          <strong>Arbitration:</strong> If informal resolution fails, any disputes shall be resolved through binding arbitration under the rules of the American Arbitration Association (AAA), except that you may bring claims in small claims court if eligible.
        </p>
        <p>
          <strong>Class Action Waiver:</strong> You agree to resolve disputes individually and waive any right to participate in class actions or class arbitrations.
        </p>
        <p>
          <strong>Exception for EU Users:</strong> If you are in the European Union, you retain the right to bring claims in your local courts and are not bound by the arbitration clause.
        </p>

        <h3 className="text-2xl font-semibold">12. Governing Law</h3>
        <p>
          These Terms are governed by the laws of the State of Delaware, United States, without regard to conflict of law principles. For users in the European Union, mandatory consumer protection laws of your country of residence will apply where required.
        </p>

        <h3 className="text-2xl font-semibold">13. Changes to Terms</h3>
        <p>
          We may modify these Terms at any time. We will notify you of material changes by posting a notice on our website or sending you an email at least 30 days before the changes take effect. Your continued use of the Services after changes become effective constitutes acceptance of the new Terms.
        </p>

        <h3 className="text-2xl font-semibold">14. Termination</h3>
        <p>
          You may terminate your account at any time through your account settings. We may suspend or terminate your access to the Services at any time, with or without cause, with or without notice. Upon termination, your right to use the Services ceases immediately, and we may delete your account data.
        </p>

        <h3 className="text-2xl font-semibold">15. Severability</h3>
        <p>
          If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
        </p>

        <h3 className="text-2xl font-semibold">16. Entire Agreement</h3>
        <p>
          These Terms, together with our Privacy Policy and any other policies referenced herein, constitute the entire agreement between you and Upscale Forge regarding the Services and supersede all prior agreements and understandings.
        </p>

        <h3 className="text-2xl font-semibold">17. Contact Us</h3>
        <p className="mb-2">If you have questions about these Terms, please contact us at:</p>
        <ul className="list-none pl-0">
          <li><strong>Email:</strong> legal@upscaleforge.com</li>
          <li><strong>Address:</strong> Upscale Forge, [Your Business Address]</li>
        </ul>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-8">
          Last updated: November 29, 2025
        </p>
      </div>
    </div>
  );
}
