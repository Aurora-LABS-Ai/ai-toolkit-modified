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
  const keys = ['CAPTION_BASE_URL', 'CAPTION_API_KEY', 'CAPTION_MODEL', 'CAPTION_SYSTEM_PROMPT'];
  const rows = await prisma.settings.findMany({ where: { key: { in: keys } } });
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return {
    baseUrl: map['CAPTION_BASE_URL'] || '',
    apiKey: map['CAPTION_API_KEY'] || '',
    model: map['CAPTION_MODEL'] || '',
    systemPrompt: map['CAPTION_SYSTEM_PROMPT'] || '',
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
