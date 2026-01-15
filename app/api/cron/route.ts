import { NextResponse } from 'next/server';
import { triggerSync, isJobRunning, getSchedules } from '@/lib/cron';

/**
 * GET /api/cron
 * Returns cron status and schedules
 */
export async function GET() {
  return NextResponse.json({
    schedules: getSchedules(),
    running: {
      dsc: isJobRunning('dsc'),
      dpd: isJobRunning('dpd'),
    },
  });
}

/**
 * POST /api/cron
 * Manually trigger a sync job
 *
 * Body: { "job": "dsc" | "dpd" }
 * Header: Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: Request) {
  // Verify authorization
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 500 }
    );
  }

  const token = authHeader?.replace('Bearer ', '');
  if (token !== cronSecret) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Parse request body
  let body: { job?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { job } = body;
  if (job !== 'dsc' && job !== 'dpd') {
    return NextResponse.json(
      { error: 'Invalid job. Must be "dsc" or "dpd"' },
      { status: 400 }
    );
  }

  // Check if already running
  if (isJobRunning(job)) {
    return NextResponse.json(
      { error: `${job} job is already running` },
      { status: 409 }
    );
  }

  // Trigger the job
  const result = await triggerSync(job);

  return NextResponse.json({
    job,
    success: result.success,
    output: result.output.slice(-2000), // Last 2000 chars of output
  });
}
