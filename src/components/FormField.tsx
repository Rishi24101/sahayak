import React from 'react';
import type { FieldSchema, FieldValidation } from '../types';

interface Props {
  schema: FieldSchema;
  value: string;
  validation?: FieldValidation;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  valid:   'border-green-400 focus:border-green-500',
  warning: 'border-amber-400 focus:border-amber-500',
  error:   'border-red-400 focus:border-red-500',
  empty:   'border-gray-300 focus:border-indigo-500',
};

const ICON: Record<string, string> = {
  valid:   '✅',
  warning: '⚠️',
  error:   '❌',
  empty:   '',
};

const FormField: React.FC<Props> = ({ schema, value, validation, onChange, disabled }) => {
  const status = validation?.status ?? 'empty';
  const borderClass = STATUS_STYLES[status] ?? STATUS_STYLES.empty;

  const inputBase =
    `w-full border-2 rounded-xl px-4 py-2.5 text-gray-800 text-sm transition-colors focus:outline-none ${borderClass}`;

  const renderInput = () => {
    if (schema.type === 'select' && schema.options) {
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={inputBase + ' bg-white'}
        >
          <option value="">-- चुनें --</option>
          {schema.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    if (schema.type === 'date') {
      return (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={inputBase}
        />
      );
    }

    return (
      <input
        type={schema.type === 'number' ? 'number' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={schema.placeholder ?? ''}
        disabled={disabled}
        className={inputBase}
        min={schema.min}
        max={schema.max}
        minLength={schema.minLength}
        maxLength={schema.maxLength}
      />
    );
  };

  return (
    <div className="flex flex-col gap-1.5 mb-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-700">
          {schema.label}
          {schema.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {ICON[status] && (
          <span className="text-sm">{ICON[status]}</span>
        )}
      </div>

      {renderInput()}

      {/* Tooltip (always shown on mobile as text) */}
      {schema.tooltip && status === 'empty' && (
        <p className="text-xs text-gray-400">{schema.tooltip}</p>
      )}

      {/* Validation message */}
      {validation?.message && (
        <p
          className={`text-xs font-medium ${
            status === 'error'
              ? 'text-red-600'
              : status === 'warning'
              ? 'text-amber-600'
              : 'text-green-600'
          }`}
        >
          {validation.message}
        </p>
      )}
    </div>
  );
};

export default FormField;
