import React from 'react';
import type { CrossCheckResult } from '../types';

interface Props {
  results: CrossCheckResult[];
}

const CrossCheckCard: React.FC<Props> = ({ results }) => {
  if (results.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500">
        दस्तावेज़ अपलोड करें और क्रॉस-चेक चलाएँ।
      </div>
    );
  }

  const mismatches = results.filter((r) => !r.match);
  const matches = results.filter((r) => r.match);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-bold text-gray-700 text-base">
        दस्तावेज़-फॉर्म क्रॉस-चेक
      </h3>

      {mismatches.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex flex-col gap-2">
          <p className="text-sm font-semibold text-red-700">
            ⚠️ {mismatches.length} असंगति मिली
          </p>
          {mismatches.map((r) => (
            <div
              key={r.fieldId}
              className="bg-white rounded-lg p-2.5 border border-red-100"
            >
              <p className="font-semibold text-red-700 text-sm">{r.fieldLabel}</p>
              <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
                <div>
                  <span className="text-gray-500">फॉर्म: </span>
                  <span className="font-medium text-gray-800">{r.formValue || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500">दस्तावेज़: </span>
                  <span className="font-medium text-gray-800">{r.docValue || '—'}</span>
                </div>
              </div>
              <p className="text-xs text-amber-700 mt-1">{r.message}</p>
            </div>
          ))}
        </div>
      )}

      {matches.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex flex-col gap-1.5">
          <p className="text-sm font-semibold text-green-700">
            ✅ {matches.length} फ़ील्ड मेल खाते हैं
          </p>
          {matches.map((r) => (
            <div key={r.fieldId} className="flex items-center gap-2 text-xs text-green-700">
              <span>✓</span>
              <span>{r.fieldLabel}: {r.formValue}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CrossCheckCard;
