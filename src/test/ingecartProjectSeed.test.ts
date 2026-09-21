import { describe, expect, it } from 'vitest';
import { getIngecartBundledProjectWorkspace } from '@/lib/ingecartProjectSeed';

describe('ingecart project seed', () => {
  it('includes the Auxiliar corrugadora current project', () => {
    const bundled = getIngecartBundledProjectWorkspace();
    const project = bundled.projects.find((item) => item.project_number === 'PRJ-2026-011');

    expect(project).toBeTruthy();
    expect(project?.customer_name).toBe('Auxiliar');
    expect(project?.title).toBe('Auxiliar - Corrugadora Final Assembly');
    expect(project?.status).toBe('in_progress');
    expect(project?.ai_analysis?.priority).toBe('critical_final_assembly_control');

    const milestones = bundled.project_milestones.filter((item) => item.project_id === project?.id);
    expect(milestones.some((item) => item.milestone_type === 'contract' && item.is_paid === true)).toBe(true);
  });
});
