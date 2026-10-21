import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, MapPin, Edit3 } from 'lucide-react';
import WoodButton from '../ui/WoodButton';

interface ShippingAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (address: ShippingAddress) => void;
}

export interface ShippingAddress {
  fullName: string;
  email: string;
  streetAddress: string;
  apt?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

const ShippingAddressModal: React.FC<ShippingAddressModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<ShippingAddress>({
    fullName: '',
    email: '',
    streetAddress: '',
    apt: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    phone: ''
  });

  // Try to trigger browser autofill by focusing the first field
  const handleAutofillAttempt = () => {
    // Browser autofill is automatically triggered on focus
    setShowManualEntry(true);
  };

  const handleInputChange = (field: keyof ShippingAddress, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateForm = (): boolean => {
    if (!formData.fullName.trim()) {
      setError('Please enter your full name');
      return false;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!formData.streetAddress.trim()) {
      setError('Please enter your street address');
      return false;
    }
    if (!formData.city.trim()) {
      setError('Please enter your city');
      return false;
    }
    if (!formData.state.trim()) {
      setError('Please enter your state');
      return false;
    }
    if (!formData.postalCode.trim()) {
      setError('Please enter your postal code');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit address');
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 pointer-events-auto bg-black/60 backdrop-blur-sm">
      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] px-6 py-6 text-white">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
          
          <div className="flex items-center gap-3 mb-2">
            <MapPin size={28} className="text-white" />
            <h2 className="font-display font-bold text-2xl">Where should we ship it?</h2>
          </div>
          <p className="text-white/90 text-sm">
            We'll mail the free book here after the 7-day challenge.
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {!showManualEntry ? (
            // Autofill prompt
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] rounded-full mx-auto mb-6 flex items-center justify-center">
                <MapPin size={40} className="text-white" />
              </div>
              
              <h3 className="font-display font-bold text-xl text-gray-900 mb-3">
                Use Saved Address?
              </h3>
              <p className="text-gray-600 mb-6 text-sm leading-relaxed px-4">
                Your browser can autofill your shipping address to save time.
              </p>

              <div className="space-y-3">
                <WoodButton
                  onClick={handleAutofillAttempt}
                  variant="primary"
                  fullWidth
                  className="bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] hover:from-[#6D28D9] hover:to-[#4C1D95]"
                >
                  <MapPin size={18} className="mr-2" />
                  Use Autofill
                </WoodButton>

                <button
                  onClick={() => setShowManualEntry(true)}
                  className="w-full py-3 text-gray-700 hover:text-gray-900 font-medium text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Edit3 size={16} />
                  Enter Address Manually
                </button>
              </div>
            </div>
          ) : (
            // Manual entry form
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Full Name */}
              <div>
                <label htmlFor="fullName" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Full name
                </label>
                <input
                  id="fullName"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange('fullName', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent transition-shadow"
                  placeholder="John Doe"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent transition-shadow"
                  placeholder="john@example.com"
                />
              </div>

              {/* Street Address */}
              <div>
                <label htmlFor="streetAddress" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Street address
                </label>
                <input
                  id="streetAddress"
                  name="address-line1"
                  type="text"
                  autoComplete="address-line1"
                  value={formData.streetAddress}
                  onChange={(e) => handleInputChange('streetAddress', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent transition-shadow"
                  placeholder="123 Main St"
                />
              </div>

              {/* Apt/Suite (Optional) */}
              <div>
                <label htmlFor="apt" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Apt, suite <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  id="apt"
                  name="address-line2"
                  type="text"
                  autoComplete="address-line2"
                  value={formData.apt}
                  onChange={(e) => handleInputChange('apt', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent transition-shadow"
                  placeholder="Apt 4B"
                />
              </div>

              {/* City & State - Side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="city" className="block text-sm font-semibold text-gray-700 mb-1.5">
                    City
                  </label>
                  <input
                    id="city"
                    name="address-level2"
                    type="text"
                    autoComplete="address-level2"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent transition-shadow"
                    placeholder="New York"
                  />
                </div>

                <div>
                  <label htmlFor="state" className="block text-sm font-semibold text-gray-700 mb-1.5">
                    State
                  </label>
                  <input
                    id="state"
                    name="address-level1"
                    type="text"
                    autoComplete="address-level1"
                    value={formData.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent transition-shadow"
                    placeholder="NY"
                  />
                </div>
              </div>

              {/* Postal Code */}
              <div>
                <label htmlFor="postalCode" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Postal code
                </label>
                <input
                  id="postalCode"
                  name="postal-code"
                  type="text"
                  autoComplete="postal-code"
                  value={formData.postalCode}
                  onChange={(e) => handleInputChange('postalCode', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent transition-shadow"
                  placeholder="10001"
                />
              </div>

              {/* Country */}
              <div>
                <label htmlFor="country" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Country
                </label>
                <select
                  id="country"
                  name="country"
                  autoComplete="country"
                  value={formData.country}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent transition-shadow"
                >
                  <option value="United States">United States</option>
                  <option value="Canada">Canada</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Australia">Australia</option>
                </select>
              </div>

              {/* Phone (Optional) */}
              <div>
                <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Phone <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  id="phone"
                  name="tel"
                  type="tel"
                  autoComplete="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent transition-shadow"
                  placeholder="(555) 123-4567"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <WoodButton
                  type="submit"
                  variant="primary"
                  fullWidth
                  disabled={isSubmitting}
                  className="bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] hover:from-[#6D28D9] hover:to-[#4C1D95] py-4 text-lg"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Address'}
                </WoodButton>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ShippingAddressModal;
