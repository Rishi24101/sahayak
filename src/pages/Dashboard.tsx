import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  AlertCircle, CheckCircle2, TrendingDown, 
  FileText, ArrowRight, ShieldAlert
} from 'lucide-react';
import { api } from '../utils/api';
import type { DashboardData } from '../utils/api';

const SERVICE_NAMES: Record<string, string> = {
  old_age_pension: 'वृद्धावस्था पेंशन',
  widow_pension: 'विधवा पेंशन',
  ration_card: 'राशन कार्ड',
  income_certificate: 'आय प्रमाण पत्र',
  caste_certificate: 'जाति प्रमाण पत्र',
  ayushman: 'आयुष्मान भारत',
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboard()
      .then(setData)
      .catch(() => {
        // Fallback mock data if backend is down
        setData({
          total_submissions: 12,
          total_rejected: 5,
          rejection_rate: 41.7,
          high_risk_count: 3,
          scheme_stats: [
            { service_type: 'old_age_pension', total: 4, rejected: 2, avg_risk: 0.47 },
            { service_type: 'caste_certificate', total: 3, rejected: 2, avg_risk: 0.62 },
            { service_type: 'income_certificate', total: 2, rejected: 0, avg_risk: 0.22 },
            { service_type: 'ration_card', total: 2, rejected: 1, avg_risk: 0.45 },
            { service_type: 'ayushman', total: 1, rejected: 0, avg_risk: 0.35 },
          ],
          top_rejection_reasons: [
            { service_type: 'old_age_pension', field_name: 'income', error_message: 'आय सीमा से अधिक', count: 42 },
            { service_type: 'old_age_pension', field_name: 'age', error_message: 'आयु 60 वर्ष से कम', count: 35 },
            { service_type: 'caste_certificate', field_name: 'name_mismatch', error_message: 'नाम दस्तावेजों से मेल नहीं', count: 31 },
            { service_type: 'old_age_pension', field_name: 'name_mismatch', error_message: 'नाम आधार से मेल नहीं', count: 28 },
            { service_type: 'caste_certificate', field_name: 'father_name_mismatch', error_message: 'पिता का नाम मेल नहीं', count: 22 },
          ],
          recent_submissions: [],
        });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">डैशबोर्ड</h1>
          <p className="text-slate-500 mt-1">आज की गतिविधि और जोखिम विश्लेषण</p>
        </div>
        <Link 
          to="/forms" 
          className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:shadow-lg hover:shadow-blue-500/25 transition-all flex items-center gap-2 active:scale-[0.98]"
        >
          नया आवेदन
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">कुल आवेदन</p>
              <h3 className="text-3xl font-bold text-slate-900 mt-1">{data.total_submissions}</h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">रोके गए रिजेक्शन</p>
              <h3 className="text-3xl font-bold text-emerald-600 mt-1">{data.total_submissions - data.total_rejected}</h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">उच्च जोखिम</p>
              <h3 className="text-3xl font-bold text-red-600 mt-1">{data.high_risk_count}</h3>
            </div>
            <div className="p-3 bg-red-50 text-red-600 rounded-xl">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">रिजेक्शन दर</p>
              <h3 className="text-3xl font-bold text-amber-600 mt-1">{data.rejection_rate}%</h3>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <TrendingDown className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Rejection Reasons */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              प्रमुख रिजेक्शन कारण
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {data.top_rejection_reasons.map((reason, i) => (
              <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900">{reason.error_message}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {SERVICE_NAMES[reason.service_type] || reason.service_type} → {reason.field_name}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-red-500 to-amber-500 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(reason.count / 50 * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-slate-700 w-8 text-right">{reason.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scheme-wise Stats */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              योजना-वार सारांश
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {data.scheme_stats.map((stat, i) => (
              <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    {SERVICE_NAMES[stat.service_type] || stat.service_type}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    कुल: {stat.total} | रिजेक्ट: {stat.rejected}
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  stat.avg_risk > 0.6 ? 'bg-red-100 text-red-700' :
                  stat.avg_risk > 0.3 ? 'bg-amber-100 text-amber-700' :
                  'bg-emerald-100 text-emerald-700'
                }`}>
                  {(stat.avg_risk * 100).toFixed(0)}% जोखिम
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
