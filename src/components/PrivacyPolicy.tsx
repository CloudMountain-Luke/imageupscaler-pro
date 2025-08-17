import React from 'react';

export function PrivacyPolicy() {
  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Privacy Policy</h2>
      <div className="prose dark:prose-invert text-gray-700 dark:text-gray-300">
        <p>
          Your privacy is important to us. This Privacy Policy explains how ImageUpscale Pro collects, uses, and discloses information about you.
        </p>
        <h3>1. Information We Collect</h3>
        <p>
          We collect information you provide directly to us, such as when you create an account, upload images for processing, or contact us for support. This may include your name, email address, payment information, and the images you upload.
        </p>
        <h3>2. How We Use Your Information</h3>
        <p>
          We use the information we collect to:
          <ul>
            <li>Provide, maintain, and improve our services.</li>
            <li>Process your transactions and send you related information.</li>
            <li>Communicate with you about products, services, and offers.</li>
            <li>Monitor and analyze trends, usage, and activities in connection with our services.</li>
            <li>Detect, investigate, and prevent fraudulent transactions and other illegal activities.</li>
          </ul>
        </p>
        <h3>3. Sharing of Information</h3>
        <p>
          We may share information about you as follows:
          <ul>
            <li>With vendors, consultants, and other service providers who need access to such information to carry out work on our behalf.</li>
            <li>In response to a request for information if we believe disclosure is in accordance with, or required by, any applicable law, regulation, or legal process.</li>
            <li>With your consent or at your direction.</li>
          </ul>
        </p>
        <h3>4. Image Data</h3>
        <p>
          Images uploaded for upscaling are processed by our AI models. We do not store your images permanently after processing is complete. Temporary copies are used solely for the purpose of providing the upscaling service and are deleted shortly thereafter. We do not use your images for training our AI models or for any other purpose without your explicit consent.
        </p>
        <h3>5. Security</h3>
        <p>
          We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access, disclosure, alteration, and destruction.
        </p>
        <h3>6. Your Choices</h3>
        <p>
          You may update, correct, or delete information about you at any time by logging into your account or contacting us.
        </p>
        <h3>7. Contact Us</h3>
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
