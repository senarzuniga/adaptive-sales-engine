import { useLanguage } from '@/i18n/LanguageContext';
import { useData } from '@/store/DataStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VoiceTextInput } from '@/components/VoiceTextInput';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Save, Globe, Linkedin, Sparkles, Loader2 } from 'lucide-react';
import type { CompanyProfile } from '@/store/DataStore';

const CompanyInfoPage = () => {
  const { t } = useLanguage();
  const { data, setCompanyProfile, activeCompanyId, triggerEnrichment } = useData();
  const profile = data.companyProfile;

  const update = (field: keyof CompanyProfile, value: string) => {
    setCompanyProfile({ ...profile, [field]: value });
  };

  const handleSave = () => {
    toast({ title: t.companyInfo.saved });
  };

  if (!activeCompanyId) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto text-center py-20">
        <h2 className="text-xl font-semibold text-foreground mb-2">No company selected</h2>
        <p className="text-muted-foreground">Select or create a company from the top bar to manage its profile.</p>
      </div>
    );
  }

  const enrichmentBadge = () => {
    switch (profile.enrichment_status) {
      case 'enriching': return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> AI Enriching...</Badge>;
      case 'completed': return <Badge className="gap-1 bg-primary/10 text-primary border-primary/20"><Sparkles className="h-3 w-3" /> AI Enriched</Badge>;
      case 'failed': return <Badge variant="destructive" className="gap-1">Enrichment Failed</Badge>;
      default: return <Badge variant="outline" className="gap-1">Not Enriched</Badge>;
    }
  };

  const identityFields: { key: keyof CompanyProfile; label: string; type: 'input' | 'textarea'; icon?: any }[] = [
    { key: 'company_name', label: t.companyInfo.companyName, type: 'input' },
    { key: 'website_url', label: 'Website URL', type: 'input', icon: Globe },
    { key: 'linkedin_url', label: 'LinkedIn URL', type: 'input', icon: Linkedin },
    { key: 'industry', label: t.companyInfo.industry, type: 'input' },
    { key: 'sub_sector', label: t.companyInfo.subSector, type: 'input' },
    { key: 'headquarters', label: t.companyInfo.headquarters, type: 'input' },
    { key: 'operating_regions', label: t.companyInfo.operatingRegions, type: 'input' },
    { key: 'employee_count', label: t.companyInfo.employeeCount, type: 'input' },
    { key: 'annual_revenue', label: t.companyInfo.annualRevenue, type: 'input' },
  ];

  const contextFields: { key: keyof CompanyProfile; label: string }[] = [
    { key: 'business_description', label: 'Business Description' },
    { key: 'main_products', label: t.companyInfo.mainProducts },
    { key: 'main_customer_segments', label: t.companyInfo.mainCustomerSegments },
    { key: 'main_competitors', label: t.companyInfo.mainCompetitors },
    { key: 'objectives', label: 'Company Objectives' },
    { key: 'strategy_context', label: 'Strategy & Context' },
    { key: 'market_context', label: 'Market Context' },
    { key: 'current_challenges', label: t.companyInfo.currentChallenges },
    { key: 'strategic_goals', label: t.companyInfo.strategicGoals },
    { key: 'additional_notes', label: t.companyInfo.additionalNotes },
  ];

  const salesFields: { key: keyof CompanyProfile; label: string; type: 'input' }[] = [
    { key: 'sales_team_size', label: t.companyInfo.salesTeamSize, type: 'input' },
    { key: 'kam_count', label: t.companyInfo.kamCount, type: 'input' },
    { key: 'sales_channels', label: t.companyInfo.salesChannels, type: 'input' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground mb-1">{t.companyInfo.title}</h2>
          <p className="text-muted-foreground text-sm">{t.companyInfo.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {enrichmentBadge()}
          {profile.enrichment_status !== 'enriching' && (
            <Button variant="outline" size="sm" className="gap-1" onClick={() => triggerEnrichment(activeCompanyId)}>
              <Sparkles className="h-3 w-3" /> {profile.enrichment_status === 'completed' ? 'Re-enrich' : 'Enrich with AI'}
            </Button>
          )}
        </div>
      </div>

      {/* Identity & URLs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Company Identity & URLs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {identityFields.map((field) => (
              <div key={field.key}>
                <Label htmlFor={field.key} className="text-sm font-medium text-foreground mb-1.5 block flex items-center gap-1">
                  {field.icon && <field.icon className="h-3 w-3 text-muted-foreground" />}
                  {field.label}
                </Label>
                <Input id={field.key} value={profile[field.key] || ''} onChange={(e) => update(field.key, e.target.value)} className="bg-background" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Business Context (rich text areas for manual input) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Business Context & Strategy</CardTitle>
          <p className="text-xs text-muted-foreground">Use these fields to describe the company in your own words. Especially useful when data is limited.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4">
            {contextFields.map((field) => (
              <div key={field.key}>
                <Label htmlFor={field.key} className="text-sm font-medium text-foreground mb-1.5 block">{field.label}</Label>
                <VoiceTextInput value={profile[field.key] || ''} onChange={(v) => update(field.key, v)} rows={3} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sales Organization */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sales Organization</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {salesFields.map((field) => (
              <div key={field.key}>
                <Label htmlFor={field.key} className="text-sm font-medium text-foreground mb-1.5 block">{field.label}</Label>
                <Input id={field.key} value={profile[field.key] || ''} onChange={(e) => update(field.key, e.target.value)} className="bg-background" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="gap-2"><Save className="h-4 w-4" /> {t.companyInfo.save}</Button>
      </div>
    </div>
  );
};

export default CompanyInfoPage;
