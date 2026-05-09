import { GroupedSelectOption, SelectOption } from "@/types";

type CaptionGroup = 'image' | 'music';
type AdditionalSections =
  | 'caption.model_name_or_path2'
  | 'caption.caption_prompt'
  | 'caption.max_res'
  | 'caption.max_new_tokens'
  | 'caption.fixed_caption'
  | 'caption.trigger_words'
  | 'caption.custom_instructions'
  | 'caption.joy_template';

export interface CaptionOption {
    name: string;
    label: string;
    group: CaptionGroup;
    hasMultiLinePrompts?: boolean;
    caption_prompt_presets?: SelectOption[];
    defaults?: { [key: string]: any };
    additionalSections?: AdditionalSections[];
    name_or_path_options?: SelectOption[];
    name_or_path2_options?: SelectOption[];
}

const defaultNameOrPath = '';

const extensionsAudio = ['mp3', 'wav', 'flac', 'ogg'];
const extensionsImage = ['jpg', 'jpeg', 'png', 'bmp', 'webp'];

const defaultExtensions = [...extensionsImage];

const defaultImageCaptionPrompt = "Caption this image as if you were going to try to generate it with an image generator. Be thurough and describe everything in the image. Be decisive by stating things as they are. Do not say things like \"It appears that\" Or \"possibly\". Start out with things like \"A person on the beach\" or \"A black dragon\". No preamble. Just get to the point.";

export const joyCaptionTypes: SelectOption[] = [
    { value: 'Descriptive', label: 'Descriptive' },
    { value: 'Descriptive (Casual)', label: 'Descriptive (Casual)' },
    { value: 'Straightforward', label: 'Straightforward' },
    { value: 'Stable Diffusion Prompt', label: 'Stable Diffusion Prompt' },
    { value: 'MidJourney', label: 'MidJourney' },
    { value: 'Danbooru tag list', label: 'Danbooru tag list' },
    { value: 'e621 tag list', label: 'e621 tag list' },
    { value: 'Rule34 tag list', label: 'Rule34 tag list' },
    { value: 'Booru-like tag list', label: 'Booru-like tag list' },
    { value: 'Art Critic', label: 'Art Critic' },
    { value: 'Product Listing', label: 'Product Listing' },
    { value: 'Social Media Post', label: 'Social Media Post' },
];

export const joyCaptionLengths: SelectOption[] = [
    { value: 'any', label: 'Any length' },
    { value: 'short', label: 'Short' },
    { value: 'medium', label: 'Medium' },
    { value: 'long', label: 'Long' },
    { value: '100', label: '≤ 100 words' },
    { value: '200', label: '≤ 200 words' },
    { value: '300', label: '≤ 300 words' },
    { value: '400', label: '≤ 400 words' },
];

export const captionerTypes: CaptionOption[] = [
    {
        name: 'AceStepCaptioner',
        label: 'Ace Step',
        group: 'music',
        defaults: {
            'config.process[0].caption.model_name_or_path': ['ACE-Step/acestep-transcriber', defaultNameOrPath],
            'config.process[0].caption.model_name_or_path2': ['ACE-Step/acestep-captioner', undefined],
            'config.process[0].caption.extensions': [extensionsAudio, defaultExtensions],
        },
        name_or_path_options: [
            { value: 'ACE-Step/acestep-transcriber', label: 'ACE-Step/acestep-transcriber' },
        ],
        name_or_path2_options: [
            { value: 'ACE-Step/acestep-captioner', label: 'ACE-Step/acestep-captioner' },
        ],
        additionalSections: [
            'caption.model_name_or_path2',
            'caption.fixed_caption',
        ],
    },
    {
        name: 'JoyCaptioner',
        label: 'JoyCaption Beta One',
        group: 'image',
        defaults: {
            'config.process[0].caption.model_name_or_path': ['fancyfeast/llama-joycaption-beta-one-hf-llava', defaultNameOrPath],
            'config.process[0].caption.extensions': [extensionsImage, defaultExtensions],
            'config.process[0].caption.caption_type': ['Descriptive', undefined],
            'config.process[0].caption.caption_length': ['any', undefined],
            'config.process[0].caption.max_new_tokens': [512, undefined],
        },
        name_or_path_options: [
            { value: 'fancyfeast/llama-joycaption-beta-one-hf-llava', label: 'HF: joycaption-beta-one (auto download)' },
            { value: '/root/alvan-custom/joy-captioner', label: 'Local: /root/alvan-custom/joy-captioner' },
        ],
        additionalSections: ['caption.joy_template'],
    },
    {
        name: 'Qwen3VLCaptioner',
        label: 'Qwen3-VL',
        group: 'image',
        defaults: {
            'config.process[0].caption.model_name_or_path': ['Qwen/Qwen3-VL-8B-Instruct', defaultNameOrPath],
            'config.process[0].caption.extensions': [extensionsImage, defaultExtensions],
            'config.process[0].caption.caption_prompt': [defaultImageCaptionPrompt, undefined],
            'config.process[0].caption.max_res': [512, undefined],
            'config.process[0].caption.max_new_tokens': [128, undefined],

        },
        name_or_path_options: [
            { value: 'Qwen/Qwen3-VL-2B-Instruct', label: 'Qwen/Qwen3-VL-2B-Instruct' },
            { value: 'Qwen/Qwen3-VL-4B-Instruct', label: 'Qwen/Qwen3-VL-4B-Instruct' },
            { value: 'Qwen/Qwen3-VL-8B-Instruct', label: 'Qwen/Qwen3-VL-8B-Instruct' },
            { value: 'Qwen/Qwen3-VL-30B-A3B-Instruct', label: 'Qwen/Qwen3-VL-30B-A3B-Instruct' },
        ],
        additionalSections: [
            'caption.caption_prompt',
            'caption.max_res',
            'caption.max_new_tokens',
        ],
    },

].sort((a, b) => {
    // Sort by label, case-insensitive
    return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
}) as any;

export const groupedCaptionerTypes: GroupedSelectOption[] = captionerTypes.reduce((acc, arch) => {
    const group = acc.find(g => g.label === arch.group);
    if (group) {
        group.options.push({ value: arch.name, label: arch.label });
    } else {
        acc.push({
            label: arch.group,
            options: [{ value: arch.name, label: arch.label }],
        });
    }
    return acc;
}, [] as GroupedSelectOption[]);

export const quantizationOptions: SelectOption[] = [
    { value: '', label: '- NONE -' },
    { value: 'float8', label: 'float8 (default)' },
    { value: 'uint7', label: '7 bit' },
    { value: 'uint6', label: '6 bit' },
    { value: 'uint5', label: '5 bit' },
    { value: 'uint4', label: '4 bit' },
    { value: 'uint3', label: '3 bit' },
    { value: 'uint2', label: '2 bit' },
];

export const maxResOptions: SelectOption[] = [
    { value: '256', label: '256' },
    { value: '512', label: '512 (default)' },
    { value: '768', label: '768' },
    { value: '1024', label: '1024' },
];
export const maxNewTokensOptions: SelectOption[] = [
    { value: '64', label: '64' },
    { value: '128', label: '128 (default)' },
    { value: '256', label: '256' },
    { value: '512', label: '512' },
    { value: '1024', label: '1024' },
];

export const defaultQtype = 'float8';