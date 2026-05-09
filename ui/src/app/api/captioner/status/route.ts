import { NextResponse } from 'next/server';
import { getJoyCaptionStatus } from '@/server/joycaptionWorker';

export async function GET() {
  return NextResponse.json(getJoyCaptionStatus());
}
