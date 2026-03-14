import { useState, useEffect } from 'react';
import { BarChart3, TrendingDown, AlertCircle } from 'lucide-react';
import { api } from '../utils/api';
import type { DashboardData } from '../utils/api';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const SERVICE_NAMES: Record<string, string> = {
  old_age_pension: 'पेंशन',
  widow_pension: 'विधवा',
  ration_card: 'राशन',
  income_certificate: 'आय',
  caste_certificate: 'जाति',
  ayushman: 'आयुष्मान',
};

export default function Analytics() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.getDashboard().then(setData).catch(() => {
      // Same fallback as dashboard
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
        ],
        top_rejection_reasons: [
          { service_type: 'old_age_pension', field_name: 'income', error_message: 'आय सीमा से अधिक', count: 42 },
          { service_type: 'old_age_pension', field_name: 'age', error_message: 'आयु 60 वर्ष से कम', count: 35 },
          { service_type: 'caste_certificate', field_name: 'name_mismatch', error_message: 'नाम मेल नहीं', count: 31 },
          { service_type: 'old_age_pension', field_name: 'name_mismatch', error_message: 'नाम आधार से मेल नहीं', count: 28 },
        ],
        recent_submissions: [],
      });
    });
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const rejectionChartData = {
    labels: data.top_rejection_reasons.map(r => r.error_message.substring(0, 20) + '...'),
    datasets: [{
      label: 'रिजेक्शन काउंट',
      data: data.top_rejection_reasons.map(r => r.count),
      backgroundColor: [
        'rgba(239, 68, 68, 0.8)',
        'rgba(245, 158, 11, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(139, 92, 246, 0.8)',
      ],
      borderRadius: 8,
    }]
  };

  const schemeChartData = {
    labels: data.scheme_stats.map(s => SERVICE_NAMES[s.service_type] || s.service_type),
    datasets: [
      {
        label: 'कुल आवेदन',
        data: data.scheme_stats.map(s => s.total),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderRadius: 8,
      },
      {
        label: 'रिजेक्ट',
        data: data.scheme_stats.map(s => s.rejected),
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderRadius: 8,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' as const },
    },
    scales: {
      y: { beginAtZero: true }
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-blue-600" />
          विश्लेषण / Analytics
        </h1>
        <p className="text-slate-500 mt-1">रिजेक्शन पैटर्न और योजना-वार प्रदर्शन</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            प्रमुख रिजेक्शन कारण
          </h3>
          <Bar data={rejectionChartData} options={chartOptions} />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-blue-500" />
            योजना-वार सारांश
          </h3>
          <Bar data={schemeChartData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
}
