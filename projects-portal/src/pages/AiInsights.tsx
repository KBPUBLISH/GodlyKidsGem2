import React, { useState } from 'react';
import {
  Sparkles,
  Brain,
  Zap,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Info,
  Lightbulb,
  Loader2,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import {
  gatherAnalyticsSummary,
  requestInsights,
  type InsightTier,
  type InsightTimeRange,
  type InsightResult,
  type InsightFinding,
  type InsightRecommendation,
} from '../services/aiInsightsService';

const TIME_RANGES: { value: InsightTimeRange; label: string }[] = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
];

const severityStyles: Record<InsightFinding['severity'], { icon: React.ReactNode; badge: string; border: string }> = {
  critical: {
    icon: <AlertOctagon className="w-5 h-5 text-red-600" />,
    badge: 'bg-red-100 text-red-700',
    border: 'border-l-red-500',
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
    badge: 'bg-amber-100 text-amber-700',
    border: 'border-l-amber-500',
  },
  positive: {
    icon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
    badge: 'bg-green-100 text-green-700',
    border: 'border-l-green-500',
  },
  info: {
    icon: <Info className="w-5 h-5 text-blue-600" />,
    badge: 'bg-blue-100 text-blue-700',
    border: 'border-l-blue-500',
  },
};

const priorityStyles: Record<InsightRecommendation['priority'], string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-600',
};

const AiInsights: React.FC = () => {
  const [tier, setTier] = useState<InsightTier>('sonnet');
  const [timeRange, setTimeRange] = useState<InsightTimeRange>('month');
  const [focus, setFocus] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InsightResult | null>(null);

  const handleDiagnose = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setStatusText('Gathering analytics…');
      const summary = await gatherAnalyticsSummary(timeRange);

      if (Object.keys(summary).length === 0) {
        setError('No analytics data could be gathered. Check that the backend analytics endpoints are reachable.');
        return;
      }

      setStatusText(`Asking Claude (${tier === 'opus' ? 'Opus 4.8' : 'Sonnet 5'}) to analyze…`);
      const res = await requestInsights({ tier, focus, timeRange, summary });
      setResult(res);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Something went wrong generating insights.';
      setError(msg);
    } finally {
      setLoading(false);
      setStatusText('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-600" />
            AI Insights
          </h1>
          <p className="text-gray-600 mt-1">
            Let Claude diagnose your analytics and recommend what to do next.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-5">
        {/* Model tier */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">Model</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTier('sonnet')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                tier === 'sonnet'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Zap className="w-4 h-4" />
              Sonnet 5 — fast &amp; cheap
            </button>
            <button
              onClick={() => setTier('opus')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                tier === 'opus'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Brain className="w-4 h-4" />
              Opus 4.8 — deepest analysis
            </button>
          </div>
        </div>

        {/* Time range */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            Time range
          </label>
          <div className="flex flex-wrap gap-2">
            {TIME_RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setTimeRange(r.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  timeRange === r.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Focus */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Focus (optional)
          </label>
          <input
            type="text"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="e.g. onboarding drop-off, paywall conversion, low-performing books…"
            className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="pt-1">
          <button
            onClick={handleDiagnose}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {statusText || 'Working…'}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {result ? 'Re-run Diagnosis' : 'Diagnose & Recommend'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertOctagon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700">Couldn’t generate insights</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Diagnosis */}
          <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Brain className="w-5 h-5 text-indigo-600" />
                Diagnosis
              </h2>
              <span className="text-xs text-gray-400">
                {result.model} · {new Date(result.generatedAt).toLocaleString()}
              </span>
            </div>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{result.diagnosis}</p>
          </div>

          {/* Findings */}
          {result.findings.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-600" />
                Findings
              </h2>
              <div className="space-y-3">
                {result.findings.map((f, i) => {
                  const s = severityStyles[f.severity] || severityStyles.info;
                  return (
                    <div
                      key={i}
                      className={`bg-white border border-gray-100 border-l-4 ${s.border} rounded-xl p-4 shadow-sm flex items-start gap-3`}
                    >
                      <div className="flex-shrink-0 mt-0.5">{s.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{f.title}</p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.badge}`}>
                            {f.severity}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{f.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                Recommendations
              </h2>
              <div className="space-y-3">
                {result.recommendations.map((r, i) => (
                  <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-sm font-bold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <p className="font-semibold text-gray-900">{r.title}</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityStyles[r.priority] || priorityStyles.low}`}>
                        {r.priority} priority
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{r.detail}</p>
                    {r.expectedImpact && (
                      <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" />
                        Expected impact: <span className="font-medium text-gray-700">{r.expectedImpact}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.unstructured && (
            <p className="text-xs text-gray-400">
              Note: the model returned a free-form response that couldn’t be parsed into structured cards.
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center">
          <Sparkles className="w-10 h-10 text-indigo-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No insights yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Pick a model and time range, then run a diagnosis. Only aggregated, anonymized analytics are sent to Claude.
          </p>
        </div>
      )}
    </div>
  );
};

export default AiInsights;
