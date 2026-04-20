/**
 * Showcase Seed Script — "企业Agent大赏"
 *
 * Populates the showcase module with demo data matching the design mockup.
 * Each case includes an initial_prompt that auto-sends when user clicks "Run".
 *
 * Run with: npx tsx prisma/seed-showcase.ts
 * Idempotent — cleans existing showcase data before inserting.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🏆 Seeding showcase data (企业Agent大赏)...');

  const org = await prisma.organizations.findFirst();
  if (!org) {
    throw new Error('No organization found. Run the main seed first: npx tsx prisma/seed.ts');
  }
  const orgId = org.id;
  console.log(`Using organization: ${org.name} (${orgId})`);

  // Clean existing
  await prisma.showcase_cases.deleteMany({ where: { organization_id: orgId } });
  await prisma.showcase_domains.deleteMany({ where: { organization_id: orgId } });
  await prisma.showcase_industries.deleteMany({ where: { organization_id: orgId } });
  console.log('Cleaned existing showcase data.');

  // ========================================================================
  // Industries
  // ========================================================================
  const fmcg = await prisma.showcase_industries.create({
    data: { organization_id: orgId, name: '快消品', slug: 'fmcg', sort_order: 0 },
  });
  const auto = await prisma.showcase_industries.create({
    data: { organization_id: orgId, name: '汽车行业', slug: 'automotive', sort_order: 1 },
  });

  // ========================================================================
  // 快消品 — 生产执行 (Production)
  // ========================================================================
  const prodExec = await prisma.showcase_domains.create({
    data: { organization_id: orgId, industry_id: fmcg.id, name: '生产执行', name_en: 'Production', icon: '🏭', sort_order: 0 },
  });

  await prisma.showcase_cases.createMany({
    data: [
      {
        organization_id: orgId, domain_id: prodExec.id, sort_order: 0,
        title: '生产执行',
        description: '排产下达、物料领用、过程记录、成品报入、MES集成',
        initial_prompt: '我需要为明天的饮料生产线制定排产计划。产品是500ml矿泉水，目标产量10万瓶。请帮我完成排产下达，包括物料需求计算、产线分配和工单生成。',
      },
      {
        organization_id: orgId, domain_id: prodExec.id, sort_order: 1,
        title: '设备运维',
        description: '预防维护、振动分析、故障诊断、备件申领、TPM管理',
        initial_prompt: '灌装线3号设备最近振动值偏高，请帮我做一次振动分析诊断，判断是否需要停机维护，并生成预防性维护工单。',
      },
      {
        organization_id: orgId, domain_id: prodExec.id, sort_order: 2,
        title: '能耗管理',
        description: '水电气监控、能源审计、碳足迹分析、节能方案',
        initial_prompt: '请帮我分析本月工厂的水电气能耗数据，对比上月的消耗趋势，识别异常能耗点，并给出节能优化建议。',
      },
      {
        organization_id: orgId, domain_id: prodExec.id, sort_order: 3,
        title: '现场治理',
        description: '6S管理、安全生产、环保监控、现场看板、精益生产',
        initial_prompt: '请帮我对A车间进行一次6S检查评估，生成检查报告，标注不合格项并给出整改建议和时间表。',
      },
    ],
  });

  // ========================================================================
  // 快消品 — 质量保障 (Quality)
  // ========================================================================
  const quality = await prisma.showcase_domains.create({
    data: { organization_id: orgId, industry_id: fmcg.id, name: '质量保障', name_en: 'Quality', icon: '✅', sort_order: 1 },
  });

  await prisma.showcase_cases.createMany({
    data: [
      {
        organization_id: orgId, domain_id: quality.id, sort_order: 0,
        title: '检验检测',
        description: '原料检验、在线巡检、成品留样、超标预警、实验室LIMS',
        initial_prompt: '今天到了一批新的原料（棕榈油，供应商：益海嘉里，批次号：PO-20260412），请帮我执行进厂检验流程，包括取样方案、检测项目确认和判定标准。',
      },
      {
        organization_id: orgId, domain_id: quality.id, sort_order: 1,
        title: '质量认证',
        description: 'ISO标准、供应商审核、体系审查、记录存档、审核应对',
        initial_prompt: '下个月有ISO 22000食品安全管理体系的外审，请帮我准备审核应对方案，列出需要检查的文件清单、常见不符合项和整改预案。',
      },
      {
        organization_id: orgId, domain_id: quality.id, sort_order: 2,
        title: '风险管理',
        description: '质量波动预警、投诉分析、纠正预防(CAPA)、风险规划',
        initial_prompt: '最近一周收到3起消费者投诉，反映产品口感异常。请帮我分析这些投诉的共性，追溯可能的质量波动原因，并启动CAPA流程。',
      },
      {
        organization_id: orgId, domain_id: quality.id, sort_order: 3,
        title: '溯源查询',
        description: '一码到底、批次追踪、正向追踪、反向召回、质量透明',
        initial_prompt: '需要对批次号 BT-20260401-A3 的产品进行正向追踪，请帮我查询该批次从原料入库到成品出库的完整流转记录，包括各环节的质检结果。',
      },
    ],
  });

  // ========================================================================
  // 快消品 — 物流配送 (Logistics)
  // ========================================================================
  const logistics = await prisma.showcase_domains.create({
    data: { organization_id: orgId, industry_id: fmcg.id, name: '物流配送', name_en: 'Logistics', icon: '🚚', sort_order: 2 },
  });

  await prisma.showcase_cases.createMany({
    data: [
      {
        organization_id: orgId, domain_id: logistics.id, sort_order: 0,
        title: '运输调度',
        description: '干线调度、配送派单、司机管理、排线优化、TMS协同',
        initial_prompt: '明天有50单华东区域的配送任务，请帮我做运输调度规划，包括车辆分配、路线优化和司机派单，目标是降低空驶率到15%以下。',
      },
      {
        organization_id: orgId, domain_id: logistics.id, sort_order: 1,
        title: '全程监控',
        description: '冷链温控、断电告示、开门检测、位置跟踪、异常报警',
        initial_prompt: '请帮我检查当前在途的所有冷链运输车辆状态，特别关注温度是否在-18°C到-15°C的合规范围内，如有异常请立即生成告警报告。',
      },
      {
        organization_id: orgId, domain_id: logistics.id, sort_order: 2,
        title: '承运商评价',
        description: '时效准点率、货损率、运费核算、满意度评价',
        initial_prompt: '请帮我生成本季度所有承运商的绩效评估报告，包括准时率、货损率、运费偏差和客户满意度评分，并给出续约建议。',
      },
      {
        organization_id: orgId, domain_id: logistics.id, sort_order: 3,
        title: '末端配送',
        description: '最后1公里、区域站分拣、周转箱回收、直达费管控',
        initial_prompt: '上海浦东区域站今天有200单末端配送任务，请帮我优化分拣方案和配送路线，同时统计周转箱回收情况和配送成本。',
      },
    ],
  });

  // ========================================================================
  // 汽车行业 — 研发设计 (R&D)
  // ========================================================================
  const rd = await prisma.showcase_domains.create({
    data: { organization_id: orgId, industry_id: auto.id, name: '研发设计', name_en: 'R&D', icon: '🔬', sort_order: 0 },
  });

  await prisma.showcase_cases.createMany({
    data: [
      {
        organization_id: orgId, domain_id: rd.id, sort_order: 0,
        title: 'CAE仿真分析',
        description: '碰撞模拟、NVH分析、热管理仿真、结构强度校核',
        initial_prompt: '我们正在开发一款新能源SUV的前防撞梁，请帮我设置一个正面碰撞仿真方案（C-NCAP标准，50km/h），包括边界条件、材料参数和评判指标。',
      },
      {
        organization_id: orgId, domain_id: rd.id, sort_order: 1,
        title: 'BOM管理',
        description: 'EBOM/MBOM转换、变更管理、零件通用化、成本估算',
        initial_prompt: '新车型X7的EBOM已经冻结，请帮我执行EBOM到MBOM的转换，识别需要新增的工艺路线，并标注与现有车型可共用的零件清单。',
      },
      {
        organization_id: orgId, domain_id: rd.id, sort_order: 2,
        title: '试验验证',
        description: '台架试验、路试管理、耐久性测试、数据采集分析',
        initial_prompt: '新开发的电驱动总成需要进行台架耐久性测试，请帮我制定测试计划，包括测试工况、持续时间、数据采集点和通过标准。',
      },
      {
        organization_id: orgId, domain_id: rd.id, sort_order: 3,
        title: '项目管理',
        description: 'APQP节点、里程碑跟踪、资源协调、风险预警',
        initial_prompt: '请帮我检查X7车型项目当前的APQP进度，哪些里程碑已延期？请生成风险评估报告并给出赶工方案建议。',
      },
    ],
  });

  // ========================================================================
  // 汽车行业 — 供应链 (Supply Chain)
  // ========================================================================
  const supplyChain = await prisma.showcase_domains.create({
    data: { organization_id: orgId, industry_id: auto.id, name: '供应链', name_en: 'Supply Chain', icon: '🔗', sort_order: 1 },
  });

  await prisma.showcase_cases.createMany({
    data: [
      {
        organization_id: orgId, domain_id: supplyChain.id, sort_order: 0,
        title: '供应商管理',
        description: '准入评审、绩效考核、产能监控、风险预警、二级供应商',
        initial_prompt: '有一家新的电池供应商（宁德新能源）申请准入，请帮我启动供应商准入评审流程，生成评审检查表，包括资质审核、产能评估和质量体系审查。',
      },
      {
        organization_id: orgId, domain_id: supplyChain.id, sort_order: 1,
        title: '采购协同',
        description: '询比价、合同管理、交付跟踪、对账结算、VMI管理',
        initial_prompt: '下季度需要采购10万套车灯总成，请帮我发起询比价流程，对比现有3家供应商的报价、交期和质量表现，给出推荐方案。',
      },
      {
        organization_id: orgId, domain_id: supplyChain.id, sort_order: 2,
        title: '库存优化',
        description: '安全库存、ABC分类、呆滞预警、JIT配送、库龄分析',
        initial_prompt: '请帮我分析当前零部件仓库的库存健康度，执行ABC分类，识别库龄超过90天的呆滞物料，并给出安全库存调整建议。',
      },
      {
        organization_id: orgId, domain_id: supplyChain.id, sort_order: 3,
        title: '物料计划',
        description: 'MRP运算、齐套分析、缺料预警、替代料管理',
        initial_prompt: '下月生产计划是5000台X5车型，请帮我运行MRP计算，检查物料齐套情况，标注缺料风险项并建议替代料方案。',
      },
    ],
  });

  // ========================================================================
  // 汽车行业 — 售后服务 (After-Sales)
  // ========================================================================
  const afterSales = await prisma.showcase_domains.create({
    data: { organization_id: orgId, industry_id: auto.id, name: '售后服务', name_en: 'After-Sales', icon: '🔧', sort_order: 2 },
  });

  await prisma.showcase_cases.createMany({
    data: [
      {
        organization_id: orgId, domain_id: afterSales.id, sort_order: 0,
        title: '故障诊断',
        description: '远程诊断、DTC解析、维修方案推荐、技术通报',
        initial_prompt: '一辆2024款X5（VIN: LFV3A28K...）报了故障码P0171（系统过稀），请帮我解析这个DTC，分析可能的故障原因，并推荐维修方案和所需配件。',
      },
      {
        organization_id: orgId, domain_id: afterSales.id, sort_order: 1,
        title: '配件管理',
        description: '配件预测、库存调拨、真伪鉴别、价格管理',
        initial_prompt: '华南区域的刹车片库存即将告急，请帮我分析近3个月的消耗趋势，预测下月需求量，并生成从华东仓库调拨的方案。',
      },
      {
        organization_id: orgId, domain_id: afterSales.id, sort_order: 2,
        title: '客户关怀',
        description: '保养提醒、满意度回访、投诉处理、会员运营',
        initial_prompt: '请帮我筛选出本月需要进行首保提醒的客户名单（购车满5000公里或6个月），生成个性化的保养提醒短信模板和预约链接。',
      },
      {
        organization_id: orgId, domain_id: afterSales.id, sort_order: 3,
        title: '索赔管理',
        description: '索赔申请、审核流程、费用核算、供应商追偿',
        initial_prompt: '经销商提交了一批保修索赔申请（共15单），请帮我审核这些索赔的合规性，核算费用，标注可向供应商追偿的项目。',
      },
    ],
  });

  // Summary
  const totalCases = await prisma.showcase_cases.count({ where: { organization_id: orgId } });
  const totalDomains = await prisma.showcase_domains.count({ where: { organization_id: orgId } });

  console.log('\n✅ Showcase data seeded successfully!');
  console.log(`   Industries: 2 (快消品, 汽车行业)`);
  console.log(`   Domains: ${totalDomains}`);
  console.log(`   Cases: ${totalCases}`);
}

main()
  .catch((e) => {
    console.error('❌ Showcase seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
