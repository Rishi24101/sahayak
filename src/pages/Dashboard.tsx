import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, TrendingDown, FileText, ArrowRight, ShieldAlert, ScanLine, Clock } from 'lucide-react';
import { api } from '../utils/api';
import type { DashboardData } from '../utils/api';

const SERVICE_NAMES: Record<string, string> = {
  old_age_pension: 'वृद्धावस्था पेंशन',
  widow_pension: 'विधवा पेंशन',
  ration_card: 'राशन कार्ड',
  income_certificate: 'आय प्रमाण पत्र',
  caste_certificate: 'जाति प्रमाण पत्र',
  domicile_certificate: 'मूल निवास',
  ayushman: 'आयुष्मान भारत',
};

const QUICK_SERVICES = [
  { id: 'old_age_pension',    label: 'वृद्धावस्था पेंशन',   en: 'Old Age Pension',     color: 'var(--csc-blue)' },
  { id: 'ration_card',        label: 'राशन कार्ड',           en: 'Ration Card',         color: 'var(--csc-green)' },
  { id: 'income_certificate', label: 'आय प्रमाण पत्र',       en: 'Income Certificate',  color: 'var(--csc-orange)' },
  { id: 'caste_certificate',  label: 'जाति प्रमाण पत्र',     en: 'Caste Certificate',   color: '#7b3fa0' },
  { id: 'widow_pension',      label: 'विधवा पेंशन',          en: 'Widow Pension',       color: '#b5451b' },
  { id: 'ayushman',           label: 'आयुष्मान भारत',        en: 'Ayushman Bharat',     color: '#1a7a8a' },
];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toLocaleDateString('hi-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  useEffect(() => {
    api.getDashboard()
      .then(setData)
      .catch(() => setData({
        total_submissions: 12,
        total_rejected: 5,
        rejection_rate: 41.7,
        high_risk_count: 3,
        scheme_stats: [
          { service_type: 'old_age_pension',    total: 4, rejected: 2, avg_risk: 0.47 },
          { service_type: 'caste_certificate',   total: 3, rejected: 2, avg_risk: 0.62 },
          { service_type: 'income_certificate',  total: 2, rejected: 0, avg_risk: 0.22 },
          { service_type: 'ration_card',         total: 2, rejected: 1, avg_risk: 0.45 },
          { service_type: 'ayushman',            total: 1, rejected: 0, avg_risk: 0.35 },
        ],
        top_rejection_reasons: [
          { service_type: 'old_age_pension',  field_name: 'income',            error_message: 'आय सीमा से अधिक',         count: 42 },
          { service_type: 'old_age_pension',  field_name: 'age',               error_message: 'आयु 60 वर्ष से कम',        count: 35 },
          { service_type: 'caste_certificate',field_name: 'name_mismatch',     error_message: 'नाम दस्तावेजों से मेल नहीं',count: 31 },
          { service_type: 'old_age_pension',  field_name: 'name_mismatch',     error_message: 'नाम आधार से मेल नहीं',     count: 28 },
          { service_type: 'caste_certificate',field_name: 'father_name_mismatch',error_message: 'पिता का नाम मेल नहीं',   count: 22 },
        ],
        recent_submissions: [],
      }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--csc-border)', borderTopColor: 'var(--csc-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
  if (!data) return null;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Page Heading ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--csc-blue)', margin: 0 }}>डैशबोर्ड / Dashboard</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Clock size={13} color="var(--csc-muted)" />
            <span style={{ fontSize: 12, color: 'var(--csc-muted)' }}>{today}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/scanner" style={{ textDecoration: 'none' }}>
            <button className="btn-ghost" style={{ fontSize: 12 }}><ScanLine size={14} /> OCR स्कैन</button>
          </Link>
          <Link to="/forms" style={{ textDecoration: 'none' }}>
            <button className="btn-primary">नया आवेदन <ArrowRight size={14} /></button>
          </Link>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--csc-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>कुल आवेदन</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--csc-blue)', marginTop: 4 }}>{data.total_submissions}</div>
              <div style={{ fontSize: 11, color: 'var(--csc-muted)', marginTop: 2 }}>Total Applications</div>
            </div>
            <div style={{ background: 'var(--csc-blue-light)', borderRadius: 6, padding: 10 }}>
              <FileText size={20} color="var(--csc-blue)" />
            </div>
          </div>
        </div>

        <div className="stat-card green">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--csc-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>बचाए गए</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--csc-green)', marginTop: 4 }}>{data.total_submissions - data.total_rejected}</div>
              <div style={{ fontSize: 11, color: 'var(--csc-muted)', marginTop: 2 }}>Rejections Prevented</div>
            </div>
            <div style={{ background: 'var(--csc-green-light)', borderRadius: 6, padding: 10 }}>
              <CheckCircle2 size={20} color="var(--csc-green)" />
            </div>
          </div>
        </div>

        <div className="stat-card red">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--csc-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>उच्च जोखिम</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--csc-red)', marginTop: 4 }}>{data.high_risk_count}</div>
              <div style={{ fontSize: 11, color: 'var(--csc-muted)', marginTop: 2 }}>High Risk Cases</div>
            </div>
            <div style={{ background: '#fdf0ef', borderRadius: 6, padding: 10 }}>
              <ShieldAlert size={20} color="var(--csc-red)" />
            </div>
          </div>
        </div>

        <div className="stat-card orange">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--csc-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>रिजेक्शन दर</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--csc-orange)', marginTop: 4 }}>{data.rejection_rate}%</div>
              <div style={{ fontSize: 11, color: 'var(--csc-muted)', marginTop: 2 }}>Rejection Rate</div>
            </div>
            <div style={{ background: 'var(--csc-orange-light)', borderRadius: 6, padding: 10 }}>
              <TrendingDown size={20} color="var(--csc-orange)" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Service Launch ── */}
      <div className="csc-card" style={{ marginBottom: 20 }}>
        <div className="csc-card-header">
          <FileText size={15} /> त्वरित सेवा / Quick Service Launch
        </div>
        <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {QUICK_SERVICES.map(svc => (
            <Link key={svc.id} to={`/forms/${svc.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                border: '1px solid var(--csc-border)', borderLeft: `4px solid ${svc.color}`,
                borderRadius: 4, padding: '10px 14px', cursor: 'pointer',
                transition: 'all 0.15s', background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
                className="hover:shadow-sm"
                onMouseOver={e => (e.currentTarget.style.background = 'var(--csc-blue-light)')}
                onMouseOut={e => (e.currentTarget.style.background = '#fff')}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--csc-text)' }}>{svc.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--csc-muted)', marginTop: 2 }}>{svc.en}</div>
                </div>
                <ArrowRight size={14} color={svc.color} />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Tables Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Rejection Reasons */}
        <div className="csc-card">
          <div className="csc-card-header">
            <AlertCircle size={15} color="var(--csc-red)" /> प्रमुख रिजेक्शन कारण
          </div>
          <div style={{ padding: '0 4px 4px' }}>
            <table className="csc-table">
              <thead>
                <tr>
                  <th>कारण</th>
                  <th>सेवा</th>
                  <th style={{ width: 60, textAlign: 'right' }}>गिनती</th>
                </tr>
              </thead>
              <tbody>
                {data.top_rejection_reasons.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: 12 }}>{r.error_message}</div>
                      <div style={{ color: 'var(--csc-muted)', fontSize: 11 }}>{r.field_name}</div>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--csc-muted)' }}>{SERVICE_NAMES[r.service_type] || r.service_type}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="badge-red">{r.count}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Scheme Stats */}
        <div className="csc-card">
          <div className="csc-card-header">
            <FileText size={15} /> योजना-वार सारांश
          </div>
          <div style={{ padding: '0 4px 4px' }}>
            <table className="csc-table">
              <thead>
                <tr>
                  <th>योजना</th>
                  <th style={{ textAlign: 'center' }}>कुल</th>
                  <th style={{ textAlign: 'center' }}>रिजेक्ट</th>
                  <th style={{ textAlign: 'right' }}>जोखिम</th>
                </tr>
              </thead>
              <tbody>
                {data.scheme_stats.map((s, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500, fontSize: 12 }}>{SERVICE_NAMES[s.service_type] || s.service_type}</td>
                    <td style={{ textAlign: 'center' }}><span className="badge-blue">{s.total}</span></td>
                    <td style={{ textAlign: 'center' }}><span className="badge-red">{s.rejected}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={s.avg_risk > 0.6 ? 'badge-red' : s.avg_risk > 0.3 ? 'badge-orange' : 'badge-green'}>
                        {(s.avg_risk * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
