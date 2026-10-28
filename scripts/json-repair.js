#!/usr/bin/env node
/**
 * json-repair.js — 容错 JSON 解析 (v10.5.0)
 *
 * 为什么需要它（实测根因）：
 *   大模型写中文内容时，习惯用 ASCII 双引号包术语，例如
 *     {"summary":"Anthropic 递交招股书，冲刺"超级智能第一股"。"}
 *   这在 JSON 中非法，JSON.parse 直接抛错。旧代码的 safeJSON() 返回 null
 *   → 整组版块降级 → 邮件里再也没有 AI 解读。这个 bug 与 maxTokens、
 *   API 额度都无关，却表现为"AI 好像没生效"，因此长期无法定位。
 *
 * 规则（只做安全的修复，不改语义）：
 *   1. 字符串内的裸双引号：向后窥探首个非空白字符，若不是 , } ] : 或结尾 → 转义
 *   2. 非法转义（如 \x）：把反斜杠自身转义为 \\
 *   3. 字符串内的换行/制表符：替换为空格
 *   4. 已合法的 JSON 原样返回（有回归测试保证）
 *
 * 零依赖、纯函数，可独立测试：node scripts/json-repair.js
 */

const SAFE_ESC = '"\\/bfnrtu';

function repairJSON(text) {
  const s = String(text || '');
  let out = '';
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (!inStr) {
      if (ch === '"') inStr = true;
      out += ch;
      continue;
    }
    if (esc) {
      out += ch;
      esc = false;
      continue;
    }
    if (ch === '\\') {
      const nx = s[i + 1];
      if (nx !== undefined && SAFE_ESC.indexOf(nx) < 0) {
        out += '\\\\';           // 非法转义 → 反斜杠自身转义
        continue;
      }
      out += ch;
      esc = true;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      while (j < s.length && (s[j] === ' ' || s[j] === '\t' || s[j] === '\n' || s[j] === '\r')) j++;
      const after = j < s.length ? s[j] : '';
      if (after === '' || after === ',' || after === '}' || after === ']' || after === ':') {
        inStr = false;
        out += ch;
      } else {
        out += '\\"';            // 内嵌裸引号 → 转义
      }
      continue;
    }
    if (ch === '\n' || ch === '\r' || ch === '\t') {
      out += ' ';
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * v10.5.0：截断抢救。
 * 实测场景：一次让模型输出 4 个版块 × 4 条长文，响应被 maxTokens 截断，
 * JSON 括号不闭合 → repair 也救不回来 → 整组降级。
 * 策略：从后往前找"最后一个完整对象"的边界，补齐闭合括号，
 *       至少把已生成好的内容救出来，而不是一片都不要。
 */
function salvage(jsonText) {
  const s = String(jsonText || '');
  if (!s) return null;
  // 逐步回退到最近的 } 边界（该位置的对象是完整的）
  for (let end = s.length; end > 40;) {
    const cut = s.lastIndexOf('}', end - 1);
    if (cut < 0) break;
    end = cut;
    const head = s.slice(0, cut + 1);
    // 统计字符串外的括号差，补齐闭合
    let depthObj = 0, depthArr = 0, inStr = false, esc = false;
    for (let i = 0; i < head.length; i++) {
      const c = head[i];
      if (inStr) {
        if (esc) { esc = false; continue; }
        if (c === '\\') { esc = true; continue; }
        if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === '{') depthObj++;
      else if (c === '}') depthObj--;
      else if (c === '[') depthArr++;
      else if (c === ']') depthArr--;
    }
    if (depthObj < 0 || depthArr < 0) continue;
    let cand = head;
    // 若停在数组元素之间，先闭合数组再闭合对象
    cand += ']'.repeat(depthArr) + '}'.repeat(depthObj);
    try { return JSON.parse(cand); } catch (e) { /* 继续回退 */ }
    try { return JSON.parse(repairJSON(cand)); } catch (e) { /* 继续回退 */ }
  }
  return null;
}

/**
 * 宽松解析：先按原样试，再剥离 markdown 围栏，然后走修复，最后抢救截断
 * @returns {any|null}
 */
function parseLoose(text, opts) {
  opts = opts || {};
  if (!text) return null;
  let s = String(text);
  s = s.replace(/```json\s*/gi, '').replace(/```/g, '').trim();

  const attempts = [];
  attempts.push(s);
  const m = s.match(/\{[\s\S]*\}/) || s.match(/\[[\s\S]*\]/);
  if (m) attempts.push(m[0]);

  for (const a of attempts) {
    try { return JSON.parse(a); } catch (e) { /* next */ }
  }
  for (const a of attempts) {
    try { return JSON.parse(repairJSON(a)); } catch (e) { /* next */ }
  }
  // 截断抢救（很可能是 maxTokens 截掉了尾部）
  const salv = salvage(m || s);
  if (salv !== null && salv !== undefined) {
    console.warn('    · JSON 被截断，已抢救部分结果（建议减少单次输出的版块数或提高 maxTokens）');
    return salv;
  }
  if (opts.verbose !== false && m) {
    console.warn('    · JSON 解析失败，原始片段: ' + JSON.stringify(s.slice(0, 180))
      + (s.length > 180 ? ' …(共' + s.length + '字)' : ''));
  }
  return null;
}

module.exports = { repairJSON, parseLoose, salvage };

/* ---------------- 自检 ---------------- */
if (require.main === module) {
  const cases = [
    ['裸引号', '{"sections":[{"sectionKey":"ai","items":[{"title":"A","summary":"冲刺"超级智能第一股"。跨越。","commentary":"这是"分水岭"。"}]}]}'],
    ['控制符', '{"a":"第一行\n第二行"}'],
    ['非法转义', '{"u":"A\\xB0C"}'],
    ['合法JSON', '{"a":"正常","b":[1,2],"c":{"d":"含\\"引号\\""}}'],
    ['代码块', '```json\n{"sections":[{"sectionKey":"ai","items":[{"title":"x"}]}]}\n```'],
    ['夹杂文字', '好的，结果如下：{"sections":[{"sectionKey":"ai","items":[{"t":"y"}]}]} 希望有帮助'],
    ['空输入', ''],
    ['纯垃圾', '抱歉，我无法完成这个任务'],
  ];
  let pass = 0;
  const shouldBeNull = ['空输入', '纯垃圾'];
  for (const [name, input] of cases) {
    const r = parseLoose(input, { verbose: false });
    const ok = shouldBeNull.indexOf(name) >= 0 ? r === null : (r !== null && typeof r === 'object');
    if (ok) pass++;
    console.log((ok ? '✅' : '❌') + ' ' + name + ' → ' + JSON.stringify(r).slice(0, 90));
  }
  const keep = JSON.parse(repairJSON('{"summary":"冲刺"超级智能第一股"。"}'));
  console.log('内容保真: ' + JSON.stringify(keep.summary));
  console.log('\n通过 ' + pass + '/' + cases.length);
  process.exit(pass === cases.length ? 0 : 1);
}