/* 铁幕1994 — 战役结构（叙事文本取自 lore.js，地图由 maps.js 生成） */
(function () {
  'use strict';
  window.DATA_CAMPAIGN = {
    NATO: {
      side: 'NATO', enemy: 'WP',
      name: '北约战役 · 「铁锤」行动',
      startSP: 4, startPC: 1,
      missions: [
        {
          id: 'nato_m1', role: 'defend', turns: 14,
          map: { profile: 'fulda', w: 22, h: 15, seed: 419941, objectives: 5, westSide: 'NATO', deployWidth: 3, radiation: 2 },
          budget: 950, income: 58, enemyBudget: 1250, enemyIncome: 66, aiSkill: 1,
          vpTarget: 85, holdObjectives: ['obj1', 'obj2'],
          enemyDoctrine: { ARM: 0.34, INF: 0.22, SUP: 0.14, REC: 0.08, AA: 0.10, HEL: 0.06, AIR: 0.04, EW: 0.02 },
          specials: { enemyNukeChance: 0.05, escalationStart: 1 },
          rewardSP: 2, rewardPC: 1
        },
        {
          id: 'nato_m2', role: 'attack', turns: 16,
          map: { profile: 'thuringia', w: 23, h: 15, seed: 419942, objectives: 5, westSide: 'NATO', deployWidth: 3, radiation: 3 },
          budget: 1150, income: 62, enemyBudget: 1050, enemyIncome: 60, aiSkill: 2,
          vpTarget: 65, holdObjectives: [],
          enemyDoctrine: { ARM: 0.24, INF: 0.30, SUP: 0.16, REC: 0.08, AA: 0.12, HEL: 0.05, AIR: 0.03, EW: 0.02 },
          specials: { enemyNukeChance: 0.08, escalationStart: 1 },
          rewardSP: 2, rewardPC: 1
        },
        {
          id: 'nato_m3', role: 'attack', turns: 16,
          map: { profile: 'elbe', w: 24, h: 15, seed: 419943, objectives: 5, westSide: 'NATO', deployWidth: 3, radiation: 3 },
          budget: 1300, income: 66, enemyBudget: 1250, enemyIncome: 66, aiSkill: 2,
          vpTarget: 70, holdObjectives: [],
          enemyDoctrine: { ARM: 0.22, INF: 0.30, SUP: 0.18, REC: 0.07, AA: 0.13, HEL: 0.05, AIR: 0.03, EW: 0.02 },
          specials: { enemyNukeChance: 0.12, escalationStart: 2, riverAssault: true },
          rewardSP: 3, rewardPC: 1
        },
        {
          id: 'nato_m4', role: 'attack', turns: 17,
          map: { profile: 'poland', w: 25, h: 16, seed: 419944, objectives: 6, westSide: 'NATO', deployWidth: 3, radiation: 4 },
          budget: 1450, income: 70, enemyBudget: 1450, enemyIncome: 72, aiSkill: 3,
          vpTarget: 75, holdObjectives: [],
          enemyDoctrine: { ARM: 0.30, INF: 0.24, SUP: 0.16, REC: 0.07, AA: 0.13, HEL: 0.06, AIR: 0.02, EW: 0.02 },
          specials: { enemyNukeChance: 0.16, escalationStart: 2 },
          rewardSP: 3, rewardPC: 2
        },
        {
          id: 'nato_m5', role: 'attack', turns: 18,
          map: { profile: 'belarus', w: 25, h: 17, seed: 419945, objectives: 6, westSide: 'NATO', deployWidth: 3, radiation: 4 },
          budget: 1550, income: 72, enemyBudget: 1650, enemyIncome: 78, aiSkill: 3,
          vpTarget: 78, holdObjectives: [],
          enemyDoctrine: { ARM: 0.26, INF: 0.28, SUP: 0.16, REC: 0.08, AA: 0.12, HEL: 0.06, AIR: 0.02, EW: 0.02 },
          specials: { enemyNukeChance: 0.22, escalationStart: 3, partisans: true },
          rewardSP: 3, rewardPC: 2
        },
        {
          id: 'nato_m6', role: 'attack', turns: 18,
          map: { profile: 'volga', w: 26, h: 17, seed: 419946, objectives: 6, westSide: 'NATO', deployWidth: 3, radiation: 4 },
          budget: 1700, income: 76, enemyBudget: 1800, enemyIncome: 84, aiSkill: 4,
          vpTarget: 80, holdObjectives: [],
          enemyDoctrine: { ARM: 0.28, INF: 0.26, SUP: 0.18, REC: 0.06, AA: 0.13, HEL: 0.05, AIR: 0.02, EW: 0.02 },
          specials: { enemyNukeChance: 0.30, escalationStart: 3, riverAssault: true },
          rewardSP: 4, rewardPC: 2
        },
        {
          id: 'nato_m7', role: 'finale', turns: 20,
          map: { profile: 'samara', w: 27, h: 18, seed: 419947, objectives: 7, westSide: 'NATO', deployWidth: 3, radiation: 5 },
          budget: 2100, income: 88, enemyBudget: 2400, enemyIncome: 100, aiSkill: 5,
          vpTarget: 95, holdObjectives: [],
          enemyDoctrine: { ARM: 0.26, INF: 0.28, SUP: 0.18, REC: 0.06, AA: 0.14, HEL: 0.04, AIR: 0.02, EW: 0.02 },
          specials: { enemyNukeChance: 0.55, escalationStart: 4, finale: true, bothNukeAuth: true },
          rewardSP: 0, rewardPC: 0
        }
      ]
    },

    WP: {
      side: 'WP', enemy: 'NATO',
      name: '华约战役 · 「西风」行动',
      startSP: 4, startPC: 1,
      missions: [
        {
          id: 'wp_m1', role: 'attack', turns: 15,
          map: { profile: 'hannover', w: 23, h: 15, seed: 519941, objectives: 5, westSide: 'NATO', deployWidth: 3, radiation: 3 },
          budget: 1150, income: 62, enemyBudget: 1000, enemyIncome: 58, aiSkill: 1,
          vpTarget: 62, holdObjectives: [],
          enemyDoctrine: { ARM: 0.28, INF: 0.26, SUP: 0.15, REC: 0.08, AA: 0.11, HEL: 0.08, AIR: 0.02, EW: 0.02 },
          specials: { enemyNukeChance: 0.05, escalationStart: 1 },
          rewardSP: 2, rewardPC: 1
        },
        {
          id: 'wp_m2', role: 'attack', turns: 16,
          map: { profile: 'ruhr', w: 24, h: 15, seed: 519942, objectives: 6, westSide: 'NATO', deployWidth: 3, radiation: 4 },
          budget: 1300, income: 66, enemyBudget: 1250, enemyIncome: 66, aiSkill: 2,
          vpTarget: 70, holdObjectives: [],
          enemyDoctrine: { ARM: 0.24, INF: 0.32, SUP: 0.14, REC: 0.07, AA: 0.13, HEL: 0.07, AIR: 0.01, EW: 0.02 },
          specials: { enemyNukeChance: 0.10, escalationStart: 2, riverAssault: true, urban: true },
          rewardSP: 2, rewardPC: 1
        },
        {
          id: 'wp_m3', role: 'attack', turns: 16,
          map: { profile: 'lowlands', w: 24, h: 16, seed: 519943, objectives: 6, westSide: 'NATO', deployWidth: 3, radiation: 3 },
          budget: 1400, income: 70, enemyBudget: 1400, enemyIncome: 70, aiSkill: 3,
          vpTarget: 72, holdObjectives: [],
          enemyDoctrine: { ARM: 0.22, INF: 0.30, SUP: 0.16, REC: 0.08, AA: 0.14, HEL: 0.07, AIR: 0.01, EW: 0.02 },
          specials: { enemyNukeChance: 0.14, escalationStart: 2, seaSupply: true },
          rewardSP: 3, rewardPC: 1
        },
        {
          id: 'wp_m4', role: 'attack', turns: 16,
          map: { profile: 'channel', w: 24, h: 16, seed: 519944, objectives: 5, westSide: 'NATO', deployWidth: 3, radiation: 2 },
          budget: 1500, income: 72, enemyBudget: 1450, enemyIncome: 74, aiSkill: 3,
          vpTarget: 74, holdObjectives: [],
          enemyDoctrine: { ARM: 0.14, INF: 0.28, SUP: 0.14, REC: 0.08, AA: 0.22, HEL: 0.08, AIR: 0.04, EW: 0.02 },
          specials: { enemyNukeChance: 0.18, escalationStart: 3, airWar: true },
          rewardSP: 3, rewardPC: 2
        },
        {
          id: 'wp_m5', role: 'attack', turns: 18,
          map: { profile: 'anglia', w: 24, h: 16, seed: 519945, objectives: 6, westSide: 'NATO', deployWidth: 3, radiation: 2 },
          budget: 1550, income: 68, enemyBudget: 1600, enemyIncome: 78, aiSkill: 4,
          vpTarget: 78, holdObjectives: [],
          enemyDoctrine: { ARM: 0.26, INF: 0.28, SUP: 0.16, REC: 0.07, AA: 0.13, HEL: 0.08, AIR: 0.00, EW: 0.02 },
          specials: { enemyNukeChance: 0.24, escalationStart: 3, beachhead: true },
          rewardSP: 4, rewardPC: 2
        },
        {
          id: 'wp_m6', role: 'attack', turns: 18,
          map: { profile: 'thames', w: 25, h: 17, seed: 519946, objectives: 6, westSide: 'NATO', deployWidth: 3, radiation: 3 },
          budget: 1750, income: 78, enemyBudget: 1800, enemyIncome: 86, aiSkill: 4,
          vpTarget: 82, holdObjectives: [],
          enemyDoctrine: { ARM: 0.24, INF: 0.32, SUP: 0.16, REC: 0.06, AA: 0.13, HEL: 0.07, AIR: 0.00, EW: 0.02 },
          specials: { enemyNukeChance: 0.32, escalationStart: 4, urban: true },
          rewardSP: 4, rewardPC: 2
        },
        {
          id: 'wp_m7', role: 'finale', turns: 20,
          map: { profile: 'london', w: 27, h: 18, seed: 519947, objectives: 7, westSide: 'NATO', deployWidth: 3, radiation: 5 },
          budget: 2100, income: 90, enemyBudget: 2400, enemyIncome: 102, aiSkill: 5,
          vpTarget: 95, holdObjectives: [],
          enemyDoctrine: { ARM: 0.22, INF: 0.34, SUP: 0.16, REC: 0.06, AA: 0.14, HEL: 0.06, AIR: 0.00, EW: 0.02 },
          specials: { enemyNukeChance: 0.55, escalationStart: 4, finale: true, bothNukeAuth: true, urban: true },
          rewardSP: 0, rewardPC: 0
        }
      ]
    }
  };
})();
