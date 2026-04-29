import { useState, useEffect, useCallback, useMemo } from 'react';
import { useData } from '@/store/DataStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  FolderKanban, Plus, Trash2, Brain, TrendingUp, AlertTriangle, Shield, Settings,
  DollarSign, BarChart3, Lightbulb, Save, Loader2, Target, Calendar, Users,
  Activity, Zap, Eye, CheckCircle, Clock, FileText, ArrowRight, Gauge, GitBranch, Edit
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { fmt, fmtPct, PROJECT_TYPES, COMPLEXITY_LEVELS, RISK_LEVELS, DURATION_CATS, PROJECT_STATUSES, PHASE_STATUSES, COST_CATEGORIES, GATE_DEFINITIONS, HEALTH_COLOR, STATUS_VARIANT } from './ProjectManagementPageConstants';
import DelaySimulation from './DelaySimulation';

// --- Delay Impact Simulation ---
function DelaySimulation({ phases, milestones, gates, project }: { phases: any[]; milestones: any[]; gates: any[]; project: any }) {
  const [delayPhaseId, setDelayPhaseId] = useState<string>('');
  const [delayDays, setDelayDays] = useState<number>(0);

  const simulation = useMemo(() => {
    if (!delayPhaseId || delayDays <= 0 || phases.length === 0) return null;

    const delayedPhaseIdx = phases.findIndex(p => p.id === delayPhaseId);
    if (delayedPhaseIdx < 0) return null;
    const delayedPhase = phases[delayedPhaseIdx];
    const delayMs = delayDays * 86400000;

    // Build cascade: all subsequent phases shift by delay amount (sequential dependency model)
    const cascadedPhases = phases.map((p, i) => {
      const isAffected = i >= delayedPhaseIdx;
      const shift = isAffected ? delayDays : 0;
      const origStart = p.planned_start ? new Date(p.planned_start) : null;
      const origEnd = p.planned_end ? new Date(p.planned_end) : null;
      const newStart = origStart && isAffected ? new Date(origStart.getTime() + delayMs) : origStart;
      const newEnd = origEnd && isAffected ? new Date(origEnd.getTime() + delayMs) : origEnd;

      return {
        ...p,
        isAffected,
        shiftDays: shift,
        originalStart: origStart,
        originalEnd: origEnd,
        newStart,
        newEnd,
        isSource: p.id === delayPhaseId,
      };
    });

    // Delivery deadline impact
    const deadline = project.delivery_deadline ? new Date(project.delivery_deadline) : null;
    const lastPhase = cascadedPhases[cascadedPhases.length - 1];
    const newProjectEnd = lastPhase?.newEnd;
    const deadlineBreached = deadline && newProjectEnd && newProjectEnd > deadline;
    const breachDays = deadlineBreached ? Math.ceil((newProjectEnd.getTime() - deadline.getTime()) / 86400000) : 0;

    // Affected milestones
    const affectedMilestones = milestones.filter(ms => {
      if (!ms.linked_phase_id) return false;
      const phaseIdx = phases.findIndex(p => p.id === ms.linked_phase_id);
      return phaseIdx >= delayedPhaseIdx;
    }).map(ms => ({
      ...ms,
      shiftDays: delayDays,
    }));

    // Affected gates
    const affectedGates = gates.filter(g => {
      if (!g.planned_date) return false;
      const gateDate = new Date(g.planned_date);
      const delayedStart = delayedPhase.planned_start ? new Date(delayedPhase.planned_start) : null;
      return delayedStart && gateDate >= delayedStart;
    }).map(g => ({
      ...g,
      newDate: new Date(new Date(g.planned_date).getTime() + delayMs),
      shiftDays: delayDays,
    }));

    // Cost impact estimate (rough: delay days × daily burn rate)
    const totalBudget = phases.reduce((s: number, p: any) => s + (p.budget || 0), 0);
    const totalPlannedDays = phases.reduce((s: number, p: any) => {
      if (!p.planned_start || !p.planned_end) return s;
      return s + Math.max(1, Math.ceil((new Date(p.planned_end).getTime() - new Date(p.planned_start).getTime()) / 86400000));
    }, 0);
    const dailyBurnRate = totalPlannedDays > 0 ? totalBudget / totalPlannedDays : 0;
    const estimatedAdditionalCost = dailyBurnRate * delayDays;

    // Penalty risk
    const hasPenalties = !!project.penalties_lds;
    const penaltyRisk = deadlineBreached && hasPenalties;

    const affectedCount = cascadedPhases.filter(p => p.isAffected && !p.isSource).length;

    return {
      cascadedPhases,
      affectedCount,
      deadlineBreached,
      breachDays,
      affectedMilestones,
      affectedGates,
      estimatedAdditionalCost,
      dailyBurnRate,
      penaltyRisk,
      delayedPhaseName: delayedPhase.phase_name,
    };
  }, [delayPhaseId, delayDays, phases, milestones, gates, project]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Delay Impact Simulator</CardTitle>
          <CardDescription className="text-xs">Select a phase and introduce a delay to see how it cascades through the project timeline, milestones, and delivery.</CardDescription>
        </CardHeader>
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
      </Card>
    </div>
  );
}

export default DelaySimulation;
