#!/usr/bin/env node
/**
 * config-pref.js — 统一的配置优先级规则 (v10.5.0)
 *
 * 背景：ai-provider 是「环境变量优先」，mail-provider 是「配置文件优先」，
 * 两者相反，导致同时存在 config/app.json 与 CI 环境变量时行为不可预测
 * （GitHub Actions 里 MAIL_PROVIDER 会被本地默认的 'qq' 覆盖）。
 *
 * 规则（单一实现，两侧共用）：
 *   1. 文件里的值「不是默认值」→ 视为用户显式配置，文件优先；
 *   2. 文件里的值是默认值 / 空 → 环境变量优先（CI / Docker / .env 场景）；
 *   3. 都没有 → 用默认值。
 * 例外：ADMIN_TOKEN / SECRET_KEY 等安全项始终 env > 文件。
 */

function isDefaultValue(fileVal, defVal) {
  if (fileVal === undefined || fileVal === null) return true;
  if (typeof fileVal === 'string' && fileVal.trim() === '') return true;
  if (typeof fileVal === 'number' && Number.isNaN(fileVal)) return true;
  if (typeof defVal === 'number' && fileVal === defVal) return true;
  if (fileVal === defVal) return true;
  return false;
}

/**
 * @param {string} key        配置对象里的字段名
 * @param {object} fileCfg    配置文件中的一层（如 getAll().ai）
 * @param {*} defVal          DEFAULT_CONFIG 中同字段值
 * @param {string[]} envKeys  按顺序尝试的环境变量名
 * @param {object} opts       { number:boolean, boolean:boolean }
 */
function pickFrom(key, fileCfg, defVal, envKeys, opts) {
  opts = opts || {};
  const envVals = (envKeys || []).map(function (k) { return process.env[k]; }).filter(function (v) { return v !== undefined && v !== ''; });
  const fileVal = fileCfg ? fileCfg[key] : undefined;
  let chosen;
  if (!isDefaultValue(fileVal, defVal)) chosen = fileVal;
  else if (envVals.length) chosen = envVals[0];
  else chosen = (fileVal === undefined || fileVal === null || fileVal === '') ? defVal : fileVal;

  if (opts.number) {
    const n = Number(chosen);
    return Number.isFinite(n) ? n : Number(defVal);
  }
  if (opts.boolean) {
    if (typeof chosen === 'boolean') return chosen;
    return String(chosen) === '1' || String(chosen).toLowerCase() === 'true';
  }
  return chosen;
}

module.exports = { pickFrom, isDefaultValue };