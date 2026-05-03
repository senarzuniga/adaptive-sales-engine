import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { OfferTemplateDefinition } from '@/services/offer/offerTemplates';
import type { OfferContentBlock } from '@/services/offer/ContentLibraryService';

interface ContentAssignmentPanelProps {
  template: OfferTemplateDefinition;
  contentLibrary: OfferContentBlock[];
  selectedSections: string[];
  assignments: Map<string, string>;
  customContent: Record<string, string>;
  onSelectSection: (sectionId: string, selected: boolean) => void;
  onAssign: (sectionId: string, blockId: string) => void;
  onCustomize: (sectionId: string, value: string) => void;
}

export function ContentAssignmentPanel({
  template,
  contentLibrary,
  selectedSections,
  assignments,
  customContent,
  onSelectSection,
  onAssign,
  onCustomize,
}: ContentAssignmentPanelProps) {
  const blocksBySection = useMemo(() => {
    const grouped = new Map<string, OfferContentBlock[]>();
    template.sections.forEach((section) => grouped.set(section.id, []));

    contentLibrary.forEach((block) => {
      if (!grouped.has(block.section_id)) grouped.set(block.section_id, []);
      grouped.set(block.section_id, [...(grouped.get(block.section_id) || []), block]);
    });

    return grouped;
  }, [template.sections, contentLibrary]);

  return (
    <div className="space-y-4">
      {template.sections.map((section) => {
        const sectionBlocks = blocksBySection.get(section.id) || [];
        const checked = selectedSections.includes(section.id);

        return (
          <Card key={section.id} className={!checked ? 'opacity-70' : ''}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span>{section.title}</span>
                <div className="flex items-center gap-2">
                  {section.required && <Badge>Required</Badge>}
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={section.required}
                    onChange={(event) => onSelectSection(section.id, event.target.checked)}
                  />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Assign library block</p>
                  <Select
                    value={assignments.get(section.id) || ''}
                    onValueChange={(value) => onAssign(section.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select content block" />
                    </SelectTrigger>
                    <SelectContent>
                      {sectionBlocks.length === 0 ? (
                        <SelectItem value="__none" disabled>No matching blocks yet</SelectItem>
                      ) : (
                        sectionBlocks.map((block) => (
                          <SelectItem key={block.id} value={block.id}>{block.title}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Custom override</p>
                  <Textarea
                    rows={4}
                    value={customContent[section.id] || ''}
                    onChange={(event) => onCustomize(section.id, event.target.value)}
                    placeholder="Optional custom text. Supports {{variable}} syntax."
                  />
                </div>
              </div>

              {section.subsections && section.subsections.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {section.subsections.map((sub) => (
                    <Badge key={sub.id} variant="outline">{sub.title}</Badge>
                  ))}
                </div>
              )}

              {section.content_blocks && (
                <div className="text-xs text-muted-foreground">
                  Suggested legal blocks: {section.content_blocks.join(', ')}
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelectSection(section.id, !checked)}
                disabled={section.required}
              >
                {checked ? 'Exclude section' : 'Include section'}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
