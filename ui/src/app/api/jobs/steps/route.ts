import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { getTrainingFolder } from '@/server/settings';

const prisma = new PrismaClient();
const ANSI_RE = /\x1B\[[0-9;]*[mGKHFJA]/g;

function parseStepFromLog(log: string): number | null {
  if (!log) return null;
  const lines = log.split(/\n|\r\n/).map(l => l.split(/\r/).pop()!.replace(ANSI_RE, ''));
  for (let i = lines.length - 1; i >= 0; i--) {
    const match = lines[i].match(/\|\s*(\d+)\/(\d+)\s+\[/);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.getAll('id');

  if (ids.length === 0) {
    return NextResponse.json({ steps: {} });
  }

  const trainingFolder = await getTrainingFolder();

  const steps: Record<string, number> = {};

  await Promise.all(
    ids.map(async (jobID) => {
      try {
        const job = await prisma.job.findUnique({ where: { id: jobID } });
        if (!job) return;

        const jobFolder = path.join(trainingFolder, job.name);
        const logPath = path.join(jobFolder, 'log.txt');

        if (!fs.existsSync(logPath)) return;

        const log = fs.readFileSync(logPath, 'utf-8');
        const step = parseStepFromLog(log);
        if (step !== null) {
          steps[jobID] = step;
        }
      } catch (error) {
        // silently skip errors
      }
    })
  );

  return NextResponse.json({ steps });
}
