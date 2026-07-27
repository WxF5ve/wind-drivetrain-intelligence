import { createHash } from "node:crypto";

export const DRIVETRAIN_TAXONOMY = [
  {
    domain: "系统架构",
    tags: [
      ["传动链系统", ["传动链", "主传动链", "轴系", "扭振", "drivetrain", "drive train", "shaft line", "torsional vibration"]],
      ["齿轮箱架构", ["齿轮箱", "主齿轮箱", "中速传动", "高速传动", "功率分流", "gearbox", "gear box", "split torque", "torque density"]],
      ["主轴系统方案", ["主轴系统", "三点支撑", "四点支撑", "集成式传动链", "main shaft system", "three point suspension", "four point suspension", "integrated drivetrain"]]
    ]
  },
  {
    domain: "载荷与动力学",
    tags: [
      ["载荷谱", ["载荷谱", "载荷历程", "扭矩谱", "极限载荷", "疲劳载荷", "load spectrum", "load history", "torque spectrum", "ultimate load", "fatigue load"]],
      ["扭振与耦合动力学", ["扭振", "传动链动力学", "气弹耦合", "机电耦合", "torsional vibration", "drivetrain dynamics", "aeroelastic coupling", "electromechanical coupling"]],
      ["行星级均载", ["均载", "载荷分配", "偏载", "load sharing", "load distribution", "load split", "uneven load"]]
    ]
  },
  {
    domain: "齿轮设计",
    tags: [
      ["齿轮宏观参数", ["齿数", "模数", "压力角", "螺旋角", "变位系数", "齿宽", "module", "pressure angle", "helix angle", "profile shift", "face width"]],
      ["齿轮微观修形", ["齿轮修形", "齿形修形", "齿向修形", "鼓形修形", "微观修形", "齿廓修形", "gear microgeometry", "profile modification", "lead modification", "tooth modification"]],
      ["齿轮强度", ["齿面接触应力", "齿根弯曲应力", "啮合刚度", "传动误差", "接触斑点", "gear strength", "contact stress", "bending stress", "mesh stiffness", "transmission error", "contact pattern"]]
    ]
  },
  {
    domain: "轴承设计",
    tags: [
      ["滚动轴承选型", ["圆柱滚子轴承", "圆锥滚子轴承", "调心滚子轴承", "四点接触球轴承", "cylindrical roller bearing", "tapered roller bearing", "spherical roller bearing", "four-point contact bearing"]],
      ["游隙与预紧", ["轴承游隙", "游隙控制", "轴承预紧", "预紧力", "bearing clearance", "bearing preload", "preload force"]],
      ["轴承配合", ["过盈配合", "配合公差", "轴承座公差", "interference fit", "bearing fit", "fit tolerance"]],
      ["滑动轴承开发", ["滑动轴承", "轴瓦", "可倾瓦", "径向滑动轴承", "journal bearing", "plain bearing", "sliding bearing", "tilting pad bearing", "hydrodynamic bearing"]]
    ]
  },
  {
    domain: "结构强度",
    tags: [
      ["行星架强度", ["行星架", "行星架强度", "行星架变形", "planet carrier", "carrier strength", "carrier deformation"]],
      ["箱体与支承强度", ["箱体变形", "箱体强度", "扭力臂", "弹性支撑", "housing deformation", "housing strength", "torque arm", "elastic support"]],
      ["轴系强度", ["主轴强度", "高速轴强度", "轴系强度", "轴系对中", "shaft strength", "shaft alignment", "shaft fatigue"]],
      ["有限元与疲劳", ["有限元", "强度分析", "疲劳强度", "拓扑优化", "ansys", "abaqus", "finite element", "fea", "fatigue strength", "topology optimization"]]
    ]
  },
  {
    domain: "材料与工艺",
    tags: [
      ["感应淬火", ["感应淬火", "中频淬火", "高频淬火", "双频淬火", "induction hardening", "induction quenching", "dual frequency hardening"]],
      ["渗碳与热处理", ["渗碳", "渗碳淬火", "氮化", "碳氮共渗", "热处理", "残余奥氏体", "carburizing", "case hardening", "nitriding", "heat treatment", "retained austenite"]],
      ["喷丸强化", ["喷丸", "强化喷丸", "应力喷丸", "残余压应力", "shot peening", "stress peening", "compressive residual stress"]],
      ["齿面精加工", ["磨齿", "珩齿", "磨削烧伤", "超精加工", "齿面粗糙度", "gear grinding", "gear honing", "grinding burn", "superfinishing", "surface roughness"]],
      ["材料与表面工程", ["齿轮钢", "轴承钢", "材料洁净度", "夹杂物", "表面涂层", "表面强化", "gear steel", "bearing steel", "material cleanliness", "inclusion", "surface coating", "surface engineering"]]
    ]
  },
  {
    domain: "润滑与热管理",
    tags: [
      ["润滑油与添加剂", ["齿轮油", "润滑油", "润滑脂", "添加剂", "黏度", "粘度", "gear oil", "lubricant", "lubrication", "grease", "additive", "viscosity"]],
      ["油液污染与过滤", ["油液监测", "磨损颗粒", "磨粒", "清洁度", "水分", "过滤精度", "oil debris", "wear debris", "oil monitoring", "cleanliness", "water contamination", "filtration"]],
      ["弹流润滑与摩擦", ["摩擦学", "摩擦系数", "混合润滑", "弹流润滑", "tribology", "friction coefficient", "mixed lubrication", "elastohydrodynamic", "ehl"]],
      ["热平衡与冷却", ["热平衡", "油温", "冷却系统", "润滑系统", "喷油润滑", "thermal balance", "oil temperature", "cooling system", "lubrication system", "oil jet"]]
    ]
  },
  {
    domain: "振动与NVH",
    tags: [
      ["齿轮箱振动", ["齿轮箱振动", "异常振动", "振动超限", "gearbox vibration", "abnormal vibration"]],
      ["噪声与异响", ["异响", "噪声", "声品质", "noise", "abnormal noise", "sound quality"]],
      ["模态与共振", ["共振", "模态分析", "临界转速", "resonance", "modal analysis", "critical speed"]],
      ["传动误差激励", ["传动误差", "啮合激励", "阶次激励", "transmission error", "mesh excitation", "order excitation", "nvh"]]
    ]
  },
  {
    domain: "仿真分析",
    tags: [
      ["AVL EXCITE", ["avl excite", "avl仿真", "excite power unit", "excite designer", "excite timing drive"]],
      ["Romax/MASTA/KISSsoft", ["romax", "masta", "kisssoft", "kisssys", "传动系统仿真", "齿轮箱仿真"]],
      ["多体动力学", ["simpack", "多体动力学", "动力学仿真", "柔性体", "multibody dynamics", "dynamic simulation", "flexible body"]],
      ["数字孪生", ["数字孪生", "虚拟样机", "模型降阶", "digital twin", "virtual prototype", "reduced order model"]]
    ]
  },
  {
    domain: "试验验证",
    tags: [
      ["台架与型式试验", ["齿轮箱试验台", "台架试验", "型式试验", "加载试验", "背靠背试验", "test rig", "bench test", "type test", "load test", "back-to-back test"]],
      ["可靠性与寿命", ["可靠性试验", "加速寿命", "疲劳寿命", "寿命预测", "reliability test", "accelerated life", "fatigue life", "life prediction"]],
      ["无损检测与内窥镜", ["内窥镜", "无损检测", "超声检测", "磁粉检测", "声发射", "endoscopy", "borescope", "nondestructive testing", "ultrasonic testing", "magnetic particle", "acoustic emission"]]
    ]
  },
  {
    domain: "监测诊断",
    tags: [
      ["振动监测", ["振动监测", "振动分析", "包络解调", "阶次分析", "频谱分析", "vibration monitoring", "vibration analysis", "envelope analysis", "order tracking", "spectral analysis"]],
      ["故障诊断与PHM", ["故障诊断", "状态监测", "预测性维护", "剩余寿命", "健康管理", "fault diagnosis", "condition monitoring", "predictive maintenance", "remaining useful life", "rul", "phm"]],
      ["SCADA与CMS", ["scada", "cms", "监测系统", "在线监测", "online monitoring", "condition monitoring system"]]
    ]
  },
  {
    domain: "失效分析",
    tags: [
      ["轴承跑圈与配合", ["轴承跑圈", "跑内圈", "跑外圈", "套圈蠕动", "内圈打滑", "外圈打滑", "配合松动", "bearing creep", "ring creep", "ring walk", "inner ring slip", "outer ring slip", "fit looseness"]],
      ["齿面失效", ["微点蚀", "点蚀", "剥落", "胶合", "擦伤", "齿面磨损", "micropitting", "pitting", "spalling", "scuffing", "tooth wear"]],
      ["轴承失效与WEC", ["白色蚀刻裂纹", "白色组织裂纹", "白色蚀刻区", "wec", "white etching crack", "white structure flaking", "butterfly crack"]],
      ["电蚀与电流损伤", ["轴承电蚀", "电流损伤", "电火花加工纹", "电流绝缘", "electrical damage", "bearing current", "fluting", "electrical erosion"]],
      ["裂纹与断裂", ["断齿", "齿根裂纹", "轮齿断裂", "轴断裂", "疲劳裂纹", "tooth fracture", "root crack", "shaft fracture", "fatigue crack"]],
      ["温升泄漏与装配质量", ["齿轮箱高温", "轴承温升", "漏油", "渗漏", "装配偏差", "同轴度", "不对中", "gearbox overheating", "bearing temperature", "oil leakage", "misalignment", "assembly error"]]
    ]
  }
];

export const DRIVETRAIN_COMPONENT_TAXONOMY = [
  {
    component: "主轴系统",
    keywords: ["主轴承", "主轴轴承", "主轴系", "主轴", "main bearing", "main shaft bearing", "main shaft"]
  },
  {
    component: "行星级",
    keywords: ["行星架", "行星轮", "太阳轮", "内齿圈", "行星销", "行星级", "均载", "planet carrier", "planet gear", "sun gear", "ring gear", "planet pin", "planetary stage", "load sharing"]
  },
  {
    component: "平行轴级",
    keywords: ["平行轴", "中间轴", "高速轴", "中速轴", "高速级", "中间级", "parallel shaft", "intermediate shaft", "high-speed shaft", "high speed shaft", "parallel stage"]
  },
  {
    component: "齿轮件",
    keywords: ["齿轮", "轮齿", "齿面", "齿根", "齿形", "齿向", "啮合", "gear tooth", "gear flank", "gear mesh", "gear microgeometry", "tooth profile"]
  },
  {
    component: "滑动轴承系统",
    keywords: ["滑动轴承", "轴瓦", "可倾瓦", "journal bearing", "plain bearing", "sliding bearing", "tilting pad bearing", "hydrodynamic bearing"]
  },
  {
    component: "齿轮箱轴承",
    keywords: ["齿轮箱轴承", "行星轮轴承", "高速轴轴承", "中间轴轴承", "滚动轴承", "风电轴承", "轴承跑圈", "套圈蠕动", "bearing creep", "ring creep", "gearbox bearing", "planet bearing", "wind turbine bearing", "rolling bearing", "roller bearing"]
  },
  {
    component: "箱体与支承",
    keywords: ["齿轮箱箱体", "箱体变形", "扭力臂", "弹性支撑", "机架接口", "gearbox housing", "housing deformation", "torque arm", "elastic support", "bedplate interface"]
  },
  {
    component: "轴系连接",
    keywords: ["联轴器", "锁紧盘", "胀紧套", "胀套", "花键", "收缩盘", "空心轴", "传动轴", "coupling", "shrink disc", "locking assembly", "spline", "hollow shaft", "drive shaft"]
  },
  {
    component: "润滑冷却与密封",
    keywords: ["润滑系统", "齿轮油", "润滑油", "润滑脂", "油液", "油温", "冷却系统", "过滤器", "密封", "漏油", "gear oil", "lubrication system", "lubricant", "oil debris", "cooling system", "filter", "seal", "oil leakage"]
  },
  {
    component: "制动与高速端",
    keywords: ["机械制动", "制动盘", "制动器", "高速端", "高速联轴器", "高速轴制动", "brake disc", "mechanical brake", "high-speed coupling", "high speed coupling", "high-speed end"]
  },
  {
    component: "监测与传感",
    keywords: ["状态监测", "振动监测", "油液监测", "扭矩传感", "温度传感", "scada", "cms", "condition monitoring", "vibration monitoring", "oil monitoring", "torque sensor", "temperature sensor"]
  },
  {
    component: "齿轮箱总成",
    keywords: ["齿轮箱", "主齿轮箱", "功率分流", "扭矩密度", "gearbox", "gear box", "split torque", "torque density"]
  },
  {
    component: "传动链总体",
    keywords: ["传动链", "主传动链", "轴系", "扭振", "载荷谱", "drivetrain", "drive train", "shaft line", "torsional vibration", "load spectrum"]
  }
];

export const PRIMARY_SECTIONS = [
  "技术与产品开发",
  "故障、质量与运维",
  "论文、标准与专利",
  "厂商与项目动态",
  "政策、市场与产业环境"
];

export const DRIVETRAIN_COMPONENT_TAGS = [
  ["主轴", ["主轴", "main shaft"]],
  ["主轴承", ["主轴承", "主轴轴承", "main bearing", "main shaft bearing"]],
  ["行星架", ["行星架", "planet carrier"]],
  ["行星轮", ["行星轮", "planet gear"]],
  ["太阳轮", ["太阳轮", "sun gear"]],
  ["内齿圈", ["内齿圈", "齿圈", "ring gear"]],
  ["行星销", ["行星销", "行星销轴", "planet pin"]],
  ["行星轴承", ["行星轮轴承", "行星轴承", "planet bearing"]],
  ["中间轴", ["中间轴", "中速轴", "intermediate shaft"]],
  ["高速轴", ["高速轴", "high-speed shaft", "high speed shaft"]],
  ["齿面", ["齿面", "齿廓", "gear flank", "tooth flank"]],
  ["齿根", ["齿根", "tooth root", "root fillet"]],
  ["轴承内圈", ["轴承内圈", "内圈", "inner ring"]],
  ["轴承外圈", ["轴承外圈", "外圈", "outer ring"]],
  ["保持架", ["保持架", "bearing cage", "cage failure"]],
  ["滚子与滚道", ["滚子", "滚动体", "滚道", "roller", "rolling element", "raceway"]],
  ["轴瓦", ["轴瓦", "可倾瓦", "bearing pad", "tilting pad"]],
  ["箱体", ["齿轮箱箱体", "箱体", "gearbox housing"]],
  ["扭力臂", ["扭力臂", "torque arm"]],
  ["弹性支承", ["弹性支撑", "弹性支承", "elastic support"]],
  ["联轴器", ["联轴器", "coupling"]],
  ["锁紧盘", ["锁紧盘", "胀紧套", "胀套", "收缩盘", "shrink disc", "locking assembly"]],
  ["花键", ["花键", "spline"]],
  ["过滤器", ["过滤器", "过滤精度", "filter", "filtration"]],
  ["冷却器", ["冷却器", "冷却系统", "oil cooler", "cooling system"]],
  ["密封", ["密封", "seal"]],
  ["制动器", ["制动器", "制动盘", "brake", "brake disc"]],
  ["振动传感器", ["振动传感器", "加速度传感器", "vibration sensor", "accelerometer"]],
  ["油液传感器", ["油液传感器", "磨粒传感器", "oil sensor", "debris sensor"]]
];

export const FAILURE_MODE_TAXONOMY = [
  ["微点蚀", ["微点蚀", "micropitting"]],
  ["点蚀", ["点蚀", "pitting"]],
  ["胶合与擦伤", ["胶合", "擦伤", "scuffing", "smearing"]],
  ["齿面磨损", ["齿面磨损", "tooth wear", "flank wear"]],
  ["断齿与齿根裂纹", ["断齿", "齿根裂纹", "轮齿断裂", "tooth fracture", "root crack"]],
  ["白色蚀刻裂纹", ["白色蚀刻裂纹", "白色组织裂纹", "white etching crack", "wec"]],
  ["轴承电蚀", ["轴承电蚀", "电流损伤", "fluting", "electrical erosion", "bearing current"]],
  ["轴承跑圈", ["轴承跑圈", "跑内圈", "跑外圈", "套圈蠕动", "bearing creep", "ring creep", "ring walk"]],
  ["轴承剥落", ["轴承剥落", "滚道剥落", "bearing spalling", "raceway spalling"]],
  ["保持架损伤", ["保持架损伤", "保持架断裂", "cage damage", "cage failure"]],
  ["轴系不对中", ["不对中", "同轴度超差", "misalignment"]],
  ["箱体与结构裂纹", ["箱体裂纹", "扭力臂裂纹", "housing crack", "torque arm crack"]],
  ["异常振动与异响", ["异常振动", "振动超限", "异响", "abnormal vibration", "abnormal noise"]],
  ["温升与过热", ["温升异常", "齿轮箱高温", "轴承温升", "过热", "overheating"]],
  ["漏油与密封失效", ["漏油", "渗漏", "密封失效", "oil leakage", "seal failure"]],
  ["润滑污染与失效", ["润滑失效", "油液污染", "水分超标", "清洁度超标", "lubrication failure", "oil contamination"]]
];

export const DEVELOPMENT_STAGE_TAXONOMY = [
  ["概念与方案", ["概念设计", "方案设计", "技术路线", "concept design", "architecture study"]],
  ["详细设计", ["详细设计", "设计优化", "参数优化", "detailed design", "design optimization"]],
  ["样机", ["样机", "首台套", "prototype", "demonstrator"]],
  ["台架试验", ["台架试验", "试验台", "背靠背试验", "bench test", "test rig", "back-to-back test"]],
  ["型式试验", ["型式试验", "type test"]],
  ["认证", ["认证", "certification", "type certificate"]],
  ["量产", ["量产", "批量生产", "批量下线", "mass production", "serial production"]],
  ["交付与吊装", ["交付", "发运", "吊装", "delivery", "shipment", "installation"]],
  ["并网运行", ["并网", "投运", "现场运行", "commissioning", "in operation"]],
  ["运维与技改", ["运维", "检修", "维修", "技改", "改造", "maintenance", "repair", "repowering", "retrofit"]]
];

const categoryRules = [
  ["白色蚀刻裂纹", ["白色蚀刻", "white etching", "wec"]],
  ["润滑", ["润滑", "lubric", "oil debris", "磨粒"]],
  ["状态监测", ["状态监测", "故障诊断", "振动", "condition monitoring", "fault diagnosis", "vibration", "scada", "predictive maintenance"]],
  ["轴承", ["轴承", "bearing", "main shaft"]],
  ["齿轮箱", ["齿轮箱", "gearbox", "gear mesh", "行星级", "齿轮"]],
  ["标准政策", ["标准", "政策", "认证", "standard", "regulation", "certification"]]
];

function containsKeyword(text, keyword) {
  const normalizedKeyword = keyword.toLowerCase();
  if (/^[a-z0-9 ]+$/.test(normalizedKeyword) && normalizedKeyword.length <= 4) {
    const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(text);
  }
  return text.includes(normalizedKeyword);
}

function classificationText(article) {
  return cleanText([
    article.title,
    article.titleZh,
    article.snippet,
    article.summary,
    ...(article.keyPoints || []),
    ...(article.tags || []),
    ...(article.contextTags || [])
  ].filter(Boolean).join(" ")).toLowerCase();
}

function inferDrivetrainClassificationFromText(text) {
  const technicalDomains = [];
  const technicalTags = [];
  for (const domain of DRIVETRAIN_TAXONOMY) {
    const matchedTags = domain.tags
      .filter(([, keywords]) => keywords.some((keyword) => containsKeyword(text, keyword)))
      .map(([tag]) => tag);
    if (!matchedTags.length) continue;
    technicalDomains.push(domain.domain);
    technicalTags.push(...matchedTags);
  }
  return {
    technicalDomains: [...new Set(technicalDomains)].slice(0, 5),
    technicalTags: [...new Set(technicalTags)].slice(0, 12)
  };
}

function inferTaxonomyTags(text, taxonomy, limit = 12) {
  return taxonomy
    .filter(([, keywords]) => keywords.some((keyword) => containsKeyword(text, keyword)))
    .map(([label]) => label)
    .slice(0, limit);
}

function inferComponentClassificationFromText(text) {
  const matches = DRIVETRAIN_COMPONENT_TAXONOMY
    .map((entry, index) => {
      const matchedKeywords = entry.keywords.filter((keyword) => containsKeyword(text, keyword));
      return {
        index,
      component: entry.component,
        score: matchedKeywords.reduce((total, keyword) => total + keyword.replace(/\s+/g, "").length, 0)
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);
  return {
    drivetrainComponent: matches[0]?.component || "",
    drivetrainComponents: matches.map((entry) => entry.component).slice(0, 5)
  };
}

export function inferDrivetrainClassification(article) {
  const text = classificationText(article);
  return {
    ...inferDrivetrainClassificationFromText(text),
    ...inferComponentClassificationFromText(text),
    componentTags: inferTaxonomyTags(text, DRIVETRAIN_COMPONENT_TAGS, 10),
    failureModes: inferTaxonomyTags(text, FAILURE_MODE_TAXONOMY, 8),
    developmentStages: inferTaxonomyTags(text, DEVELOPMENT_STAGE_TAXONOMY, 6)
  };
}

function directClassificationText(article) {
  return cleanText([
    article.title,
    article.titleZh,
    article.snippet
  ].filter(Boolean).join(" ")).toLowerCase();
}

function inferDirectDrivetrainClassification(article) {
  const text = directClassificationText(article);
  return {
    ...inferDrivetrainClassificationFromText(text),
    ...inferComponentClassificationFromText(text),
    componentTags: inferTaxonomyTags(text, DRIVETRAIN_COMPONENT_TAGS, 10),
    failureModes: inferTaxonomyTags(text, FAILURE_MODE_TAXONOMY, 8),
    developmentStages: inferTaxonomyTags(text, DEVELOPMENT_STAGE_TAXONOMY, 6)
  };
}

function inferEvidenceTypes(article, text) {
  const evidenceTypes = [];
  if (article.sourceType === "论文") evidenceTypes.push("论文");
  if (article.sourceType === "标准" || /(?:^|\s)(?:gb\/t|gb|iec|iso|dnv|gl)[-\s]?\d/i.test(text)) evidenceTypes.push("标准");
  if (article.sourceType === "专利") evidenceTypes.push("专利");
  if (containsKeyword(text, "台架试验") || containsKeyword(text, "bench test") || containsKeyword(text, "test rig")) evidenceTypes.push("台架试验");
  if (containsKeyword(text, "现场案例") || containsKeyword(text, "故障案例") || containsKeyword(text, "field case")) evidenceTypes.push("现场案例");
  if ((article.contextTags || []).includes("企业官网")) evidenceTypes.push("企业公告");
  else if ((article.contextTags || []).includes("研究机构")) evidenceTypes.push("研究报告");
  else if ((article.contextTags || []).some((tag) => ["行业权威", "中国风能协会"].includes(tag))) evidenceTypes.push("行业组织发布");
  else if (article.queryTopic === "official" || article.intelligenceType === "official") evidenceTypes.push("官方发布");
  else if (article.queryTopic === "industry" || article.intelligenceType === "industry") evidenceTypes.push("媒体报道");
  if (!evidenceTypes.length) evidenceTypes.push(article.sourceType || "公开资料");
  return [...new Set(evidenceTypes)].slice(0, 5);
}

const SUPPLIER_ENTITIES = [
  "南高齿", "南京高速齿轮", "ngc", "重齿", "重庆齿轮箱", "德力佳", "宁波东力", "杭齿", "winergy", "flender", "zf wind", "moventas", "eickhoff",
  "洛轴", "lyc", "瓦轴", "zwz", "新强联", "轴研科技", "zys", "skf", "schaeffler", "舍弗勒", "timken", "铁姆肯", "nsk", "ntn",
  "昆仑润滑", "长城润滑", "mobil", "美孚", "shell", "壳牌", "castrol", "嘉实多", "kluber", "klüber", "克鲁勃", "fuchs", "福斯"
];

const OEM_ENTITIES = [
  "金风", "goldwind", "远景能源", "envision", "明阳", "mingyang", "运达", "windey", "三一重能", "东方风电", "电气风电",
  "vestas", "siemens gamesa", "ge vernova", "nordex", "enercon"
];

function hasIndustryEntity(text) {
  return [...SUPPLIER_ENTITIES, ...OEM_ENTITIES].some((entity) => containsKeyword(text, entity));
}

function inferIndustryCategory(article, text) {
  const tags = article.contextTags || article.tags || [];
  if (SUPPLIER_ENTITIES.some((entity) => containsKeyword(text, entity))) return "传动链企业";
  if (OEM_ENTITIES.some((entity) => containsKeyword(text, entity))) return "整机与开发商";
  const supplierContext = tags.some((tag) => ["齿轮箱厂商", "轴承厂商", "润滑供应商", "传动链企业"].includes(tag));
  const directDrivetrainSignal = ["齿轮箱", "轴承", "传动链", "gearbox", "bearing", "drivetrain"].some((signal) => containsKeyword(text, signal));
  if (supplierContext && directDrivetrainSignal) return "传动链企业";
  const projectSignals = ["项目", "中标", "订单", "交付", "吊装", "并网", "project", "order", "delivery", "installation", "commissioning"];
  if (projectSignals.some((signal) => containsKeyword(text, signal))) return "项目进展";
  if (article.directSource && tags.some((tag) => ["齿轮箱厂商", "轴承厂商", "润滑供应商", "传动链企业"].includes(tag))) return "传动链企业";
  if (article.directSource && tags.some((tag) => ["整机厂商", "开发商", "业主"].includes(tag))) return "整机与开发商";
  return "企业动态";
}

function inferPrimarySection(article, classification, text) {
  const topic = article.queryTopic || article.intelligenceType || "technical";
  if (["论文", "标准", "专利"].includes(article.sourceType)) return "论文、标准与专利";
  const concreteFailure = classification.failureModes.length > 0 && [
    "故障", "失效", "损伤", "异常", "裂纹", "断齿", "跑圈", "剥落", "漏油", "维修", "检修", "案例",
    "failure", "damage", "fault", "crack", "fracture", "repair", "case study"
  ].some((signal) => containsKeyword(text, signal));
  if (concreteFailure) return "故障、质量与运维";
  const companyEvent = hasIndustryEntity(text) && [
    "订单", "中标", "签约", "交付", "下线", "吊装", "并网", "项目", "合作", "扩产", "工厂", "新品", "样机",
    "order", "contract", "delivery", "project", "partnership", "factory", "prototype", "installation", "commissioning"
  ].some((signal) => containsKeyword(text, signal));
  if (companyEvent) return "厂商与项目动态";
  const policyOrMarket = ["政策", "规划", "装机", "行业统计", "市场规模", "发展目标", "policy", "regulation", "market outlook", "installed capacity"]
    .some((signal) => containsKeyword(text, signal));
  if (topic === "industry" && policyOrMarket && !hasIndustryEntity(text)) return "政策、市场与产业环境";
  if (topic === "industry") return "厂商与项目动态";
  if (topic === "official") return "政策、市场与产业环境";
  return "技术与产品开发";
}

export function classifyArticle(article) {
  const topic = article.queryTopic || article.intelligenceType || "technical";
  const text = topic === "industry" || topic === "official" ? directClassificationText(article) : classificationText(article);
  const classification = topic === "industry" || topic === "official"
    ? inferDirectDrivetrainClassification(article)
    : inferDrivetrainClassification(article);
  const primarySection = inferPrimarySection(article, classification, text);
  const isDrivetrainItem = classification.drivetrainComponents.length > 0 || [
    "技术与产品开发", "故障、质量与运维", "论文、标准与专利"
  ].includes(primarySection);
  const componentCategory = classification.drivetrainComponent || (isDrivetrainItem ? "传动链总体" : "行业综合");
  const drivetrainComponents = classification.drivetrainComponents.length
    ? classification.drivetrainComponents
    : isDrivetrainItem ? [componentCategory] : [];
  return {
    ...classification,
    drivetrainComponent: componentCategory,
    drivetrainComponents,
    componentCategory,
    evidenceTypes: inferEvidenceTypes(article, text),
    industryCategory: primarySection === "厂商与项目动态" ? inferIndustryCategory(article, text) : "",
    sections: [primarySection],
    primarySection
  };
}

export function isIndustryRelevant(article) {
  if (article.queryTopic !== "industry") return false;
  const text = cleanText(`${article.title || ""} ${article.snippet || ""}`).toLowerCase();
  const hasNamedEntity = article.directSource || (article.matchTerms || []).some((term) => containsKeyword(text, term));
  if (!hasNamedEntity) return false;

  const windSignals = ["风电", "风机", "风力发电", "wind", "wind turbine", "offshore wind", "onshore wind"];
  const hasWindContext = windSignals.some((signal) => containsKeyword(text, signal));
  const developmentSignals = [
    "订单", "中标", "签约", "交付", "发运", "项目", "基地", "投产", "扩产", "产能", "工厂",
    "并购", "合作", "新品", "技术", "专利", "认证", "试验", "样机", "量产", "安装", "吊装",
    "并网", "增资", "投资", "任命", "会见", "order", "contract", "project", "plant", "factory",
    "capacity", "delivery", "shipment", "investment", "acquisition", "partnership", "technology",
    "patent", "certification", "test", "prototype", "production", "manufacturing", "installation",
    "commissioning", "repowering", "appoint", "outsource", "award", "mw", "gw", "兆瓦"
  ];
  const noiseSignals = [
    "stock could", "stock price", "share price", "undervalued", "buy rating", "早盘涨", "股价",
    "广告片", "威胁鸟类", "birds and bats", "project roi", "energy production assessment"
  ];
  const hasMarketMoveHeadline = /\bgains?\s+\d+(?:\.\d+)?%/i.test(text);
  return hasWindContext &&
    developmentSignals.some((signal) => containsKeyword(text, signal)) &&
    !noiseSignals.some((signal) => text.includes(signal)) &&
    !hasMarketMoveHeadline;
}

export function isOfficialRelevant(article) {
  if (article.queryTopic !== "official") return false;
  const text = cleanText(`${article.title || ""} ${article.snippet || ""}`).toLowerCase();
  const windSignals = ["风电", "风力发电", "风机", "wind turbine", "wind power", "wind energy"];
  const officialSignals = [
    "政策", "规划", "通知", "意见", "方案", "标准", "项目", "开工", "并网", "核准", "审批",
    "装机", "基地", "海上风电", "装备", "技术", "创新", "示范", "招标", "中标", "交付", "投产",
    "capacity", "project", "offshore", "onshore", "mw", "gw", "policy", "standard", "technology"
  ];
  const noiseSignals = ["招聘", "股票", "股价", "广告", "stock price", "job opening"];
  let allowedDomain = true;
  if (article.url && Array.isArray(article.allowedDomains) && article.allowedDomains.length) {
    try {
      const hostname = new URL(article.url).hostname.toLowerCase().replace(/^www\./, "");
      allowedDomain = article.allowedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
    } catch {
      allowedDomain = false;
    }
  }
  return allowedDomain &&
    windSignals.some((signal) => containsKeyword(text, signal)) &&
    officialSignals.some((signal) => containsKeyword(text, signal)) &&
    !noiseSignals.some((signal) => text.includes(signal));
}

export function cleanText(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function makeArticleId(url, title = "") {
  return createHash("sha1").update(`${url}|${title}`).digest("hex").slice(0, 12);
}

export function normalizeUrl(value = "") {
  try {
    const url = new URL(value);
    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid"
    ].forEach((parameter) => url.searchParams.delete(parameter));
    url.hash = "";
    return url.toString();
  } catch {
    return value;
  }
}

export function resolveNewsUrl(value = "") {
  try {
    const url = new URL(value);
    if (url.hostname.endsWith("bing.com") && url.searchParams.get("url")) {
      return normalizeUrl(url.searchParams.get("url"));
    }
    return normalizeUrl(value);
  } catch {
    return value;
  }
}

export function relevanceScore(article, keywordWeights) {
  const text = `${article.title} ${article.snippet} ${(article.tags || []).join(" ")}`.toLowerCase();
  return Object.entries(keywordWeights).reduce((score, [keyword, weight]) => {
    return text.includes(keyword.toLowerCase()) ? score + Number(weight) : score;
  }, 0);
}

export function isDomainRelevant(article) {
  const text = `${article.title} ${article.snippet} ${(article.tags || []).join(" ")}`.toLowerCase();
  const windAnchors = ["风电", "风力发电", "风机", "wind turbine", "wind power", "wind energy"];
  const strongDrivetrainAnchors = [
    "齿轮箱",
    "齿轮",
    "轴承",
    "传动链",
    "主轴",
    "行星轮",
    "行星架",
    "太阳轮",
    "内齿圈",
    "齿面修形",
    "啮合刚度",
    "传动误差",
    "扭矩密度",
    "载荷谱",
    "微点蚀",
    "胶合",
    "断齿",
    "电蚀",
    "白色蚀刻裂纹",
    "gearbox",
    "gear",
    "bearing",
    "drivetrain",
    "main shaft",
    "planetary gear",
    "planet carrier",
    "sun gear",
    "ring gear",
    "gear microgeometry",
    "transmission error",
    "mesh stiffness",
    "torque density",
    "load spectrum",
    "micropitting",
    "scuffing",
    "white etching crack",
    "electrical damage",
    "oil debris",
    "齿轮油",
    "磨粒"
  ];
  const weakDrivetrainAnchors = ["润滑", "lubric"];
  const specificWindAnchors = ["风力发电", "风机", "wind turbine"];
  const hasWindContext = windAnchors.some((keyword) => text.includes(keyword));
  const taxonomyTags = inferDrivetrainClassification(article).technicalTags;
  const hasSpecificTaxonomyContext = taxonomyTags.some((tag) => tag !== "润滑油与添加剂");
  const hasStrongDrivetrainContext = strongDrivetrainAnchors.some((keyword) => containsKeyword(text, keyword)) ||
    hasSpecificTaxonomyContext;
  const hasSpecificLubricationContext = specificWindAnchors.some((keyword) => text.includes(keyword)) &&
    weakDrivetrainAnchors.some((keyword) => text.includes(keyword));
  return hasWindContext && (hasStrongDrivetrainContext || hasSpecificLubricationContext);
}

export function inferCategory(article) {
  if (article.sourceType === "论文") return "学术论文";
  if (article.queryTopic === "industry") return "厂商动态";
  if (article.queryTopic === "official") {
    const text = `${article.title || ""} ${article.snippet || ""}`.toLowerCase();
    return ["政策", "规划", "通知", "意见", "方案", "标准", "policy", "standard"].some((keyword) => text.includes(keyword))
      ? "标准政策"
      : "行业资讯";
  }
  const text = `${article.title} ${article.snippet}`.toLowerCase();
  const match = categoryRules.find(([, keywords]) =>
    keywords.some((keyword) => containsKeyword(text, keyword))
  );
  return match?.[0] || "行业资讯";
}

export function inferTags(article) {
  const text = `${article.title} ${article.snippet}`.toLowerCase();
  const tags = [];
  for (const [category, keywords] of categoryRules) {
    if (keywords.some((keyword) => containsKeyword(text, keyword))) tags.push(category);
  }
  if (article.region) tags.push(article.region);
  if (article.sourceType) tags.push(article.sourceType);
  tags.push(...(article.contextTags || []));
  return [...new Set(tags)].slice(0, 7);
}

function articleHostname(article) {
  try {
    return new URL(article.url || article.sourceUrl || "").hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function domainMatches(hostname, domains = []) {
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function reliabilityLevel(score) {
  if (score >= 80) return { grade: "A", label: "高" };
  if (score >= 65) return { grade: "B", label: "较高" };
  if (score >= 50) return { grade: "C", label: "待核验" };
  return { grade: "D", label: "谨慎" };
}

function normalizedFeedback(value = {}) {
  const result = {};
  for (const key of ["useful", "questionable", "irrelevant", "broken"]) {
    result[key] = Math.max(0, Number(value[key] || 0));
  }
  result.total = result.useful + result.questionable + result.irrelevant + result.broken;
  return result;
}

export function feedbackCalibration(value, minimumFeedback = 5) {
  const feedback = normalizedFeedback(value);
  if (feedback.total < Number(minimumFeedback || 5)) {
    return { feedback, adjustment: 0, explanation: "" };
  }
  const sentiment = (feedback.useful - feedback.questionable - 1.25 * feedback.irrelevant - 1.5 * feedback.broken) /
    feedback.total;
  const adjustment = Math.max(-6, Math.min(6, Math.round(sentiment * 6)));
  const direction = adjustment >= 0 ? `+${adjustment}` : String(adjustment);
  return {
    feedback,
    adjustment,
    explanation: `${feedback.total} 份用户反馈带来 ${direction} 分有限修正`
  };
}

export function recalibratePublishedArticle(article, feedbackValue, minimumFeedback = 5) {
  const calibration = feedbackCalibration(feedbackValue, minimumFeedback);
  const reliability = article.reliability;
  if (!reliability?.dimensions) {
    return { ...article, feedbackAggregate: calibration.feedback };
  }
  const previousAdjustment = Number(reliability.dimensions.feedback || 0);
  const score = Math.max(0, Math.min(100,
    Number(reliability.score || 0) - previousAdjustment + calibration.adjustment
  ));
  const level = reliabilityLevel(score);
  const factors = (reliability.factors || []).filter((item) => !String(item).includes("用户反馈带来"));
  if (calibration.explanation) factors.push(calibration.explanation);
  const limitations = (reliability.limitations || [])
    .filter((item) => !String(item).includes("用户集中标记"));
  if (calibration.feedback.total >= Number(minimumFeedback || 5) && calibration.adjustment < 0) {
    limitations.push("用户集中标记需核验或不相关，已进入后续复核队列");
  }
  return {
    ...article,
    feedbackAggregate: calibration.feedback,
    reliability: {
      ...reliability,
      score,
      grade: level.grade,
      label: level.label,
      dimensions: { ...reliability.dimensions, feedback: calibration.adjustment },
      factors: factors.slice(-5),
      limitations: limitations.slice(-5),
      feedback: calibration.feedback
    }
  };
}

export function assessReliability(article, config = {}) {
  const hostname = articleHostname(article);
  const evidence = article.evidence || {};
  const factors = [];
  const limitations = [];
  const dimensions = {
    authority: 0,
    evidence: 0,
    traceability: 0,
    corroboration: 0,
    recency: 0,
    transparency: 0,
    feedback: 0,
    riskPenalty: 0
  };

  const authority = config.authorityDomains || {};
  if (article.sourceType === "论文" && evidence.doi) {
    dimensions.authority = 30;
    factors.push("论文具有 DOI 与期刊来源记录");
  } else if (article.sourceType === "论文") {
    dimensions.authority = 22;
    factors.push("来源为学术索引记录");
    limitations.push("未提供 DOI，出版状态需回到原文确认");
  } else if (domainMatches(hostname, authority.primary || [])) {
    dimensions.authority = 28;
    factors.push("来源属于政府、科研机构或行业标准组织");
  } else if (domainMatches(hostname, authority.industry || [])) {
    dimensions.authority = 23;
    factors.push("来源属于可识别的行业机构或技术发布方");
  } else if (domainMatches(hostname, authority.media || [])) {
    dimensions.authority = 16;
    factors.push("来源为可识别的新闻或财经发布平台");
    limitations.push("媒体转载不能替代技术报告、试验数据或原始公告");
  } else {
    dimensions.authority = 11;
    limitations.push("来源权威层级尚未纳入已知清单");
  }

  const excerpt = cleanText(article.snippet || "");
  if (article.contentAccess === "fulltext" && excerpt.length >= 500) {
    dimensions.evidence = 24;
    factors.push(article.sourceType === "论文" ? "已提取公开开放获取论文正文" : "已提取发布方公开正文");
  } else if (evidence.hasAbstract || excerpt.length >= 180) {
    dimensions.evidence = 20;
    factors.push(article.sourceType === "论文" ? "索引提供了论文摘要" : "发布方提供了较完整的公开摘要");
  } else if (evidence.hasPublisherDescription || excerpt.length >= 70) {
    dimensions.evidence = 13;
    factors.push("发布方提供了可核查的内容简介");
  } else {
    dimensions.evidence = 4;
    limitations.push("公开索引缺少足够摘要，无法仅凭标题判断结论");
  }

  if (article.linkType === "publisher" && article.linkVerified) {
    dimensions.traceability = 15;
    factors.push("原文直链已在采集时验证");
  } else if (article.linkType === "publisher") {
    dimensions.traceability = 11;
    factors.push("链接指向发布方或 DOI 页面");
  } else {
    dimensions.traceability = 4;
    limitations.push("当前为聚合跳转链接，需确认最终发布方页面");
  }

  const corroboratingSources = [...new Set(article.corroboratingSources || [])].filter(Boolean);
  dimensions.corroboration = Math.min(14, corroboratingSources.length * 6);
  if (corroboratingSources.length) {
    factors.push(`发现 ${corroboratingSources.length} 个独立来源报道相近信息`);
  } else {
    limitations.push("本轮采集未发现独立来源交叉印证");
  }

  const ageDays = Math.max(0, (Date.now() - new Date(article.publishedAt || 0).getTime()) / 86400000);
  dimensions.recency = ageDays <= 30 ? 8 : ageDays <= 180 ? 5 : 2;
  if (dimensions.recency >= 5) factors.push("发布时间处于当前监测窗口");

  if (article.source && article.publishedAt && article.sourceChannel) {
    dimensions.transparency = 8;
    factors.push("来源、日期和采集通道信息完整");
  } else {
    dimensions.transparency = 3;
    limitations.push("来源元数据不完整");
  }

  const claimText = `${article.title || ""} ${excerpt}`.toLowerCase();
  const commercialSignals = config.commercialSignals || ["咨询", "市场规模", "深度分析报告", "market size", "market forecast"];
  const selfClaimSignals = config.selfClaimSignals || ["公司表示", "公司称", "主要产品涵盖", "宣布", "unveils", "announces"];
  if (commercialSignals.some((signal) => claimText.includes(signal.toLowerCase()))) {
    dimensions.riskPenalty -= 8;
    limitations.push("内容含商业报告或市场预测信号，方法与样本需额外核验");
  }
  if (selfClaimSignals.some((signal) => claimText.includes(signal.toLowerCase()))) {
    dimensions.riskPenalty -= 6;
    limitations.push("内容可能主要来自企业自述，尚不能视为独立验证");
  }
  if (evidence.publicationType === "preprint") {
    dimensions.riskPenalty -= 5;
    limitations.push("资料为预印本，尚未确认同行评审状态");
  }

  const calibration = feedbackCalibration(article.feedbackAggregate, config.minimumFeedback);
  const feedback = calibration.feedback;
  dimensions.feedback = calibration.adjustment;
  if (calibration.explanation) factors.push(calibration.explanation);

  const rawScore = Object.values(dimensions).reduce((sum, value) => sum + value, 0);
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const level = reliabilityLevel(score);
  return {
    score,
    grade: level.grade,
    label: level.label,
    methodVersion: "1.0",
    dimensions,
    factors: factors.slice(0, 5),
    limitations: limitations.slice(0, 5),
    feedback
  };
}

export function deduplicateArticles(articles) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  const accepted = [];
  return articles.filter((article) => {
    const normalizedUrl = normalizeUrl(article.url);
    const titleKey = cleanText(article.title).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
    const duplicateEvent = accepted.some((candidate) => isSameIndustryEvent(article, candidate));
    if (!normalizedUrl || !titleKey || seenUrls.has(normalizedUrl) || seenTitles.has(titleKey) || duplicateEvent) {
      return false;
    }
    seenUrls.add(normalizedUrl);
    seenTitles.add(titleKey);
    article.url = normalizedUrl;
    accepted.push(article);
    return true;
  });
}

const eventStopWords = new Set([
  "wind", "turbine", "turbines", "power", "energy", "group", "systems", "new", "three",
  "order", "orders", "secures", "secured", "wins", "lands", "bags", "receives", "received",
  "announces", "announced", "totalling", "totaling", "megawatt", "project", "projects"
]);

function eventTitleTokens(value) {
  const normalized = cleanText(value)
    .toLowerCase()
    .replace(/united states|u\.s\.|usa/g, "us")
    .replace(/japanese/g, "japan")
    .replace(/german/g, "germany")
    .replace(/totalling/g, "totaling");
  const tokens = new Set(
    (normalized.match(/[a-z0-9.]{3,}/g) || []).filter((token) => !eventStopWords.has(token))
  );
  for (const sequence of normalized.match(/[\p{Script=Han}]{2,}/gu) || []) {
    for (let index = 0; index < sequence.length - 1; index += 1) {
      tokens.add(sequence.slice(index, index + 2));
    }
  }
  return tokens;
}

function eventNumbers(value) {
  const normalized = cleanText(value).toLowerCase().replace(/(\d)\s*-\s*(mw|gw)\b/g, "$1$2");
  return new Set(
    (normalized.match(/\d+(?:\.\d+)?\s*(?:mw|gw|兆瓦|亿元|亿|万|%)?/g) || [])
      .map((item) => item.replace(/\s+/g, ""))
  );
}

const knownIndustryEntities = [
  "金风科技", "远景能源", "明阳智能", "运达股份", "电气风电", "东方风电", "中车株洲所",
  "南高齿", "南京高速齿轮", "重庆齿轮箱", "宁波东力", "德力佳", "中车戚墅堰所", "杭齿前进",
  "洛轴", "瓦轴", "新强联", "天马轴承", "轴研科技", "昆仑润滑", "长城润滑油",
  "Vestas", "Siemens Gamesa", "GE Vernova", "Nordex", "Enercon", "Goldwind", "Envision",
  "MingYang", "ZF Wind Power", "Winergy", "Flender", "Moventas", "Eickhoff", "RENK", "Wikov",
  "SKF", "Schaeffler", "Timken", "NSK", "NTN", "Liebherr", "Castrol", "ExxonMobil", "Kluber", "FUCHS"
];

function matchedIndustryEntities(article) {
  const title = cleanText(article.title).toLowerCase();
  const candidates = [...new Set([...(article.matchTerms || []), ...knownIndustryEntities])];
  return new Set(candidates.filter((term) => containsKeyword(title, term)));
}

function isSameIndustryEvent(left, right) {
  const leftIsIndustry = left.queryTopic === "industry" || left.intelligenceType === "industry";
  const rightIsIndustry = right.queryTopic === "industry" || right.intelligenceType === "industry";
  if (!leftIsIndustry || !rightIsIndustry) return false;

  const leftTime = new Date(left.publishedAt || 0).getTime();
  const rightTime = new Date(right.publishedAt || 0).getTime();
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) &&
      Math.abs(leftTime - rightTime) > 3 * 86400000) return false;

  const leftNumbers = eventNumbers(left.title);
  const rightNumbers = eventNumbers(right.title);
  const sharedNumbers = [...leftNumbers].filter((number) => rightNumbers.has(number));
  if (leftNumbers.size && rightNumbers.size && !sharedNumbers.length) return false;

  const leftEntities = matchedIndustryEntities(left);
  const rightEntities = matchedIndustryEntities(right);
  const sharesEntity = [...leftEntities].some((entity) => rightEntities.has(entity));
  if (sharesEntity && sharedNumbers.some((number) => /(?:mw|gw|兆瓦|亿元|亿)$/.test(number))) {
    return true;
  }

  const leftTokens = eventTitleTokens(left.title);
  const rightTokens = eventTitleTokens(right.title);
  if (Math.min(leftTokens.size, rightTokens.size) < 2) return false;
  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) overlap += 1;
  });
  return sharesEntity && overlap >= 2 && overlap / Math.min(leftTokens.size, rightTokens.size) >= 0.66;
}

export function createFallbackSummary(article) {
  const snippet = cleanText(article.snippet).replace(/^abstract[\s.:;-]*/i, "").trim();
  const title = cleanText(article.title);
  const comparableSnippet = snippet.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const comparableTitle = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const titleRemainder = snippet.startsWith(title)
    ? snippet.slice(title.length).replace(/^[,，:：\s-]+/, "")
    : "";
  const hasDistinctExcerpt = snippet.length >= 40 &&
    comparableSnippet !== comparableTitle &&
    !(titleRemainder && titleRemainder.length < 40);
  const firstSentence = snippet.split(/(?<=[。！？.!?])\s*/)[0] || snippet;
  const compact = firstSentence.slice(0, 150);
  return {
    titleZh: /[\p{Script=Han}]/u.test(title) ? title : "",
    summary: hasDistinctExcerpt && compact.length >= 24
      ? compact
      : `原始索引未提供可用摘要。资料主题为“${title.slice(0, 80)}”，请打开原文核对研究方法、数据和结论边界。`,
    keyPoints: [
      `来源：${article.source || "未知来源"}`,
      `主题：${inferCategory(article)}`,
      article.publishedAt ? `发布时间：${article.publishedAt.slice(0, 10)}` : "发布时间待确认"
    ],
    engineeringImpact: "建议结合具体机型、载荷谱和失效样本评估其工程适用性。",
    category: inferCategory(article),
    tags: inferTags(article),
    paperDetails: {
      objective: "",
      methods: "",
      testObject: "",
      operatingConditions: "",
      quantitativeFindings: [],
      limitations: []
    },
    industryDetails: {
      eventType: "",
      companies: [],
      location: "",
      capacity: "",
      investment: "",
      timeline: "",
      supplyChainImpact: "",
      verificationStatus: "",
      quantitativeFacts: []
    },
    experienceReview: {
      status: "无经验",
      synthesis: "",
      applicableBoundary: "",
      verificationNeeded: ""
    }
  };
}

function normalizedPaperDetails(value = {}) {
  value = value && typeof value === "object" ? value : {};
  return {
    objective: cleanText(value.objective || ""),
    methods: cleanText(value.methods || ""),
    testObject: cleanText(value.testObject || ""),
    operatingConditions: cleanText(value.operatingConditions || ""),
    quantitativeFindings: (Array.isArray(value.quantitativeFindings) ? value.quantitativeFindings : [])
      .map((item) => ({
        metric: cleanText(item?.metric || ""),
        value: cleanText(item?.value || ""),
        unit: cleanText(item?.unit || ""),
        comparison: cleanText(item?.comparison || ""),
        conditions: cleanText(item?.conditions || ""),
        evidence: cleanText(item?.evidence || "")
      }))
      .filter((item) => item.metric && item.value)
      .slice(0, 6),
    limitations: (Array.isArray(value.limitations) ? value.limitations : [])
      .map(cleanText)
      .filter(Boolean)
      .slice(0, 5)
  };
}

function normalizedIndustryDetails(value = {}) {
  value = value && typeof value === "object" ? value : {};
  return {
    eventType: cleanText(value.eventType || ""),
    companies: (Array.isArray(value.companies) ? value.companies : []).map(cleanText).filter(Boolean).slice(0, 8),
    location: cleanText(value.location || ""),
    capacity: cleanText(value.capacity || ""),
    investment: cleanText(value.investment || ""),
    timeline: cleanText(value.timeline || ""),
    supplyChainImpact: cleanText(value.supplyChainImpact || ""),
    verificationStatus: cleanText(value.verificationStatus || ""),
    quantitativeFacts: (Array.isArray(value.quantitativeFacts) ? value.quantitativeFacts : [])
      .map(cleanText)
      .filter(Boolean)
      .slice(0, 6)
  };
}

export function publicEngineeringExperience(value = {}) {
  const counts = {};
  for (const key of ["total", "supports", "conditional", "contradicts", "uncertain"]) {
    counts[key] = Math.max(0, Number(value[key] || 0));
  }
  return {
    ...counts,
    writtenTotal: Math.max(0, Number(value.writtenTotal || 0)),
    averageConfidence: Math.max(0, Math.min(5, Number(value.averageConfidence || 0))),
    evidence: Object.fromEntries(
      Object.entries(value.evidence || {})
        .map(([key, count]) => [cleanText(key), Math.max(0, Number(count || 0))])
        .filter(([key, count]) => key && count > 0)
        .slice(0, 8)
    ),
    topContexts: (Array.isArray(value.topContexts) ? value.topContexts : [])
      .map((item) => ({ context: cleanText(item?.context || ""), count: Math.max(0, Number(item?.count || 0)) }))
      .filter((item) => item.context && item.count > 0)
      .slice(0, 5)
  };
}

function normalizedExperienceReview(value = {}) {
  value = value && typeof value === "object" ? value : {};
  const statuses = new Set(["无经验", "待核验", "部分支持", "有条件适用", "存在冲突"]);
  return {
    status: statuses.has(value.status) ? value.status : "无经验",
    synthesis: cleanText(value.synthesis || ""),
    applicableBoundary: cleanText(value.applicableBoundary || ""),
    verificationNeeded: cleanText(value.verificationNeeded || "")
  };
}

export function toPublicArticle(article, summaryData) {
  const classification = classifyArticle({
    ...article,
    titleZh: summaryData.titleZh,
    summary: summaryData.summary,
    keyPoints: summaryData.keyPoints,
    engineeringImpact: summaryData.engineeringImpact,
    tags: summaryData.tags
  });
  const contentAccess = ["fulltext", "abstract", "metadata"].includes(article.contentAccess)
    ? article.contentAccess
    : article.evidence?.hasAbstract || article.evidence?.hasPublisherDescription
      ? "abstract"
      : "metadata";
  const publicArticle = {
    id: article.id || makeArticleId(article.url, article.title),
    title: cleanText(article.title),
    source: cleanText(article.source || "未知来源"),
    sourceType: article.sourceType || "行业资讯",
    region: article.region || "海外",
    language: article.language || "en",
    publishedAt: article.publishedAt || new Date().toISOString(),
    collectedAt: article.collectedAt || new Date().toISOString(),
    url: normalizeUrl(article.url),
    sourceUrl: normalizeUrl(article.sourceUrl || ""),
    sourceChannel: cleanText(article.sourceChannel || "网络公开来源"),
    linkType: article.linkType === "aggregator" ? "aggregator" : "publisher",
    linkVerified: Boolean(article.linkVerified),
    evidence: {
      hasAbstract: Boolean(article.evidence?.hasAbstract),
      hasPublisherDescription: Boolean(article.evidence?.hasPublisherDescription),
      doi: cleanText(article.evidence?.doi || ""),
      authorsCount: Number(article.evidence?.authorsCount || 0),
      authors: (Array.isArray(article.evidence?.authors) ? article.evidence.authors : []).map(cleanText).filter(Boolean).slice(0, 8),
      citedByCount: Number(article.evidence?.citedByCount || 0),
      publicationType: cleanText(article.evidence?.publicationType || ""),
      journal: cleanText(article.evidence?.journal || ""),
      issnL: cleanText(article.evidence?.issnL || ""),
      issns: (Array.isArray(article.evidence?.issns) ? article.evidence.issns : []).map(cleanText).filter(Boolean).slice(0, 4),
      publisher: cleanText(article.evidence?.publisher || ""),
      volume: cleanText(article.evidence?.volume || ""),
      issue: cleanText(article.evidence?.issue || ""),
      firstPage: cleanText(article.evidence?.firstPage || ""),
      lastPage: cleanText(article.evidence?.lastPage || ""),
      isOpenAccess: Boolean(article.evidence?.isOpenAccess),
      isInDoaj: Boolean(article.evidence?.isInDoaj),
      contentAccess,
      contentSource: cleanText(article.contentSource || ""),
      extractedCharacters: Math.max(0, Number(article.extractedCharacters || 0)),
      sourceMetrics: {
        provider: cleanText(article.evidence?.sourceMetrics?.provider || ""),
        metricName: cleanText(article.evidence?.sourceMetrics?.metricName || ""),
        twoYearMeanCitedness: Number(article.evidence?.sourceMetrics?.twoYearMeanCitedness || 0),
        hIndex: Number(article.evidence?.sourceMetrics?.hIndex || 0),
        i10Index: Number(article.evidence?.sourceMetrics?.i10Index || 0),
        worksCount: Number(article.evidence?.sourceMetrics?.worksCount || 0),
        citedByCount: Number(article.evidence?.sourceMetrics?.citedByCount || 0),
        updatedAt: cleanText(article.evidence?.sourceMetrics?.updatedAt || "")
      }
    },
    corroboratingSources: [...new Set(article.corroboratingSources || [])].map(cleanText).filter(Boolean).slice(0, 6),
    feedbackAggregate: normalizedFeedback(article.feedbackAggregate),
    engineeringExperience: publicEngineeringExperience(article.engineeringExperience),
    intelligenceType: article.queryTopic === "industry"
      ? "industry"
      : article.queryTopic === "official"
        ? "official"
        : "technical",
    primarySection: classification.primarySection,
    sections: classification.sections,
    technicalDomains: classification.technicalDomains,
    technicalTags: classification.technicalTags,
    componentTags: classification.componentTags,
    failureModes: classification.failureModes,
    developmentStages: classification.developmentStages,
    evidenceTypes: classification.evidenceTypes,
    industryCategory: classification.industryCategory,
    drivetrainComponent: classification.drivetrainComponent,
    drivetrainComponents: classification.drivetrainComponents,
    componentCategory: classification.componentCategory,
    titleZh: cleanText(summaryData.titleZh || (/[\p{Script=Han}]/u.test(article.title || "") ? article.title : "")),
    category: article.queryTopic === "industry"
      ? "厂商动态"
      : article.queryTopic === "official"
        ? summaryData.category || inferCategory(article)
        : summaryData.category || inferCategory(article),
    tags: [...new Set([
      ...(summaryData.tags?.length ? summaryData.tags : inferTags(article)),
      ...(article.contextTags || []),
      ...classification.technicalTags
    ])].map(cleanText).filter(Boolean).slice(0, 16),
    summary: cleanText(summaryData.summary),
    keyPoints: (summaryData.keyPoints || []).map(cleanText).filter(Boolean).slice(0, 5),
    engineeringImpact: cleanText(summaryData.engineeringImpact),
    paperDetails: normalizedPaperDetails(summaryData.paperDetails),
    industryDetails: normalizedIndustryDetails(summaryData.industryDetails),
    experienceReview: normalizedExperienceReview(summaryData.experienceReview),
    readingMinutes: Math.max(2, Math.min(12, Math.round(cleanText(article.snippet).length / 240) + 2)),
    relevanceScore: Number(article.relevanceScore || 0)
  };
  publicArticle.reliability = assessReliability(article, article.reliabilityConfig || {});
  return publicArticle;
}
