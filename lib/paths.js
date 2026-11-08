#!/usr/bin/env node
/**
 * paths.js — 统一路径常量模块
 * 集中管理所有目录/文件路径，消除各脚本里的硬编码字符串。
 */
const path = require('path');

const ROOT = path.resolve(__dirname, '..');   // 项目根目录
const CONFIG_DIR = path.join(ROOT, 'config'); // 配置目录
const DATA_DIR = path.join(ROOT, 'data');     // 运行时数据目录
const SCRIPTS_DIR = path.join(ROOT, 'scripts'); // 脚本目录
const LOCKS_DIR = path.join(DATA_DIR, '.locks'); // 锁文件目录

const CONFIG_FILE = path.join(CONFIG_DIR, 'app.json');            // 主配置文件
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');          // 运行历史
const SCHED_STATE_FILE = path.join(DATA_DIR, 'scheduler-state.json'); // 调度器状态

const SLOTS = ['morning', 'noon', 'afternoon', 'evening']; // 4 个投递时段

/** 某时段的抓取数据文件 */
function dataFile(slot) { return path.join(DATA_DIR, `${slot}-latest.json`); }
/** 某时段的 HTML 邮件文件 */
function htmlFile(slot) { return path.join(DATA_DIR, `${slot}-email.html`); }
/** 某时段的纯文本备选体 */
function textFile(slot) { return path.join(DATA_DIR, `${slot}-email.txt`); }
/** 某时段的预览 HTML */
function previewFile(slot) { return path.join(DATA_DIR, `preview-${slot}.html`); }
/** 某时段的预览 TXT */
function previewTextFile(slot) { return path.join(DATA_DIR, `preview-${slot}.txt`); }
/** 某锁文件路径（防重复执行） */
function lockPath(name) { return path.join(LOCKS_DIR, `${name}.lock`); }

module.exports = {
  ROOT, CONFIG_DIR, DATA_DIR, SCRIPTS_DIR, LOCKS_DIR,
  CONFIG_FILE, HISTORY_FILE, SCHED_STATE_FILE, SLOTS,
  dataFile, htmlFile, textFile, previewFile, previewTextFile, lockPath,
};