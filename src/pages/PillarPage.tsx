import { useLanguage } from '@/i18n/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';

interface PillarPageProps {
  pillarKey: 'p0' | 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6';
  pillarNumber: number;
}

const PillarPage = ({ pillarKey, pillarNumber }: PillarPageProps) => {
  const { t } = useLanguage();
  const pillar = t.pillars[pillarKey];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded">
            {t.dashboard.pillar} {pillarNumber}
          </span>
        </div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">{pillar.title}</h2>
        <p className="text-muted-foreground">{pillar.desc}</p>
      </div>

      <Card>
        <CardContent className="py-16 text-center">
          <Construction className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Coming Soon</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Upload your data and company information first. AI-powered analysis for this pillar will be activated once data is available.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PillarPage;
