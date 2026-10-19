import { normalizeReadingBrief, READING_BRIEF_VERSION } from "../../public/lib/reading.mjs";

export const READING_INSTRUCTIONS = [
  "readingBrief 是直接展示在首页的工程师阅读稿，不是摘要字段拼接。headline 用准确的中文对象+动作/主要进展表达，不夸大为突破或首创。",
  "paragraphs 写成1-2个流畅自然的段落：先说明谁针对什么对象、采用什么结构/方法、取得什么结果，再在有依据时自然带出对齿轮箱开发的具体借鉴点。不使用‘关键数据：’‘工程意义：’等分点标签。",
  "按信息价值控制详略：技术研究优先交代机制、结构、工况、对照和结果，通常180-350字；采购、招标或简短动态通常80-160字，保留部件范围、金额口径和实际阶段。有价值的复杂内容可适当加长，信息少时不要凑字数。",
  "日期和来源在独立标签中展示，正文不重复上线日期、卷期、转载经过，不评价来源，不写‘未披露/信息不足/需核验原文’之类流程说明。实际合同/交付节点和试验边界仍须保留。",
  "严格区分仿真、台架、现场验证和企业自述；通用齿轮论文不能改称风电现场验证。百分比保留比较对象、金额保留整体包件口径、候选公示不能写成已中标。工程建议用‘可关注/可用于/需结合实际工况’等措辞，不冒充实测结论。",
  "只采用本条原始标题与摘录中的数据，原样保留数值和单位，不自行换算、推算增幅或借用写作示例/其他条目的数据。没有定量结果时写清定性机制，不捏造数字。",
  "highlights 返回正文中原样出现的2-8个短语，优先选择关键数值连同单位、技术结构或关键状态，不返回整句，不插入HTML或Markdown。summary 与 readingBrief 第一段保持一致；engineeringImpact 可为空，避免硬凑泛泛的行业意义。",
  "以下示例仅供学习表达，不是本轮事实证据，不得把其名称或数字迁移到其他资料：",
  "技术产品示例：南方宇航16.XMW MCD紧凑型半直驱齿轮箱完成下线及型式试验。方案采用四级行星传动，首级多行星轮配合柔性销轴改善均载，并以同心嵌套结构压缩轴向空间；按企业披露的比较口径，径向直径增加28%，传动链长度缩短51%，扭矩密度达到270 N·m/kg。高速输出轴配置绝缘与电流导流结构，以降低电蚀风险。第二段可讨论径向包络与轴向紧凑性的取舍，以及均载、电气保护与机舱接口联动验证。",
  "论文写作示例：一项通用齿轮计算研究以eAssistant及ISO 6336评估滚刀凸角对齿根应力和啮合性能的影响。在相同5°凸角下，凸角系数由0.01增至0.1时，应力由33.6增至40 N/mm²，重合度由1.276降至0.700。对齿轮开发的借鉴在于把刀具凸角、磨削余量、齿根圆角和有效啮合区一并校核；这是特定算例结果，应用时需结合实际模数、材料和载荷谱。",
  "短动态写作示例：天上坪风电场液压系统及齿轮箱油管维护项目进入候选人公示阶段，首选候选人报价607985.20元，金额对应整个维护包件，并非单一部件价格。该项维护涉及油路与液压系统，检修恢复时可关注渗漏、软管和密封状态，以及压力与清洁度检查。"
].join("\n");

export function parseReadingBrief(value, source = {}) {
  if (source.contentAccess === "metadata" || source.sourceEvidenceKind === "previous-summary") return null;
  const brief = normalizeReadingBrief({ ...value, version: READING_BRIEF_VERSION });
  if (!brief) return null;
  const sourceText = `${source.title || ""} ${source.snippet || ""}`;
  if (!source.snippet) return null;
  const numbers = (value) => String(value).match(/\d+(?:\.\d+)?/g) || [];
  const available = new Set(numbers(sourceText));
  // A necessary numerical guard, not a substitute for checking metric/unit/context.
  if (numbers(`${brief.headline} ${brief.paragraphs.join(" ")}`).some((number) => !available.has(number))) return null;
  return brief;
}
