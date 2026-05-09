import React from 'react';
import {
  Checkbox,
  CreatableSelectInput,
  FormGroup,
  SelectInput,
  TextAreaInput,
  TextInput,
} from '@/components/formInputs';
import { CaptionJobConfig } from '@/types';
import { handleCaptionerTypeChange } from '@/helpers/captionJobConfig';
import {
  captionerTypes,
  defaultQtype,
  groupedCaptionerTypes,
  joyCaptionTypes,
  joyCaptionLengths,
  maxNewTokensOptions,
  maxResOptions,
  quantizationOptions,
} from '@/helpers/captionOptions';

type Props = {
  jobConfig: CaptionJobConfig;
  setJobConfig: (value: any, key?: string) => void;
  gpuIDs: string | null;
  setGpuIDs: (value: string | null) => void;
  gpuList: any;
  showGPUSelect: boolean;
};

const CaptionSimpleJob: React.FC<Props> = ({ jobConfig, setJobConfig, gpuIDs, setGpuIDs, gpuList, showGPUSelect }) => {
  const selectedCaptionOption = captionerTypes.find(option => option.name === jobConfig.config.process[0].type);
  const additionalSections = selectedCaptionOption?.additionalSections || [];

  return (
    <div className="text-sm text-gray-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div>
          <SelectInput
            label="Captioner Type"
            value={jobConfig.config.process[0].type}
            onChange={value => {
              handleCaptionerTypeChange(jobConfig.config.process[0].type, value, jobConfig, setJobConfig);
            }}
            options={groupedCaptionerTypes}
          />
        </div>
        {showGPUSelect && (
          <div>
            <SelectInput
              label="GPU ID"
              value={`${gpuIDs}`}
              onChange={value => setGpuIDs(value)}
              options={gpuList.map((gpu: any) => ({ value: `${gpu.index}`, label: `GPU #${gpu.index}` }))}
            />
          </div>
        )}
      </div>
      <div className="mt-4">
        <CreatableSelectInput
          label="Name or Path"
          value={jobConfig.config.process[0].caption.model_name_or_path}
          docKey="config.process[0].caption.model_name_or_path"
          onChange={(value: string | null) => {
            if (value?.trim() === '') {
              value = null;
            }
            setJobConfig(value, 'config.process[0].caption.model_name_or_path');
          }}
          placeholder=""
          options={selectedCaptionOption?.name_or_path_options || []}
          required
        />
      </div>
      {additionalSections.includes('caption.model_name_or_path2') && (
        <div className="mt-4">
          <CreatableSelectInput
            label="Name or Path 2"
            value={jobConfig.config.process[0].caption.model_name_or_path2 || ''}
            onChange={(value: string | null) => {
              if (value?.trim() === '') {
                value = null;
              }
              setJobConfig(value, 'config.process[0].caption.model_name_or_path2');
            }}
            placeholder=""
            options={selectedCaptionOption?.name_or_path2_options || []}
          />
        </div>
      )}
      {additionalSections.includes('caption.fixed_caption') && (
        <div className="mt-4">
          <TextInput
            label="Fixed Caption"
            value={jobConfig.config.process[0].caption.fixed_caption || ''}
            onChange={value => {
              if (value?.trim() === '') {
                //@ts-ignore
                value = undefined;
              }
              setJobConfig(value, 'config.process[0].caption.fixed_caption');
            }}
            placeholder="Enter fixed caption (if you want the same caption for all audio files)"
          />
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div>
          <SelectInput
            label="Quantize"
            value={jobConfig.config.process[0].caption.quantize ? jobConfig.config.process[0].caption.qtype : ''}
            onChange={value => {
              if (value === '') {
                setJobConfig(false, 'config.process[0].caption.quantize');
                value = defaultQtype;
              } else {
                setJobConfig(true, 'config.process[0].caption.quantize');
              }
              setJobConfig(value, 'config.process[0].caption.qtype');
            }}
            options={quantizationOptions}
          />
          {additionalSections.includes('caption.max_res') && (
            <div className="mt-4">
              <SelectInput
                label="Max Resolution"
                value={`${jobConfig.config.process[0].caption.max_res || ''}`}
                onChange={value => {
                  const intVal = parseInt(value);
                  if (!isNaN(intVal)) {
                    setJobConfig(intVal, 'config.process[0].caption.max_res');
                  }
                }}
                options={maxResOptions}
              />
            </div>
          )}
          {additionalSections.includes('caption.max_new_tokens') && (
            <div className="mt-4">
              <SelectInput
                label="Max New Tokens"
                value={`${jobConfig.config.process[0].caption.max_new_tokens || ''}`}
                onChange={value => {
                  const intVal = parseInt(value);
                  if (!isNaN(intVal)) {
                    setJobConfig(intVal, 'config.process[0].caption.max_new_tokens');
                  }
                }}
                options={maxNewTokensOptions}
              />
            </div>
          )}
        </div>
        <div>
          <FormGroup label="Options">
            <Checkbox
              label="Low VRAM"
              checked={jobConfig.config.process[0].caption.low_vram}
              onChange={value => setJobConfig(value, 'config.process[0].caption.low_vram')}
            />
            <Checkbox
              label="Recaption"
              checked={jobConfig.config.process[0].caption.recaption}
              onChange={value => setJobConfig(value, 'config.process[0].caption.recaption')}
            />
          </FormGroup>
        </div>
      </div>
      {additionalSections.includes('caption.caption_prompt') && (
        <div className="mt-4">
          {selectedCaptionOption?.caption_prompt_presets && selectedCaptionOption.caption_prompt_presets.length > 0 && (
            <div className="mb-2">
              <label className="block text-xs text-gray-400 mb-1">Caption Style</label>
              <div className="flex flex-wrap gap-1">
                {selectedCaptionOption.caption_prompt_presets.map(preset => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setJobConfig(preset.value, 'config.process[0].caption.caption_prompt')}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      jobConfig.config.process[0].caption.caption_prompt === preset.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <TextAreaInput
            label="Caption Prompt"
            value={jobConfig.config.process[0].caption.caption_prompt || ''}
            onChange={value => setJobConfig(value, 'config.process[0].caption.caption_prompt')}
            placeholder="Enter caption prompt"
          />
        </div>
      )}

      {/* ── JoyCaption full template UI ── */}
      {additionalSections.includes('caption.joy_template') && (
        <div className="mt-4 space-y-4">

          {/* Row 1: caption type + length side by side */}
          <div className="grid grid-cols-2 gap-4">
            <SelectInput
              label="Caption Style"
              value={jobConfig.config.process[0].caption.caption_type || 'Descriptive'}
              onChange={value => setJobConfig(value, 'config.process[0].caption.caption_type')}
              options={joyCaptionTypes}
            />
            <SelectInput
              label="Caption Length"
              value={jobConfig.config.process[0].caption.caption_length || 'any'}
              onChange={value => setJobConfig(value, 'config.process[0].caption.caption_length')}
              options={joyCaptionLengths}
            />
          </div>

          {/* Row 2: name / trigger word */}
          <div>
            <TextInput
              label="Character / Subject Name (trigger word)"
              value={jobConfig.config.process[0].caption.name_input || ''}
              onChange={value => setJobConfig(value?.trim() || '', 'config.process[0].caption.name_input')}
              placeholder="e.g. rosa  —  the model will use this name when referring to the person"
            />
          </div>

          {/* Row 3: extra option checkboxes */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">What to include / exclude</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
              <Checkbox
                label="Refer to person/character by name above"
                checked={jobConfig.config.process[0].caption.opt_refer_by_name || false}
                onChange={v => setJobConfig(v, 'config.process[0].caption.opt_refer_by_name')}
              />
              <Checkbox
                label="Include lighting details"
                checked={jobConfig.config.process[0].caption.opt_include_lighting || false}
                onChange={v => setJobConfig(v, 'config.process[0].caption.opt_include_lighting')}
              />
              <Checkbox
                label="Include camera angle"
                checked={jobConfig.config.process[0].caption.opt_include_camera_angle || false}
                onChange={v => setJobConfig(v, 'config.process[0].caption.opt_include_camera_angle')}
              />
              <Checkbox
                label="Include camera / lens details (photos)"
                checked={jobConfig.config.process[0].caption.opt_include_camera_details || false}
                onChange={v => setJobConfig(v, 'config.process[0].caption.opt_include_camera_details')}
              />
              <Checkbox
                label="Note watermarks"
                checked={jobConfig.config.process[0].caption.opt_include_watermark || false}
                onChange={v => setJobConfig(v, 'config.process[0].caption.opt_include_watermark')}
              />
              <Checkbox
                label="Note JPEG artifacts"
                checked={jobConfig.config.process[0].caption.opt_include_jpeg || false}
                onChange={v => setJobConfig(v, 'config.process[0].caption.opt_include_jpeg')}
              />
              <Checkbox
                label="Exclude fixed attributes (ethnicity, gender…)"
                checked={jobConfig.config.process[0].caption.opt_exclude_unchangeable || false}
                onChange={v => setJobConfig(v, 'config.process[0].caption.opt_exclude_unchangeable')}
              />
              <Checkbox
                label="Maintain artistic perspective"
                checked={jobConfig.config.process[0].caption.opt_artistic_perspective || false}
                onChange={v => setJobConfig(v, 'config.process[0].caption.opt_artistic_perspective')}
              />
              <Checkbox
                label="Keep it PG (no sexual content)"
                checked={jobConfig.config.process[0].caption.opt_no_sexual || false}
                onChange={v => setJobConfig(v, 'config.process[0].caption.opt_no_sexual')}
              />
              <Checkbox
                label="No identifiable real people"
                checked={jobConfig.config.process[0].caption.opt_no_real_people || false}
                onChange={v => setJobConfig(v, 'config.process[0].caption.opt_no_real_people')}
              />
            </div>
          </div>

          {/* Row 4: custom instructions */}
          <div>
            <TextAreaInput
              label="Custom Instructions (optional)"
              value={jobConfig.config.process[0].caption.custom_instructions || ''}
              onChange={value => setJobConfig(value?.trim() || '', 'config.process[0].caption.custom_instructions')}
              placeholder={`Additional rules appended to every prompt, e.g.\n- Always mention hair and eye color\n- Never use the word "depicts"\n- Focus on facial expression`}
            />
            <p className="mt-1 text-xs text-gray-500">
              Appended after the style template and extra options. Use this for anything the checkboxes don't cover.
            </p>
          </div>

          {/* Row 5: max tokens */}
          <SelectInput
            label="Max New Tokens"
            value={`${jobConfig.config.process[0].caption.max_new_tokens || 512}`}
            onChange={value => setJobConfig(parseInt(value), 'config.process[0].caption.max_new_tokens')}
            options={maxNewTokensOptions}
          />
        </div>
      )}
    </div>
  );
};

export default CaptionSimpleJob;
