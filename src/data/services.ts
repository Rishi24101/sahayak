// Shared service catalogue — single source of truth
export interface ServiceInfo {
  id: string;
  name: string;          // Hindi
  nameEn: string;        // English
  desc: string;          // Hindi document list
  color: string;         // Tailwind gradient
  portalUrl: string;     // Govt portal URL
}

export const SERVICES: ServiceInfo[] = [
  {
    id: 'old_age_pension',
    name: 'वृद्धावस्था पेंशन',
    nameEn: 'Old Age Pension (IGNOAPS)',
    desc: 'आधार, आयु प्रमाण, आय प्रमाण, बैंक पासबुक',
    color: 'from-blue-500 to-indigo-500',
    portalUrl: 'https://edistrict.cgstate.gov.in/',
  },
  {
    id: 'widow_pension',
    name: 'विधवा पेंशन',
    nameEn: 'Widow Pension (IGNWPS)',
    desc: 'आधार, मृत्यु प्रमाण पत्र, आयु प्रमाण, बैंक पासबुक',
    color: 'from-purple-500 to-pink-500',
    portalUrl: 'https://edistrict.cgstate.gov.in/',
  },
  {
    id: 'caste_certificate',
    name: 'जाति प्रमाण पत्र',
    nameEn: 'Caste Certificate (SC/ST/OBC)',
    desc: 'आधार, शपथ पत्र, पटवारी रिपोर्ट, स्कूल TC',
    color: 'from-emerald-500 to-teal-500',
    portalUrl: 'https://edistrict.cgstate.gov.in/',
  },
  {
    id: 'income_certificate',
    name: 'आय प्रमाण पत्र',
    nameEn: 'Income Certificate',
    desc: 'आधार, राशन कार्ड, स्व-घोषणा पत्र',
    color: 'from-amber-500 to-orange-500',
    portalUrl: 'https://edistrict.cgstate.gov.in/',
  },
  {
    id: 'ration_card',
    name: 'राशन कार्ड',
    nameEn: 'Ration Card (NFSA)',
    desc: 'सभी सदस्यों का आधार, आय प्रमाण, परिवार फोटो',
    color: 'from-rose-500 to-red-500',
    portalUrl: 'https://khadya.cg.nic.in/',
  },
  {
    id: 'ayushman',
    name: 'आयुष्मान भारत',
    nameEn: 'Ayushman Bharat (PM-JAY)',
    desc: 'आधार (सभी सदस्य), राशन कार्ड, मोबाइल नंबर',
    color: 'from-cyan-500 to-blue-500',
    portalUrl: 'https://pmjay.gov.in/',
  },
  {
    id: 'domicile_certificate',
    name: 'मूल निवास प्रमाण पत्र',
    nameEn: 'Domicile Certificate',
    desc: 'आधार, पुराना निवास प्रमाण, स्कूल TC',
    color: 'from-violet-500 to-purple-500',
    portalUrl: 'https://edistrict.cgstate.gov.in/',
  },
];

export const SERVICE_MAP: Record<string, ServiceInfo> = Object.fromEntries(
  SERVICES.map((s) => [s.id, s])
);
