import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, X, Check } from 'lucide-react';
import { useOrganization } from '@/services/useMembers';

interface Props {
  isOwner: boolean;
}

export function OrganizationTab({ isOwner }: Props) {
  const { org, isLoading, isSaving, error, clearError, save } = useOrganization();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (org) {
      setName(org.name);
      setSlug(org.slug);
    }
  }, [org]);

  const isDirty = org && (name !== org.name || slug !== org.slug);

  const handleSave = async () => {
    const ok = await save({ name, slug });
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={clearError}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Organization Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isOwner}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Slug
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 shrink-0">org/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              disabled={!isOwner}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed font-mono"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">Used in URLs. Lowercase letters, numbers, and hyphens only.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Plan</label>
          <div className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-400 capitalize">
            {org?.plan_type ?? '—'}
          </div>
        </div>
      </div>

      {isOwner && (
        <button
          onClick={handleSave}
          disabled={isSaving || !isDirty}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <Check className="w-4 h-4 text-green-300" />
          ) : null}
          {saved ? 'Saved' : 'Save Changes'}
        </button>
      )}

      {!isOwner && (
        <p className="text-xs text-gray-500">Only the organization owner can edit these settings.</p>
      )}
    </div>
  );
}
