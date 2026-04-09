/**
 * BusinessScopeCustomizer Component
 * 
 * Allows users to customize the business scope appearance including
 * icon selection (emoji picker) and color theme selection.
 * Shows real-time preview of customization.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import React, { useState, useEffect } from 'react';
import { Check, Users } from 'lucide-react';
import { useTranslation } from '@/i18n';
import type { BusinessScopeCustomization } from '@/services/useBusinessScopeCreator';

// ============================================================================
// Types
// ============================================================================

export interface BusinessScopeCustomizerProps {
  /** Current customization settings */
  customization: BusinessScopeCustomization;
  /** Callback when customization changes */
  onChange: (customization: BusinessScopeCustomization) => void;
  /** Business scope name for preview */
  businessScopeName: string;
  /** Number of agents for preview */
  agentCount: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Available emoji icons for selection
 */
const ICON_OPTIONS = [
  '👥', '💻', '📢', '💰', '🎧', '📊', '🔧', '📈', '🎯', '🏢',
  '📋', '🔍', '💡', '🛠️', '📱', '🌐', '🔒', '📝', '⚙️', '🎨',
  '📦', '🚀', '💼', '🏆', '📣', '🔔', '💬', '📌', '🗂️', '✨'
];

/**
 * Available color options for selection
 */
const COLOR_OPTIONS = [
  { value: '#4CAF50', nameKey: 'customizer.color.green' },
  { value: '#2196F3', nameKey: 'customizer.color.blue' },
  { value: '#FF9800', nameKey: 'customizer.color.orange' },
  { value: '#9C27B0', nameKey: 'customizer.color.purple' },
  { value: '#E91E63', nameKey: 'customizer.color.pink' },
  { value: '#00BCD4', nameKey: 'customizer.color.cyan' },
  { value: '#FF5722', nameKey: 'customizer.color.redOrange' },
  { value: '#607D8B', nameKey: 'customizer.color.grayBlue' },
  { value: '#795548', nameKey: 'customizer.color.brown' },
  { value: '#3F51B5', nameKey: 'customizer.color.indigo' },
];

/**
 * Domain-based default suggestions
 */
const DOMAIN_SUGGESTIONS: Record<string, { icon: string; color: string }> = {
  '资产': { icon: '💰', color: '#FF9800' },
  '逾期': { icon: '📊', color: '#FF5722' },
  '人力': { icon: '👥', color: '#4CAF50' },
  'hr': { icon: '👥', color: '#4CAF50' },
  'it': { icon: '💻', color: '#2196F3' },
  'marketing': { icon: '📢', color: '#E91E63' },
  'sales': { icon: '💰', color: '#9C27B0' },
  'customer': { icon: '🎧', color: '#00BCD4' },
  'support': { icon: '🎧', color: '#00BCD4' },
  'finance': { icon: '💵', color: '#4CAF50' },
  'legal': { icon: '⚖️', color: '#607D8B' },
  'operations': { icon: '⚙️', color: '#795548' },
  '技术': { icon: '💻', color: '#2196F3' },
  '运营': { icon: '📊', color: '#FF9800' },
  '客服': { icon: '🎧', color: '#00BCD4' },
  '法务': { icon: '⚖️', color: '#607D8B' },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Gets default customization based on domain keywords
 */
function getDefaultSuggestion(scopeName: string): { icon: string; color: string } | null {
  const lowerName = scopeName.toLowerCase();
  
  for (const [keyword, suggestion] of Object.entries(DOMAIN_SUGGESTIONS)) {
    if (lowerName.includes(keyword) || scopeName.includes(keyword)) {
      return suggestion;
    }
  }
  
  return null;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface IconPickerProps {
  selectedIcon: string;
  onSelect: (icon: string) => void;
}

const IconPicker: React.FC<IconPickerProps> = ({ selectedIcon, onSelect }) => {
  return (
    <div className="grid grid-cols-10 gap-1">
      {ICON_OPTIONS.map((icon) => (
        <button
          key={icon}
          onClick={() => onSelect(icon)}
          className={`
            w-8 h-8 rounded-lg flex items-center justify-center text-lg
            transition-all hover:scale-110
            ${selectedIcon === icon 
              ? 'bg-blue-500/20 ring-2 ring-blue-500' 
              : 'bg-gray-700/50 hover:bg-gray-700'
            }
          `}
        >
          {icon}
        </button>
      ))}
    </div>
  );
};

interface ColorPickerProps {
  selectedColor: string;
  onSelect: (color: string) => void;
  t: (key: string) => string;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ selectedColor, onSelect, t }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {COLOR_OPTIONS.map((color) => (
        <button
          key={color.value}
          onClick={() => onSelect(color.value)}
          className={`
            w-8 h-8 rounded-full flex items-center justify-center
            transition-all hover:scale-110
            ${selectedColor === color.value ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-800' : ''}
          `}
          style={{ backgroundColor: color.value }}
          title={t(color.nameKey)}
        >
          {selectedColor === color.value && (
            <Check className="h-4 w-4 text-white" />
          )}
        </button>
      ))}
    </div>
  );
};

interface PreviewCardProps {
  icon: string;
  color: string;
  name: string;
  agentCount: number;
  t: (key: string) => string;
}

const PreviewCard: React.FC<PreviewCardProps> = ({ icon, color, name, agentCount, t }) => {
  return (
    <div 
      className="rounded-xl p-4 border transition-all"
      style={{ 
        backgroundColor: `${color}10`,
        borderColor: `${color}30`
      }}
    >
      <div className="flex items-center gap-3">
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${color}20` }}
        >
          {icon}
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-white">{name}</h4>
          <div className="flex items-center gap-1 mt-1">
            <Users className="h-3 w-3 text-gray-400" />
            <span className="text-xs text-gray-400">{t('customizer.agentCount').replace('{count}', String(agentCount))}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const BusinessScopeCustomizer: React.FC<BusinessScopeCustomizerProps> = ({
  customization,
  onChange,
  businessScopeName,
  agentCount,
}) => {
  const { t } = useTranslation();
  const [showSuggestion, setShowSuggestion] = useState(false);
  const suggestion = getDefaultSuggestion(businessScopeName);

  // Check if current customization matches suggestion
  useEffect(() => {
    if (suggestion) {
      const matchesSuggestion = 
        customization.icon === suggestion.icon && 
        customization.color === suggestion.color;
      setShowSuggestion(!matchesSuggestion);
    } else {
      setShowSuggestion(false);
    }
  }, [suggestion, customization]);

  const handleIconChange = (icon: string) => {
    onChange({ ...customization, icon });
  };

  const handleColorChange = (color: string) => {
    onChange({ ...customization, color });
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...customization, description: e.target.value });
  };

  const handleApplySuggestion = () => {
    if (suggestion) {
      onChange({ 
        ...customization, 
        icon: suggestion.icon, 
        color: suggestion.color 
      });
      setShowSuggestion(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Preview */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {t('customizer.preview')}
        </label>
        <PreviewCard
          icon={customization.icon}
          color={customization.color}
          name={businessScopeName}
          agentCount={agentCount}
          t={t}
        />
      </div>

      {/* Suggestion Banner */}
      {showSuggestion && suggestion && (
        <div 
          className="p-3 rounded-lg border flex items-center justify-between"
          style={{ 
            backgroundColor: `${suggestion.color}10`,
            borderColor: `${suggestion.color}30`
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">{suggestion.icon}</span>
            <div>
              <p className="text-sm text-gray-300">
                {t('customizer.recommendation')}
              </p>
              <p className="text-xs text-gray-500">
                {t('customizer.clickToApply')}
              </p>
            </div>
          </div>
          <button
            onClick={handleApplySuggestion}
            className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            {t('customizer.applyRecommendation')}
          </button>
        </div>
      )}

      {/* Icon Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {t('customizer.selectIcon')}
        </label>
        <IconPicker
          selectedIcon={customization.icon}
          onSelect={handleIconChange}
        />
      </div>

      {/* Color Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {t('customizer.selectColor')}
        </label>
        <ColorPicker
          selectedColor={customization.color}
          onSelect={handleColorChange}
          t={t}
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {t('customizer.description')}
        </label>
        <textarea
          value={customization.description}
          onChange={handleDescriptionChange}
          placeholder={t('customizer.descriptionPlaceholder')}
          rows={3}
          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>
    </div>
  );
};

export default BusinessScopeCustomizer;
