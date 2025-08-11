import React, { useState } from 'react';
import { Check, CreditCard, Star, Zap, Crown, Calendar, DollarSign, Plus, Edit3, AlertCircle, TrendingUp } from 'lucide-react';

export function BillingSection() {
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showEditPayment, setShowEditPayment] = useState(false);

  // Mock user data - this would come from your backend
  const currentPlan = {
    name: 'Pro',
    price: 24.99,
    billingCycle: 'monthly',
    upscalesIncluded: 500,
    upscalesUsed: 287,
    nextBillingDate: '2025-02-15',
    status: 'active'
  };

  const paymentMethods = [
    {
      id: 1,
      type: 'visa',
      last4: '4242',
      expiryMonth: 12,
      expiryYear: 2027,
      isDefault: true
    },
    {
      id: 2,
      type: 'mastercard',
      last4: '8888',
      expiryMonth: 8,
      expiryYear: 2026,
      isDefault: false
    }
  ];

  const billingHistory = [
    {
      id: 1,
      date: '2025-01-15',
      amount: 24.99,
      status: 'paid',
      description: 'Pro Plan - Monthly'
    },
    {
      id: 2,
      date: '2024-12-15',
      amount: 24.99,
      status: 'paid',
      description: 'Pro Plan - Monthly'
    },
    {
      id: 3,
      date: '2024-11-15',
      amount: 24.99,
      status: 'paid',
      description: 'Pro Plan - Monthly'
    }
  ];

  const getCardIcon = (type: string) => {
    switch (type) {
      case 'visa':
        return '💳';
      case 'mastercard':
        return '💳';
      case 'amex':
        return '💳';
      default:
        return '💳';
    }
  };

  const usagePercentage = (currentPlan.upscalesUsed / currentPlan.upscalesIncluded) * 100;
  const remainingUpscales = currentPlan.upscalesIncluded - currentPlan.upscalesUsed;
  const daysUntilBilling = Math.ceil((new Date(currentPlan.nextBillingDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Billing & Account</h2>
      </div>

      {/* Current Plan Overview */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Current Plan</h3>
            <p className="text-gray-600 dark:text-gray-400">Manage your subscription and usage</p>
          </div>
          <div className="flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-lg">
            <Zap className="w-4 h-4" />
            <span className="font-medium">{currentPlan.name} Plan</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Plan Details */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Monthly Bill</h4>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">${currentPlan.price}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">per month</p>
          </div>

          {/* Next Billing */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Next Billing</h4>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{daysUntilBilling}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">days remaining</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {new Date(currentPlan.nextBillingDate).toLocaleDateString()}
            </p>
          </div>

          {/* Usage */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Usage</h4>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{currentPlan.upscalesUsed}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">of {currentPlan.upscalesIncluded} upscales</p>
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mt-2">
              <div 
                className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, usagePercentage)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Usage Alert */}
        {usagePercentage > 80 && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800 dark:text-amber-200">Usage Alert</h4>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  You've used {Math.round(usagePercentage)}% of your monthly upscales. 
                  {remainingUpscales} upscales remaining.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment Methods */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Payment Methods</h3>
          <button
            onClick={() => setShowAddPayment(true)}
            className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            <span>Add Payment Method</span>
          </button>
        </div>

        <div className="space-y-3">
          {paymentMethods.map((method) => (
            <div key={method.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getCardIcon(method.type)}</span>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    •••• •••• •••• {method.last4}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Expires {method.expiryMonth}/{method.expiryYear}
                    {method.isDefault && (
                      <span className="ml-2 bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs">
                        Default
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditPayment(true)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Billing History */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Billing History</h3>
        
        <div className="space-y-3">
          {billingHistory.map((bill) => (
            <div key={bill.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{bill.description}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(bill.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-gray-900 dark:text-gray-100">${bill.amount}</p>
                <p className="text-sm text-green-600 capitalize">{bill.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Plan Management */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Plan Management</h3>
        
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center space-x-2 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white px-4 py-2 rounded-lg transition-all duration-200">
            <Star className="w-4 h-4" />
            <span>Upgrade Plan</span>
          </button>
          
          <button className="flex items-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-all duration-200">
            <Calendar className="w-4 h-4" />
            <span>Change Billing Cycle</span>
          </button>
          
          <button className="flex items-center space-x-2 text-red-600 hover:text-red-700 px-4 py-2 rounded-lg border border-red-200 hover:border-red-300 transition-all duration-200">
            <span>Cancel Subscription</span>
          </button>
        </div>
      </div>

      {/* Add Payment Method Modal Placeholder */}
      {showAddPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Add Payment Method</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Payment method integration will be added during deployment phase.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowAddPayment(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}