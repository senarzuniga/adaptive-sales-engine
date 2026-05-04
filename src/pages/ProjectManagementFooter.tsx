import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function ProjectManagementFooter({ delayPhaseId, setDelayPhaseId, delayDays, setDelayDays, phases }) {
  return (
    <CardContent>
      <div className="flex items-end gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-muted-foreground">Phase to Delay</label>
          <Select value={delayPhaseId} onValueChange={setDelayPhaseId}>
            <SelectTrigger><SelectValue placeholder="Select phase..." /></SelectTrigger>
            <SelectContent>
              {phases.map(p => (
                <SelectItem key={p.id} value={p.id}>Phase {p.phase_number}: {p.phase_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <label className="text-xs font-medium text-muted-foreground">Delay (days)</label>
          <Input type="number" min={0} value={delayDays} onChange={e => setDelayDays(Number(e.target.value))} />
        </div>
      </div>
    </CardContent>
  );
}
