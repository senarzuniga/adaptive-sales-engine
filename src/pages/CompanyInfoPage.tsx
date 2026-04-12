import { useLanguage } from '@/i18n/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { Save } from 'lucide-react';

interface CompanyProfile {
  companyName: string;
  industry: string;
  subSector: string;
  headquarters: string;
  operatingRegions: string;
  employeeCount: string;
  annualRevenue: string;
  mainProducts: string;
  mainCustomerSegments: string;
  mainCompetitors: string;
  salesTeamSize: string;
  kamCount: string;
  salesChannels: string;
  currentChallenges: string;
  strategicGoals: string;
  additionalNotes: string;
}

const initialProfile: CompanyProfile = {
  companyName: '', industry: '', subSector: '', headquarters: '',
  operatingRegions: '', employeeCount: '', annualRevenue: '', mainProducts: '',
  mainCustomerSegments: '', mainCompetitors: '', salesTeamSize: '', kamCount: '',
  salesChannels: '', currentChallenges: '', strategicGoals: '', additionalNotes: '',
};

const CompanyInfoPage = () => {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<CompanyProfile>(initialProfile);

  const update = (field: keyof CompanyProfile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    localStorage.setItem('acs_company_profile', JSON.stringify(profile));
    toast({ title: t.companyInfo.saved });
  };

  const fields: { key: keyof CompanyProfile; label: string; type: 'input' | 'textarea' }[] = [
    { key: 'companyName', label: t.companyInfo.companyName, type: 'input' },
    { key: 'industry', label: t.companyInfo.industry, type: 'input' },
    { key: 'subSector', label: t.companyInfo.subSector, type: 'input' },
    { key: 'headquarters', label: t.companyInfo.headquarters, type: 'input' },
    { key: 'operatingRegions', label: t.companyInfo.operatingRegions, type: 'input' },
    { key: 'employeeCount', label: t.companyInfo.employeeCount, type: 'input' },
    { key: 'annualRevenue', label: t.companyInfo.annualRevenue, type: 'input' },
    { key: 'mainProducts', label: t.companyInfo.mainProducts, type: 'textarea' },
    { key: 'mainCustomerSegments', label: t.companyInfo.mainCustomerSegments, type: 'textarea' },
    { key: 'mainCompetitors', label: t.companyInfo.mainCompetitors, type: 'textarea' },
    { key: 'salesTeamSize', label: t.companyInfo.salesTeamSize, type: 'input' },
    { key: 'kamCount', label: t.companyInfo.kamCount, type: 'input' },
    { key: 'salesChannels', label: t.companyInfo.salesChannels, type: 'input' },
    { key: 'currentChallenges', label: t.companyInfo.currentChallenges, type: 'textarea' },
    { key: 'strategicGoals', label: t.companyInfo.strategicGoals, type: 'textarea' },
    { key: 'additionalNotes', label: t.companyInfo.additionalNotes, type: 'textarea' },
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
                <Label htmlFor={field.key} className="text-sm font-medium text-foreground mb-1.5 block">
                  {field.label}
                </Label>
                {field.type === 'input' ? (
                  <Input
                    id={field.key}
                    value={profile[field.key]}
                    onChange={(e) => update(field.key, e.target.value)}
                    className="bg-background"
                  />
                ) : (
                  <Textarea
                    id={field.key}
                    value={profile[field.key]}
                    onChange={(e) => update(field.key, e.target.value)}
                    rows={3}
                    className="bg-background"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end mt-8">
            <Button onClick={handleSave} className="gap-2">
              <Save className="h-4 w-4" />
              {t.companyInfo.save}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanyInfoPage;
