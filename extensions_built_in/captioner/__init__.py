from toolkit.extension import Extension


class AceStepCaptionerExtension(Extension):
    uid = "AceStepCaptioner"
    name = "Ace Step Captioner"

    @classmethod
    def get_process(cls):
        from .AceStepCaptioner import AceStepCaptioner
        return AceStepCaptioner


class Qwen3VLCaptionerExtension(Extension):
    uid = "Qwen3VLCaptioner"
    name = "Qwen 3VL Captioner"

    @classmethod
    def get_process(cls):
        from .Qwen3VLCaptioner import Qwen3VLCaptioner
        return Qwen3VLCaptioner


class JoyCaptionerExtension(Extension):
    uid = "JoyCaptioner"
    name = "JoyCaption Beta One"

    @classmethod
    def get_process(cls):
        from .JoyCaptioner import JoyCaptioner
        return JoyCaptioner


AI_TOOLKIT_EXTENSIONS = [
    AceStepCaptionerExtension,
    JoyCaptionerExtension,
    Qwen3VLCaptionerExtension,
]
