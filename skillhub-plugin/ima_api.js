/**
 * ima_api.js - LumaPost SkillHub 插件执行逻辑
 * 
 * 当用户在 SkillHub 触发插件时，调用此脚本执行：
 * 1. 检查SMTP配置
 * 2. 搜索新闻（8个领域）
 * 3. 生成JSON数据
 * 4. 生成HTML邮件
 * 5. 发送邮件
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置路径
const PROJECT_ROOT = path.resolve(__dirname, '..'); // lumapost 项目根目录
const DATA_DIR = path.join(PROJECT_ROOT, 'lumapost', 'data');
const SCRIPTS_DIR = path.join(PROJECT_ROOT, 'lumapost', 'scripts');

/**
 * 检查配置是否完整
 */
function checkConfig() {
  const envPath = path.join(PROJECT_ROOT, 'lumapost', '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('缺少 .env 配置文件。请复制 .env.example 并填写SMTP信息。');
  }
  
  const env = fs.readFileSync(envPath, 'utf8');
  const required = ['SMTP_USER', 'SMTP_PASS'];
  const missing = required.filter(key => !env.includes(`${key}=`) || env.includes(`${key}=\n`));
  
  if (missing.length > 0) {
    throw new Error(`配置缺失: ${missing.join(', ')}`);
  }
  
  console.log('✅ SMTP配置检查通过');
}

/**
 * 生成邮件时段信息
 */
function getPeriodInfo() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return {
    type: 'morning',
    name: '早报',
    greeting: '清晨好！新的一天，从一份光影邮报开始~',
    quoteType: '励志'
  };
  if (hour >= 11 && hour < 14) return {
    type: 'noon',
    name: '午报',
    greeting: '午间好！短暂休整，资讯补给~',
    quoteType: '轻松'
  };
  if (hour >= 14 && hour < 19) return {
    type: 'afternoon',
    name: '午后速递',
    greeting: '下午好！工作间隙，速览要闻~',
    quoteType: '职场'
  };
  return {
    type: 'evening',
    name: '晚间总结',
    greeting: '晚上好！一天的收获，尽在光影邮报~',
    quoteType: '人生哲理'
  };
}

/**
 * 执行插件主逻辑
 */
async function main() {
  try {
    console.log('🚀 LumaPost 光影邮报 - SkillHub 插件执行开始\n');
    
    // 1. 检查配置
    checkConfig();
    
    // 2. 获取时段信息
    const period = getPeriodInfo();
    console.log(`📅 当前时段: ${period.name} (${period.type})`);
    
    // 3. 检查数据文件是否存在（由外部AI生成）
    const dataFile = path.join(DATA_DIR, 'latest.json');
    if (!fs.existsSync(dataFile)) {
      console.log('⚠️ 未找到 latest.json 数据文件');
      console.log('📋 请确保已执行新闻搜索并生成JSON数据');
      console.log(`📁 数据文件应位于: ${dataFile}`);
      return { success: false, message: '缺少数据文件，请先运行新闻搜索' };
    }
    
    // 4. 生成HTML邮件
    console.log('🎨 正在生成HTML邮件...');
    const htmlFile = path.join(DATA_DIR, 'email.html');
    execSync(
      `node "${path.join(SCRIPTS_DIR, 'gen-html.js')}" --data-file="${dataFile}" --output="${htmlFile}"`,
      { cwd: path.join(PROJECT_ROOT, 'lumapost'), stdio: 'inherit' }
    );
    
    // 5. 发送邮件
    console.log('📧 正在发送邮件...');
    execSync(
      `node "${path.join(SCRIPTS_DIR, 'send-email.js')}" --to=ENV_SMTP_USER --subject="✨ LumaPost · 光影邮报 · ${period.name}" --body-file="${htmlFile}"`,
      { cwd: path.join(PROJECT_ROOT, 'lumapost'), stdio: 'inherit' }
    );
    
    console.log('\n✨ LumaPost 邮件发送完成！');
    return { success: true, period: period.name };
    
  } catch (error) {
    console.error('\n❌ 执行失败:', error.message);
    return { success: false, error: error.message };
  }
}

// 导出给 SkillHub 调用
module.exports = { main, checkConfig, getPeriodInfo };

// 如果直接运行
if (require.main === module) {
  main().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}
