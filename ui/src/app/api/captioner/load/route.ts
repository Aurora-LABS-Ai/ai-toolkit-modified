import { NextResponse } from 'next/server';
import { loadJoyCaptionWorker, getJoyCaptionStatus } from '@/server/joycaptionWorker';

export async function POST() {
  try {
    await loadJoyCaptionWorker();
    return NextResponse.json(getJoyCaptionStatus());
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load JoyCaption' }, { status: 500 });
  }
}
