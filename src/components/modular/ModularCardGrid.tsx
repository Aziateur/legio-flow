import React from 'react';
import { Template } from '../../types/schema';
import { ModularCard } from './ModularCard';

interface ModularCardGridProps {
  template: Template;
  values: Record<string, any>;
  onChange: (fieldId: string, value: any) => void;
  onAction?: (actionName: string, payload?: any) => void;
}

export const ModularCardGrid: React.FC<ModularCardGridProps> = ({
  template,
  values,
  onChange,
  onAction
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
      {template.fields.map((field) => {
        const val = values[field.id] !== undefined ? values[field.id] : field.defaultValue;
        return (
          <ModularCard
            key={field.id}
            field={field}
            value={val}
            onChange={(newVal) => onChange(field.id, newVal)}
            onAction={onAction}
          />
        );
      })}
    </div>
  );
};
