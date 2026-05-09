import { NextResponse } from 'next/server';
import { unloadJoyCaptionWorker, getJoyCaptionStatus } from '@/server/joycaptionWorker';

export async function POST() {
  try {
    await unloadJoyCaptionWorker();
    return NextResponse.json(getJoyCaptionStatus());
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to unload JoyCaption' }, { status: 500 });
  }
}
