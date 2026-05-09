import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { defaultTrainFolder, defaultDatasetsFolder } from '@/paths';
import { flushCache } from '@/server/settings';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const settings = await prisma.settings.findMany();
    const settingsObject = settings.reduce((acc: any, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});
    // if TRAINING_FOLDER is not set, use default
    if (!settingsObject.TRAINING_FOLDER || settingsObject.TRAINING_FOLDER === '') {
      settingsObject.TRAINING_FOLDER = defaultTrainFolder;
    }
    // if DATASETS_FOLDER is not set, use default
    if (!settingsObject.DATASETS_FOLDER || settingsObject.DATASETS_FOLDER === '') {
      settingsObject.DATASETS_FOLDER = defaultDatasetsFolder;
    }
    return NextResponse.json(settingsObject);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      HF_TOKEN,
      TRAINING_FOLDER,
      DATASETS_FOLDER,
      CAPTION_BASE_URL,
      CAPTION_API_KEY,
      CAPTION_MODEL,
      CAPTION_SYSTEM_PROMPT,
    } = body;

    const keys = [
      { key: 'HF_TOKEN', value: HF_TOKEN ?? '' },
      { key: 'TRAINING_FOLDER', value: TRAINING_FOLDER ?? '' },
      { key: 'DATASETS_FOLDER', value: DATASETS_FOLDER ?? '' },
      { key: 'CAPTION_BASE_URL', value: CAPTION_BASE_URL ?? '' },
      { key: 'CAPTION_API_KEY', value: CAPTION_API_KEY ?? '' },
      { key: 'CAPTION_MODEL', value: CAPTION_MODEL ?? '' },
      { key: 'CAPTION_SYSTEM_PROMPT', value: CAPTION_SYSTEM_PROMPT ?? '' },
    ];

    await Promise.all(
      keys.map(({ key, value }) =>
        prisma.settings.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        }),
      ),
    );

    flushCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
