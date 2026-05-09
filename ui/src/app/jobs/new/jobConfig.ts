'use client';
import { isMac } from '@/helpers/basic';
import { defaultSampleConfig } from '@/helpers/defaultSamples';
import { JobConfig, SampleConfig, DatasetConfig, SliderConfig } from '@/types';

export const defaultDatasetConfig: DatasetConfig = {
  folder_path: '/path/to/images/folder',
  mask_path: null,
  mask_min_value: 0.1,
  default_caption: '',
  caption_ext: 'txt',
  caption_dropout_rate: 0.05,
  cache_latents_to_disk: false,
  is_reg: false,
  network_weight: 1,
  resolution: [512, 768, 1024],
  controls: [],
  shrink_video_to_frames: true,
  num_frames: 1,
  flip_x: false,
  flip_y: false,
  num_repeats: 1,
};

export const defaultSliderConfig: SliderConfig = {
  guidance_strength: 3.0,
  anchor_strength: 1.0,
  positive_prompt: 'person who is happy',
  negative_prompt: 'person who is sad',
  target_class: 'person',
  anchor_class: '',
};

export const defaultJobConfig: JobConfig = {
  job: 'extension',
  config: {
    name: 'my_first_lora_v1',
    process: [
      {
        type: 'diffusion_trainer',
        training_folder: 'output',
        sqlite_db_path: './aitk_db.db',
        device: 'cuda',
        trigger_word: null,
        performance_log_every: 10,
        network: {
          type: 'lora',
          linear: 32,
          linear_alpha: 32,
          conv: 16,
          conv_alpha: 16,
          lokr_full_rank: true,
          lokr_factor: -1,
          network_kwargs: {
            ignore_if_contains: [],
          },
        },
        save: {
          dtype: 'bf16',
          save_every: 250,
          max_step_saves_to_keep: 4,
          save_format: 'diffusers',
          push_to_hub: false,
        },
        datasets: [defaultDatasetConfig],
        train: {
          batch_size: 1,
          bypass_guidance_embedding: true,
          steps: 3000,
          gradient_accumulation: 1,
          train_unet: true,
          train_text_encoder: false,
          gradient_checkpointing: true,
          noise_scheduler: 'flowmatch',
          optimizer: 'adamw8bit',
          timestep_type: 'sigmoid',
          content_or_style: 'balanced',
          optimizer_params: {
            weight_decay: 1e-4,
          },
          unload_text_encoder: false,
          cache_text_embeddings: false,
          lr: 0.0001,
          ema_config: {
            use_ema: false,
            ema_decay: 0.99,
          },
          skip_first_sample: false,
          force_first_sample: false,
          disable_sampling: false,
          dtype: 'bf16',
          diff_output_preservation: false,
          diff_output_preservation_multiplier: 1.0,
          diff_output_preservation_class: 'person',
          switch_boundary_every: 1,
          loss_type: 'mse',
        },
        logging: {
          log_every: 1,
          use_ui_logger: true,
        },
        model: {
          name_or_path: 'ostris/Flex.1-alpha',
          quantize: true,
          qtype: 'qfloat8',
          quantize_te: true,
          qtype_te: 'qfloat8',
          arch: 'flex1',
          low_vram: false,
          model_kwargs: {},
        },
        sample: defaultSampleConfig,
      },
    ],
  },
  meta: {
    name: '[name]',
    version: '1.0',
  },
};

export const migrateJobConfig = (jobConfig: JobConfig): JobConfig => {
  // upgrade prompt strings to samples
  if (
    jobConfig?.config?.process &&
    jobConfig.config.process[0]?.sample &&
    Array.isArray(jobConfig.config.process[0].sample.prompts) &&
    jobConfig.config.process[0].sample.prompts.length > 0
  ) {
    let newSamples = [];
    for (const prompt of jobConfig.config.process[0].sample.prompts) {
      newSamples.push({
        prompt: prompt,
      });
    }
    jobConfig.config.process[0].sample.samples = newSamples;
    delete jobConfig.config.process[0].sample.prompts;
  }

  // upgrade job from ui_trainer to diffusion_trainer
  if (jobConfig?.config?.process && jobConfig.config.process[0]?.type === 'ui_trainer') {
    jobConfig.config.process[0].type = 'diffusion_trainer';
  }

  if ('auto_memory' in jobConfig.config.process[0].model) {
    jobConfig.config.process[0].model.layer_offloading = (jobConfig.config.process[0].model.auto_memory ||
      false) as boolean;
    delete jobConfig.config.process[0].model.auto_memory;
  }

  if (!('logging' in jobConfig.config.process[0])) {
    //@ts-ignore
    jobConfig.config.process[0].logging = {
      log_every: 1,
      use_ui_logger: true,
    };
  }
  if (isMac()) {
    jobConfig.config.process[0].device = 'mps';
  }

  // Ensure every train field SimpleJob reads exists so no config can crash the form
  const train = jobConfig.config.process[0].train as any;
  if (train) {
    if (train.optimizer_params === undefined) train.optimizer_params = { weight_decay: 0 };
    if (train.timestep_type === undefined) train.timestep_type = 'sigmoid';
    if (train.content_or_style === undefined) train.content_or_style = 'balanced';
    if (train.loss_type === undefined) train.loss_type = 'mse';
    if (train.ema_config === undefined) train.ema_config = { use_ema: false, ema_decay: 0.99 };
    if (train.skip_first_sample === undefined) train.skip_first_sample = false;
    if (train.force_first_sample === undefined) train.force_first_sample = false;
    if (train.disable_sampling === undefined) train.disable_sampling = false;
    if (train.diff_output_preservation === undefined) train.diff_output_preservation = false;
    if (train.diff_output_preservation_multiplier === undefined) train.diff_output_preservation_multiplier = 1.0;
    if (train.diff_output_preservation_class === undefined) train.diff_output_preservation_class = 'person';
    if (train.unload_text_encoder === undefined) train.unload_text_encoder = false;
    if (train.cache_text_embeddings === undefined) train.cache_text_embeddings = false;
    if (train.batch_size === undefined) train.batch_size = 1;
    if (train.gradient_accumulation === undefined) train.gradient_accumulation = 1;
    if (train.steps === undefined) train.steps = 3000;
    if (train.optimizer === undefined) train.optimizer = 'adamw8bit';
    if (train.lr === undefined) train.lr = 0.0001;
    if (train.switch_boundary_every === undefined) train.switch_boundary_every = 1;
  }

  // Ensure network exists for LoRA modes (safe default if missing)
  if (!jobConfig.config.process[0].network && jobConfig.config.process[0].type !== 'sd_trainer') {
    (jobConfig.config.process[0] as any).network = {
      type: 'lora',
      linear: 32,
      linear_alpha: 32,
      conv: 16,
      conv_alpha: 16,
      lokr_full_rank: true,
      lokr_factor: -1,
      network_kwargs: { ignore_if_contains: [] },
    };
  }

  // Ensure sample exists
  const sample = jobConfig.config.process[0].sample as any;
  if (sample) {
    if (!sample.samples) sample.samples = [];
    if (sample.seed === undefined) sample.seed = 42;
    if (sample.walk_seed === undefined) sample.walk_seed = true;
    if (sample.width === undefined) sample.width = 1024;
    if (sample.height === undefined) sample.height = 1024;
    if (sample.guidance_scale === undefined) sample.guidance_scale = 3.5;
    if (sample.sample_steps === undefined) sample.sample_steps = 25;
    if (sample.sample_every === undefined) sample.sample_every = 250;
    if (sample.sampler === undefined) sample.sampler = 'flowmatch';
  }

  return jobConfig;
};
