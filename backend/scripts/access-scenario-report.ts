/**
 * One-off ACL scenario report for workflows + files.
 * Run from backend/: npx ts-node --transpile-only scripts/access-scenario-report.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

type Scope = 'all' | 'company' | 'department' | 'division' | 'own' | string;

function seesAllCompanyWorkflows(scope: Scope) {
  return scope === 'all' || scope === 'company';
}

function roleScope(permissionsJson: unknown): Scope {
  if (
    permissionsJson &&
    typeof permissionsJson === 'object' &&
    'dataScope' in permissionsJson &&
    typeof (permissionsJson as any).dataScope === 'string'
  ) {
    return (permissionsJson as any).dataScope;
  }
  return 'own';
}

function participates(
  userId: string,
  deptIds: string[],
  workflow: {
    assignedBy: string;
    assignedToType: string | null;
    assignedToId: string | null;
    actions: Array<{
      assignedToType: string;
      assignedToId: string;
      createdBy: string;
    }>;
    routingHistory: Array<{
      fromType: string;
      fromId: string | null;
      toType: string;
      toId: string;
    }>;
  },
) {
  if (workflow.assignedBy === userId) return { ok: true, via: 'creator' };
  if (
    workflow.assignedToType === 'user' &&
    workflow.assignedToId === userId
  ) {
    return { ok: true, via: 'workflow_assignee' };
  }
  if (
    workflow.assignedToType === 'department' &&
    workflow.assignedToId &&
    deptIds.includes(workflow.assignedToId)
  ) {
    return { ok: true, via: 'department_assignee' };
  }
  for (const a of workflow.actions) {
    if (a.createdBy === userId) return { ok: true, via: 'action_creator' };
    if (a.assignedToType === 'user' && a.assignedToId === userId) {
      return { ok: true, via: 'action_assignee' };
    }
    if (
      a.assignedToType === 'department' &&
      deptIds.includes(a.assignedToId)
    ) {
      return { ok: true, via: 'action_department' };
    }
  }
  for (const h of workflow.routingHistory) {
    if (h.fromType === 'user' && h.fromId === userId) {
      return { ok: true, via: 'routing_from' };
    }
    if (h.toType === 'user' && h.toId === userId) {
      return { ok: true, via: 'routing_to' };
    }
    if (h.fromType === 'department' && h.fromId && deptIds.includes(h.fromId)) {
      return { ok: true, via: 'routing_from_dept' };
    }
    if (h.toType === 'department' && deptIds.includes(h.toId)) {
      return { ok: true, via: 'routing_to_dept' };
    }
  }
  return { ok: false, via: 'none' };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15_000,
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const users = await prisma.user.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        name: true,
        email: true,
        companyId: true,
        userRoles: { include: { role: true } },
        userDepartments: { select: { departmentId: true } },
      },
      orderBy: { name: 'asc' },
    });

    const workflows = await prisma.workflow.findMany({
      select: {
        id: true,
        title: true,
        companyId: true,
        status: true,
        assignedBy: true,
        assignedToType: true,
        assignedToId: true,
        assignedToName: true,
        documentId: true,
        actions: {
          select: {
            assignedToType: true,
            assignedToId: true,
            createdBy: true,
          },
        },
        routingHistory: {
          select: {
            fromType: true,
            fromId: true,
            toType: true,
            toId: true,
          },
        },
        files: { select: { fileId: true } },
        document: { select: { id: true, fileName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const files = await prisma.file.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        fileName: true,
        companyId: true,
        createdBy: true,
      },
      orderBy: { fileName: 'asc' },
    });

    console.log('\n=== WORKFLOW ACCESS SCENARIOS ===\n');

    for (const user of users) {
      const role = user.userRoles[0]?.role;
      const scope = roleScope(role?.permissionsJson) as Scope;
      const deptIds = user.userDepartments.map((d) => d.departmentId);
      const label = `${user.name || user.email} [${role?.name || 'no-role'} / scope=${scope}]`;

      const visible = workflows.filter((w) => {
        if (scope === 'all') return true;
        if (user.companyId && w.companyId !== user.companyId) return false;
        if (seesAllCompanyWorkflows(scope)) return true;
        return participates(user.id, deptIds, w).ok;
      });

      console.log(`\n${label}`);
      console.log(`  Sees ${visible.length}/${workflows.length} workflows`);
      for (const w of workflows) {
        if (scope !== 'all' && user.companyId && w.companyId !== user.companyId) {
          continue;
        }
        let trigger = 'hidden';
        if (seesAllCompanyWorkflows(scope) || scope === 'all') {
          trigger =
            scope === 'all'
              ? 'instance_scope'
              : 'company_scope (all company workflows)';
        } else {
          const p = participates(user.id, deptIds, w);
          trigger = p.ok
            ? `participant:${p.via}`
            : 'DENIED (not a participant)';
        }
        const mark = trigger.startsWith('DENIED') ? '✗' : '✓';
        console.log(
          `  ${mark} "${w.title}" → ${w.assignedToName || 'Unassigned'} [${w.status}] — ${trigger}`,
        );
      }
    }

    console.log('\n\n=== FILE READ TRIGGERS (high-level) ===\n');
    console.log(
      'Order of decide(): instance_scope → company isolation → deny → capability → signature_invite → workflow_participant → company_scope → explicit_grant → creator → no_grant\n',
    );

    const interesting = files.filter((f) =>
      /Arewa|Scan|fcdo|unicef|wb\.pdf|dangote|Should/i.test(f.fileName),
    );
    const sampleFiles = interesting.length ? interesting : files.slice(0, 8);

    for (const user of users) {
      const role = user.userRoles[0]?.role;
      const scope = roleScope(role?.permissionsJson) as Scope;
      const deptIds = user.userDepartments.map((d) => d.departmentId);
      console.log(
        `\n${user.name || user.email} [${role?.name || 'no-role'} / ${scope}]`,
      );

      for (const file of sampleFiles) {
        let trigger = 'no_grant (would need ACL)';
        if (scope === 'all') trigger = 'instance_scope';
        else if (user.companyId && file.companyId !== user.companyId) {
          trigger = 'other_company DENIED';
        } else if (scope === 'company') {
          trigger = 'company_scope';
        } else {
          const linked = workflows.filter(
            (w) =>
              w.documentId === file.id ||
              w.files.some((wf) => wf.fileId === file.id),
          );
          let viaWorkflow = false;
          for (const w of linked) {
            if (participates(user.id, deptIds, w).ok) {
              viaWorkflow = true;
              trigger = `workflow_participant (via "${w.title}")`;
              break;
            }
          }
          if (!viaWorkflow) {
            if (file.createdBy === user.id) {
              trigger = 'creator (if no grant path)';
            } else {
              trigger = 'needs explicit_grant / folder ACL (or DENIED)';
            }
          }
        }
        const denied = /DENIED|needs explicit|no_grant/.test(trigger);
        console.log(`  ${denied ? '✗' : '✓'} ${file.fileName} — ${trigger}`);
      }
    }

    console.log('\n\n=== UI TAB RULES (frontend) ===\n');
    console.log(
      'All: backend-visible workflows only (participants unless company/all scope)',
    );
    console.log(
      'Assigned to Me: assignedTo user === me OR assignedTo department in my departments',
    );
    console.log('My Work: Assigned to Me AND status not completed/filed');
    console.log('Completed: status === completed');
    console.log(
      'Reference picker: only documents that pass filterReadable (same decide() rules)',
    );
    console.log(
      'Workflow download/open: allowed if decide(read) — including workflow_participant',
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
