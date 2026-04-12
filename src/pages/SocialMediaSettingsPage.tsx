import { useState, useEffect, useCallback } from 'react';
import { useData } from '@/store/DataStore';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { VoiceTextInput } from '@/components/VoiceTextInput';
import {
  Linkedin, Twitter, Instagram, Facebook, Plus, Trash2, Save,
  Globe, Settings, CheckCircle, AlertCircle, Loader2, Share2
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface SocialAccount {
  id: string;
  company_id: string;
  platform: string;
  profile_url: string;
  account_name: string;
  is_enabled: boolean;
  api_credentials: Record<string, string>;
  posting_preferences: {
    auto_post: boolean;
    content_types: string[];
    frequency: string;
  };
  notes: string;
}

const PLATFORMS = [
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'text-blue-600',
    credentialFields: [
      { key: 'client_id', label: 'Client ID', help: 'From LinkedIn Developer Portal → App → Auth' },
      { key: 'client_secret', label: 'Client Secret', secret: true, help: 'From LinkedIn Developer Portal → App → Auth' },
      { key: 'access_token', label: 'Access Token', secret: true, help: 'OAuth 2.0 access token (use LinkedIn OAuth flow)' },
      { key: 'organization_id', label: 'Organization ID (optional)', help: 'For posting as a company page. Found in Page Admin URL.' },
    ],
    setupUrl: 'https://www.linkedin.com/developers/apps',
    setupInstructions: 'Create an app at LinkedIn Developer Portal. Enable "Share on LinkedIn" and "Sign In with LinkedIn" products. Generate an access token with w_member_social and w_organization_social scopes.',
  },
  { id: 'twitter', label: 'Twitter / X', icon: Twitter, color: 'text-foreground',
    credentialFields: [
      { key: 'api_key', label: 'API Key (Consumer Key)', help: 'From X Developer Portal → Project → Keys' },
      { key: 'api_secret', label: 'API Secret', secret: true, help: 'From X Developer Portal → Project → Keys' },
      { key: 'access_token', label: 'Access Token', secret: true, help: 'From X Developer Portal → Project → Keys' },
      { key: 'access_token_secret', label: 'Access Token Secret', secret: true, help: 'From X Developer Portal → Project → Keys' },
    ],
    setupUrl: 'https://developer.x.com/en/portal/dashboard',
    setupInstructions: 'Create a project and app at X Developer Portal. Enable Read and Write permissions. Generate access tokens.',
  },
  { id: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-500',
    credentialFields: [
      { key: 'access_token', label: 'Access Token', secret: true, help: 'From Meta Graph API / Facebook Developer Portal' },
      { key: 'business_account_id', label: 'Business Account ID', help: 'Instagram Business or Creator account ID' },
    ],
    setupUrl: 'https://developers.facebook.com/',
    setupInstructions: 'Requires a Facebook App with Instagram Graph API. Connect your Instagram Business account through Facebook Page settings.',
  },
  { id: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-500',
    credentialFields: [
      { key: 'page_access_token', label: 'Page Access Token', secret: true, help: 'From Facebook Graph API Explorer or App settings' },
      { key: 'page_id', label: 'Page ID', help: 'Facebook Page ID (found in Page settings → About)' },
    ],
    setupUrl: 'https://developers.facebook.com/',
    setupInstructions: 'Create a Facebook App. Add the Pages API product. Generate a long-lived Page Access Token with pages_manage_posts permission.',
  },
];

const CONTENT_TYPES = ['article', 'update', 'case_study', 'product_news', 'industry_insight', 'event'];
const FREQUENCIES = ['manual', 'weekly', 'bi-weekly', 'monthly'];

const SocialMediaSettingsPage = () => {
  const { activeCompanyId } = useData();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    const { data } = await supabase
      .from('social_media_accounts')
      .select('*')
      .eq('company_id', activeCompanyId);
    setAccounts((data as any[]) || []);
    setLoading(false);
  }, [activeCompanyId]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const addPlatform = async (platformId: string) => {
    if (!activeCompanyId) return;
    const existing = accounts.find(a => a.platform === platformId);
    if (existing) {
      setExpandedPlatform(platformId);
      return;
    }
    const { data, error } = await supabase
      .from('social_media_accounts')
      .insert({ company_id: activeCompanyId, platform: platformId })
      .select()
      .single();
    if (error) {
      toast({ title: 'Error adding platform', description: error.message, variant: 'destructive' });
      return;
    }
    setAccounts(prev => [...prev, data as any]);
    setExpandedPlatform(platformId);
    toast({ title: `${platformId} added` });
  };

  const updateAccount = (id: string, updates: Partial<SocialAccount>) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const saveAccount = async (account: SocialAccount) => {
    setSaving(account.id);
    const { error } = await supabase
      .from('social_media_accounts')
      .update({
        profile_url: account.profile_url,
        account_name: account.account_name,
        is_enabled: account.is_enabled,
        api_credentials: account.api_credentials,
        posting_preferences: account.posting_preferences,
        notes: account.notes,
      })
      .eq('id', account.id);
    setSaving(null);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Settings saved' });
    }
  };

  const deleteAccount = async (id: string) => {
    await supabase.from('social_media_accounts').delete().eq('id', id);
    setAccounts(prev => prev.filter(a => a.id !== id));
    toast({ title: 'Platform removed' });
  };

  if (!activeCompanyId) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto text-center py-20">
        <Share2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">No company selected</h2>
        <p className="text-muted-foreground">Select a company to manage social media settings.</p>
      </div>
    );
  }

  const getPlatformConfig = (id: string) => PLATFORMS.find(p => p.id === id);

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Share2 className="h-6 w-6 text-primary" /> Social Media & Publishing
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Configure social media accounts for auto-publishing AI-generated content (posts, newsletters, articles).
        </p>
      </div>

      {/* Add Platform Buttons */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add Platform</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {PLATFORMS.map(p => {
              const exists = accounts.some(a => a.platform === p.id);
              return (
                <Button
                  key={p.id}
                  variant={exists ? 'secondary' : 'outline'}
                  className="gap-2"
                  onClick={() => addPlatform(p.id)}
                >
                  <p.icon className={`h-4 w-4 ${p.color}`} />
                  {p.label}
                  {exists && <CheckCircle className="h-3 w-3 text-green-500" />}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="text-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        </div>
      )}

      {/* Platform Cards */}
      {!loading && accounts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Globe className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground">No social media platforms configured yet. Click a platform above to get started.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {accounts.map(account => {
          const config = getPlatformConfig(account.platform);
          if (!config) return null;
          const isExpanded = expandedPlatform === account.platform;

          return (
            <Card key={account.id} className="overflow-hidden">
              <CardHeader
                className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedPlatform(isExpanded ? null : account.platform)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <config.icon className={`h-5 w-5 ${config.color}`} />
                    <div>
                      <CardTitle className="text-base">{config.label}</CardTitle>
                      {account.account_name && (
                        <p className="text-xs text-muted-foreground">@{account.account_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {account.is_enabled ? (
                      <Badge variant="default" className="text-[10px]">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Inactive</Badge>
                    )}
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="space-y-6 border-t pt-4">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Account Name / Handle</Label>
                      <Input
                        value={account.account_name}
                        onChange={e => updateAccount(account.id, { account_name: e.target.value })}
                        placeholder="@company_handle"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Profile URL</Label>
                      <Input
                        value={account.profile_url}
                        onChange={e => updateAccount(account.id, { profile_url: e.target.value })}
                        placeholder={`https://${config.id}.com/...`}
                      />
                    </div>
                  </div>

                  {/* Enable Toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Enable Auto-Publishing</Label>
                      <p className="text-xs text-muted-foreground">Allow the Cobot to publish content to this platform</p>
                    </div>
                    <Switch
                      checked={account.is_enabled}
                      onCheckedChange={v => updateAccount(account.id, { is_enabled: v })}
                    />
                  </div>

                  <Separator />

                  {/* API Credentials */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm font-medium">API Credentials</Label>
                      <a href={config.setupUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                        Open Developer Portal →
                      </a>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3 mb-3">
                      <p className="text-xs text-muted-foreground">{config.setupInstructions}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {config.credentialFields.map(field => (
                        <div key={field.key}>
                          <Label className="text-xs">{field.label}</Label>
                          <Input
                            type={field.secret ? 'password' : 'text'}
                            value={account.api_credentials?.[field.key] || ''}
                            onChange={e => updateAccount(account.id, {
                              api_credentials: { ...account.api_credentials, [field.key]: e.target.value }
                            })}
                            placeholder={field.help}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Posting Preferences */}
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Posting Preferences</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs">Frequency</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                          value={account.posting_preferences?.frequency || 'manual'}
                          onChange={e => updateAccount(account.id, {
                            posting_preferences: { ...account.posting_preferences, frequency: e.target.value }
                          })}
                        >
                          {FREQUENCIES.map(f => (
                            <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1).replace('-', ' ')}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">Content Types</Label>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {CONTENT_TYPES.map(ct => {
                            const active = account.posting_preferences?.content_types?.includes(ct);
                            return (
                              <Badge
                                key={ct}
                                variant={active ? 'default' : 'outline'}
                                className="cursor-pointer text-[10px]"
                                onClick={() => {
                                  const current = account.posting_preferences?.content_types || [];
                                  const updated = active ? current.filter(c => c !== ct) : [...current, ct];
                                  updateAccount(account.id, {
                                    posting_preferences: { ...account.posting_preferences, content_types: updated }
                                  });
                                }}
                              >
                                {ct.replace('_', ' ')}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Notes */}
                  <div>
                    <Label className="text-xs">Notes & Brand Guidelines</Label>
                    <VoiceTextInput
                      value={account.notes || ''}
                      onChange={v => updateAccount(account.id, { notes: v })}
                      placeholder="Tone of voice, hashtag strategy, brand guidelines for this platform..."
                      rows={3}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between">
                    <Button variant="destructive" size="sm" className="gap-1" onClick={() => deleteAccount(account.id)}>
                      <Trash2 className="h-3 w-3" /> Remove
                    </Button>
                    <Button size="sm" className="gap-1" onClick={() => saveAccount(account)} disabled={saving === account.id}>
                      {saving === account.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      Save Settings
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default SocialMediaSettingsPage;
