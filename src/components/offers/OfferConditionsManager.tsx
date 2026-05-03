import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ContentLibraryService, type OfferContentBlock } from '@/services/offer/ContentLibraryService';

interface OfferConditionsManagerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function OfferConditionsManager({ selectedIds, onChange }: OfferConditionsManagerProps) {
  const service = new ContentLibraryService();
  const [conditions, setConditions] = useState<OfferContentBlock[]>([]);

  useEffect(() => {
    service.getConditionsLibrary().then(setConditions).catch(() => setConditions([]));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Offer Conditions Library</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {conditions.map((condition) => {
          const checked = selectedIds.includes(condition.id);
          return (
            <div key={condition.id} className="border rounded p-2 space-y-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(next) => {
                    if (next) onChange([...selectedIds, condition.id]);
                    else onChange(selectedIds.filter((id) => id !== condition.id));
                  }}
                />
                <p className="font-medium text-sm">{condition.title}</p>
              </div>
              <p className="text-xs text-muted-foreground">{condition.content}</p>
            </div>
          );
        })}

        <Button variant="outline" size="sm" onClick={() => onChange(conditions.filter((item) => item.is_default).map((item) => item.id))}>
          Apply Default Conditions
        </Button>
      </CardContent>
    </Card>
  );
}
