# 录音质量与发布核查

原 mature 录音及同音色三次重录的独立本地识别结果为无关语句；更换模型后的三次重录均识别为 mature。识别未使用答案作为提示，机器识别不是逐音节人工试听的替代。

正式网站的旧 deck 录音与网站外保存的原文件 SHA-256 相同；其独立识别结果是无关语句。修正版独立识别为 Deck，使用新文件名发布，避免旧 CDN/浏览器缓存。

本次对全部 1881 条听写录音进行了离线识别、完整解码、哈希、音量和首音缓冲检查。对 307 条识别分歧进一步复核，其中 144 条再由 small.en 模型核查；必要时换用备用声源，并用不提供答案提示的重复播放识别复核短词。本次额外优化 158 条录音。另对模考与入学测试的 33 个 MP3 完整解码，未修改真题录音。

仍有 40 条短词、同音词、专有名词或数字的机器识别分歧。这是识别的不确定性，不是已确认的录音损坏；未据此改变词表答案，也不将机器识别视为逐音节人工试听的替代。详细核查记录保留在网站外的 clarity-v4-audit 目录，不进入部署包。

全部 1881 条听写录音已重新生成，主要使用 Jenny (Dioco)，少量采用 LJ Speech 备用音色。保持原始读词文本、认可答案、日期/号码读法和地址拼读；double/triple 段保留 1.40。前置 650ms 静音、后置 600ms 静音，不裁切音节、不加降噪门。192kbps、44.1kHz 单声道。逐条完整解码、检查有效音量与峰值，并验证前 300ms 为静音。

播放器每次播放使用独立媒体元素，清理上一录音的资源与事件。完整播放指定遍数后才允许进入下一词；答对、自动提交或重复按 Enter 不会截断正在播放的录音。明确点击重播、退出或打开设置仍可以暂停/重启。

旧录音在网站之外保留：`/Users/lenteyyy/Documents/Codex/2026-07-12/zai/audio-production/clarity-v3/originals`。校验与生成信息保存在该目录的 manifest.json。新录音使用不同文件名，避免浏览器/CDN继续播放旧缓存。再次导入词表时，导入脚本验证并保留修复版覆盖记录。

声源：[Piper模型卡](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_GB/jenny_dioco/medium/MODEL_CARD)；[Jenny (Dioco) 数据集及许可](https://github.com/dioco-group/jenny-tts-dataset)。仅离线生成并分发预录音，未嵌入模型、未上传答案或录音至云端。模型文件与识别工具不进入网站部署包。

备用声源：[LJ Speech 模型卡](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/ljspeech/high/MODEL_CARD)；[LJ Speech 公共领域数据集](https://keithito.com/LJ-Speech-Dataset/)。只分发预录音，不部署模型。
