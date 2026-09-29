# FireRedAudio Pure ASR 架构级 POC 与完整 benchmark

生成时间：2026-09-04T12:10:33+08:00

## 结论先行

本次把 FireRedAudio 从 `task=understand` 的“同时生成文字、时间戳、speaker、格式”改成了 `task=asr` 的纯文本路径。18 条录音共 768 个 VAD ASR unit，文本由 FireRed 产生，时间戳由原始音频上的 FSMN-VAD unit 提供，speaker 由整条录音独立运行的 CAM++ `vad_segment` 全局聚类提供，最后按原始时间排序合并。

实测最终单卡（物理 GPU1）为 **434.00s infer、471.23s wall、21.83× realtime**；双卡两个独立 Worker 为 **259.15s wall、39.70× realtime**。以这批约 2.86 小时音频计算，单卡约 **7.85 分钟**，双卡约 **4.32 分钟**。

如果把一次性 FSMN-VAD + CAM++ manifest 预处理也计入冷启动端到端时间，预处理实测 **95.41s**，则单卡约 **9.44 分钟**、双卡约 **5.91 分钟**；manifest 可缓存，重复消费同一批 unit 时不需要再次做这一步。

最终纯 ASR 的 final generated tokens 是 **19,769**，v6 structured 是 **56,939**，减少 **65.28%**。infer time 减少 **63.82%**，wall 减少 **62.46%**。这表明主要收益确实来自减少 autoregressive 输出任务，而不是来自编译或量化。

但本次没有人工 gold transcript，也没有把 CAM++ 的 review 标记当作正确率证明。纯 ASR 仍有 **131 个 speaker review、0 个 speaker unknown、2 个疑似漏语音 unit**；因此最终推荐是“速度上可用、进入业务前需人工抽样确认 speaker 边界”的明确候选，而不是宣称质量已经无条件通过。

## 1. 实际环境与加速证据

本次 FireRed Worker 使用环境：`2.11.0+cu128`，CUDA runtime `12.8`，设备为 RTX 4090；不重复 StaticCache、torch.compile、CUDA Graph 和 reduce-overhead 实验，沿用 v6 已有失败证据并保持 dynamic KV cache。

- FlashAttention2: **YES** — `attention_requested=flash_attention_2`, `qwen_attention_implementation=flash_attention_2`, importable=True.
- Liger: **YES** — runtime `liger_applied=True`.
- flash-linear-attention: **YES** — importable=True, `qwen_fast_linear_path=True`, fused delta-rule flags are true=True.
- causal-conv1d: **YES** — importable=True, function/update flags=True.
- Runtime: Python worker 2.11.0+cu128, CUDA runtime 12.8; decoder uses BF16 from the FireRed loader.

这些是 worker 启动时和 Qwen 路径运行时采集的标志，不是“只 import 包”的推断。日志中仍有 Transformers 关于未显式传 dtype 的 FA2 warning，但模型实际按 BF16 加载且 benchmark 全部完成；建议生产启动时显式记录 dtype 以消除该 warning。

## 2. Benchmark 矩阵

`generated tokens` 对纯 ASR 优先使用最终保留结果；旧实验没有单独保存 final token 字段时，表中使用其 summary 报出的 token 总数。`speaker review / unknown` 是 QA 标记，不是人工准确率。`trunc / invalid` 是最终结果计数。

| 方案 | GPU | ASR unit | generated tokens | infer | wall | throughput | VRAM | gap | speaker review / unknown | trunc / invalid |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|
| structured v6 | 1 | adaptive chunk (62 final) | 56,939 | 1199.53s | 1255.23s | 8.20× | 22665 MiB | 3 | 62 / 41 | 0 / 0 |
| pure A / VAD + greedy | 1 | VAD utterance | 5,360 | 118.12s | 154.98s | 19.37× | 21055 MiB | 0 | 81 / 42 | 0 / 0 |
| pure B / coarse speaker-aware + greedy | 1 | speaker-aware (coarse) | 5,374 | 119.19s | 156.15s | 19.23× | 21055 MiB | 0 | 86 / 46 | 0 / 0 |
| pure B / true speaker split + greedy | 1 | speaker-aware (split) | 6,193 | 145.18s | 182.37s | 16.46× | 21065 MiB | 0 | 358 / 358 | 0 / 0 |
| pure C / speech block + greedy | 1 | speech block | 5,304 | 115.70s | 152.51s | 19.68× | 21193 MiB | 0 | 30 / 1 | 0 / 0 |
| pure A / VAD + CAM++ vad_segment | 1 | VAD utterance + vad_segment CAM++ | 5,351 | 119.11s | 156.67s | 19.16× | 21055 MiB | 0 | 48 / 0 | 0 / 0 |
| pure B / beam=4 | 1 | speaker-aware + official beam=4 | 38,493 | 928.45s | 965.58s | 3.11× | 21521 MiB | 0 | 105 / 67 | 68 / 0 |
| pure C / Chinese long prompt | 1 | speech block + long Chinese prompt | 7,706 | 165.68s | 202.91s | 14.79× | 21193 MiB | 0 | 32 / 3 | 0 / 0 |
| final pure ASR / 1 GPU | 1 | VAD + CAM++ vad_segment | 19,769 | 434.00s | 471.23s | 21.83× | 21055 MiB | 0 | 131 / 0 | 0 / 0 |
| final pure ASR / 2 GPU | 0,1 | VAD + CAM++ vad_segment + 2 workers | 19,769 | 442.49s | 259.15s | 39.70× | 22429 MiB | 0 | 131 / 0 | 0 / 0 |

完整 18 文件的主对照如下：

| 方案 | units | attempts | final tokens | infer | wall | RTF | throughput | peak VRAM | gaps | review | unknown | invalid | trunc |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| structured v6 / GPU1 | 62 | 67 | 56,939 | 1199.53s | 1255.23s | 0.121998 | 8.20× | 22665 MiB | 3 | 62 | 41 | 0 | 0 |
| final pure ASR / GPU1 | 768 | 778 | 19,769 | 434.00s | 471.23s | 0.045799 | 21.83× | 21055 MiB | 0 | 131 | 0 | 0 | 0 |
| final pure ASR / GPU0+GPU1 | 768 | 778 | 19,769 | 442.49s* | 259.15s | 0.025187 | 39.70× | 22429 MiB | 0 | 131 | 0 | 0 | 0 |

\* 双卡 `infer` 是两个 Worker 的计算时间之和，不是墙钟；并行效果应看 wall/throughput。双卡 wall speedup 为 **1.82×**，两卡线性 scaling efficiency 约 **90.9%**。两套最终 pure ASR 按 `(job_id, unit_index)` 对齐后结果一致：无 missing、extra 或文本差异。

## 3. 为什么快：输出 token 与 profiler

v6 final chunk 的累计 profiler：audio decode **0.723s**，audio encoder **6.318s**，prompt **1.081s**，backbone generate **1191.122s**，其中 decode **336.238s**。backbone 是绝对主瓶颈。

纯 ASR representative/full sample 的模型侧 profiler 仍显示 audio encoder 和 prompt 很小，主要时间仍是 decoder，但每个 unit 不再生成时间戳、speaker label 和 structured understand 外壳。最终 token 从 56,939 降到 19,769，所以 backbone infer 从 1199.53s 降到 434.00s；这不是“显存降低后自然变快”的假象，GPU1 峰值也从 22665 MiB 降到 21055 MiB。

## 4. 三种 unit 策略的判断

- **Strategy A：VAD utterance**。代表集 241 units，19.37×，调用次数和时间戳粒度平衡最好；最终全量选择它。它允许一个 acoustic unit 内存在短暂 speaker 混合，因此需要 speaker review 标记。
- **Strategy B：speaker-aware**。粗粒度版本 262 units，速度与 A 基本相同，不能保证一个 unit 只含一个 speaker；真正按 CAM++ 边界切分后代表集膨胀到 750 units、16.46×，unknown/review 大幅增加，说明当前 CAM++ 边界不适合直接作为 FireRed 调用粒度。保留作为失败证据，不推荐生产。
- **Strategy C：speech block**。只有 62 units，代表集速度最快（约 19.68×），但一个 block 会跨多个说话人，不能把 dominant speaker 伪装成整个 block 的 speaker；因此不适合当前需要可靠 speaker 的最终展示。

## 5. decoding 与 prompt A/B

代表集 beam=4 的 speaker-aware 实验为 965.58s wall、3.11×，并出现 68 个 truncation；greedy=1 没有 truncation，生产选择 `do_sample=False, num_beams=1, use_cache=True`。

官方短 prompt `Transcribe speech to text.` 是当前生产候选。中文长 prompt 实验不仅变慢到约 14.79×，还出现 structured/speaker/timestamp 风格污染；因此没有继续把“逐字、不要环境声”等长约束塞回 pure ASR。对 FireRed 产生的听不清内容，程序保持原文，不让另一个 LLM 猜测补全。

## 6. 时间戳、speaker 与质量风险

最终时间戳是 acoustic unit 的 `[original_start, original_end]`，不是按文字长度比例伪造的句内时间。manifest 保留原始 16 kHz 时间轴、VAD spans 和 speaker intervals；所有最终 unit 满足合法范围/单调校验，当前 pure full run 的 invalid timestamp、non-monotonic、duplicate、empty speech、truncation 均为 0。

CAM++ 现在对每一条完整录音独立运行 global clustering，使用 `vad_segment` 结果给 VAD unit 赋 cluster，再首次出现顺序映射为 `说话人1…N`。相对于旧 punc-segment 临时映射，代表集 unknown 从 42 降到 0，全量 unknown 从 100 降到 0；全量 review 从 254 降到 131。review 仍然存在，通常表示一个 VAD unit 跨多个候选 speaker 或 overlap 不足，不能把它当作 speaker 已经“全自动正确”。

全量 pure ASR 仍有 2 个 `suspected_missing_speech` unit；它们已按当前 retry 规则拆分重跑但仍被标记，不能声称绝对无漏转写。没有 gold transcript，因此本报告不报告 WER/CER，也不把文本字符数变化当作质量提升。

## 7. 双 GPU 结果

采用两个独立常驻 FireRed Worker，不做 tensor parallel；FSMN-VAD/CAM++ 只对整条录音预处理一次，unit 动态放入共享队列，结果按 `recording_id, unit_index, start` deterministic merge。GPU0/1 worker busy ratio、queue wait、功耗和显存原始采样在 [dual_gpu_monitoring.csv](dual_gpu_monitoring.csv)；单卡采样在 [single_gpu_monitoring.csv](single_gpu_monitoring.csv)。

双卡平均利用率和 peak VRAM 见 raw JSON；最终两卡比单卡 wall 快约 1.82×，说明数据并行有效但存在模型加载和动态 unit 负载不均衡成本。调度粒度已经是 unit，而不是整条录音，结果没有因返回顺序而错乱。

GPU 监控摘要：单卡 GPU1 平均利用率 **85.60%**、平均显存 **19692 MiB**、峰值 **21055 MiB**；双卡 GPU0/GPU1 平均利用率分别为 **82.18% / 80.12%**，峰值显存分别为 **22429 / 21055 MiB**。这不是“显存占满但 GPU 空转”：FireRed 推理期间两张卡的 SM 利用率都约 80% 以上。

预处理不是 FireRed decoder 的瓶颈，但它不是零成本：当前 full manifest 包含 FSMN-VAD + CAM++ 模型加载和 18 条录音处理，共 95.41s。服务化时应缓存 manifest，或把它放到 FireRed Worker 启动前的独立阶段。

## 8. 后端结论与唯一推荐配置

- **PyTorch + official acceleration：推荐**，已经在当前 Worker 路径实测启用。
- **StaticCache / torch.compile / CUDA Graph：本阶段不推荐继续投入**；沿用 v6 的兼容性、recompile、cold/warm 和 output 不一致失败证据。
- **vLLM hybrid：暂缓**。按本阶段 gate，Pure ASR 先把单卡提升到 21.83×、双卡提升到 39.70×，当前更需要解决 speaker review 和 2 个疑似漏语音；没有启动重复加载两份 9B 的危险 POC。
- **TensorRT-LLM / SGLang：暂不值得进入移植**。当前架构收益主要已经来自减少模型任务本身，而不是把仍然输出 timestamp/speaker 的 structured decoder 换后端。

**唯一推荐的当前生产候选：**

```text
原始音频时间轴
→ FSMN-VAD（保留原始时间，不删除后拼接）
→ CAM++ full-recording + vad_segment global clustering
→ VAD utterance ASR units（约 5～30s，token cap 命中时只拆分 retry）
→ FireRedAudio task=asr，官方短 prompt，greedy=1
→ BF16 + FlashAttention2 + Liger + flash-linear-attention + causal-conv1d，dynamic KV
→ 两个独立 4090 Worker（GPU0/GPU1）
→ 按 recording_id/unit_index/start deterministic merge
```

上线前的唯一保留门槛是对 `speaker_needs_review` 和 `suspected_missing_speech` 做人工抽样；v6 structured baseline 仍保留，作为回退和质量对照。

## 9. 可复现产物

    - [firered_before_optimization_audit.md](firered_before_optimization_audit.md)
- [benchmark_pure_asr_raw.json](benchmark_pure_asr_raw.json)
- [firered_pure_asr_quality_spotcheck.md](firered_pure_asr_quality_spotcheck.md)
- [single_gpu_monitoring.csv](single_gpu_monitoring.csv)
- [dual_gpu_monitoring.csv](dual_gpu_monitoring.csv)
- 本目录下每个实验目录的 `summary.json`、每条录音 JSON、manifest 和 unit wav 均保留。
