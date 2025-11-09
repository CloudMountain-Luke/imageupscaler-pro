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
          Welcome to Upscale Forge. These Terms of Service ("Terms") govern your use of our website and services. By accessing or using our services, you agree to be bound by these Terms.
        </p>
        <h3 className="text-2xl font-semibold">1. Acceptance of Terms</h3>
        <p>
          By using our services, you confirm that you accept these Terms and that you agree to comply with them. If you do not agree to these Terms, you must not use our services.
        </p>

        <h3 className="text-2xl font-semibold">2. Changes to Terms</h3>
        <p>
          We may amend these Terms from time to time. Every time you wish to use our services, please check these Terms to ensure you understand the terms that apply at that time.
        </p>
        <p className="italic text-sm">We will indicate the date of the most recent update at the bottom of this page.</p>

        <h3 className="text-2xl font-semibold">3. Your Account</h3>
        <p className="mb-2">You agree that you are responsible for:</p>
        <ul className="list-disc pl-6">
          <li>Maintaining the confidentiality of your account and password.</li>
          <li>Restricting access to your devices and account.</li>
          <li>All activities that occur under your account or password.</li>
        </ul>

        <h3 className="text-2xl font-semibold">4. Use of Service</h3>
        <p className="mb-2">You agree not to use the service for any unlawful purpose or in any way that might:</p>
        <ul className="list-disc pl-6">
          <li>Harm, abuse, or harass other users.</li>
          <li>Interfere with or disrupt the service or servers.</li>
          <li>Infringe intellectual property or proprietary rights.</li>
        </ul>

        <h3 className="text-2xl font-semibold">5. Intellectual Property</h3>
        <p>
          <strong>All content</strong> included on the site—such as text, graphics, logos, images, and software—is the property of Upscale Forge or its suppliers and protected by applicable laws.
        </p>

        <h3 className="text-2xl font-semibold">6. Limitation of Liability</h3>
        <p>
          To the fullest extent permitted by applicable law, Upscale Forge shall not be liable for any indirect, incidental, special, consequential or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses, resulting from:
        </p>
        <ol className="list-decimal pl-6">
          <li>Your access to or use of or inability to access or use the services;</li>
          <li>Any conduct or content of any third party on the services;</li>
          <li>Any content obtained from the services; and</li>
          <li>Unauthorized access, use or alteration of your transmissions or content.</li>
        </ol>

        <h3 className="text-2xl font-semibold">7. Governing Law</h3>
        <p>
          These Terms are governed by and construed in accordance with the laws of [Your Country/State], without regard to its conflict of law principles.
        </p>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-8">
          Last updated: August 17, 2025
        </p>
      </div>
    </div>
  );
}
