import React from 'react';

export function RefundPolicy() {
  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Refund Policy</h2>
      <div className="prose dark:prose-invert text-gray-700 dark:text-gray-300">
        <p>
          At ImageUpscale Pro, we strive to provide a high-quality image upscaling service. This policy outlines the conditions under which refunds may be issued.
        </p>
        <h3>1. Subscription Services</h3>
        <p>
          For monthly or annual subscription plans, we generally do not offer refunds for partial months or years of service. You may cancel your subscription at any time, and your access to the service will continue until the end of your current billing period.
        </p>
        <h3>2. Failed Upscales</h3>
        <p>
          If an upscale operation fails due to a technical issue on our end (e.g., server error, AI model failure) and you are unable to obtain a usable upscaled image, the credits used for that specific transaction will be automatically returned to your account. If you believe a transaction failed and credits were not returned, please contact support with the transaction details.
        </p>
        <h3>3. Quality of Upscale</h3>
        <p>
          While our AI models are state-of-the-art, the quality of the upscaled image can sometimes be limited by the quality of the original input image. We do not offer refunds based on subjective dissatisfaction with the aesthetic outcome of an upscale if the service technically completed the process. We encourage users to test with our free tier or sample images to understand the capabilities before committing to a paid plan.
        </p>
        <h3>4. Accidental Purchases / Duplicate Charges</h3>
        <p>
          If you believe you have been charged in error, or have been subjected to a duplicate charge, please contact our support team immediately with details of the transaction. We will investigate and, if an error is confirmed, issue a full refund for the erroneous charge.
        </p>
        <h3>5. How to Request a Refund</h3>
        <p>
          All refund requests must be submitted within [e.g., 7 days] of the transaction date. To request a refund, please contact our customer support team at [Your Contact Email] with your account details and the reason for your request. All refunds are issued at our sole discretion.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-8">
          Last updated: August 17, 2025
        </p>
      </div>
    </div>
  );
}
