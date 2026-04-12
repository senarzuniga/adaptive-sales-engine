import { useLanguage } from '@/i18n/LanguageContext';
import { useData } from '@/store/DataStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VoiceTextInput } from '@/components/VoiceTextInput';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Save } from 'lucide-react';
import type { CompanyProfile } from '@/store/DataStore';

const CompanyInfoPage = () => {
  const { t } = useLanguage();
  const { data, setCompanyProfile, activeCompanyId } = useData();
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

  const fields: { key: keyof CompanyProfile; label: string; type: 'input' | 'textarea' }[] = [
    { key: 'company_name', label: t.companyInfo.companyName, type: 'input' },
    { key: 'industry', label: t.companyInfo.industry, type: 'input' },
    { key: 'sub_sector', label: t.companyInfo.subSector, type: 'input' },
    { key: 'headquarters', label: t.companyInfo.headquarters, type: 'input' },
    { key: 'operating_regions', label: t.companyInfo.operatingRegions, type: 'input' },
    { key: 'employee_count', label: t.companyInfo.employeeCount, type: 'input' },
    { key: 'annual_revenue', label: t.companyInfo.annualRevenue, type: 'input' },
    { key: 'main_products', label: t.companyInfo.mainProducts, type: 'textarea' },
    { key: 'main_customer_segments', label: t.companyInfo.mainCustomerSegments, type: 'textarea' },
    { key: 'main_competitors', label: t.companyInfo.mainCompetitors, type: 'textarea' },
    { key: 'sales_team_size', label: t.companyInfo.salesTeamSize, type: 'input' },
    { key: 'kam_count', label: t.companyInfo.kamCount, type: 'input' },
    { key: 'sales_channels', label: t.companyInfo.salesChannels, type: 'input' },
    { key: 'current_challenges', label: t.companyInfo.currentChallenges, type: 'textarea' },
    { key: 'strategic_goals', label: t.companyInfo.strategicGoals, type: 'textarea' },
    { key: 'additional_notes', label: t.companyInfo.additionalNotes, type: 'textarea' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-2">{t.companyInfo.title}</h2>
        <p className="text-muted-foreground">{t.companyInfo.subtitle}</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {fields.map((field) => (
              <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                <Label htmlFor={field.key} className="text-sm font-medium text-foreground mb-1.5 block">{field.label}</Label>
                {field.type === 'input' ? (
                  <Input id={field.key} value={profile[field.key] || ''} onChange={(e) => update(field.key, e.target.value)} className="bg-background" />
                ) : (
                  <VoiceTextInput value={profile[field.key] || ''} onChange={(v) => update(field.key, v)} rows={3} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-8">
            <Button onClick={handleSave} className="gap-2"><Save className="h-4 w-4" /> {t.companyInfo.save}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanyInfoPage;
