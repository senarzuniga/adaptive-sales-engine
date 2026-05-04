import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Zap } from 'lucide-react';

export function ProjectManagementHeader() {
  return (
    <CardHeader className="pb-2">
      <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Delay Impact Simulator</CardTitle>
      <CardDescription className="text-xs">Select a phase and introduce a delay to see how it cascades through the project timeline, milestones, and delivery.</CardDescription>
    </CardHeader>
  );
}
