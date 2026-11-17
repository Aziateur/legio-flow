import React, { useState } from 'react';
import { useStorage } from '../../context/StorageContext';
import { Template, TemplateField, CardWidth, CardShape, FieldType } from '../../types/schema';
import { 
  Sliders, 
  Plus, 
  Trash2, 
  MoveUp, 
  MoveDown, 
  Copy, 
  RotateCcw, 
  Eye, 
  Check, 
  Sparkles,
  LayoutGrid,
  Maximize2,
  Columns,
  Palette
} from 'lucide-react';

export const TemplateManager: React.FC = () => {
  const { 
    templates, 
    saveTemplate, 
    deleteTemplate, 
    resetTemplatesToDefault 
  } = useStorage();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || 'tpl_daily_default');
  const activeTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];

  // Field editor modal/state
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  // New field modal state
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>('textarea');
  const [newFieldWidth, setNewFieldWidth] = useState<CardWidth>('col-span-6');
  const [newFieldShape, setNewFieldShape] = useState<CardShape>('standard');
  const [newFieldDescription, setNewFieldDescription] = useState('');

  // Field type options with clear human explanations
  const fieldTypes: { type: FieldType; label: string; desc: string }[] = [
    { type: 'rating_5', label: '1–5 Rating Scorecard', desc: 'Focus, Execution, Output style rating' },
    { type: 'rating_10', label: '1–10 Execution Score', desc: 'Standard 1-10 execution metric' },
    { type: 'duration', label: 'Planned vs Actual Time', desc: 'Timer & minute trackers' },
    { type: 'score_target', label: 'Tasks Ratio Counter', desc: 'e.g. 3 / 3 tasks completed' },
    { type: 'textarea', label: 'Multi-line Reflexion Prompt', desc: 'Text box for thoughts, blockers, wins' },
    { type: 'numbered_list', label: 'Numbered 1, 2, 3 Priorities', desc: 'Discrete numbered input rows with badges' },
    { type: 'text', label: 'Short Text Input', desc: 'Single-line header or task title' },
    { type: 'checkbox', label: 'Yes/No Boolean Toggle', desc: 'Routine or habit completion check' },
    { type: 'checklist', label: 'Interactive Checklist', desc: 'Subtasks with checkboxes' },
    { type: 'task_points_table', label: 'Goal Crusher Tasks Table', desc: 'Tasks with score weights totaling 10' },
    { type: 'reward_ladder', label: 'Reward Ladder Tier', desc: 'Milestones (6+, 7+, 8+, etc.)' },
    { type: 'gws_session_link', label: 'Linked GWS Sessions', desc: 'Live sessions belonging to this cycle' }
  ];

  const widths: { width: CardWidth; label: string; cols: string }[] = [
    { width: 'col-span-12', label: 'Full Width', cols: '100% of grid' },
    { width: 'col-span-8', label: 'Two-Thirds (2/3)', cols: '66% of grid' },
    { width: 'col-span-6', label: 'Half Width (1/2)', cols: '50% of grid' },
    { width: 'col-span-4', label: 'One-Third (1/3)', cols: '33% of grid' },
    { width: 'col-span-3', label: 'Quarter (1/4)', cols: '25% of grid' }
  ];

  const shapes: { shape: CardShape; label: string; desc: string }[] = [
    { shape: 'standard', label: 'Standard Slate', desc: 'Clean dark card with subtle border' },
    { shape: 'compact', label: 'Compact Dense', desc: 'Low padding for tight metric rows' },
    { shape: 'highlight', label: 'Glowing Amber Hero', desc: 'Accent border & hero glow' },
    { shape: 'bordered', label: 'Crisp Border', desc: 'High-contrast sharp outline' },
    { shape: 'minimal', label: 'Minimalist Ghost', desc: 'Borderless transparent flat style' }
  ];

  // Actions on active template
  const handleUpdateTemplateName = (name: string) => {
    saveTemplate({ ...activeTemplate, name });
  };

  const handleUpdateTemplateDesc = (description: string) => {
    saveTemplate({ ...activeTemplate, description });
  };

  const handleUpdateColumns = (columns: 1 | 2 | 3 | 4) => {
    saveTemplate({ ...activeTemplate, columns });
  };

  const handleFieldWidthChange = (fieldId: string, width: CardWidth) => {
    const updated = activeTemplate.fields.map(f =>
      f.id === fieldId ? { ...f, width } : f
    );
    saveTemplate({ ...activeTemplate, fields: updated });
  };

  const handleFieldShapeChange = (fieldId: string, shape: CardShape) => {
    const updated = activeTemplate.fields.map(f =>
      f.id === fieldId ? { ...f, shape } : f
    );
    saveTemplate({ ...activeTemplate, fields: updated });
  };

  const handleFieldLabelChange = (fieldId: string, label: string) => {
    const updated = activeTemplate.fields.map(f =>
      f.id === fieldId ? { ...f, label } : f
    );
    saveTemplate({ ...activeTemplate, fields: updated });
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeTemplate.fields.length) return;

    const newFields = [...activeTemplate.fields];
    const [moved] = newFields.splice(index, 1);
    newFields.splice(targetIndex, 0, moved);

    saveTemplate({ ...activeTemplate, fields: newFields });
  };

  const handleDeleteField = (fieldId: string) => {
    if (activeTemplate.fields.length <= 1) {
      alert('A template must have at least one card/field.');
      return;
    }
    const updated = activeTemplate.fields.filter(f => f.id !== fieldId);
    saveTemplate({ ...activeTemplate, fields: updated });
  };

  const handleAddField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldLabel.trim()) return;

    const newField: TemplateField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: newFieldLabel.trim(),
      description: newFieldDescription.trim(),
      type: newFieldType,
      width: newFieldWidth,
      shape: newFieldShape
    };

    saveTemplate({
      ...activeTemplate,
      fields: [...activeTemplate.fields, newField]
    });

    setNewFieldLabel('');
    setNewFieldDescription('');
    setShowAddField(false);
  };

  const handleCreateNewTemplate = () => {
    const newId = `tpl_custom_${Date.now()}`;
    const newTpl: Template = {
      id: newId,
      name: 'Custom Review Template',
      description: 'Fully personalized layout and metrics',
      category: 'custom',
      columns: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fields: [
        {
          id: 'field_1',
          label: 'Primary Objective',
          type: 'text',
          width: 'col-span-12',
          shape: 'highlight'
        },
        {
          id: 'field_2',
          label: 'Energy & Discipline Rating',
          type: 'rating_10',
          width: 'col-span-6',
          shape: 'standard'
        },
        {
          id: 'field_3',
          label: 'Course Correction Insights',
          type: 'textarea',
          width: 'col-span-6',
          shape: 'standard'
        }
      ]
    };

    saveTemplate(newTpl);
    setSelectedTemplateId(newId);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-amber-400">
            <Sliders className="w-4 h-4" />
            <span>Modular Template Architecture</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 mt-1">
            Template & Layout Customizer
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Modify card counts, reorder blocks, adjust widths (1/4 to Full), and customize shapes & fields.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleCreateNewTemplate}
            className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Template</span>
          </button>

          <button
            onClick={() => {
              if (confirm('Reset all templates to default factory layouts?')) {
                resetTemplatesToDefault();
              }
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs font-semibold transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {/* Template Switcher Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 border-b border-slate-800/80">
        {templates.map((tpl) => {
          const isSelected = tpl.id === activeTemplate.id;
          return (
            <button
              key={tpl.id}
              onClick={() => setSelectedTemplateId(tpl.id)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 ring-2 ring-amber-400'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <span>{tpl.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                isSelected ? 'bg-slate-900/40 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}>
                {tpl.fields.length} cards
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Template Meta Editor */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Template Title</label>
            <input
              type="text"
              value={activeTemplate.name}
              onChange={(e) => handleUpdateTemplateName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl p-3 text-sm text-slate-100 font-bold focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Description</label>
            <input
              type="text"
              value={activeTemplate.description}
              onChange={(e) => handleUpdateTemplateDesc(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl p-3 text-xs text-slate-300 focus:outline-none"
            />
          </div>
        </div>

        {/* Global Grid Columns Selection */}
        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Desktop Grid Base Columns
            </h4>
            <p className="text-[11px] text-slate-500">Sets the baseline layout division for cards</p>
          </div>

          <div className="flex items-center space-x-2">
            {[1, 2, 3, 4].map((col) => (
              <button
                key={col}
                onClick={() => handleUpdateColumns(col as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
                  activeTemplate.columns === col
                    ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                {col} Column{col > 1 ? 's' : ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cards & Fields List (Modular Drag / Reorder / Resizing) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Configured Cards & Modular Blocks ({activeTemplate.fields.length})
            </h2>
            <p className="text-xs text-slate-400">
              Customize the number, size, shape, and question of each modular card below.
            </p>
          </div>

          <button
            onClick={() => setShowAddField(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-md shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Card / Field</span>
          </button>
        </div>

        {/* Card Cards List */}
        <div className="space-y-4">
          {activeTemplate.fields.map((field, index) => {
            const isFirst = index === 0;
            const isLast = index === activeTemplate.fields.length - 1;

            return (
              <div
                key={field.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 sm:p-6 shadow-lg transition-all space-y-4"
              >
                {/* Top Row: Reorder, Title, Type, and Delete */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  
                  <div className="flex items-center space-x-3">
                    {/* Reorder Buttons */}
                    <div className="flex flex-col space-y-1">
                      <button
                        onClick={() => handleMoveField(index, 'up')}
                        disabled={isFirst}
                        className={`p-1 rounded-md bg-slate-950 text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:cursor-not-allowed`}
                        title="Move Up"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveField(index, 'down')}
                        disabled={isLast}
                        className={`p-1 rounded-md bg-slate-950 text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:cursor-not-allowed`}
                        title="Move Down"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Field Order & Editable Label */}
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                          #{index + 1}
                        </span>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => handleFieldLabelChange(field.id, e.target.value)}
                          className="bg-transparent font-bold text-slate-100 text-sm focus:outline-none focus:bg-slate-950 px-2 py-0.5 rounded"
                        />
                      </div>
                      <span className="text-[11px] text-slate-500 block pl-8">
                        Type: {fieldTypes.find(t => t.type === field.type)?.label || field.type}
                      </span>
                    </div>
                  </div>

                  {/* Actions (Delete) */}
                  <div className="flex items-center space-x-2 self-end sm:self-center">
                    <button
                      onClick={() => handleDeleteField(field.id)}
                      className="p-2 rounded-xl bg-slate-950 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 border border-slate-800 transition-colors"
                      title="Delete this block"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Bottom Row: Size & Shape Customizers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800/80">
                  
                  {/* Size Customizer */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                      <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Card Size / Grid Width:</span>
                    </label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {widths.map((w) => {
                        const isSelected = field.width === w.width;
                        return (
                          <button
                            key={w.width}
                            type="button"
                            onClick={() => handleFieldWidthChange(field.id, w.width)}
                            className={`py-2 px-1 rounded-xl text-[10px] font-bold text-center transition-all ${
                              isSelected
                                ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400 shadow-md shadow-amber-500/20'
                                : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                            }`}
                          >
                            {w.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Shape & Style Customizer */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                      <Palette className="w-3.5 h-3.5 text-amber-400" />
                      <span>Card Shape & Visual Style:</span>
                    </label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {shapes.map((s) => {
                        const isSelected = field.shape === s.shape;
                        return (
                          <button
                            key={s.shape}
                            type="button"
                            onClick={() => handleFieldShapeChange(field.id, s.shape)}
                            className={`py-2 px-1 rounded-xl text-[10px] font-bold text-center transition-all ${
                              isSelected
                                ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400 shadow-md shadow-amber-500/20'
                                : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                            }`}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* Add New Field Modal */}
      {showAddField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 sm:p-8 shadow-2xl space-y-6">
            
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
                <Plus className="w-5 h-5 text-amber-400" />
                <span>Add Modular Card to Template</span>
              </h3>
              <button
                onClick={() => setShowAddField(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddField} className="space-y-4">
              
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Card / Question Label</label>
                <input
                  type="text"
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  placeholder="e.g. Energy Level, Strategic Blocker, Weekly Reward Tier"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl p-3 text-sm text-slate-100 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Description / Subtitle</label>
                <input
                  type="text"
                  value={newFieldDescription}
                  onChange={(e) => setNewFieldDescription(e.target.value)}
                  placeholder="Help text explaining this card"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Card Metric Type</label>
                <select
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value as FieldType)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none cursor-pointer"
                >
                  {fieldTypes.map(t => (
                    <option key={t.type} value={t.type}>{t.label} — {t.desc}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Width / Size</label>
                  <select
                    value={newFieldWidth}
                    onChange={(e) => setNewFieldWidth(e.target.value as CardWidth)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none cursor-pointer"
                  >
                    {widths.map(w => (
                      <option key={w.width} value={w.width}>{w.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Shape & Style</label>
                  <select
                    value={newFieldShape}
                    onChange={(e) => setNewFieldShape(e.target.value as CardShape)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none cursor-pointer"
                  >
                    {shapes.map(s => (
                      <option key={s.shape} value={s.shape}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddField(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20"
                >
                  Create Card
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
