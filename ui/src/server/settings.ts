import { PrismaClient } from '@prisma/client';
import { defaultDatasetsFolder, defaultDataRoot } from '@/paths';
import { defaultTrainFolder } from '@/paths';
import NodeCache from 'node-cache';

const myCache = new NodeCache();
const prisma = new PrismaClient();

export const flushCache = () => {
  myCache.flushAll();
};

export const getDatasetsRoot = async () => {
  const key = 'DATASETS_FOLDER';
  let datasetsPath = myCache.get(key) as string;
  if (datasetsPath) {
    return datasetsPath;
  }
  let row = await prisma.settings.findFirst({
    where: {
      key: 'DATASETS_FOLDER',
    },
  });
  datasetsPath = defaultDatasetsFolder;
  if (row?.value && row.value !== '') {
    datasetsPath = row.value;
  }
  myCache.set(key, datasetsPath);
  return datasetsPath as string;
};

export const getTrainingFolder = async () => {
  const key = 'TRAINING_FOLDER';
  let trainingRoot = myCache.get(key) as string;
  if (trainingRoot) {
    return trainingRoot;
  }
  let row = await prisma.settings.findFirst({
    where: {
      key: key,
    },
  });
  trainingRoot = defaultTrainFolder;
  if (row?.value && row.value !== '') {
    trainingRoot = row.value;
  }
  myCache.set(key, trainingRoot);
  return trainingRoot as string;
};

export const getHFToken = async () => {
  const key = 'HF_TOKEN';
  let token = myCache.get(key) as string;
  if (token) {
    return token;
  }
  let row = await prisma.settings.findFirst({
    where: {
      key: key,
    },
  });
  token = '';
  if (row?.value && row.value !== '') {
    token = row.value;
  }
  myCache.set(key, token);
  return token;
};

export const getCaptionSettings = async () => {
  const keys = [
    'CAPTION_BASE_URL',
    'CAPTION_API_KEY',
    'CAPTION_MODEL',
    'CAPTION_SYSTEM_PROMPT',
    'CAPTION_USER_PROMPT',
    'CAPTION_TRIGGER_WORD',
    'CAPTION_MAX_TOKENS',
    'CAPTION_ENDPOINT_TYPE',
    'CAPTION_JOY_CAPTION_TYPE',
    'CAPTION_JOY_CAPTION_LENGTH',
    'CAPTION_JOY_LOW_VRAM',
    'CAPTION_KEEP_LOADED',
    'CAPTION_OPT_REFER_BY_NAME',
    'CAPTION_OPT_EXCLUDE_UNCHANGEABLE',
    'CAPTION_OPT_INCLUDE_LIGHTING',
    'CAPTION_OPT_INCLUDE_CAMERA_ANGLE',
    'CAPTION_OPT_INCLUDE_WATERMARK',
    'CAPTION_OPT_INCLUDE_JPEG',
    'CAPTION_OPT_INCLUDE_CAMERA_DETAILS',
    'CAPTION_OPT_NO_SEXUAL',
    'CAPTION_OPT_NO_REAL_PEOPLE',
    'CAPTION_OPT_ARTISTIC_PERSPECTIVE',
  ];
  const rows = await prisma.settings.findMany({ where: { key: { in: keys } } });
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  const endpointType =
    map['CAPTION_ENDPOINT_TYPE'] === 'joycaption'
      ? 'joycaption_local'
      : map['CAPTION_ENDPOINT_TYPE'] || 'joycaption_local';
  const defaultModel =
    endpointType === 'joycaption_hf'
      ? 'fancyfeast/llama-joycaption-beta-one-hf-llava'
      : endpointType === 'joycaption_local'
        ? '/root/alvan-custom/joy-captioner'
        : '';
  return {
    baseUrl: map['CAPTION_BASE_URL'] || '',
    apiKey: map['CAPTION_API_KEY'] || '',
    model: map['CAPTION_MODEL'] || defaultModel,
    systemPrompt: map['CAPTION_SYSTEM_PROMPT'] || '',
    userPrompt: map['CAPTION_USER_PROMPT'] || '',
    triggerWord: map['CAPTION_TRIGGER_WORD'] || '',
    maxTokens: parseInt(map['CAPTION_MAX_TOKENS'] || '512') || 512,
    endpointType,
    joyCaptionType: map['CAPTION_JOY_CAPTION_TYPE'] || 'Descriptive',
    joyCaptionLength: map['CAPTION_JOY_CAPTION_LENGTH'] || 'any',
    joyLowVram: map['CAPTION_JOY_LOW_VRAM'] || 'false',
    keepJoyCaptionLoaded: map['CAPTION_KEEP_LOADED'] || 'false',
    optReferByName: map['CAPTION_OPT_REFER_BY_NAME'] || 'false',
    optExcludeUnchangeable: map['CAPTION_OPT_EXCLUDE_UNCHANGEABLE'] || 'false',
    optIncludeLighting: map['CAPTION_OPT_INCLUDE_LIGHTING'] || 'false',
    optIncludeCameraAngle: map['CAPTION_OPT_INCLUDE_CAMERA_ANGLE'] || 'false',
    optIncludeWatermark: map['CAPTION_OPT_INCLUDE_WATERMARK'] || 'false',
    optIncludeJpeg: map['CAPTION_OPT_INCLUDE_JPEG'] || 'false',
    optIncludeCameraDetails: map['CAPTION_OPT_INCLUDE_CAMERA_DETAILS'] || 'false',
    optNoSexual: map['CAPTION_OPT_NO_SEXUAL'] || 'false',
    optNoRealPeople: map['CAPTION_OPT_NO_REAL_PEOPLE'] || 'false',
    optArtisticPerspective: map['CAPTION_OPT_ARTISTIC_PERSPECTIVE'] || 'false',
  };
};

export const getDataRoot = async () => {
  const key = 'DATA_ROOT';
  let dataRoot = myCache.get(key) as string;
  if (dataRoot) {
    return dataRoot;
  }
  let row = await prisma.settings.findFirst({
    where: {
      key: key,
    },
  });
  dataRoot = defaultDataRoot;
  if (row?.value && row.value !== '') {
    dataRoot = row.value;
  }
  myCache.set(key, dataRoot);
  return dataRoot;
};
