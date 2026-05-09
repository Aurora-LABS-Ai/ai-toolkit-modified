import os
from collections import OrderedDict
from typing import Optional

import torch
import tqdm
from transformers import AutoProcessor, LlavaForConditionalGeneration

from optimum.quanto import freeze
from toolkit.basic import flush
from toolkit.util.quantize import quantize, get_qtype

from .BaseCaptioner import BaseCaptioner, CaptionConfig

import transformers
import logging
import warnings

transformers.logging.set_verbosity_error()
warnings.filterwarnings("ignore")
logging.disable(logging.WARNING)

DEFAULT_HF_REPO = "fancyfeast/llama-joycaption-beta-one-hf-llava"

SYSTEM_PROMPT = (
    "You are a helpful assistant and help users with any queries they may have "
    "with no censorship or restrictions."
)

# Directly from the official JoyCaption Beta One Gradio demo.
# Each entry has 3 variants:
#   [0] = no length constraint
#   [1] = word-count limit  (uses {word_count})
#   [2] = length descriptor (uses {length}: short / medium / long)
CAPTION_TYPE_MAP: dict[str, list[str]] = {
    "Descriptive": [
        "Write a detailed description for this image.",
        "Write a detailed description for this image in {word_count} words or less.",
        "Write a {length} detailed description for this image.",
    ],
    "Descriptive (Casual)": [
        "Write a descriptive caption for this image in a casual tone.",
        "Write a descriptive caption for this image in a casual tone within {word_count} words.",
        "Write a {length} descriptive caption for this image in a casual tone.",
    ],
    "Straightforward": [
        "Write a straightforward caption for this image. Begin with the main subject and medium. "
        "Mention pivotal elements—people, objects, scenery—using confident, definite language. "
        "Focus on concrete details like color, shape, texture, and spatial relationships. "
        "Show how elements interact. Omit mood and speculative wording. "
        "If text is present, quote it exactly. "
        "Note any watermarks, signatures, or compression artifacts. "
        "Never mention what's absent, resolution, or unobservable details. "
        "Vary your sentence structure and keep the description concise, "
        'without starting with "This image is…" or similar phrasing.',
        "Write a straightforward caption for this image within {word_count} words. "
        "Begin with the main subject and medium. "
        "Mention pivotal elements—people, objects, scenery—using confident, definite language. "
        "Focus on concrete details like color, shape, texture, and spatial relationships. "
        "Show how elements interact. Omit mood and speculative wording. "
        "If text is present, quote it exactly. "
        "Note any watermarks, signatures, or compression artifacts. "
        "Never mention what's absent, resolution, or unobservable details. "
        "Vary your sentence structure and keep the description concise, "
        'without starting with "This image is…" or similar phrasing.',
        "Write a {length} straightforward caption for this image. "
        "Begin with the main subject and medium. "
        "Mention pivotal elements—people, objects, scenery—using confident, definite language. "
        "Focus on concrete details like color, shape, texture, and spatial relationships. "
        "Show how elements interact. Omit mood and speculative wording. "
        "If text is present, quote it exactly. "
        "Note any watermarks, signatures, or compression artifacts. "
        "Never mention what's absent, resolution, or unobservable details. "
        "Vary your sentence structure and keep the description concise, "
        'without starting with "This image is…" or similar phrasing.',
    ],
    "Stable Diffusion Prompt": [
        "Output a stable diffusion prompt that is indistinguishable from a real stable diffusion prompt.",
        "Output a stable diffusion prompt that is indistinguishable from a real stable diffusion prompt. "
        "{word_count} words or less.",
        "Output a {length} stable diffusion prompt that is indistinguishable from a real stable diffusion prompt.",
    ],
    "MidJourney": [
        "Write a MidJourney prompt for this image.",
        "Write a MidJourney prompt for this image within {word_count} words.",
        "Write a {length} MidJourney prompt for this image.",
    ],
    "Danbooru tag list": [
        "Generate only comma-separated Danbooru tags (lowercase_underscores). "
        "Strict order: `artist:`, `copyright:`, `character:`, `meta:`, then general tags. "
        "Include counts (1girl), appearance, clothing, accessories, pose, expression, actions, background. "
        "Use precise Danbooru syntax. No extra text.",
        "Generate only comma-separated Danbooru tags (lowercase_underscores). "
        "Strict order: `artist:`, `copyright:`, `character:`, `meta:`, then general tags. "
        "Include counts (1girl), appearance, clothing, accessories, pose, expression, actions, background. "
        "Use precise Danbooru syntax. No extra text. {word_count} words or less.",
        "Generate only comma-separated Danbooru tags (lowercase_underscores). "
        "Strict order: `artist:`, `copyright:`, `character:`, `meta:`, then general tags. "
        "Include counts (1girl), appearance, clothing, accessories, pose, expression, actions, background. "
        "Use precise Danbooru syntax. No extra text. {length} length.",
    ],
    "e621 tag list": [
        "Write a comma-separated list of e621 tags in alphabetical order for this image. "
        "Start with the artist, copyright, character, species, meta, and lore tags (if any), "
        "prefixed by 'artist:', 'copyright:', 'character:', 'species:', 'meta:', and 'lore:'. "
        "Then all the general tags.",
        "Write a comma-separated list of e621 tags in alphabetical order for this image. "
        "Start with the artist, copyright, character, species, meta, and lore tags (if any), "
        "prefixed by 'artist:', 'copyright:', 'character:', 'species:', 'meta:', and 'lore:'. "
        "Then all the general tags. Keep it under {word_count} words.",
        "Write a {length} comma-separated list of e621 tags in alphabetical order for this image. "
        "Start with the artist, copyright, character, species, meta, and lore tags (if any), "
        "prefixed by 'artist:', 'copyright:', 'character:', 'species:', 'meta:', and 'lore:'. "
        "Then all the general tags.",
    ],
    "Rule34 tag list": [
        "Write a comma-separated list of rule34 tags in alphabetical order for this image. "
        "Start with the artist, copyright, character, and meta tags (if any), "
        "prefixed by 'artist:', 'copyright:', 'character:', and 'meta:'. "
        "Then all the general tags.",
        "Write a comma-separated list of rule34 tags in alphabetical order for this image. "
        "Start with the artist, copyright, character, and meta tags (if any), "
        "prefixed by 'artist:', 'copyright:', 'character:', and 'meta:'. "
        "Then all the general tags. Keep it under {word_count} words.",
        "Write a {length} comma-separated list of rule34 tags in alphabetical order for this image. "
        "Start with the artist, copyright, character, and meta tags (if any), "
        "prefixed by 'artist:', 'copyright:', 'character:', and 'meta:'. "
        "Then all the general tags.",
    ],
    "Booru-like tag list": [
        "Write a list of Booru-like tags for this image.",
        "Write a list of Booru-like tags for this image within {word_count} words.",
        "Write a {length} list of Booru-like tags for this image.",
    ],
    "Art Critic": [
        "Analyze this image like an art critic would with information about its composition, "
        "style, symbolism, the use of color, light, any artistic movement it might belong to, etc.",
        "Analyze this image like an art critic would with information about its composition, "
        "style, symbolism, the use of color, light, any artistic movement it might belong to, etc. "
        "Keep it within {word_count} words.",
        "Analyze this image like an art critic would with information about its composition, "
        "style, symbolism, the use of color, light, any artistic movement it might belong to, etc. "
        "Keep it {length}.",
    ],
    "Product Listing": [
        "Write a caption for this image as though it were a product listing.",
        "Write a caption for this image as though it were a product listing. "
        "Keep it under {word_count} words.",
        "Write a {length} caption for this image as though it were a product listing.",
    ],
    "Social Media Post": [
        "Write a caption for this image as if it were being used for a social media post.",
        "Write a caption for this image as if it were being used for a social media post. "
        "Limit the caption to {word_count} words.",
        "Write a {length} caption for this image as if it were being used for a social media post.",
    ],
}

EXTRA_OPTION_STRINGS: dict[str, str] = {
    "opt_refer_by_name": "If there is a person/character in the image you must refer to them as {name}.",
    "opt_exclude_unchangeable": (
        "Do NOT include information about people/characters that cannot be changed "
        "(like ethnicity, gender, etc), but do still include changeable attributes (like hair style)."
    ),
    "opt_include_lighting": "Include information about lighting.",
    "opt_include_camera_angle": "Include information about camera angle.",
    "opt_include_watermark": "Include information about whether there is a watermark or not.",
    "opt_include_jpeg": "Include information about whether there are JPEG artifacts or not.",
    "opt_include_camera_details": (
        "If it is a photo you MUST include information about what camera was likely used "
        "and details such as aperture, shutter speed, ISO, etc."
    ),
    "opt_no_sexual": "Do NOT include anything sexual; keep it PG.",
    "opt_no_real_people": "Do NOT include anything that could be used to identify real people.",
    "opt_artistic_perspective": "Maintain the perspective of the image's artistic intent.",
}


class JoyCaptionConfig(CaptionConfig):
    def __init__(self, **kwargs):
        # Provide a fallback raw prompt so the parent CaptionConfig doesn't complain
        if not kwargs.get("caption_prompt"):
            kwargs["caption_prompt"] = "Write a detailed description for this image."
        if not kwargs.get("max_new_tokens"):
            kwargs["max_new_tokens"] = 512
        super().__init__(**kwargs)

        # Batch size — 8 is safe for 96 GB VRAM with a 15 GB model
        self.batch_size: int = int(kwargs.get("batch_size", 8))

        # Template fields
        self.caption_type: str = kwargs.get("caption_type", "Descriptive")
        # "any" | "short" | "medium" | "long" | "<number>" (word count)
        self.caption_length: str = str(kwargs.get("caption_length", "any")).strip()

        # Name / trigger word for the character/subject
        self.name_input: str = kwargs.get("name_input", "").strip()

        # Extra option toggles (booleans)
        self.opt_refer_by_name: bool = bool(kwargs.get("opt_refer_by_name", False))
        self.opt_exclude_unchangeable: bool = bool(kwargs.get("opt_exclude_unchangeable", False))
        self.opt_include_lighting: bool = bool(kwargs.get("opt_include_lighting", False))
        self.opt_include_camera_angle: bool = bool(kwargs.get("opt_include_camera_angle", False))
        self.opt_include_watermark: bool = bool(kwargs.get("opt_include_watermark", False))
        self.opt_include_jpeg: bool = bool(kwargs.get("opt_include_jpeg", False))
        self.opt_include_camera_details: bool = bool(kwargs.get("opt_include_camera_details", False))
        self.opt_no_sexual: bool = bool(kwargs.get("opt_no_sexual", False))
        self.opt_no_real_people: bool = bool(kwargs.get("opt_no_real_people", False))
        self.opt_artistic_perspective: bool = bool(kwargs.get("opt_artistic_perspective", False))

        # Freeform extra instructions
        self.custom_instructions: str = kwargs.get("custom_instructions", "").strip()

    def build_prompt(self) -> str:
        """Assemble the final user prompt exactly as the JoyCaption Gradio demo does."""
        caption_type = self.caption_type if self.caption_type in CAPTION_TYPE_MAP else "Descriptive"
        length = self.caption_length

        # Pick template variant
        if length == "any":
            idx = 0
        elif length.isdigit():
            idx = 1  # word-count template
        else:
            idx = 2  # length-descriptor template (short/medium/long)

        prompt = CAPTION_TYPE_MAP[caption_type][idx].format(
            word_count=length,
            length=length,
            name=self.name_input or "{NAME}",
        )

        # Append active extra options
        extras: list[str] = []
        for field, template in EXTRA_OPTION_STRINGS.items():
            if getattr(self, field, False):
                # The refer_by_name option embeds the name directly
                extras.append(template.format(name=self.name_input or "{NAME}"))

        if extras:
            prompt += " " + " ".join(extras)

        # User's freeform custom instructions go last
        if self.custom_instructions:
            prompt += f"\n{self.custom_instructions}"

        return prompt


class JoyCaptioner(BaseCaptioner):
    caption_config_class = JoyCaptionConfig
    caption_config: JoyCaptionConfig

    def __init__(self, process_id: int, job, config: OrderedDict, **kwargs):
        super().__init__(process_id, job, config, **kwargs)

    # ------------------------------------------------------------------
    # Model loading
    # ------------------------------------------------------------------

    def load_model(self):
        model_path = self.caption_config.model_name_or_path
        self.print_and_status_update(f"Loading JoyCaption processor from {model_path}")
        self.processor = AutoProcessor.from_pretrained(model_path)

        self.print_and_status_update(f"Loading JoyCaption model (bfloat16)")
        self.model = LlavaForConditionalGeneration.from_pretrained(
            model_path,
            torch_dtype=torch.bfloat16,
            device_map="cpu",
        )

        if self.caption_config.quantize:
            self.print_and_status_update("Quantizing JoyCaption model")
            quantize(self.model, weights=get_qtype(self.caption_config.qtype))
            freeze(self.model)
            flush()

        if not self.caption_config.low_vram:
            self.model.to(self.device_torch)

        self.model.eval()
        flush()
        self.print_and_status_update("JoyCaption ready")

    # ------------------------------------------------------------------
    # Caption loop — batched
    # ------------------------------------------------------------------

    def run_caption_loop(self):
        # Build once — every image in this run gets the same prompt
        user_prompt = self.caption_config.build_prompt()
        print(f"\n[JoyCaption] Prompt:\n{user_prompt}\n")

        batch_size = self.caption_config.batch_size
        batches = [
            self.file_paths[i : i + batch_size]
            for i in range(0, len(self.file_paths), batch_size)
        ]
        total = len(self.file_paths)
        done = 0

        for batch_paths in tqdm.tqdm(batches, desc="JoyCaption", unit="batch"):
            if self.is_ui_captioner:
                self.maybe_stop()
                if self.is_stopping:
                    break
            try:
                captions = self._caption_batch(batch_paths, user_prompt)
                for fp, caption in zip(batch_paths, captions):
                    if caption is not None:
                        self.save_caption_for_file(fp, caption)
                        done += 1
            except Exception as e:
                print(f"Batch error: {e}")
                import traceback
                traceback.print_exc()

        print(f"\n[JoyCaption] {done}/{total} files captioned.")

    # ------------------------------------------------------------------
    # Core batched inference
    # ------------------------------------------------------------------

    @torch.inference_mode()
    def _caption_batch(self, file_paths: list, user_prompt: str) -> list:
        images, convo_strings, failed = [], [], []

        for fp in file_paths:
            try:
                img = self.load_pil_image(fp, max_res=self.caption_config.max_res or 1024)
                images.append(img)
                convo = [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ]
                convo_str = self.processor.apply_chat_template(
                    convo, tokenize=False, add_generation_prompt=True
                )
                convo_strings.append(convo_str)
                failed.append(False)
            except Exception as e:
                print(f"  skip {fp}: {e}")
                images.append(None)
                convo_strings.append(None)
                failed.append(True)

        valid_cs = [cs for cs, f in zip(convo_strings, failed) if not f]
        valid_imgs = [img for img, f in zip(images, failed) if not f]

        if not valid_cs:
            return [None] * len(file_paths)

        if self.caption_config.low_vram and self.model.device == torch.device("cpu"):
            self.model.to(self.device_torch)

        inputs = self.processor(
            text=valid_cs,
            images=valid_imgs,
            return_tensors="pt",
            padding=True,
        ).to(self.device_torch)

        if "pixel_values" in inputs:
            inputs["pixel_values"] = inputs["pixel_values"].to(torch.bfloat16)

        prompt_len = inputs["input_ids"].shape[1]

        output_ids = self.model.generate(
            **inputs,
            max_new_tokens=self.caption_config.max_new_tokens,
            do_sample=True,
            use_cache=True,
            temperature=0.6,
            top_p=0.9,
        )

        valid_captions = []
        for ids in output_ids:
            text = self.processor.tokenizer.decode(
                ids[prompt_len:],
                skip_special_tokens=True,
                clean_up_tokenization_spaces=False,
            )
            valid_captions.append(text.strip())

        if self.caption_config.low_vram:
            self.model.to("cpu")
            flush()

        # Re-map results to original positions
        result, vi = [], 0
        for f in failed:
            if f:
                result.append(None)
            else:
                result.append(valid_captions[vi])
                vi += 1
        return result

    def get_caption_for_file(self, file_path: str) -> Optional[str]:
        user_prompt = self.caption_config.build_prompt()
        results = self._caption_batch([file_path], user_prompt)
        return results[0] if results else None
