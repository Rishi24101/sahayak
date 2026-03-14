import React from 'react';
import type { FieldSchema, FieldValidation } from '../types';
import FormField from './FormField';

interface Props {
  fields: FieldSchema[];
  values: Record<string, string>;
  validations: Record<string, FieldValidation>;
  onChange: (fieldId: string, value: string) => void;
  disabled?: boolean;
}

const FormRenderer: React.FC<Props> = ({
  fields,
  values,
  validations,
  onChange,
  disabled,
}) => {
  return (
    <div className="flex flex-col">
      {fields.map((field) => (
        <FormField
          key={field.id}
          schema={field}
          value={values[field.id] ?? ''}
          validation={validations[field.id]}
          onChange={(val) => onChange(field.id, val)}
          disabled={disabled}
        />
      ))}
    </div>
  );
};

export default FormRenderer;
