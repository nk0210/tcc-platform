import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getUserScopedStorage } from "@/lib/persistence/storage";

export interface ChecklistItem {
  id: string;
  text: string;
  required: boolean;
  checked: boolean;
}

export interface PlaybookRule {
  id: string;
  category: "entry" | "exit" | "risk" | "psychology";
  rule: string;
}

export interface Playbook {
  id: string;
  name: string;
  description: string;
  asset: string;
  timeframe: string;
  strategy: string;
  entryRules: PlaybookRule[];
  exitRules: PlaybookRule[];
  riskRules: PlaybookRule[];
  psychologyRules: PlaybookRule[];
  checklist: ChecklistItem[];
  maxDailyLoss: number;
  maxTradesPerDay: number;
  maxLotSize: number;
  minRR: number;
  active: boolean;
  adherenceScore: number;
  totalChecks: number;
  passedChecks: number;
  createdAt: number;
}

const defaultPlaybook: Playbook = {
  id: "pb1",
  name: "My SMC Playbook",
  description: "Smart Money Concepts playbook for XAUUSD. London and NY sessions only.",
  asset: "XAUUSD", timeframe: "H1", strategy: "SMC",
  entryRules: [
    { id: "e1", category: "entry", rule: "HTF bias confirmed before entry" },
    { id: "e2", category: "entry", rule: "BOS or CHOCH confirmed on entry TF" },
    { id: "e3", category: "entry", rule: "Order block identified and valid" },
    { id: "e4", category: "entry", rule: "Liquidity sweep observed" },
    { id: "e5", category: "entry", rule: "Trading during London or NY session only" },
  ],
  exitRules: [
    { id: "x1", category: "exit", rule: "TP set at next liquidity level" },
    { id: "x2", category: "exit", rule: "SL placed below OB with buffer" },
    { id: "x3", category: "exit", rule: "Trail SL after 1:1 R achieved" },
    { id: "x4", category: "exit", rule: "Exit if setup invalidated" },
  ],
  riskRules: [
    { id: "r1", category: "risk", rule: "Maximum 1% risk per trade" },
    { id: "r2", category: "risk", rule: "Maximum 3% daily loss limit" },
    { id: "r3", category: "risk", rule: "Maximum 3 open positions at once" },
    { id: "r4", category: "risk", rule: "No trading before high-impact news" },
    { id: "r5", category: "risk", rule: "Stop trading after 2 consecutive losses" },
  ],
  psychologyRules: [
    { id: "p1", category: "psychology", rule: "Complete pre-market analysis before trading" },
    { id: "p2", category: "psychology", rule: "No revenge trading after a loss" },
    { id: "p3", category: "psychology", rule: "Journal every trade immediately after" },
    { id: "p4", category: "psychology", rule: "Do not move SL to breakeven early" },
  ],
  checklist: [
    { id: "c1", text: "HTF bias checked (D1 / H4)", required: true, checked: false },
    { id: "c2", text: "Session confirmed (London/NY)", required: true, checked: false },
    { id: "c3", text: "Economic calendar checked", required: true, checked: false },
    { id: "c4", text: "Order block identified on chart", required: true, checked: false },
    { id: "c5", text: "BOS/CHOCH confirmed", required: true, checked: false },
    { id: "c6", text: "SL placed correctly", required: true, checked: false },
    { id: "c7", text: "TP target identified", required: true, checked: false },
    { id: "c8", text: "Risk % calculated and within limit", required: true, checked: false },
    { id: "c9", text: "Emotion check — am I calm?", required: false, checked: false },
    { id: "c10", text: "No recent losses affecting decision", required: false, checked: false },
  ],
  maxDailyLoss: 3, maxTradesPerDay: 5, maxLotSize: 0.5, minRR: 1.5,
  active: true, adherenceScore: 0, totalChecks: 0, passedChecks: 0,
  createdAt: Date.now(),
};

interface PlaybookStore {
  playbooks: Playbook[];
  activePlaybookId: string;
  toggleChecklistItem: (playbookId: string, itemId: string) => void;
  resetChecklist: (playbookId: string) => void;
  addRule: (playbookId: string, category: PlaybookRule["category"], rule: string) => void;
  deleteRule: (playbookId: string, ruleId: string) => void;
  addChecklistItem: (playbookId: string, text: string, required: boolean) => void;
  updatePlaybook: (playbookId: string, updates: Partial<Playbook>) => void;
}

export const usePlaybookStore = create<PlaybookStore>()(
  persist(
    (set) => ({
      playbooks: [defaultPlaybook],
      activePlaybookId: "pb1",

      toggleChecklistItem: (playbookId, itemId) =>
        set((state) => ({
          playbooks: state.playbooks.map(pb => pb.id !== playbookId ? pb : {
            ...pb,
            checklist: pb.checklist.map(item => item.id === itemId ? { ...item, checked: !item.checked } : item),
          }),
        })),

      resetChecklist: (playbookId) =>
        set((state) => ({
          playbooks: state.playbooks.map(pb => pb.id !== playbookId ? pb : {
            ...pb,
            checklist: pb.checklist.map(item => ({ ...item, checked: false })),
          }),
        })),

      addRule: (playbookId, category, rule) =>
        set((state) => ({
          playbooks: state.playbooks.map(pb => {
            if (pb.id !== playbookId) return pb;
            const newRule: PlaybookRule = { id: Date.now().toString(), category, rule };
            const key = `${category}Rules` as keyof Playbook;
            return { ...pb, [key]: [...(pb[key] as PlaybookRule[]), newRule] };
          }),
        })),

      deleteRule: (playbookId, ruleId) =>
        set((state) => ({
          playbooks: state.playbooks.map(pb => {
            if (pb.id !== playbookId) return pb;
            return {
              ...pb,
              entryRules: pb.entryRules.filter(r => r.id !== ruleId),
              exitRules: pb.exitRules.filter(r => r.id !== ruleId),
              riskRules: pb.riskRules.filter(r => r.id !== ruleId),
              psychologyRules: pb.psychologyRules.filter(r => r.id !== ruleId),
            };
          }),
        })),

      addChecklistItem: (playbookId, text, required) =>
        set((state) => ({
          playbooks: state.playbooks.map(pb => pb.id !== playbookId ? pb : {
            ...pb,
            checklist: [...pb.checklist, { id: Date.now().toString(), text, required, checked: false }],
          }),
        })),

      updatePlaybook: (playbookId, updates) =>
        set((state) => ({
          playbooks: state.playbooks.map(pb => pb.id !== playbookId ? pb : { ...pb, ...updates }),
        })),
    }),
    {
      name: "playbook",
      storage: createJSONStorage(() => getUserScopedStorage("playbook")),
    }
  )
);