import React from 'react';
import { BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ContentAnalyticsProps {
  contentId: string;
  contentType: 'book' | 'playlist';
}

/**
 * Placeholder analytics panel.
 * The portal previously referenced this component but it wasn't committed, breaking builds.
 * For now, link to the main Analytics dashboard.
 */
const ContentAnalytics: React.FC<ContentAnalyticsProps> = ({ contentId, contentType }) => {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
        <BarChart3 className="w-5 h-5 text-indigo-600" />
      </div>
      <div className="flex-1">
        <div className="font-semibold text-gray-900">Analytics</div>
        <div className="text-sm text-gray-600">
          View engagement stats for this {contentType}. (ID: {contentId})
        </div>
        <Link to="/analytics" className="inline-flex mt-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
          Go to Analytics →
        </Link>
      </div>
    </div>
  );
};

export default ContentAnalytics;



