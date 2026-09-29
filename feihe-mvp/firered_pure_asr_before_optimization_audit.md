# FireRedAudio Pure ASR 架构 POC：修改前审计

审计日期：2026-09-04（Asia/Shanghai）

## 本次目标

本阶段不继续在 v6 structured understand 上做微调，而是验证新的职责拆分：

```text
FSMN-VAD + CAM++ 全录音 speaker pipeline
        ↓
FireRedAudio task=asr，只生成转写文本
        ↓
程序侧使用 acoustic unit 的原始时间轴和全局 speaker 组合结果
```

现有 v6 保留为不可变对照，新的代码放在 `asr_deploy/pure_asr/`，不覆盖 v6 runner。

## FireRedAudio 代码与模型审计

- FireRed repo：`/home/user/models/asr_deploy/fireredaudio`
- HEAD：`88b826378023eb9a49b297214568398a300e5c32`
- 模型：`/home/user/models/asr_deploy/models/modelscope/firered_audio/FireRedAudio`
- 官方推理入口：`inference.py::FireRedAudioInference.understand`
- 官方 ASR 调用：`task="asr"`
- 官方 ASR prompt：`Transcribe speech to text.`
- `GENERATION_PARAMS["asr"]`：`do_sample=False`、`num_beams=4`、`repetition_penalty=1.1`、`max_new_tokens=300`
- 当前 `task="asr"` 已经通过 FireRed Audio Encoder + Qwen3.5 backbone 生成文本，但 API 输入仍是一整个 audio path；本阶段需要在外部构造 acoustic unit，并保存 unit 到原始录音的时间映射。
- 当前 structured v6 使用 `task="understand"`，由 FireRed 自回归产生时间戳、speaker 和文本；这条路径不改。
- 当前 decoder 仍是 FireRed wrapper 内的 Qwen3.5 hybrid backbone；FA2、Liger、FLA、causal-conv1d 的开关和动态 KV 能沿用 v6 loader。

## 已知 v6 基线

来源：`/home/user/models/asr_optimization_20260903/final_fa2_greedy_v6_dense180_safe2/summary.json`

```text
18/18 success
audio = 10288.925667 s
infer = 1199.532237 s
phase wall = 1255.226368 s
generated tokens = 56939
peak GPU1 = 22665 MiB
final truncation = 0
bad timestamp = 0
monotonic timestamp = 0
boundary gap = 3
speaker review = 62
```

旧 structured FireRed 300 秒基线为 `infer=1217.947s`、`wall=1238.286s`、`generated token` 没有完整记录但输出含结构化时间戳/speaker、旧审计截断疑似数为 `12`。

## VAD 与 speaker 现状

- FSMN-VAD 已在 `/home/user/models/asr_deploy/envs/funasr` 中可用，现有 adaptive planner 只生成 180--360 秒左右的 FireRed context window，不会生成 5--30 秒 pure-ASR unit。
- 现有 `run_diarization_smoke.py` 使用 FunASR `AutoModel(model="paraformer-zh", vad_model="fsmn-vad", spk_model="cam++")`，能够返回 `sentence_info[].spk`。
- Yuqi `result.json` 中的 `sentence_info` 同时包含 Paraformer 文本、时间戳和 `spk`；本阶段不得把其中 Paraformer 文本作为 FireRed transcript，只能把独立运行得到的 VAD/CAM++ 时间和 speaker 作为 acoustic metadata。
- 本阶段需要每条完整录音先独立运行 VAD + CAM++，一次性建立 global cluster/interval manifest，再让 FireRed worker 消费 manifest。

## 实际环境

FireRed 加速环境：`/home/user/models/asr_deploy/envs/firered311`

```text
Python 3.11.15
PyTorch 2.11.0+cu128
CUDA runtime 12.8
Transformers 5.8.0
flash-attn 2.8.3
liger-kernel 0.8.0
flash-linear-attention 0.5.0（distribution/import 以实际环境探测为准）
causal-conv1d 1.6.2.post1
Triton 3.6.0
```

FunASR/VAD/CAM++ 环境：`/home/user/models/asr_deploy/envs/funasr`

```text
Python 3.10.9
FunASR 1.3.14
PyTorch 2.5.1+cu121
torchaudio 2.5.1+cu121
ModelScope 1.38.0
Transformers 5.12.1
```

机器有两张 RTX 4090 24GB。单卡 FireRed benchmark 使用物理 GPU1；双 worker 只在单卡策略确定后使用 GPU0/GPU1 数据并行，不做 tensor parallel。

## 尚未开始的变更

截至本审计文件写入时，尚未修改生产 Yuqi 服务，也尚未把纯 ASR A/B/C 的任何结果算入 benchmark。StaticCache、torch.compile、CUDA Graph 按上一阶段实测结论保持关闭，不在本 POC 重复。

