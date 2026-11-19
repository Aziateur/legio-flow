import React, { useState, useEffect } from 'react';
import { useStorage } from '../../context/StorageContext';
import {
  Template,
  TemplateField,
  TemplateCategory,
  CardWidth,
  CardShape,
  FieldType
} from '../../types/schema';
import { ModularCardGrid } from '../modular/ModularCardGrid';
import {
  Sliders,
  Plus,
  Trash2,
  Copy,
  RotateCcw,
  Eye,
  EyeOff,
  LayoutGrid,
  Maximize2,
  Palette,
  GripVertical,
  ArrowLeft,
  Monitor,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  ListOrdered,
  Target,
  CheckSquare,
  ListChecks,
  Gauge,
  Star,
  ToggleRight,
  Clock,
  Timer,
  AlignLeft,
  Type,
  Award,
  Sparkles,
  Settings2,
  Layers
} from 'lucide-react';

interface BlockPaletteItem {
  type: FieldType;
  label: string;
  shortLabel: string;
  desc: string;
  category: 'planning' | 'metrics' | 'reflection';
  defaultWidth: CardWidth;
  defaultShape: CardShape;
  defaultPlaceholder?: string;
  icon: React.FC<{ className?: string }>;
}

const BLOCK_PALETTE: BlockPaletteItem[] = [
  // Planning & Execution
  {
    type: 'numbered_list',
    label: 'Priority List (1, 2, 3)',
    shortLabel: 'Priorities',
    desc: 'Numbered daily priorities with checkboxes',
    category: 'planning',
    defaultWidth: 'col-span-12',
    defaultShape: 'standard',
    defaultPlaceholder: 'Enter priority...',
    icon: ListOrdered
  },
  {
    type: 'score_target',
    label: 'Tasks Ratio Counter',
    shortLabel: 'Tasks Ratio',
    desc: 'Completed vs target progress bar (e.g. 3/4)',
    category: 'planning',
    defaultWidth: 'col-span-6',
    defaultShape: 'compact',
    icon: Target
  },
  {
    type: 'checklist',
    label: 'Interactive Checklist',
    shortLabel: 'Checklist',
    desc: 'Checkable subtasks list inside a card',
    category: 'planning',
    defaultWidth: 'col-span-6',
    defaultShape: 'standard',
    icon: ListChecks
  },
  {
    type: 'task_points_table',
    label: 'Goal Crusher Table',
    shortLabel: 'Points Table',
    desc: 'Weighted goals summing to 10 points',
    category: 'planning',
    defaultWidth: 'col-span-12',
    defaultShape: 'standard',
    icon: CheckSquare
  },

  // Metrics & Tracking
  {
    type: 'rating_10',
    label: '1–10 Score Bar',
    shortLabel: '1–10 Rating',
    desc: 'Interactive 1 to 10 discipline/execution score',
    category: 'metrics',
    defaultWidth: 'col-span-6',
    defaultShape: 'compact',
    icon: Gauge
  },
  {
    type: 'rating_5',
    label: '1–5 Scorecard',
    shortLabel: '1–5 Card',
    desc: 'Focus, Execution & Output 1–5 ratings',
    category: 'metrics',
    defaultWidth: 'col-span-6',
    defaultShape: 'highlight',
    icon: Star
  },
  {
    type: 'checkbox',
    label: 'Yes / No Toggle',
    shortLabel: 'Yes/No',
    desc: 'Binary habit or routine completion switch',
    category: 'metrics',
    defaultWidth: 'col-span-6',
    defaultShape: 'compact',
    icon: ToggleRight
  },
  {
    type: 'duration',
    label: 'Time: Planned vs Actual',
    shortLabel: 'Duration',
    desc: 'Minutes planned vs actual duration tracker',
    category: 'metrics',
    defaultWidth: 'col-span-6',
    defaultShape: 'standard',
    icon: Clock
  },
  {
    type: 'gws_session_link',
    label: 'Linked GWS Sprints',
    shortLabel: 'GWS Links',
    desc: 'Displays deep-work sprints logged today',
    category: 'metrics',
    defaultWidth: 'col-span-6',
    defaultShape: 'compact',
    icon: Timer
  },

  // Reflection & Rewards
  {
    type: 'textarea',
    label: 'Reflexion / Notes Box',
    shortLabel: 'Notes Box',
    desc: 'Multi-line prompt for notes, wins or blockers',
    category: 'reflection',
    defaultWidth: 'col-span-12',
    defaultShape: 'standard',
    defaultPlaceholder: 'Write your thoughts here...',
    icon: AlignLeft
  },
  {
    type: 'text',
    label: 'Short Headline / Input',
    shortLabel: 'Short Text',
    desc: 'Single-line focus theme or title input',
    category: 'reflection',
    defaultWidth: 'col-span-12',
    defaultShape: 'compact',
    defaultPlaceholder: 'Short headline...',
    icon: Type
  },
  {
    type: 'reward_ladder',
    label: 'Reward Ladder Tiers',
    shortLabel: 'Rewards',
    desc: 'Score-unlocked reward tiers (6+, 8+, 10)',
    category: 'reflection',
    defaultWidth: 'col-span-6',
    defaultShape: 'standard',
    icon: Award
  }
];

const WIDTH_OPTIONS: { width: CardWidth; label: string; short: string; spans: number }[] = [
  { width: 'col-span-3', label: 'Quarter', short: '1/4', spans: 3 },
  { width: 'col-span-4', label: 'One-Third', short: '1/3', spans: 4 },
  { width: 'col-span-6', label: 'Half', short: '1/2', spans: 6 },
  { width: 'col-span-8', label: 'Two-Thirds', short: '2/3', spans: 8 },
  { width: 'col-span-12', label: 'Full Width', short: 'Full', spans: 12 }
];

const SHAPE_OPTIONS: {
  shape: CardShape;
  label: string;
  desc: string;
  previewClass: string;
  canvasClass: string;
}[] = [
  {
    shape: 'standard',
    label: 'Standard',
    desc: 'Clean dark card',
    previewClass: 'bg-slate-900 border border-slate-700',
    canvasClass: 'bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-lg'
  },
  {
    shape: 'compact',
    label: 'Compact',
    desc: 'Tight dense padding',
    previewClass: 'bg-slate-900 border border-slate-800',
    canvasClass: 'bg-slate-900/80 border border-slate-800 p-3 rounded-xl'
  },
  {
    shape: 'highlight',
    label: 'Amber Hero',
    desc: 'Glowing gold accent',
    previewClass: 'bg-gradient-to-br from-slate-900 to-amber-950/50 border-2 border-amber-500/60',
    canvasClass:
      'bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/25 border-2 border-amber-500/40 p-4 rounded-2xl shadow-lg shadow-amber-500/10'
  },
  {
    shape: 'bordered',
    label: 'Crisp Frame',
    desc: 'Sharp thick outline',
    previewClass: 'bg-slate-950 border-2 border-slate-500',
    canvasClass: 'bg-slate-950 border-2 border-slate-700 p-4 rounded-2xl'
  },
  {
    shape: 'minimal',
    label: 'Ghost',
    desc: 'Subtle flat outline',
    previewClass: 'bg-transparent border border-dashed border-slate-700',
    canvasClass: 'bg-slate-950/30 border border-slate-800/70 p-3.5 rounded-xl'
  }
];

const getCanvasSpanClass = (width: CardWidth): string => {
  switch (width) {
    case 'col-span-3':
      return 'col-span-12 sm:col-span-6 lg:col-span-3';
    case 'col-span-4':
      return 'col-span-12 sm:col-span-6 lg:col-span-4';
    case 'col-span-6':
      return 'col-span-12 lg:col-span-6';
    case 'col-span-8':
      return 'col-span-12 lg:col-span-8';
    case 'col-span-12':
    default:
      return 'col-span-12';
  }
};

const getCanvasShapeClass = (shape: CardShape): string => {
  return SHAPE_OPTIONS.find(s => s.shape === shape)?.canvasClass || SHAPE_OPTIONS[0].canvasClass;
};

const buildSamplePreviewValues = (template: Template): Record<string, any> => {
  const vals: Record<string, any> = {};
  template.fields.forEach(f => {
    switch (f.type) {
      case 'numbered_list':
        vals[f.id] = [
          { id: 'p1', text: 'Ship core deliverable', completed: true },
          { id: 'p2', text: 'Complete 2 deep work sprints', completed: false },
          { id: 'p3', text: 'Review metrics & course-correct', completed: false }
        ];
        break;
      case 'score_target':
        vals[f.id] = { completed: 2, total: 3 };
        break;
      case 'rating_10':
        vals[f.id] = 8;
        break;
      case 'rating_5':
        vals[f.id] = { focus: 4, execution: 5, output: 4, total: 13 };
        break;
      case 'checkbox':
        vals[f.id] = true;
        break;
      case 'duration':
        vals[f.id] = { planned: 60, actual: 55 };
        break;
      case 'gws_session_link':
        vals[f.id] = [
          {
            id: 'demo_gws_1',
            taskName: 'Deep Work Sprint',
            actualMinutes: 55,
            ratings: { focus: 4, execution: 5, output: 4, total: 13 }
          }
        ];
        break;
      case 'checklist':
        vals[f.id] = [
          { id: 'c1', text: 'Morning setup complete', completed: true },
          { id: 'c2', text: 'Zero distractions block', completed: false }
        ];
        break;
      case 'task_points_table':
        vals[f.id] = [
          { id: 't1', text: 'Launch milestone #1', score: 4, completed: true },
          { id: 't2', text: 'Close weekly review', score: 3, completed: false },
          { id: 't3', text: 'Ship documentation', score: 3, completed: false }
        ];
        break;
      case 'reward_ladder':
        vals[f.id] = [
          { id: 'r1', minScore: 7, reward: 'Guilt-free movie night' },
          { id: 'r2', minScore: 9, reward: 'Steak dinner celebration' }
        ];
        break;
      case 'text':
        vals[f.id] = 'High-leverage execution sprint';
        break;
      case 'textarea':
      default:
        vals[f.id] = 'Preview sample note — type here to test this card live.';
        break;
    }
  });
  return vals;
};

/** Compact visual wireframe shown inside each card on the visual canvas */
const CardVisualMiniPreview: React.FC<{ field: TemplateField }> = ({ field }) => {
  switch (field.type) {
    case 'numbered_list':
      return (
        <div className="space-y-1.5 mt-2 pointer-events-none select-none">
          {[1, 2, 3].map(n => (
            <div
              key={n}
              className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800/80"
            >
              <span className="w-4 h-4 rounded bg-amber-500/20 text-amber-400 text-[9px] font-mono font-bold flex items-center justify-center">
                {n}
              </span>
              <span className="text-[11px] text-slate-500 truncate">
                {field.placeholder || `Priority #${n}...`}
              </span>
            </div>
          ))}
        </div>
      );
    case 'score_target':
      return (
        <div className="space-y-1.5 mt-2 pointer-events-none select-none">
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-slate-400">67% Fulfilled</span>
            <span className="text-amber-400 font-bold">2 / 3</span>
          </div>
          <div className="h-2 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
            <div className="h-full w-2/3 bg-amber-500 rounded-full" />
          </div>
        </div>
      );
    case 'rating_10':
      return (
        <div className="grid grid-cols-10 gap-1 mt-2 pointer-events-none select-none">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <div
              key={n}
              className={`py-1 rounded text-center text-[9px] font-mono font-bold ${
                n === 8
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-950 text-slate-500 border border-slate-800'
              }`}
            >
              {n}
            </div>
          ))}
        </div>
      );
    case 'rating_5':
      return (
        <div className="space-y-1 mt-2 pointer-events-none select-none text-[10px] font-mono">
          {['Focus', 'Execution', 'Output'].map(k => (
            <div key={k} className="flex items-center justify-between">
              <span className="text-slate-500">{k}</span>
              <div className="flex space-x-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <span
                    key={n}
                    className={`w-4 h-4 rounded flex items-center justify-center text-[9px] ${
                      n === 4 ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-950 text-slate-600'
                    }`}
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    case 'checkbox':
      return (
        <div className="mt-2 flex items-center justify-between pointer-events-none select-none">
          <span className="text-[10px] text-slate-500">Status</span>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
            Yes (Locked In)
          </span>
        </div>
      );
    case 'duration':
      return (
        <div className="grid grid-cols-2 gap-2 mt-2 pointer-events-none select-none text-[10px] font-mono">
          <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-slate-500 block">Planned</span>
            <span className="text-slate-200 font-bold">50 min</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-slate-500 block">Actual</span>
            <span className="text-amber-400 font-bold">55 min</span>
          </div>
        </div>
      );
    case 'gws_session_link':
      return (
        <div className="mt-2 p-2 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-[10px] font-mono pointer-events-none select-none">
          <span className="text-amber-400 font-bold">⏱ 2 GWS (110m)</span>
          <span className="text-slate-500">Auto-linked</span>
        </div>
      );
    case 'checklist':
      return (
        <div className="space-y-1 mt-2 text-[10px] text-slate-400 pointer-events-none select-none">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500/30 border border-emerald-400" />
            <span className="line-through text-slate-500">Completed item</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full border border-slate-600" />
            <span>Pending subtask</span>
          </div>
        </div>
      );
    case 'task_points_table':
      return (
        <div className="space-y-1 mt-2 text-[10px] font-mono pointer-events-none select-none">
          <div className="flex justify-between px-2 py-1 rounded bg-slate-950 border border-slate-800">
            <span className="text-slate-300">Deliverable A</span>
            <span className="text-amber-400 font-bold">4 pts</span>
          </div>
          <div className="flex justify-between px-2 py-1 rounded bg-slate-950 border border-slate-800">
            <span className="text-slate-300">Deliverable B</span>
            <span className="text-amber-400 font-bold">3 pts</span>
          </div>
        </div>
      );
    case 'reward_ladder':
      return (
        <div className="flex flex-wrap gap-1.5 mt-2 text-[10px] font-mono pointer-events-none select-none">
          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
            7+ Pts: Tier 1
          </span>
          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            9+ Pts: Tier 2
          </span>
        </div>
      );
    case 'text':
      return (
        <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] text-slate-500 pointer-events-none select-none">
          {field.placeholder || 'Short text line...'}
        </div>
      );
    case 'textarea':
    default:
      return (
        <div className="mt-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-500 h-14 overflow-hidden pointer-events-none select-none">
          {field.placeholder || 'Multi-line notes & reflexions...'}
        </div>
      );
  }
};

export const TemplateManager: React.FC = () => {
  const {
    templates,
    saveTemplate,
    deleteTemplate,
    resetTemplatesToDefault,
    setActiveTab,
    setPlanningSubTab
  } = useStorage();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    templates[0]?.id || 'tpl_daily_default'
  );
  const activeTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];

  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(
    activeTemplate?.fields[0]?.id || null
  );
  const [studioMode, setStudioMode] = useState<'builder' | 'preview'>('builder');
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [inspectorTab, setInspectorTab] = useState<'card' | 'template'>('card');
  const [previewValues, setPreviewValues] = useState<Record<string, any>>({});

  // Drag-and-drop state (either reordering existing field by ID OR dragging a new block type from palette)
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);
  const [draggedPaletteType, setDraggedPaletteType] = useState<FieldType | null>(null);
  const [dragOverFieldId, setDragOverFieldId] = useState<string | null>(null);
  const [dragOverCanvasEnd, setDragOverCanvasEnd] = useState(false);

  // Sync selectedFieldId & preview sample values when switching templates
  useEffect(() => {
    if (!activeTemplate) return;
    if (!activeTemplate.fields.some(f => f.id === selectedFieldId)) {
      setSelectedFieldId(activeTemplate.fields[0]?.id || null);
    }
    setPreviewValues(buildSamplePreviewValues(activeTemplate));
  }, [activeTemplate?.id]);

  if (!activeTemplate) return null;

  const selectedField =
    activeTemplate.fields.find(f => f.id === selectedFieldId) || activeTemplate.fields[0] || null;

  // --- Template-level mutations ---
  const updateTemplate = (patch: Partial<Template>) => {
    saveTemplate({
      ...activeTemplate,
      ...patch,
      updatedAt: new Date().toISOString()
    });
  };

  const updateField = (fieldId: string, patch: Partial<TemplateField>) => {
    const updated = activeTemplate.fields.map(f =>
      f.id === fieldId ? { ...f, ...patch } : f
    );
    updateTemplate({ fields: updated });
  };

  const stepFieldWidth = (fieldId: string, delta: -1 | 1) => {
    const field = activeTemplate.fields.find(f => f.id === fieldId);
    if (!field) return;
    const idx = WIDTH_OPTIONS.findIndex(w => w.width === field.width);
    const curIdx = idx === -1 ? WIDTH_OPTIONS.length - 1 : idx;
    const nextIdx = Math.max(0, Math.min(WIDTH_OPTIONS.length - 1, curIdx + delta));
    updateField(fieldId, { width: WIDTH_OPTIONS[nextIdx].width });
  };

  const moveFieldByOffset = (fieldId: string, delta: -1 | 1) => {
    const idx = activeTemplate.fields.findIndex(f => f.id === fieldId);
    if (idx === -1) return;
    const target = idx + delta;
    if (target < 0 || target >= activeTemplate.fields.length) return;
    const next = [...activeTemplate.fields];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    updateTemplate({ fields: next });
  };

  const reorderFields = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const fromIdx = activeTemplate.fields.findIndex(f => f.id === sourceId);
    const toIdx = activeTemplate.fields.findIndex(f => f.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...activeTemplate.fields];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    updateTemplate({ fields: next });
  };

  const addBlockFromPalette = (type: FieldType, insertBeforeFieldId?: string) => {
    const def = BLOCK_PALETTE.find(b => b.type === type);
    if (!def) return;
    const newField: TemplateField = {
      id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: def.label,
      description: def.desc,
      type: def.type,
      width: def.defaultWidth,
      shape: def.defaultShape,
      ...(def.defaultPlaceholder ? { placeholder: def.defaultPlaceholder } : {})
    };

    const next = [...activeTemplate.fields];
    if (insertBeforeFieldId) {
      const idx = next.findIndex(f => f.id === insertBeforeFieldId);
      if (idx !== -1) next.splice(idx, 0, newField);
      else next.push(newField);
    } else {
      next.push(newField);
    }

    updateTemplate({ fields: next });
    setSelectedFieldId(newField.id);
    setInspectorTab('card');
  };

  const duplicateField = (fieldId: string) => {
    const idx = activeTemplate.fields.findIndex(f => f.id === fieldId);
    if (idx === -1) return;
    const orig = activeTemplate.fields[idx];
    const copy: TemplateField = {
      ...orig,
      id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: `${orig.label} (Copy)`
    };
    const next = [...activeTemplate.fields];
    next.splice(idx + 1, 0, copy);
    updateTemplate({ fields: next });
    setSelectedFieldId(copy.id);
    setInspectorTab('card');
  };

  const handleDeleteField = (fieldId: string) => {
    if (activeTemplate.fields.length <= 1) {
      alert('A template must keep at least 1 block.');
      return;
    }
    const next = activeTemplate.fields.filter(f => f.id !== fieldId);
    updateTemplate({ fields: next });
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(next[0]?.id || null);
    }
  };

  // --- One-Click Layout Presets ---
  const applyLayoutPreset = (preset: 'hero_split' | 'two_col' | 'three_col' | 'single_stack') => {
    const nextFields = activeTemplate.fields.map((f, idx) => {
      if (preset === 'hero_split') {
        return { ...f, width: (idx === 0 ? 'col-span-12' : 'col-span-6') as CardWidth };
      }
      if (preset === 'two_col') {
        return { ...f, width: 'col-span-6' as CardWidth };
      }
      if (preset === 'three_col') {
        return { ...f, width: 'col-span-4' as CardWidth };
      }
      return { ...f, width: 'col-span-12' as CardWidth };
    });
    const cols: 1 | 2 | 3 =
      preset === 'three_col' ? 3 : preset === 'single_stack' ? 1 : 2;
    updateTemplate({ fields: nextFields, columns: cols });
  };

  const handleCreateNewTemplate = () => {
    const newId = `tpl_custom_${Date.now()}`;
    const newTpl: Template = {
      id: newId,
      name: 'Custom Modular Layout',
      description: 'Drag, resize, and customize cards visually',
      category: 'custom',
      columns: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fields: [
        {
          id: `field_${Date.now()}_1`,
          label: 'Primary Focus',
          description: 'Single highest-leverage outcome',
          type: 'text',
          width: 'col-span-12',
          shape: 'highlight',
          placeholder: 'What wins the day?'
        },
        {
          id: `field_${Date.now()}_2`,
          label: 'Execution Score',
          description: 'Rate overall discipline out of 10',
          type: 'rating_10',
          width: 'col-span-6',
          shape: 'compact'
        },
        {
          id: `field_${Date.now()}_3`,
          label: 'Key Notes & Adjustments',
          description: 'Course correction for next cycle',
          type: 'textarea',
          width: 'col-span-6',
          shape: 'standard'
        }
      ]
    };
    saveTemplate(newTpl);
    setSelectedTemplateId(newId);
    setSelectedFieldId(newTpl.fields[0].id);
    setStudioMode('builder');
  };

  const handleDuplicateTemplate = () => {
    const newId = `tpl_copy_${Date.now()}`;
    const clone: Template = {
      ...activeTemplate,
      id: newId,
      name: `${activeTemplate.name} (Copy)`,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fields: activeTemplate.fields.map((f, i) => ({
        ...f,
        id: `${f.id}_copy_${i}_${Date.now().toString(36).slice(-3)}`
      }))
    };
    saveTemplate(clone);
    setSelectedTemplateId(newId);
    setSelectedFieldId(clone.fields[0]?.id || null);
  };

  const handleDeleteTemplate = () => {
    if (activeTemplate.isDefault) {
      alert('Default system templates cannot be deleted (you can edit or reset them anytime).');
      return;
    }
    if (!confirm(`Delete template "${activeTemplate.name}"?`)) return;
    const fallback = templates.find(t => t.id !== activeTemplate.id);
    deleteTemplate(activeTemplate.id);
    if (fallback) {
      setSelectedTemplateId(fallback.id);
      setSelectedFieldId(fallback.fields[0]?.id || null);
    }
  };

  const clearDragState = () => {
    setDraggedFieldId(null);
    setDraggedPaletteType(null);
    setDragOverFieldId(null);
    setDragOverCanvasEnd(false);
  };

  const visibleCount = activeTemplate.fields.filter(f => !f.hidden).length;

  return (
    <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* Top Studio Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                  Visual Modular Studio • Admin Only
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[10px] font-mono font-bold">
                  Auto-Saved Live
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-100 mt-0.5">
                Template & Bento Layout Builder
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Drag blocks to reorder, resize cards directly on the 12-column grid, toggle visibility, or test live.
              </p>
            </div>
          </div>

          {/* Right Studio Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPlanningSubTab('daily');
                setActiveTab('planning');
              }}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-bold transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Daily Plan</span>
            </button>

            {/* Builder vs Live Preview Switcher */}
            <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setStudioMode('builder')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  studioMode === 'builder'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Visual Builder</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewValues(buildSamplePreviewValues(activeTemplate));
                  setStudioMode('preview');
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  studioMode === 'preview'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Live Preview</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleCreateNewTemplate}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>New Template</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (confirm('Reset all templates back to factory default layouts?')) {
                  resetTemplatesToDefault();
                }
              }}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-800 text-xs font-bold transition-colors"
              title="Reset all templates to defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Template Tabs + 1-Click Layout Presets */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pt-4 border-t border-slate-800/80">
          <div className="flex items-center space-x-2 overflow-x-auto pb-1">
            {templates.map(tpl => {
              const isSelected = tpl.id === activeTemplate.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(tpl.id)}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <span className={`text-[9px] uppercase font-mono font-extrabold px-1.5 py-0.5 rounded ${
                    isSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-900 text-amber-400'
                  }`}>
                    {tpl.category}
                  </span>
                  <span>{tpl.name}</span>
                  <span className={`text-[10px] font-mono ${
                    isSelected ? 'text-slate-900' : 'text-slate-500'
                  }`}>
                    ({tpl.fields.filter(f => !f.hidden).length})
                  </span>
                </button>
              );
            })}
          </div>

          {/* 1-Click Layout Presets */}
          {studioMode === 'builder' ? (
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center space-x-1 mr-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Quick Layout:</span>
              </span>
              {[
                { id: 'hero_split' as const, label: 'Hero + Split' },
                { id: 'two_col' as const, label: '2-Col Grid' },
                { id: 'three_col' as const, label: '3-Col Cockpit' },
                { id: 'single_stack' as const, label: 'Single Stack' }
              ].map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyLayoutPreset(preset.id)}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 text-[11px] font-bold transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center space-x-1 p-1 rounded-xl bg-slate-950 border border-slate-800 self-start">
              <button
                type="button"
                onClick={() => setPreviewViewport('desktop')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-bold ${
                  previewViewport === 'desktop'
                    ? 'bg-slate-800 text-amber-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Desktop</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewViewport('mobile')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-bold ${
                  previewViewport === 'mobile'
                    ? 'bg-slate-800 text-amber-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* LIVE INTERACTIVE PREVIEW MODE                                         */}
      {/* ===================================================================== */}
      {studioMode === 'preview' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2 text-xs text-slate-400">
            <span>
              Interactive Sandbox for <strong className="text-slate-100">{activeTemplate.name}</strong> ({visibleCount} visible card{visibleCount === 1 ? '' : 's'}) — click & type below to test your layout.
            </span>
            <button
              type="button"
              onClick={() => setStudioMode('builder')}
              className="text-amber-400 hover:text-amber-300 font-bold"
            >
              ← Return to Visual Builder
            </button>
          </div>

          <div
            className={`mx-auto transition-all duration-300 ${
              previewViewport === 'mobile'
                ? 'max-w-[400px] p-4 rounded-[2.2rem] bg-slate-900/60 border-4 border-slate-800 shadow-2xl'
                : 'w-full'
            }`}
          >
            <ModularCardGrid
              template={activeTemplate}
              values={previewValues}
              onChange={(fid, val) => setPreviewValues(prev => ({ ...prev, [fid]: val }))}
            />
          </div>
        </div>
      ) : (
        /* ===================================================================== */
        /* 3-ZONE VISUAL BUILDER (PALETTE | 12-COL BENTO CANVAS | INSPECTOR)     */
        /* ===================================================================== */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

          {/* ZONE 1 (LEFT): MODULAR BLOCK PALETTE */}
          <aside className="xl:col-span-3 bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-4 xl:sticky xl:top-20">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-100">
                  Block Library
                </h2>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Click or Drag</span>
            </div>

            {(
              [
                { key: 'planning' as const, title: 'Planning & Tasks' },
                { key: 'metrics' as const, title: 'Metrics & Tracking' },
                { key: 'reflection' as const, title: 'Notes & Rewards' }
              ]
            ).map(group => (
              <div key={group.key} className="space-y-1.5">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 px-1">
                  {group.title}
                </div>
                <div className="grid grid-cols-2 xl:grid-cols-1 gap-1.5">
                  {BLOCK_PALETTE.filter(b => b.category === group.key).map(block => {
                    const Icon = block.icon;
                    return (
                      <button
                        key={block.type}
                        type="button"
                        draggable
                        onDragStart={e => {
                          setDraggedPaletteType(block.type);
                          setDraggedFieldId(null);
                          e.dataTransfer.effectAllowed = 'copy';
                          e.dataTransfer.setData('text/plain', `palette:${block.type}`);
                        }}
                        onDragEnd={clearDragState}
                        onClick={() => addBlockFromPalette(block.type)}
                        className="group w-full flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/40 text-left transition-all cursor-grab active:cursor-grabbing"
                        title={`Click or drag to add "${block.label}"`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div className="p-1.5 rounded-lg bg-slate-900 group-hover:bg-amber-500/15 text-slate-400 group-hover:text-amber-400 transition-colors shrink-0">
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-200 truncate">
                              {block.shortLabel}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {block.desc}
                            </div>
                          </div>
                        </div>
                        <Plus className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </aside>

          {/* ZONE 2 (CENTER): INTERACTIVE 12-COLUMN BENTO CANVAS */}
          <section className="xl:col-span-6 space-y-4">
            <div className="flex items-center justify-between px-1">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                  Interactive 12-Column Grid Canvas
                </span>
                <div className="text-xs text-slate-400">
                  Showing <strong className="text-slate-200">{activeTemplate.name}</strong> • Click a card to edit, drag handle to reorder, or use <code className="text-amber-300">- / +</code> to resize.
                </div>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                {visibleCount}/{activeTemplate.fields.length} visible
              </span>
            </div>

            <div className="p-4 sm:p-5 rounded-3xl bg-slate-950/70 border border-slate-800/90 shadow-inner min-h-[420px]">
              <div className="grid grid-cols-12 gap-4 items-stretch">
                {activeTemplate.fields.map((field, index) => {
                  const isSelected = selectedField?.id === field.id;
                  const isDragOver = dragOverFieldId === field.id;
                  const isDragging = draggedFieldId === field.id;
                  const widthMeta =
                    WIDTH_OPTIONS.find(w => w.width === field.width) || WIDTH_OPTIONS[4];
                  const paletteMeta = BLOCK_PALETTE.find(b => b.type === field.type);

                  return (
                    <div
                      key={field.id}
                      draggable
                      onDragStart={e => {
                        setDraggedFieldId(field.id);
                        setDraggedPaletteType(null);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', `field:${field.id}`);
                      }}
                      onDragOver={e => {
                        e.preventDefault();
                        if (dragOverFieldId !== field.id) setDragOverFieldId(field.id);
                      }}
                      onDragLeave={() => {
                        if (dragOverFieldId === field.id) setDragOverFieldId(null);
                      }}
                      onDrop={e => {
                        e.preventDefault();
                        if (draggedPaletteType) {
                          addBlockFromPalette(draggedPaletteType, field.id);
                        } else if (draggedFieldId && draggedFieldId !== field.id) {
                          reorderFields(draggedFieldId, field.id);
                        }
                        clearDragState();
                      }}
                      onDragEnd={clearDragState}
                      onClick={() => {
                        setSelectedFieldId(field.id);
                        setInspectorTab('card');
                      }}
                      className={`${getCanvasSpanClass(field.width)} ${getCanvasShapeClass(
                        field.shape
                      )} relative cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-500/15'
                          : 'hover:ring-1 hover:ring-slate-600'
                      } ${isDragOver ? 'ring-2 ring-emerald-400 scale-[1.01]' : ''} ${
                        isDragging ? 'opacity-40' : ''
                      } ${field.hidden ? 'opacity-45 border-dashed' : ''}`}
                    >
                      {/* Inline Quick-Toolbar */}
                      <div className="flex items-center justify-between gap-1.5 mb-2 pb-2 border-b border-slate-800/70">
                        <div className="flex items-center space-x-1.5 min-w-0">
                          <span
                            className="p-1 rounded-md bg-slate-950/80 text-slate-500 hover:text-amber-400 cursor-grab active:cursor-grabbing shrink-0"
                            title="Drag to reorder"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-950 text-amber-400 border border-slate-800 shrink-0">
                            {paletteMeta?.shortLabel || field.type}
                          </span>
                          {field.hidden && (
                            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                              Hidden
                            </span>
                          )}
                        </div>

                        {/* Quick Inline Resize + Visibility + Move + Duplicate + Delete */}
                        <div
                          className="flex items-center space-x-1 shrink-0"
                          onClick={e => e.stopPropagation()}
                        >
                          {/* Width Stepper */}
                          <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => stepFieldWidth(field.id, -1)}
                              disabled={field.width === 'col-span-3'}
                              className="px-1.5 py-0.5 text-[10px] font-bold text-slate-400 hover:text-amber-300 hover:bg-slate-800 disabled:opacity-30"
                              title="Make narrower"
                            >
                              −
                            </button>
                            <span className="px-1.5 text-[10px] font-mono font-bold text-slate-300">
                              {widthMeta.short}
                            </span>
                            <button
                              type="button"
                              onClick={() => stepFieldWidth(field.id, 1)}
                              disabled={field.width === 'col-span-12'}
                              className="px-1.5 py-0.5 text-[10px] font-bold text-slate-400 hover:text-amber-300 hover:bg-slate-800 disabled:opacity-30"
                              title="Make wider"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => moveFieldByOffset(field.id, -1)}
                            disabled={index === 0}
                            className="p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-25"
                            title="Move earlier"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveFieldByOffset(field.id, 1)}
                            disabled={index === activeTemplate.fields.length - 1}
                            className="p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-25"
                            title="Move later"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => updateField(field.id, { hidden: !field.hidden })}
                            className={`p-1 rounded-md transition-colors ${
                              field.hidden
                                ? 'text-amber-400 bg-amber-500/10'
                                : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
                            }`}
                            title={field.hidden ? 'Show card in app' : 'Hide card in app'}
                          >
                            {field.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateField(field.id)}
                            className="p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800"
                            title="Duplicate card"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteField(field.id)}
                            className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                            title="Delete card"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Card Title + Description */}
                      <div>
                        <div className="text-xs font-extrabold uppercase tracking-wide text-slate-100 truncate">
                          {field.label || 'Untitled Block'}
                        </div>
                        {field.description && (
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {field.description}
                          </div>
                        )}
                      </div>

                      {/* Visual Mini Preview */}
                      <CardVisualMiniPreview field={field} />
                    </div>
                  );
                })}

                {/* Drop Zone at End of Canvas */}
                <div
                  onDragOver={e => {
                    e.preventDefault();
                    setDragOverCanvasEnd(true);
                  }}
                  onDragLeave={() => setDragOverCanvasEnd(false)}
                  onDrop={e => {
                    e.preventDefault();
                    if (draggedPaletteType) {
                      addBlockFromPalette(draggedPaletteType);
                    } else if (draggedFieldId) {
                      const next = activeTemplate.fields.filter(f => f.id !== draggedFieldId);
                      const moved = activeTemplate.fields.find(f => f.id === draggedFieldId);
                      if (moved) updateTemplate({ fields: [...next, moved] });
                    }
                    clearDragState();
                  }}
                  className={`col-span-12 rounded-2xl border-2 border-dashed p-4 text-center transition-all ${
                    dragOverCanvasEnd
                      ? 'border-amber-400 bg-amber-500/10 text-amber-300'
                      : 'border-slate-800 bg-slate-900/30 text-slate-500'
                  }`}
                >
                  <span className="text-xs font-bold">
                    {draggedPaletteType || draggedFieldId
                      ? 'Drop here to place at the bottom of the grid'
                      : 'Drag any block from the left library onto the grid — or click a block to append it'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ZONE 3 (RIGHT): CONTEXT-AWARE INSPECTOR */}
          <aside className="xl:col-span-3 bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4 xl:sticky xl:top-20">
            {/* Inspector Mode Switcher */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setInspectorTab('card')}
                className={`py-1.5 rounded-xl text-xs font-bold transition-all ${
                  inspectorTab === 'card'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Selected Card
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('template')}
                className={`flex items-center justify-center space-x-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  inspectorTab === 'template'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Template</span>
              </button>
            </div>

            {inspectorTab === 'card' && selectedField ? (
              <div className="space-y-4">
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Card Title
                  </label>
                  <input
                    type="text"
                    value={selectedField.label}
                    onChange={e => updateField(selectedField.id, { label: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs font-bold text-slate-100 focus:outline-none"
                  />
                </div>

                {/* Subtitle / Description */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Subtitle / Helper Text
                  </label>
                  <input
                    type="text"
                    value={selectedField.description || ''}
                    onChange={e => updateField(selectedField.id, { description: e.target.value })}
                    placeholder="Short helper text under title..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>

                {/* Placeholder (for text-based blocks) */}
                {(selectedField.type === 'text' ||
                  selectedField.type === 'textarea' ||
                  selectedField.type === 'numbered_list') && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Input Placeholder
                    </label>
                    <input
                      type="text"
                      value={selectedField.placeholder || ''}
                      onChange={e => updateField(selectedField.id, { placeholder: e.target.value })}
                      placeholder="Placeholder hint..."
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
                    />
                  </div>
                )}

                {/* Block Type */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Widget / Metric Type
                  </label>
                  <select
                    value={selectedField.type}
                    onChange={e => updateField(selectedField.id, { type: e.target.value as FieldType })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer"
                  >
                    {BLOCK_PALETTE.map(b => (
                      <option key={b.type} value={b.type}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Visual Grid Width Bars */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                    <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Card Width (12-Col Grid)</span>
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {WIDTH_OPTIONS.map(w => {
                      const active = selectedField.width === w.width;
                      return (
                        <button
                          key={w.width}
                          type="button"
                          onClick={() => updateField(selectedField.id, { width: w.width })}
                          className={`p-2 rounded-xl border text-center space-y-1.5 transition-all ${
                            active
                              ? 'bg-amber-500/15 border-amber-400 text-amber-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                          title={`${w.label} (${w.spans}/12 columns)`}
                        >
                          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${active ? 'bg-amber-400' : 'bg-slate-500'}`}
                              style={{ width: `${(w.spans / 12) * 100}%` }}
                            />
                          </div>
                          <div className="text-[10px] font-mono font-bold">{w.short}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Visual Card Style Swatches */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                    <Palette className="w-3.5 h-3.5 text-amber-400" />
                    <span>Visual Style & Frame</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {SHAPE_OPTIONS.map(s => {
                      const active = selectedField.shape === s.shape;
                      return (
                        <button
                          key={s.shape}
                          type="button"
                          onClick={() => updateField(selectedField.id, { shape: s.shape })}
                          className={`p-2.5 rounded-xl border text-left space-y-1.5 transition-all ${
                            active
                              ? 'bg-amber-500/10 border-amber-400'
                              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className={`h-5 w-full rounded-md ${s.previewClass}`} />
                          <div>
                            <div
                              className={`text-[11px] font-bold ${
                                active ? 'text-amber-300' : 'text-slate-200'
                              }`}
                            >
                              {s.label}
                            </div>
                            <div className="text-[9px] text-slate-500">{s.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Visibility & Quick Actions */}
                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <button
                    type="button"
                    onClick={() => updateField(selectedField.id, { hidden: !selectedField.hidden })}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
                      selectedField.hidden
                        ? 'bg-slate-950 border-slate-800 text-slate-400'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    }`}
                  >
                    <span>{selectedField.hidden ? 'Hidden in Live App' : 'Visible in Live App'}</span>
                    {selectedField.hidden ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => duplicateField(selectedField.id)}
                      className="flex items-center justify-center space-x-1.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-bold"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Duplicate</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteField(selectedField.id)}
                      className="flex items-center justify-center space-x-1.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* TEMPLATE METADATA SETTINGS */
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={activeTemplate.name}
                    onChange={e => updateTemplate({ name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs font-bold text-slate-100 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={activeTemplate.description}
                    onChange={e => updateTemplate({ description: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Applies To Category
                  </label>
                  <select
                    value={activeTemplate.category}
                    onChange={e =>
                      updateTemplate({ category: e.target.value as TemplateCategory })
                    }
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="daily">Daily Plan</option>
                    <option value="review">Daily Review</option>
                    <option value="gws">GWS Sprint</option>
                    <option value="weekly">Weekly Plan</option>
                    <option value="custom">Custom Template</option>
                  </select>
                </div>

                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <button
                    type="button"
                    onClick={handleDuplicateTemplate}
                    className="w-full flex items-center justify-center space-x-1.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-bold"
                  >
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                    <span>Duplicate Template</span>
                  </button>

                  {!activeTemplate.isDefault && (
                    <button
                      type="button"
                      onClick={handleDeleteTemplate}
                      className="w-full flex items-center justify-center space-x-1.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Custom Template</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </aside>

        </div>
      )}

    </div>
  );
};
