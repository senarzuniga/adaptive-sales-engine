import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OFFER_TEMPLATES, type OfferTemplateType } from '@/services/offer/offerTemplates';

interface TemplateSelectorProps {
  selectedTemplate: OfferTemplateType;
  onSelect: (templateType: OfferTemplateType) => void;
}

const labels: Record<OfferTemplateType, { name: string; icon: string; description: string }> = {
  machine_selling: {
    name: 'Machine/Equipment Sale',
    icon: '🏭',
    description: 'Capital equipment offers with technical specs, performance guarantees, and delivery/installation blocks.',
  },
  service_selling: {
    name: 'Professional Services',
    icon: '🤝',
    description: 'Service-oriented SoW structure with methodology, governance, SLA, and legal conditions.',
  },
};

export function TemplateSelector({ selectedTemplate, onSelect }: TemplateSelectorProps) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {OFFER_TEMPLATES.map((template) => {
        const info = labels[template.template_type];
        const active = selectedTemplate === template.template_type;
        return (
          <Card key={template.template_id} className={active ? 'border-primary' : ''}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span>{info.icon}</span>
                {info.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">{info.description}</p>
              <div className="flex flex-wrap gap-1">
                {template.sections.map((section) => (
                  <Badge key={section.id} variant={section.required ? 'default' : 'outline'}>
                    {section.title}
                  </Badge>
                ))}
              </div>
              <Button className="w-full" variant={active ? 'default' : 'outline'} onClick={() => onSelect(template.template_type)}>
                {active ? 'Selected' : 'Use this template'}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
