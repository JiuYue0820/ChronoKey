// React 端 i18n 接入:订阅 i18n 核心的语言切换,语言变化时相关组件重渲染。
import { useSyncExternalStore } from 'react';
import * as core from './i18n.js';

export function useI18n() {
  const lang = useSyncExternalStore(core.subscribe, core.getLang, core.getLang);
  return {
    lang,
    setLang: core.setLang,
    initLang: core.initLang,
    t: core.t,
    tr: core.tr,
    typeLabel: core.typeLabel,
    fieldLabel: core.fieldLabel,
    strengthLabel: core.strengthLabel,
    strengthWarning: core.strengthWarning,
    crackTimeLabel: core.crackTimeLabel,
    auditDetail: core.auditDetail,
    auditGrade: core.auditGrade,
    relTimeLabel: core.relTimeLabel,
    LANGS: core.LANGS,
  };
}

export {
  t, tr, typeLabel, fieldLabel,
  strengthLabel, strengthWarning, crackTimeLabel,
  auditDetail, auditGrade, relTimeLabel,
  setLang, getLang, initLang, subscribe, LANGS,
} from './i18n.js';
