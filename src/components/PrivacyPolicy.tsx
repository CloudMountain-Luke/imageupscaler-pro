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
          Your privacy is important to us. This Privacy Policy explains how Upscale Forge collects, uses, and discloses information about you.
        </p>
        <h3 className="text-2xl font-semibold">1. Information We Collect</h3>
        <p>
          We collect information you provide directly to us, such as when you create an account, upload images for processing, or contact us for support. This may include your name, email address, payment information, and the images you upload.
        </p>
        <h3 className="text-2xl font-semibold">2. How We Use Your Information</h3>
        <p className="mb-2">We use the information we collect to:</p>
        <ul className="list-disc pl-6">
          <li>Provide, maintain, and improve our services.</li>
          <li>Process your transactions and send you related information.</li>
          <li>Communicate with you about products, services, and offers.</li>
          <li>Monitor and analyze trends, usage, and activities in connection with our services.</li>
          <li>Detect, investigate, and prevent fraudulent transactions and other illegal activities.</li>
        </ul>

        <h3 className="text-2xl font-semibold">3. Sharing of Information</h3>
        <p className="mb-2">We may share information about you as follows:</p>
        <ul className="list-disc pl-6">
          <li>With vendors, consultants, and other service providers who need access to such information to carry out work on our behalf.</li>
          <li>In response to a request for information if we believe disclosure is in accordance with, or required by, any applicable law, regulation, or legal process.</li>
          <li>With your consent or at your direction.</li>
        </ul>

        <h3 className="text-2xl font-semibold">4. Image Data</h3>
        <p>
          Images uploaded for upscaling are processed by our AI models. We do not store your images permanently after processing is complete. Temporary copies are used solely for the purpose of providing the upscaling service and are deleted shortly thereafter. We do not use your images for training our AI models or for any other purpose without your explicit consent.
        </p>

        <h3 className="text-2xl font-semibold">5. Security</h3>
        <p>
          We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access, disclosure, alteration, and destruction.
        </p>

        <h3 className="text-2xl font-semibold">6. Your Choices</h3>
        <p>
          You may update, correct, or delete information about you at any time by logging into your account or contacting us.
        </p>

        <h3 className="text-2xl font-semibold">7. Contact Us</h3>
        <p>
          If you have any questions about this Privacy Policy, please contact us at [Your Contact Email].
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-8">
          Last updated: August 17, 2025
        </p>
      </div>
    </div>
  );
}
