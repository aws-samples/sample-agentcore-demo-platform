/**
 * Settings Page
 * Tabs: Members, Organization, API Keys, Appearance
 */

import { useState } from 'react';
import { Users, Building2, Key, AlertCircle, Palette, UsersRound } from 'lucide-react';
import { MembersTab } from './settings/MembersTab';
import { OrganizationTab } from './settings/OrganizationTab';
import { ApiKeysTab } from './settings/ApiKeysTab';
import { AppearanceTab } from './settings/AppearanceTab';
import { GroupsTab } from './settings/GroupsTab';
import { useAuth } from '@/services/AuthContext';
import { useMembers } from '@/services/useMembers';

type Tab = 'members' | 'groups' | 'organization' | 'api-keys' | 'appearance';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'members', label: 'Members', icon: <Users className="w-4 h-4" /> },
  { id: 'groups', label: 'Groups', icon: <UsersRound className="w-4 h-4" /> },
  { id: 'organization', label: 'Organization', icon: <Building2 className="w-4 h-4" /> },
  { id: 'api-keys', label: 'API Keys', icon: <Key className="w-4 h-4" /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
];

export function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('members');
  const { user } = useAuth();

  const isAdmin = user?.role === 'owner' || user?.role === 'admin';
  const { members: orgMembers } = useMembers();

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
      <p className="text-sm text-gray-400 mb-8">
        Manage your organization, members, and API access.
      </p>

      {!isAdmin && (
        <div className="mb-6 flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          You have read-only access. Contact an admin to make changes.
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-gray-800 mb-8">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'members' && <MembersTab isAdmin={isAdmin} currentUserId={user?.id ?? ''} />}
      {activeTab === 'groups' && <GroupsTab isAdmin={isAdmin} orgMembers={orgMembers.map(m => ({ id: m.id, user_id: m.user_id, name: m.name, email: m.email }))} />}
      {activeTab === 'organization' && <OrganizationTab isOwner={user?.role === 'owner'} />}
      {activeTab === 'api-keys' && <ApiKeysTab isAdmin={isAdmin} />}
      {activeTab === 'appearance' && <AppearanceTab />}
    </div>
  );
}
