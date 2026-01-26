import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Upload, Save, Mail, Globe, CreditCard } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'https://backendgk2-0.onrender.com';

interface ProfileData {
  name: string;
  bio: string;
  website: string;
  profileImage: string;
  payoutMethod: string | null;
  payoutEmail: string;
}

const CreatorProfile: React.FC = () => {
  const { getToken, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [profile, setProfile] = useState<ProfileData>({
    name: '',
    bio: '',
    website: '',
    profileImage: '',
    payoutMethod: null,
    payoutEmail: '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = getToken();
      const res = await axios.get(`${API_URL}/api/creator/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setProfile({
        name: res.data.name || '',
        bio: res.data.bio || '',
        website: res.data.website || '',
        profileImage: res.data.profileImage || '',
        payoutMethod: res.data.payoutMethod || null,
        payoutEmail: res.data.payoutEmail || '',
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await axios.post(
        `${API_URL}/api/upload/image?bookId=creators&type=profile`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      setProfile(prev => ({ ...prev, profileImage: res.data.url }));
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = getToken();
      await axios.put(
        `${API_URL}/api/creator/me`,
        profile,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Profile updated successfully!');
    } catch (error: any) {
      console.error('Save error:', error);
      alert(error.response?.data?.error || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New passwords do not match');
      return;
    }
    
    if (passwordData.newPassword.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    setSaving(true);
    try {
      const token = getToken();
      await axios.put(
        `${API_URL}/api/creator/me/password`,
        {
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert('Password changed successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      console.error('Password change error:', error);
      alert(error.response?.data?.error || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
        <p className="text-gray-500">Manage your creator profile and payout details</p>
      </div>

      {/* Profile Image */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Profile Image</h2>
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
            {profile.profileImage ? (
              <img src={profile.profileImage} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-10 h-10 text-gray-300" />
              </div>
            )}
          </div>
          <div>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer">
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Upload Photo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                disabled={uploading}
              />
            </label>
            <p className="text-xs text-gray-400 mt-2">Recommended: Square image, at least 200x200px</p>
          </div>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Basic Information</h2>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Display Name
          </label>
          <input
            type="text"
            value={profile.name}
            onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Your name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bio
          </label>
          <textarea
            value={profile.bio}
            onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
            rows={3}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Tell listeners about yourself..."
          />
          <p className="text-xs text-gray-400 mt-1">This will be shown on your public creator profile</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Globe className="w-4 h-4 inline mr-1" />
            Website (optional)
          </label>
          <input
            type="url"
            value={profile.website}
            onChange={(e) => setProfile(prev => ({ ...prev, website: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="https://your-website.com"
          />
        </div>
      </div>

      {/* Payout Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Payout Settings
        </h2>
        <p className="text-sm text-gray-500">Configure how you'd like to receive your earnings</p>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payout Method
          </label>
          <select
            value={profile.payoutMethod || ''}
            onChange={(e) => setProfile(prev => ({ ...prev, payoutMethod: e.target.value || null }))}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">Select a method...</option>
            <option value="paypal">PayPal</option>
            <option value="venmo">Venmo</option>
            <option value="check">Check</option>
          </select>
        </div>

        {(profile.payoutMethod === 'paypal' || profile.payoutMethod === 'venmo') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Mail className="w-4 h-4 inline mr-1" />
              {profile.payoutMethod === 'paypal' ? 'PayPal Email' : 'Venmo Username/Email'}
            </label>
            <input
              type="text"
              value={profile.payoutEmail}
              onChange={(e) => setProfile(prev => ({ ...prev, payoutEmail: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder={profile.payoutMethod === 'paypal' ? 'your-email@example.com' : '@username'}
            />
          </div>
        )}

        <div className="bg-yellow-50 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Payouts are processed monthly when your balance exceeds $25.00.
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Change Password</h2>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Current Password
          </label>
          <input
            type="password"
            value={passwordData.currentPassword}
            onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            New Password
          </label>
          <input
            type="password"
            value={passwordData.newPassword}
            onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Confirm New Password
          </label>
          <input
            type="password"
            value={passwordData.confirmPassword}
            onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <button
          onClick={handleChangePassword}
          disabled={saving || !passwordData.currentPassword || !passwordData.newPassword}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          Change Password
        </button>
      </div>
    </div>
  );
};

export default CreatorProfile;
