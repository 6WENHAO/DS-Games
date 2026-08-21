/**
 * thesis-data.js
 * ---------------------------------------------------------------------------
 * 论文数据层 —— 全部数值均取自：
 *   姜啸雷《基于改进的YOLOv11的可移动烟支缺陷检测系统设计》（上传终稿 6.11）
 * 每条记录标注来源（表号/图号/节号），标注 ASSUMED 的为仿真所需、论文未给出的
 * 可调假设参数（界面中均可修改）。
 * 本文件不含任何逻辑，只有数据，便于拆解与复用。
 * ---------------------------------------------------------------------------
 */

/* ========================= 1. 12 类烟支外观缺陷（表3-3） ========================= */
export const DEFECT_CLASSES = [
  { id: 0,  code: 'WP_larded',      name: '水松纸搭口夹杂', zone: '搭口',   desc: '水松纸搭口衔接处嵌有烟丝碎末等异物', color: '#e5793a' },
  { id: 1,  code: 'CP_macula',      name: '卷烟纸黄斑',     zone: '卷烟纸', desc: '卷烟纸区域出现大小不一的淡黄色斑块', color: '#e8c33a' },
  { id: 2,  code: 'WP_Turnup',      name: '水松纸翻白',     zone: '水松纸', desc: '水松纸端部轻微翻折，露出背面白色纸基', color: '#f2f2f2' },
  { id: 3,  code: 'WP_warpedge',    name: '水松纸翘边',     zone: '水松纸', desc: '水松纸边缘与滤嘴贴合不紧，呈翘起状', color: '#6fd3c7' },
  { id: 4,  code: 'Smoke_beadlet',  name: '布带印',         zone: '卷烟纸', desc: '卷烟纸表面因设备布带造成的压痕纹理', color: '#9aa7c7' },
  { id: 5,  code: 'CP_puncture',    name: '卷烟纸刺破',     zone: '卷烟纸', desc: '卷烟纸被梗签等异物刺穿，形成微小破洞', color: '#e2554f' },
  { id: 6,  code: 'CP_blackspots',  name: '卷烟纸表面黑点', zone: '卷烟纸', desc: '卷烟纸表面的深色点状污渍', color: '#4a4a55' },
  { id: 7,  code: 'WP_folds',       name: '水松纸皱',       zone: '水松纸', desc: '水松纸受挤压产生的无规则折叠或波浪纹理', color: '#b083d6' },
  { id: 8,  code: 'WP_break',       name: '水松纸破',       zone: '水松纸', desc: '水松纸出现局部破损、撕裂，边缘参差', color: '#d94f8a' },
  { id: 9,  code: 'WP_Wrongteeth',  name: '水松纸错牙',     zone: '搭口',   desc: '水松纸搭口处对位偏差，接缝参差不齐', color: '#48a0e8' },
  { id: 10, code: 'WP_Noglue',      name: '水松纸无胶',     zone: '搭口',   desc: '搭口处因缺胶导致水松纸开胶、松脱', color: '#57c76b' },
  { id: 11, code: 'Light_Behead',   name: '烟支翻折',       zone: '整体',   desc: '整支烟支发生严重弯曲、折痕甚至断裂', color: '#ff8a3d' },
];

/* 缺陷出现频次权重：论文图3-11 指出"类别分布不均衡"、"某类别样本只有15个"，
   但未给出逐类精确计数 —— 此处为 ASSUMED 默认值，界面可调。 */
export const DEFECT_OCCURRENCE_WEIGHTS = [
  14, 22, 6, 15, 9, 18, 12, 16, 8, 11, 4, 2,
];

/* ========================= 2. 系统硬件配置（表2-1 + 2.1.2 正文） ========================= */
export const HARDWARE = [
  {
    key: 'hmi', zone: '控制区域', name: '工业触摸屏', model: '汇川 IT7150E',
    fn: '显示检测软件界面，完成人机交互、参数设置和运行状态监控',
    specs: ['15 英寸工业触摸屏', '1024 x 600 LCD', '支持以太网通信', '支持远程桌面 / 脚本编程'],
    why: '相比普通显示器现场稳定性更优，适合长时间运行；作为操作人员与检测软件之间的交互终端。',
    src: '表2-1 / 图2-2',
  },
  {
    key: 'workstation', zone: '控制区域', name: '视觉工作站', model: 'GPU + CPU 工作站',
    fn: '运行YOLO检测模型，完成图像推理、结果统计和数据保存',
    specs: ['算法处理核心', '承载第三章模型与第四章软件', 'GigE 图像接入', 'FP16 半精度推理'],
    why: 'YOLO 推理对算力有要求，多相机/批量模式需高吞吐；配 GPU 可显著提升推理效率。',
    src: '表2-1 / 2.1.2(2)',
  },
  {
    key: 'switch', zone: '控制区域', name: '千兆交换机', model: '华为 S1730S-L8P1T-A',
    fn: '实现相机、工作站等网络设备之间的数据传输',
    specs: ['多个千兆网口', '即插即用', '无风扇设计'],
    why: '高速采集及多相机并行时图像数据量明显增加，链路需高带宽低延迟；起网络汇聚作用。',
    src: '表2-1 / 图2-3',
  },
  {
    key: 'syncboard', zone: '控制区域', name: '同步处理板', model: 'NI sbRIO-9607',
    fn: '采集同步信号，完成相机与光源的精准触发控制',
    specs: ['Xilinx Zynq-7020 SoC', '双核 ARM Cortex-A9 实时处理器', 'Artix-7 FPGA', '硬件触发输出'],
    why: '相比软件定时触发，FPGA 硬件触发具有更高实时性与确定性，避免图像位置偏移与模糊。',
    src: '表2-1 / 图2-4',
  },
  {
    key: 'camera', zone: '检测区域', name: '面阵相机 x4', model: '汇川 VC21-0045C-450-X',
    fn: '采集烟支外观图像',
    specs: ['全局快门彩色面阵', '分辨率 720 x 540（45 万像素）', '全分辨率帧率 450 fps', 'GigE Vision 接口'],
    why: '全局快门避免卷帘快门在高速运动下的畸变；体积小功耗低，便于紧凑空间安装。',
    src: '表2-1 / 图2-5',
  },
  {
    key: 'light', zone: '检测区域', name: '条形光源 x2', model: '汇川 IL-LI23728G',
    fn: '为烟支表面提供稳定照明',
    specs: ['外形 237 x 28 x 27 mm', '发光面 225 x 22 mm', '绿色光', '功率 12 W'],
    why: '烟支轴向形成较长照明区域，覆盖整个视野；调角度与距离可增强缺陷区对比度。',
    src: '表2-1 / 图2-6',
  },
  {
    key: 'syncsensor', zone: '检测区域', name: '同步传感器', model: '同步齿轮 + 光电传感器',
    fn: '获取烟支运动位置及节拍信息',
    specs: ['与输送机构机械同步', '齿槽变化产生脉冲', 'DCP 初始同步信号', 'MCP 烟支同步信号'],
    why: '连接视觉检测结果与执行剔除动作的关键环节：不仅要知缺陷，还要知缺陷在哪个槽位。',
    src: '表2-1 / 图2-7',
  },
  {
    key: 'plc', zone: '控制区域', name: 'PLC', model: '汇川 H5U-1614MTD-A8',
    fn: '接收检测结果，完成槽位跟踪和剔除控制',
    specs: ['16 点输入 / 14 点输出', '可控 8 轴', '高速脉冲输出与高速计数', 'EtherCAT 总线'],
    why: '工业现场可靠性与抗干扰能力强，适合作剔除控制核心；高速计数为后续扩展留基础。',
    src: '表2-1 / 图2-8',
  },
  {
    key: 'valve', zone: '执行区域', name: '高速电磁阀', model: 'MAC 52A-11-D08-DM-DDFA-1BA MOD: CLSF',
    fn: '控制气动剔除动作',
    specs: ['大口径阀体', '双线圈设计', '支持脉冲控制切换', '断电保位 + 手动应急'],
    why: '响应过慢会漏剔，开启过长会影响相邻烟支，故需高速阀体保证剔除时序精度。',
    src: '表2-1 / 图2-9',
  },
];

/* ========================= 3. 平台机械布局（2.1.1 图2-1） ========================= */
/* "从右到左依次为料斗鼓轮、接驳轮1、接驳轮2、剔除轮，中间两个接驳轮作为相机检测轮。
    上下各设两组相机，每组相机呈90度夹角进行拍摄。各筒轮内部通过负压吸附烟支。" */
export const DRUM_LAYOUT = [
  { key: 'hopper',   name: '料斗鼓轮', role: '烟支入料、单元化上料',       order: 1 },
  { key: 'transfer1', name: '接驳轮1', role: '检测轮（上/下相机组 1 视角）', order: 2 },
  { key: 'transfer2', name: '接驳轮2', role: '检测轮（上/下相机组 2 视角）', order: 3 },
  { key: 'reject',   name: '剔除轮',   role: '剔除工位，气吹分离缺陷烟支',   order: 4 },
];

/* ========================= 4. 七阶段工作流程（2.2.3 图2-11） ========================= */
export const WORKFLOW_STAGES = [
  {
    id: 'init', idx: 1, name: '系统初始化', chain: '—',
    actors: ['工业触摸屏', '视觉工作站', 'PLC', '同步处理板', '相机', '光源', '交换机'],
    detail: '加载YOLO权重、选择运行模式、设置置信度/IoU阈值、输出目录与自动保存；随后检测 CUDA 设备、模型加载、相机通信、PLC 连接状态。异常则界面提示排查。',
  },
  {
    id: 'sync', idx: 2, name: '同步采集', chain: '运动同步 + 图像采集',
    actors: ['同步齿轮', '光电传感器', '同步处理板', '面阵相机', '条形光源'],
    detail: '齿槽变化产生脉冲，同步处理板内部计数判断烟支是否到达拍摄位；计数达到预设触发点输出相机触发信号，同时控制光源在曝光期间稳定点亮。',
  },
  {
    id: 'infer', idx: 3, name: '视觉检测', chain: '智能识别',
    actors: ['视觉工作站', 'Ultralytics YOLO', 'PyTorch/CUDA'],
    detail: '尺寸调整 → 归一化 → 前向推理 → 置信度筛选 → 非极大值抑制，输出缺陷类别、置信度与检测框坐标。单图/文件夹批量/四相机工作站三种模式分别调度。',
  },
  {
    id: 'comm', idx: 4, name: '结果通信', chain: '结果通信',
    actors: ['视觉工作站', 'Modbus TCP', 'PLC'],
    detail: '将烟支编号、检测状态、缺陷类别编号及置信度等级写入 PLC 寄存器；PLC 读取后进行有效性判断，合格保持正常、不合格标记待剔除。',
  },
  {
    id: 'track', idx: 5, name: '槽位跟踪', chain: '位置跟踪',
    actors: ['PLC', 'DCP/MCP 同步信号'],
    detail: '每经过一个固定同步单位槽位队列前移一次；检测工位与剔除工位之间的槽位差在调试时确定，为 PLC 程序关键参数。视觉延迟需折算为同步脉冲数进行补偿。',
  },
  {
    id: 'reject', idx: 6, name: '剔除执行', chain: '精确剔除',
    actors: ['PLC 数字量输出', '高速电磁阀', '气路组件', '剔除喷嘴'],
    detail: '待剔除槽位到达剔除工位时 PLC 输出数字量信号，电磁阀切换，压缩空气经喷嘴将缺陷烟支吹离正常输送路径；剔除后清除该槽位标记。',
  },
  {
    id: 'trace', idx: 7, name: '数据记录', chain: '数据追溯',
    actors: ['检测软件', 'CSV/JSON', '标注图像'],
    detail: '实时记录检测数量、缺陷类别分布、平均置信度、推理耗时及保存图像数量；缺陷烟支保存带标注框图像，导出 CSV/JSON 供质量追溯与工艺优化。',
  },
];

/* ========================= 5. YOLO 基线选型对比（表3-1，COCO） ========================= */
export const YOLO_COMPARISON = [
  { model: 'YOLOv5n',  params: 1.9,  size: 5.8,  flops: 7.1, map50: 88.4, fps: 147, note: '结构经典、部署生态成熟、参数量最少' },
  { model: 'YOLOv8n',  params: 2.68, size: 6.8,  flops: 8.1, map50: 90.1, fps: 270, note: '无锚框+解耦头、检测速度极快' },
  { model: 'YOLOv9t',  params: 1.73, size: 6.4,  flops: 7.6, map50: 90.6, fps: 256, note: '参数量最少、可编程梯度信息、效率最高' },
  { model: 'YOLOv10n', params: 2.26, size: 6.5,  flops: 6.5, map50: 76.4, fps: 182, note: '无NMS端到端、计算量最低、小目标稍弱' },
  { model: 'YOLOv11n', params: 2.58, size: 6.3,  flops: 6.3, map50: 90.1, fps: 303, note: 'C3k2+C2PSA模块、速度最快、模型最小', selected: true },
  { model: 'YOLOv11s', params: 9.4,  size: 18.3, flops: 21.3, map50: 93.1, fps: 183, note: '参数量比YOLOv11n大' },
];

/* ========================= 6. YOLOv11n 网络结构（3.1.1 图3-1~3-8） ========================= */
export const YOLO_MODULES = [
  { key: 'Conv',     name: 'Conv 卷积层',        role: '3x3 步长2 卷积，下采样，特征图长宽各缩一半，扩大感受野并减少后续计算' },
  { key: 'C3k2',     name: 'C3k2 特征提取模块',  role: '经典 CSP 架构演进，跨阶段局部连接分支提取深层特征，减少参数量、缓解梯度消失' },
  { key: 'SPPF',     name: 'SPPF 快速空间金字塔池化', role: 'Backbone 末端，多尺寸最大池化并拼接，极小代价扩展全局感受野' },
  { key: 'C2PSA',    name: 'C2PSA 注意力强化模块', role: '引入位置/空间注意力，集中算力于有价值位置或通道，抑制背景噪声' },
  { key: 'Upsample', name: 'Upsample 上采样',    role: '深层低分辨率特征放大，与浅层特征空间尺寸对齐，为融合做准备' },
  { key: 'Concat',   name: 'Concat 特征拼接',    role: '通道维拼接深层语义与浅层位置信息，兼顾分类与定位回归' },
  { key: 'Detect',   name: 'Detect 检测头',      role: '三个尺度分别输出边界框坐标、置信度及类别概率' },
];

/* YOLOv11n 主干-颈部-头部拓扑（用于结构图渲染，层序依 3.1.1 描述） */
export const YOLO_GRAPH = {
  backbone: [
    { id: 'b0', m: 'Conv',  out: 'P1/2',  ch: 16 },
    { id: 'b1', m: 'Conv',  out: 'P2/4',  ch: 32 },
    { id: 'b2', m: 'C3k2',  out: 'P2/4',  ch: 64 },
    { id: 'b3', m: 'Conv',  out: 'P3/8',  ch: 64 },
    { id: 'b4', m: 'C3k2',  out: 'P3/8',  ch: 128, tap: 'P3' },
    { id: 'b5', m: 'Conv',  out: 'P4/16', ch: 128 },
    { id: 'b6', m: 'C3k2',  out: 'P4/16', ch: 128, tap: 'P4' },
    { id: 'b7', m: 'Conv',  out: 'P5/32', ch: 256 },
    { id: 'b8', m: 'C3k2',  out: 'P5/32', ch: 256 },
    { id: 'b9', m: 'SPPF',  out: 'P5/32', ch: 256 },
    { id: 'b10', m: 'C2PSA', out: 'P5/32', ch: 256, tap: 'P5' },
  ],
  neck: [
    { id: 'n0', m: 'Upsample', from: ['P5'] },
    { id: 'n1', m: 'Concat',   from: ['n0', 'P4'] },
    { id: 'n2', m: 'C3k2',     from: ['n1'], ch: 128, tap: 'N4' },
    { id: 'n3', m: 'Upsample', from: ['N4'] },
    { id: 'n4', m: 'Concat',   from: ['n3', 'P3'] },
    { id: 'n5', m: 'C3k2',     from: ['n4'], ch: 64, tap: 'H_small' },
    { id: 'n6', m: 'Conv',     from: ['H_small'] },
    { id: 'n7', m: 'Concat',   from: ['n6', 'N4'] },
    { id: 'n8', m: 'C3k2',     from: ['n7'], ch: 128, tap: 'H_mid' },
    { id: 'n9', m: 'Conv',     from: ['H_mid'] },
    { id: 'n10', m: 'Concat',  from: ['n9', 'P5'] },
    { id: 'n11', m: 'C3k2',    from: ['n10'], ch: 256, tap: 'H_large' },
  ],
  heads: [
    { id: 'd_s', m: 'Detect', from: 'H_small', scale: '80x80 小尺度' },
    { id: 'd_m', m: 'Detect', from: 'H_mid',   scale: '40x40 中尺度' },
    { id: 'd_l', m: 'Detect', from: 'H_large', scale: '20x20 大尺度' },
  ],
};

/* ========================= 7. 训练环境（表3-2）与超参（表3-4） ========================= */
export const TRAIN_ENV = [
  ['操作系统', 'Windows 11'],
  ['CPU', '12th Gen Intel(R) Core(TM) i9-12900H'],
  ['GPU', 'NVIDIA GeForce RTX 3070 Ti'],
  ['显存', '8 GB'],
  ['深度学习框架', 'PyTorch'],
  ['Python版本', '3.11'],
  ['CUDA版本', '11.8'],
  ['开发环境', 'PyCharm'],
];

export const HYPER_PARAMS = [
  ['输入尺寸', '640 x 640', '统一分辨率'],
  ['NMS 交并比', '0.5', '默认 0.7，降低以减少小目标重复框'],
  ['置信度', '0.2', '默认 0.25，降低以避免小目标预测框被过早过滤'],
  ['优化器', 'AdamW', '配合余弦退火降低学习率'],
  ['训练轮次', '早停 patience = 90', '90 轮内 mAP@0.5 最大值未变化即停止'],
];

/* ========================= 8. 数据集（3.2） ========================= */
export const DATASET = {
  rawImages: 819,
  negativeSamples: 144,
  augmented: 4914,
  split: { train: 3438, val: 978, test: 498 },
  ratio: '7 : 2 : 1（先划分再扩充）',
  augmentations: ['水平翻转', '垂直翻转', '高斯模糊', '提高亮度', '降低亮度'],
  acquisition: '高分辨率数码相机，室内白色灯光均匀照明，烟支水平置于纯白背景，镜头光轴垂直烟支轴线，手动对焦并锁定白平衡，保存为 bmp',
  labelTool: 'LabelImg（标注结果保存为 txt）',
  classes: 12,
};

/* ========================= 9. 消融实验：6 个模型 ========================= */
/* 模型复杂度（表3-5） */
export const MODEL_COMPLEXITY = {
  baseline:   { params: 2592200, gflops: 6.4, epochTime: 47 },
  wiou:       { params: 2592200, gflops: 6.4, epochTime: 47 },
  eiou:       { params: 2592200, gflops: 6.4, epochTime: 47 },
  outlook:    { params: 3055628, gflops: 7.9, epochTime: 68 },
  wiou_ol:    { params: 3055628, gflops: 7.9, epochTime: 68 },
  eiou_ol:    { params: 3055628, gflops: 7.9, epochTime: 68 },
};

/* 逐类 AP@0.5（表3-6），行序 = 类别 id 0..11，末行 All */
export const AP_TABLE = {
  baseline: [0.903, 0.995, 0.966, 0.769, 0.982, 0.889, 0.873, 0.705, 0.874, 0.916, 0.994, 0.995],
  wiou:     [0.844, 0.995, 0.928, 0.859, 0.995, 0.824, 0.926, 0.787, 0.868, 0.937, 0.995, 0.995],
  outlook:  [0.842, 0.995, 0.936, 0.797, 0.958, 0.874, 0.909, 0.803, 0.964, 0.908, 0.994, 0.995],
  wiou_ol:  [0.839, 0.995, 0.987, 0.790, 0.969, 0.902, 0.899, 0.770, 0.889, 0.914, 0.986, 0.995],
  eiou:     [0.894, 0.995, 0.923, 0.827, 0.972, 0.928, 0.855, 0.768, 0.933, 0.907, 0.995, 0.995],
  eiou_ol:  [0.873, 0.995, 0.928, 0.780, 0.993, 0.874, 0.896, 0.766, 0.877, 0.881, 0.995, 0.995],
};

/* 综合指标（表3-6 All 行 + 表3-7） */
export const MODELS = [
  {
    key: 'baseline', name: '基线 YOLOv11n', short: '基线', loss: 'CIoU', attn: '无',
    map50: 0.905, gain: 0, P: 0.9179, R: 0.8848, F1: 0.9010, map5095: 0.5876,
    note: 'YOLOv11n 原始配置（CIoU 损失，注意力模块不变）',
    color: '#8a93a8',
  },
  {
    key: 'wiou', name: '+WIoU', short: 'WIoU', loss: 'WIoU v1', attn: '无',
    map50: 0.913, gain: 0.88, P: 0.9201, R: 0.8741, F1: 0.8965, map5095: 0.5853,
    note: '距离注意力 + 离群度注意力动态分配梯度；翘边+9.0%、黑点+5.3%、皱+8.2%、错牙+2.1%',
    color: '#48a0e8',
  },
  {
    key: 'eiou', name: '+EIoU', short: 'EIoU', loss: 'EIoU', attn: '无',
    map50: 0.916, gain: 1.2, P: 0.9255, R: 0.8891, F1: 0.9069, map5095: 0.5929,
    note: '宽高解耦直接回归；刺破+3.9%、水松纸破+5.9%；综合精度最优，且不增参数与延迟',
    color: '#2fbf71', recommended: true,
  },
  {
    key: 'outlook', name: '+Outlook Attention', short: 'Outlook', loss: 'CIoU', attn: 'Outlook',
    map50: 0.915, gain: 1.1, P: 0.9223, R: 0.8842, F1: 0.9028, map5095: 0.5969,
    note: '在全部 C3k2 中集成；水松纸破+9.0%、水松纸皱+9.8%；mAP@.5:.95 明显提升',
    color: '#b083d6',
  },
  {
    key: 'wiou_ol', name: '+WIoU +Outlook', short: 'WIoU+OL', loss: 'WIoU v1', attn: 'Outlook',
    map50: 0.911, gain: 0.66, P: 0.9232, R: 0.8991, F1: 0.9110, map5095: 0.5980,
    note: 'Recall 与 F1 各方案最优，适合对漏检敏感场景；mAP@0.5 反而回落',
    color: '#e8a33a',
  },
  {
    key: 'eiou_ol', name: '+EIoU +Outlook', short: 'EIoU+OL', loss: 'EIoU', attn: 'Outlook',
    map50: 0.905, gain: 0, P: 0.9238, R: 0.8814, F1: 0.9021, map5095: 0.5955,
    note: '与基线持平，未产生叠加增益；注意力与损失函数在梯度传播上可能存在优化方向冲突',
    color: '#e2554f',
  },
];

/* ========================= 10. 损失函数原理（3.3.3） ========================= */
export const LOSS_FUNCTIONS = [
  {
    key: 'CIoU', name: 'CIoU（YOLOv11 默认）',
    formula: 'L_CIoU = 1 - IoU + rho^2(b, b_gt) / c^2 + alpha * v',
    terms: [
      'rho：预测框与真实框中心点的欧氏距离',
      'c：覆盖两框的最小外接矩形对角线长度',
      'v：衡量宽高比一致性的参数',
      'alpha：平衡系数，防止 v 过大',
    ],
    issue: '长宽比惩罚项用反正切比值间接定义，长宽比差异大时梯度模糊、收敛变慢，对低质量标注敏感。',
  },
  {
    key: 'WIoU', name: 'WIoU v1（2023）',
    formula: 'L_WIoU = R_WIoU * L_IoU,   R_WIoU = exp( ((x-x_gt)^2 + (y-y_gt)^2) / (W_g^2 + H_g^2) )',
    terms: [
      '(x,y),(x_gt,y_gt)：预测框与真实框中心坐标',
      'W_g, H_g：最小外接矩形的宽和高',
      'R_WIoU：中心重合时取最小值 1，偏离越大值越大',
    ],
    issue: '两层注意力动态调权：中心距远则加大惩罚加速回归；样本质量低则降低梯度增益，防有害梯度。',
  },
  {
    key: 'EIoU', name: 'EIoU（推荐方案）',
    formula: 'L_EIoU = 1 - IoU + rho^2(b,b_gt)/c^2 + rho^2(w,w_gt)/C_w^2 + rho^2(h,h_gt)/C_h^2',
    terms: [
      'C_w, C_h：最小外接矩形的宽度和高度',
      'rho(w,w_gt)：预测框与真实框宽度的差值',
      'rho(h,h_gt)：高度的差值',
    ],
    issue: '宽高比从间接反正切改为直接差值惩罚；宽/高损失解耦独立优化，梯度方向清晰；极端长宽比缺陷（如翘边长条目标）梯度更稳定。',
  },
];

/* ========================= 11. FP16 / FP32 推理性能（表4-1） ========================= */
export const PRECISION_BENCH = {
  fp32: { map50: 0.9160, map5095: 0.5843, msPerImage: 4.00, fps: 250.2, msMin: 3.39, msMax: 8.16, vramMB: 408.1 },
  fp16: { map50: 0.9164, map5095: 0.5838, msPerImage: 3.02, fps: 331.5, msMin: 2.71, msMax: 4.08, vramMB: 244.4 },
  speedup: 1.32,
  vramReduction: 0.401,
};

/* ========================= 12. 三层部署架构（4.1 图4-1） ========================= */
export const DEPLOY_STACK = [
  {
    key: 'engine', layer: '底层计算引擎', title: 'PyTorch + CUDA / cuDNN / cuBLAS',
    points: [
      '动态图"定义即运行"，便于调试、测试与功能迭代',
      '卷积、矩阵乘等密集算子映射到 GPU 并行执行',
      '固定输入尺寸 + cuDNN benchmark 选择较优卷积算法',
      '支持 Tensor Core 时启用 TF32 提高吞吐',
      'torch.inference_mode() 关闭梯度与自动微分开销',
      '零值图像多轮单张/批量预热，提前建立 CUDA 上下文与算子路径',
    ],
  },
  {
    key: 'framework', layer: '中间推理框架', title: 'Ultralytics YOLO',
    points: [
      'YOLO(model_path) 加载权重，predict() 完成推理',
      'predict() 内封装尺寸调整/归一化/批组织/前向/置信度筛选/NMS/结果封装',
      '结果对象含类别索引、置信度、边界框坐标、类别名与原图',
      '批量推理充分利用 GPU 并行（批量模式与工作站模式均使用）',
      'device / half / imgsz / conf / iou 参数直接下传框架',
      '升级模型通常只需替换权重文件，应用层少量适配',
    ],
  },
  {
    key: 'deploy', layer: '上层部署引擎', title: '系统部署引擎（十大模块）',
    points: [
      '全局配置：颜色映射表、批处理尺寸、队列容量',
      '工具函数：图像格式转换、检测框绘制、文件扫描',
      '数据结构：检测框 / 检测结果两个数据类',
      '计时模块：GPU（CUDA Event）与 CPU 自适应精确计时',
      '模型管理：单例 + 类级/实例级互斥锁，保证唯一与线程安全',
      '实时统计：检测数据采集与可视化刷新',
      '线程基础设施：可暂停可停止线程基类',
      '工作线程：单图 / 批量 / 文件夹扫描 / 并行推理',
      '管理层：工作站模式多线程生命周期协调',
      '界面层：顶部状态栏 + 主窗口布局与交互',
    ],
  },
];

/* ========================= 13. 软件工作模式（4.2） ========================= */
export const GUI_MODES = [
  {
    key: 'image', name: '单张图片', algo: '算法2 SingleImageDetection',
    detail: '独立检测线程完成一次性推理，避免主界面阻塞；结果直接显示在界面中。',
  },
  {
    key: 'folder', name: '文件夹批量', algo: '算法3 BatchDetection',
    detail: '预读流水线：当前批次推理期间 CPU 线程池（8 workers）异步预读下一批，独立保存线程池（4 workers）异步写盘，使 I/O 等待与 GPU 计算时间重叠。',
  },
  {
    key: 'workstation', name: '四相机工作站', algo: '算法4-A/4-B 生产者—消费者',
    detail: '4 个生产者线程各自固定周期扫描对应相机目录并入队；1 个消费者线程公平轮询四路队列（每队列取 B/4 张）聚合后提交 GPU 批量推理，结果按相机标识分别更新界面；内置空闲检测，超时无新图自动暂停 GPU 计算。',
  },
];

/* ========================= 14. 仿真默认参数（ASSUMED，界面可调） =========================
   论文给出：主流卷接机组 12000 支/分钟（1.3 节）、相机 450 fps、FP16 3.02 ms/张。
   下列时序/几何量论文未逐项给出，取工程合理值作为仿真默认，全部可在界面调整。 */
export const SIM_DEFAULTS = {
  throughputCPM: 3000,        // 生产节拍 支/分钟
  drumSlots: 24,              // 单鼓轮槽位数
  camerasPerCigarette: 4,     // 上下各两组，每支烟被 4 台相机拍摄
  precision: 'fp16',          // fp16 / fp32
  modelKey: 'eiou',           // 默认部署 EIoU 方案（论文推荐）
  confThreshold: 0.20,        // 表3-4
  iouThreshold: 0.50,         // 表3-4
  batchSize: 8,               // 全局配置模块批处理尺寸
  queueCapacity: 64,          // 全局配置模块队列容量（每相机，算法4-A 队列满则阻塞）
  defectRate: 0.08,           // 来料缺陷率
  // 时序（ms）
  exposureUs: 200,            // 曝光时间 us
  lightLeadUs: 50,            // 光源提前量 us
  triggerDelayUs: 0,          // 相机触发延迟 us
  gigeTransferMs: 1.6,        // GigE 传输 720x540 彩色
  preprocessMs: 0.9,          // 尺寸调整 + 归一化
  postprocessMs: 0.6,         // 置信度筛选 + NMS + 结果封装
  modbusMs: 2.5,              // Modbus TCP 往返
  // 槽位与剔除
  trackMode: 'id',            // id = 按检测编号对齐槽位；pulse = 按补偿脉冲数折算
  detectToRejectSlots: 15,    // 检测工位 → 剔除工位 槽位差（机械真值 15）
  compensationPulses: 6,      // 视觉延迟补偿脉冲数
  resultWindowSlots: 14,      // PLC 结果接收窗口（槽位）
  valveResponseMs: 3.0,       // 电磁阀响应时间
  valveLeadMs: 1.5,           // PLC 提前输出量（补偿阀响应滞后）
  valvePulseMs: 9.0,          // 剔除脉冲宽度
  airPressureBar: 4.5,        // 气压
  nozzleGapMm: 6.0,           // 喷嘴到烟支距离
  timeoutPolicy: 'reject',    // alarm / stop / reject（异常品处理）
  classWeights: null,         // 缺陷类别权重（null = 用 DEFECT_OCCURRENCE_WEIGHTS）
};

export const CIGARETTE_GEOM = {
  totalLenMm: 84,
  tipLenMm: 27,      // 水松纸段
  rodLenMm: 57,      // 卷烟纸段
  diameterMm: 7.8,
  seamNote: '卷烟纸包裹烟丝形成烟棒（白，前端）；水松纸包裹滤嘴并通过搭口与烟棒粘接（深色/带纹理）',
  src: '3.2.1 图3-9 烟支分区',
};

/* ========================= 15. 论文提出的局限与展望（5.1.2 / 5.2） ========================= */
export const LIMITATIONS = [
  { title: '数据集规模与场景多样性有限', detail: '仅 819 张原始图像；采集条件单一（固定光源、纯白背景），对复杂背景、不同光照及不同品牌的泛化能力未充分验证。' },
  { title: '组合优化策略叠加增益不明显', detail: 'EIoU+Outlook Attention 的 mAP@0.5 回落至 0.905，两种改进在梯度传播路径上可能存在优化方向冲突。' },
  { title: '系统实际产线验证尚不充分', detail: '整机联调与现场测试尚未开展；振动、粉尘、温漂及电磁干扰下的长期稳定性、剔除准确率与故障自诊断仍需验证。' },
  { title: '可移动部署便捷性有待完善', detail: '转运过程中的快速标定、自动校准及参数自适应等便捷性功能尚未深入研究。' },
];

export const OUTLOOK = [
  { title: '模型持续学习与自适应优化', detail: '在线更新机制 + 增量训练/持续微调；引入半监督或主动学习降低标注成本。' },
  { title: '多模态检测信息融合', detail: '引入近红外、高光谱或 X 射线成像，提高对伪装性缺陷（色泽接近的搭口夹杂、深色水松纸细微破洞）的检出。' },
  { title: '缺陷溯源与工艺闭环优化', detail: '关联鼓轮转速、供丝量、接装温度、水松纸张力等工艺参数，从"检测剔除"升级为"预警预防"，异常时向 MES 预警。' },
  { title: '系统产品化与标准化推广', detail: '完善工业设计、安全防护、EMC 与可靠性测试；核心软件框架抽象为通用工业视觉检测平台。' },
];

export const THESIS_META = {
  title: '基于改进的YOLOv11的可移动烟支缺陷检测系统设计',
  titleEn: 'Design of a Mobile Cigarette Defect Detection System Based on an Improved YOLOv11',
  author: '姜啸雷',
  advisor: '陈琳',
  school: '机械工程学院',
  major: '机械电子工程',
  classId: '机电221',
  studentId: '2201300219',
  date: '2026年4月',
  keywords: ['烟支外观缺陷', 'YOLOv11改进', '检测平台', '人机交互界面'],
  route: '平台结构设计 — 控制逻辑规划 — 检测算法优化 — 推理框架与交互界面开发',
  chain: '运动同步 — 图像采集 — 智能识别 — 结果通信 — 位置跟踪 — 精确剔除 — 数据追溯',
};

export function classById(id) {
  return DEFECT_CLASSES[id];
}

export function modelByKey(key) {
  for (var i = 0; i < MODELS.length; i++) if (MODELS[i].key === key) return MODELS[i];
  return MODELS[0];
}
