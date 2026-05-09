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
    if (settingsObject.CAPTION_ENDPOINT_TYPE === 'joycaption') {
      settingsObject.CAPTION_ENDPOINT_TYPE = 'joycaption_local';
    }
    if (!settingsObject.CAPTION_ENDPOINT_TYPE) {
      settingsObject.CAPTION_ENDPOINT_TYPE = 'joycaption_local';
    }
    if (!settingsObject.CAPTION_MODEL && settingsObject.CAPTION_ENDPOINT_TYPE === 'joycaption_local') {
      settingsObject.CAPTION_MODEL = '/root/alvan-custom/joy-captioner';
    }
    if (!settingsObject.CAPTION_MODEL && settingsObject.CAPTION_ENDPOINT_TYPE === 'joycaption_hf') {
      settingsObject.CAPTION_MODEL = 'fancyfeast/llama-joycaption-beta-one-hf-llava';
    }
    settingsObject.CAPTION_MAX_TOKENS = settingsObject.CAPTION_MAX_TOKENS || '512';
    settingsObject.CAPTION_JOY_CAPTION_TYPE = settingsObject.CAPTION_JOY_CAPTION_TYPE || 'Descriptive';
    settingsObject.CAPTION_JOY_CAPTION_LENGTH = settingsObject.CAPTION_JOY_CAPTION_LENGTH || 'any';
    settingsObject.CAPTION_JOY_LOW_VRAM = settingsObject.CAPTION_JOY_LOW_VRAM || 'false';
    settingsObject.CAPTION_KEEP_LOADED = settingsObject.CAPTION_KEEP_LOADED || 'false';
    settingsObject.CAPTION_OPT_REFER_BY_NAME = settingsObject.CAPTION_OPT_REFER_BY_NAME || 'false';
    settingsObject.CAPTION_OPT_EXCLUDE_UNCHANGEABLE = settingsObject.CAPTION_OPT_EXCLUDE_UNCHANGEABLE || 'false';
    settingsObject.CAPTION_OPT_INCLUDE_LIGHTING = settingsObject.CAPTION_OPT_INCLUDE_LIGHTING || 'false';
    settingsObject.CAPTION_OPT_INCLUDE_CAMERA_ANGLE = settingsObject.CAPTION_OPT_INCLUDE_CAMERA_ANGLE || 'false';
    settingsObject.CAPTION_OPT_INCLUDE_WATERMARK = settingsObject.CAPTION_OPT_INCLUDE_WATERMARK || 'false';
    settingsObject.CAPTION_OPT_INCLUDE_JPEG = settingsObject.CAPTION_OPT_INCLUDE_JPEG || 'false';
    settingsObject.CAPTION_OPT_INCLUDE_CAMERA_DETAILS = settingsObject.CAPTION_OPT_INCLUDE_CAMERA_DETAILS || 'false';
    settingsObject.CAPTION_OPT_NO_SEXUAL = settingsObject.CAPTION_OPT_NO_SEXUAL || 'false';
    settingsObject.CAPTION_OPT_NO_REAL_PEOPLE = settingsObject.CAPTION_OPT_NO_REAL_PEOPLE || 'false';
    settingsObject.CAPTION_OPT_ARTISTIC_PERSPECTIVE = settingsObject.CAPTION_OPT_ARTISTIC_PERSPECTIVE || 'false';
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
      CAPTION_USER_PROMPT,
      CAPTION_TRIGGER_WORD,
      CAPTION_MAX_TOKENS,
      CAPTION_ENDPOINT_TYPE,
      CAPTION_JOY_CAPTION_TYPE,
      CAPTION_JOY_CAPTION_LENGTH,
      CAPTION_JOY_LOW_VRAM,
      CAPTION_KEEP_LOADED,
      CAPTION_OPT_REFER_BY_NAME,
      CAPTION_OPT_EXCLUDE_UNCHANGEABLE,
      CAPTION_OPT_INCLUDE_LIGHTING,
      CAPTION_OPT_INCLUDE_CAMERA_ANGLE,
      CAPTION_OPT_INCLUDE_WATERMARK,
      CAPTION_OPT_INCLUDE_JPEG,
      CAPTION_OPT_INCLUDE_CAMERA_DETAILS,
      CAPTION_OPT_NO_SEXUAL,
      CAPTION_OPT_NO_REAL_PEOPLE,
      CAPTION_OPT_ARTISTIC_PERSPECTIVE,
    } = body;

    const keys = [
      { key: 'HF_TOKEN', value: HF_TOKEN ?? '' },
      { key: 'TRAINING_FOLDER', value: TRAINING_FOLDER ?? '' },
      { key: 'DATASETS_FOLDER', value: DATASETS_FOLDER ?? '' },
      { key: 'CAPTION_BASE_URL', value: CAPTION_BASE_URL ?? '' },
      { key: 'CAPTION_API_KEY', value: CAPTION_API_KEY ?? '' },
      { key: 'CAPTION_MODEL', value: CAPTION_MODEL ?? '' },
      { key: 'CAPTION_SYSTEM_PROMPT', value: CAPTION_SYSTEM_PROMPT ?? '' },
      { key: 'CAPTION_USER_PROMPT', value: CAPTION_USER_PROMPT ?? '' },
      { key: 'CAPTION_TRIGGER_WORD', value: CAPTION_TRIGGER_WORD ?? '' },
      { key: 'CAPTION_MAX_TOKENS', value: CAPTION_MAX_TOKENS ?? '512' },
      {
        key: 'CAPTION_ENDPOINT_TYPE',
        value: CAPTION_ENDPOINT_TYPE === 'joycaption' ? 'joycaption_local' : CAPTION_ENDPOINT_TYPE ?? 'joycaption_local',
      },
      { key: 'CAPTION_JOY_CAPTION_TYPE', value: CAPTION_JOY_CAPTION_TYPE ?? 'Descriptive' },
      { key: 'CAPTION_JOY_CAPTION_LENGTH', value: CAPTION_JOY_CAPTION_LENGTH ?? 'any' },
      { key: 'CAPTION_JOY_LOW_VRAM', value: CAPTION_JOY_LOW_VRAM ?? 'false' },
      { key: 'CAPTION_KEEP_LOADED', value: CAPTION_KEEP_LOADED ?? 'false' },
      { key: 'CAPTION_OPT_REFER_BY_NAME', value: CAPTION_OPT_REFER_BY_NAME ?? 'false' },
      { key: 'CAPTION_OPT_EXCLUDE_UNCHANGEABLE', value: CAPTION_OPT_EXCLUDE_UNCHANGEABLE ?? 'false' },
      { key: 'CAPTION_OPT_INCLUDE_LIGHTING', value: CAPTION_OPT_INCLUDE_LIGHTING ?? 'false' },
      { key: 'CAPTION_OPT_INCLUDE_CAMERA_ANGLE', value: CAPTION_OPT_INCLUDE_CAMERA_ANGLE ?? 'false' },
      { key: 'CAPTION_OPT_INCLUDE_WATERMARK', value: CAPTION_OPT_INCLUDE_WATERMARK ?? 'false' },
      { key: 'CAPTION_OPT_INCLUDE_JPEG', value: CAPTION_OPT_INCLUDE_JPEG ?? 'false' },
      { key: 'CAPTION_OPT_INCLUDE_CAMERA_DETAILS', value: CAPTION_OPT_INCLUDE_CAMERA_DETAILS ?? 'false' },
      { key: 'CAPTION_OPT_NO_SEXUAL', value: CAPTION_OPT_NO_SEXUAL ?? 'false' },
      { key: 'CAPTION_OPT_NO_REAL_PEOPLE', value: CAPTION_OPT_NO_REAL_PEOPLE ?? 'false' },
      { key: 'CAPTION_OPT_ARTISTIC_PERSPECTIVE', value: CAPTION_OPT_ARTISTIC_PERSPECTIVE ?? 'false' },
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
