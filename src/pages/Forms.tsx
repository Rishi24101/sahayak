import { Link } from 'react-router-dom';
import { FileText, ArrowRight } from 'lucide-react';

const SERVICES = [
  { id: 'old_age_pension', name: 'वृद्धावस्था पेंशन', nameEn: 'Old Age Pension (IGNOAPS)', desc: 'आधार, आयु प्रमाण, आय प्रमाण, बैंक पासबुक', color: 'from-blue-500 to-indigo-500' },
  { id: 'widow_pension', name: 'विधवा पेंशन', nameEn: 'Widow Pension (IGNWPS)', desc: 'आधार, मृत्यु प्रमाण पत्र, आयु प्रमाण', color: 'from-purple-500 to-pink-500' },
  { id: 'caste_certificate', name: 'जाति प्रमाण पत्र', nameEn: 'Caste Certificate (SC/ST/OBC)', desc: 'आधार, शपथ पत्र, पटवारी रिपोर्ट, स्कूल TC', color: 'from-emerald-500 to-teal-500' },
  { id: 'income_certificate', name: 'आय प्रमाण पत्र', nameEn: 'Income Certificate', desc: 'आधार, राशन कार्ड, स्व-घोषणा पत्र', color: 'from-amber-500 to-orange-500' },
  { id: 'ration_card', name: 'राशन कार्ड', nameEn: 'Ration Card (NFSA)', desc: 'सभी सदस्यों का आधार, आय प्रमाण, परिवार फोटो', color: 'from-rose-500 to-red-500' },
  { id: 'ayushman', name: 'आयुष्मान भारत', nameEn: 'Ayushman Bharat (PM-JAY)', desc: 'आधार, राशन कार्ड, मोबाइल नंबर', color: 'from-cyan-500 to-blue-500' },
];

export default function Forms() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">सेवा फॉर्म</h1>
        <p className="text-slate-500 mt-1">सेवा चुनें और नया आवेदन शुरू करें</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {SERVICES.map(svc => (
          <Link key={svc.id} to={`/forms/${svc.id}`}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden group">
            <div className={`h-2 bg-gradient-to-r ${svc.color}`} />
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{svc.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{svc.nameEn}</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-blue-50 transition-colors">
                  <FileText className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                </div>
              </div>
              <p className="text-sm text-slate-600 mt-3 leading-relaxed">📎 {svc.desc}</p>
              <div className="flex items-center gap-1 mt-4 text-sm font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                आवेदन शुरू करें <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
