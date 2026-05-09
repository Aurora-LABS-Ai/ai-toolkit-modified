#!/usr/bin/env python3
import json
import os
import sys
import traceback

import torch
from PIL import Image
from transformers import AutoProcessor, LlavaForConditionalGeneration

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from extensions_built_in.captioner.JoyCaptioner import JoyCaptionConfig, SYSTEM_PROMPT  # noqa: E402
from toolkit.basic import flush  # noqa: E402

processor = None
model = None
caption_config = None
loaded_key = None


def load_pil_image(file_path: str, max_res: int | None = None) -> Image.Image:
    image = Image.open(file_path).convert("RGB")
    if max_res is not None:
        max_pixels = max_res * max_res
        image_pixels = image.width * image.height
        if image_pixels > max_pixels:
            scale_factor = (max_pixels / image_pixels) ** 0.5
            new_width = int(image.width * scale_factor)
            new_height = int(image.height * scale_factor)
            image = image.resize((new_width, new_height), resample=Image.BICUBIC)
    return image


def build_config(data: dict) -> JoyCaptionConfig:
    image_path = data.get("image_path") or os.getcwd()
    return JoyCaptionConfig(
        model_name_or_path=data["model_name_or_path"],
        path_to_caption=os.path.dirname(image_path),
        extensions=["jpg", "jpeg", "png", "bmp", "webp"],
        device=data.get("device") or ("cuda" if torch.cuda.is_available() else "cpu"),
        dtype="bf16",
        quantize=False,
        low_vram=bool(data.get("low_vram", False)),
        max_res=int(data.get("max_res") or 1024),
        max_new_tokens=int(data.get("max_new_tokens") or 512),
        caption_type=data.get("caption_type") or "Descriptive",
        caption_length=data.get("caption_length") or "any",
        name_input=data.get("trigger_word") or "",
        custom_instructions=data.get("custom_instructions") or "",
        opt_refer_by_name=bool(data.get("opt_refer_by_name", False)),
        opt_exclude_unchangeable=bool(data.get("opt_exclude_unchangeable", False)),
        opt_include_lighting=bool(data.get("opt_include_lighting", False)),
        opt_include_camera_angle=bool(data.get("opt_include_camera_angle", False)),
        opt_include_watermark=bool(data.get("opt_include_watermark", False)),
        opt_include_jpeg=bool(data.get("opt_include_jpeg", False)),
        opt_include_camera_details=bool(data.get("opt_include_camera_details", False)),
        opt_no_sexual=bool(data.get("opt_no_sexual", False)),
        opt_no_real_people=bool(data.get("opt_no_real_people", False)),
        opt_artistic_perspective=bool(data.get("opt_artistic_perspective", False)),
    )


def config_key(data: dict) -> str:
    keep = {
        key: data.get(key)
        for key in [
            "model_name_or_path",
            "device",
            "low_vram",
            "max_res",
            "max_new_tokens",
            "caption_type",
            "caption_length",
            "trigger_word",
            "custom_instructions",
            "opt_refer_by_name",
            "opt_exclude_unchangeable",
            "opt_include_lighting",
            "opt_include_camera_angle",
            "opt_include_watermark",
            "opt_include_jpeg",
            "opt_include_camera_details",
            "opt_no_sexual",
            "opt_no_real_people",
            "opt_artistic_perspective",
        ]
    }
    return json.dumps(keep, sort_keys=True)


def unload_model():
    global processor, model, caption_config, loaded_key
    if model is not None:
        model.to("cpu")
    processor = None
    model = None
    caption_config = None
    loaded_key = None
    flush()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


def load_model(data: dict):
    global processor, model, caption_config, loaded_key
    next_key = config_key(data)
    if model is not None and loaded_key == next_key:
        return
    unload_model()
    caption_config = build_config(data)
    processor = AutoProcessor.from_pretrained(caption_config.model_name_or_path)
    if processor.tokenizer.pad_token is None:
        processor.tokenizer.pad_token = processor.tokenizer.eos_token
    model = LlavaForConditionalGeneration.from_pretrained(
        caption_config.model_name_or_path,
        torch_dtype=torch.bfloat16,
        device_map="cpu",
    ).eval()
    if not caption_config.low_vram:
        model.to(torch.device(caption_config.device))
    loaded_key = next_key
    flush()


@torch.inference_mode()
def caption_image(data: dict) -> dict:
    if model is None or processor is None or caption_config is None:
        load_model(data)

    image_path = data["image_path"]
    caption_path = os.path.splitext(image_path)[0] + ".txt"
    prompt = caption_config.build_prompt()
    image = load_pil_image(image_path, max_res=caption_config.max_res)
    convo = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]
    convo_str = processor.apply_chat_template(convo, tokenize=False, add_generation_prompt=True)
    target_device = torch.device(caption_config.device)
    if caption_config.low_vram and model.device == torch.device("cpu"):
        model.to(target_device)

    inputs = processor(text=[convo_str], images=[image], return_tensors="pt").to(target_device)
    if "pixel_values" in inputs:
        inputs["pixel_values"] = inputs["pixel_values"].to(torch.bfloat16)

    prompt_len = inputs["input_ids"].shape[1]
    output_ids = model.generate(
        **inputs,
        max_new_tokens=caption_config.max_new_tokens,
        do_sample=True,
        suppress_tokens=None,
        use_cache=True,
        temperature=0.6,
        top_k=None,
        top_p=0.9,
    )
    caption = processor.tokenizer.decode(
        output_ids[0][prompt_len:],
        skip_special_tokens=True,
        clean_up_tokenization_spaces=False,
    ).strip()

    with open(caption_path, "w", encoding="utf-8") as f:
        f.write(caption)

    if caption_config.low_vram:
        model.to("cpu")
        flush()

    return {"caption": caption, "captionPath": caption_path}


def respond(message: dict):
    print(json.dumps(message), flush=True)


def main():
    respond({"ready": True})
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        request_id = None
        try:
            request = json.loads(line)
            request_id = request.get("id")
            command = request.get("command")
            data = request.get("payload") or {}
            if command == "load":
                load_model(data)
                respond({"id": request_id, "ok": True, "status": "loaded"})
            elif command == "caption":
                load_model(data)
                result = caption_image(data)
                respond({"id": request_id, "ok": True, **result})
            elif command == "unload":
                unload_model()
                respond({"id": request_id, "ok": True, "status": "unloaded"})
            elif command == "status":
                respond({"id": request_id, "ok": True, "loaded": model is not None})
            elif command == "shutdown":
                unload_model()
                respond({"id": request_id, "ok": True, "status": "shutdown"})
                break
            else:
                respond({"id": request_id, "ok": False, "error": f"Unknown command: {command}"})
        except Exception as exc:
            respond({
                "id": request_id,
                "ok": False,
                "error": str(exc),
                "traceback": traceback.format_exc(),
            })
    unload_model()


if __name__ == "__main__":
    main()
