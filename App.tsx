
import React, { useState, useEffect, useMemo } from 'react';
import { Home, Package, User, Plus, Receipt, Target } from 'lucide-react';

import { Expense, Income, BudgetSettings, ExpenseType, RecordType } from './types';
import { getExpenses, saveExpenses, getIncomes, saveIncomes, getSettings, saveSettings } from './services/storageService';
import { DEFAULT_SETTINGS } from './constants';

import SwipeableRecordCard from './components/SwipeableRecordCard';
import AddRecordModal from './components/AddRecordModal';
import BudgetManager from './components/BudgetManager';
import Backpack from './components/Backpack';
import PersonalCenter from './components/PersonalCenter';
import SettlementReceipt from './components/SettlementReceipt';
import DetailedRecordsView from './components/DetailedRecordsView';

const App: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [settings, setSettings] = useState<BudgetSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  
  const [currentView, setCurrentView] = useState<'BUDGET' | 'BACKPACK' | 'PROFILE'>('BUDGET');
  const [currentSubView, setCurrentSubView] = useState<string>('DASHBOARD');
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Expense | Income | null>(null);
  const [modalInitialType, setModalInitialType] = useState<RecordType>(RecordType.EXPENSE);

  useEffect(() => {
    const init = async () => {
      const [e, i, s] = await Promise.all([getExpenses(), getIncomes(), getSettings()]);
      setExpenses(e);
      setIncomes(i);
      setSettings(s);
      setLoading(false);
      if (s.totalBudget === 0) setIsManagerOpen(true);
    };
    init();
  }, []);

  // 结算提醒逻辑
  useEffect(() => {
    if (loading) return;
    const checkSettlement = () => {
      const now = new Date();
      const [h, m] = settings.settlementTime.split(':').map(Number);
      const settlementTime = new Date();
      settlementTime.setHours(h, m, 0, 0);

      const todayStr = now.toISOString().split('T')[0];
      const lastSettlementDate = localStorage.getItem('lastSettlementDate');

      if (now >= settlementTime && lastSettlementDate !== todayStr) {
        setIsSettlementOpen(true);
        localStorage.setItem('lastSettlementDate', todayStr);
      }
    };

    const timer = setInterval(checkSettlement, 60000); // 每分钟检查一次
    checkSettlement();
    return () => clearInterval(timer);
  }, [loading, settings.settlementTime]);

  const budgetState = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // 计算当前账单周期
    const year = now.getFullYear();
    const month = now.getMonth();
    const startDay = settings.monthStartDay || 1;
    
    let startDate = new Date(year, month, startDay);
    if (startDate > now) {
      startDate = new Date(year, month - 1, startDay);
    }
    startDate.setHours(0, 0, 0, 0);
    
    let endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, startDay - 1);
    endDate.setHours(23, 59, 59, 999);

    const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
    const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    
    // 本月总预算 = 月总预算 - 固定支出 - 存钱小目标
    const flexiblePool = settings.totalBudget - settings.fixedBudget - settings.savingsGoal;
    
    // 本月实际总支出 (仅限周期内的弹性支出)
    const cycleExpenses = expenses.filter(e => {
      return e.date >= startStr && e.date <= endStr && e.type === ExpenseType.FLEXIBLE;
    });
    
    // 本月初到昨日的实际总支出
    const spentBeforeToday = cycleExpenses
      .filter(e => e.date < todayStr)
      .reduce((sum, e) => sum + e.amount, 0);

    // 本月初到今日当前所有的实际总支出 (包含今日已产生的支出)
    const totalSpentIncludingToday = cycleExpenses
      .filter(e => e.date <= todayStr)
      .reduce((sum, e) => sum + e.amount, 0);

    // 计算天数 (使用纯日期计算，避免时区/小时干扰)
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const cycleEndDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    const cycleStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    
    // 本月总天数
    const totalDaysInCycle = Math.round((cycleEndDate.getTime() - cycleStartDate.getTime()) / 86400000) + 1;

    // 今日到月末的天数 (包含今日)
    const daysFromTodayToEnd = Math.round((cycleEndDate.getTime() - todayDate.getTime()) / 86400000) + 1;
    
    // 明日到月末的天数
    const daysFromTomorrowToEnd = Math.max(0, daysFromTodayToEnd - 1);

    // 今日预算 = (本月总预算 - 本月初到昨日的实际总支出) / 今日到月末的天数
    const dailyBudget = daysFromTodayToEnd > 0 
      ? Math.max(0, (flexiblePool - spentBeforeToday) / daysFromTodayToEnd)
      : 0;

    // 明日预算 = (本月总预算 - 本月初到今日当前所有的实际总支出) / 明日到月末的天数
    // 如果今天是本周期最后一天（明日是新周期），则显示默认每日可分配资金
    const tomorrowBudget = daysFromTomorrowToEnd > 0
      ? Math.max(0, (flexiblePool - totalSpentIncludingToday) / daysFromTomorrowToEnd)
      : (flexiblePool / totalDaysInCycle);

    // 今日支出
    const todayExpenses = cycleExpenses.filter(e => e.date === todayStr);
    const todaySpent = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    // 默认每日可分配灵活资金
    const averageDailyBudget = flexiblePool / totalDaysInCycle;

    // 今日已省 = 默认每日可分配灵活资金 - 今日实际支出
    const todaySaved = averageDailyBudget - todaySpent;

    // 本月累计节省 (基于平均预算的净节省)
    const daysPassed = totalDaysInCycle - daysFromTodayToEnd + 1;
    const budgetSoFar = averageDailyBudget * daysPassed;
    const netSaved = budgetSoFar - totalSpentIncludingToday;
    
    return { todayStr, dailyBudget, tomorrowBudget, todaySpent, todaySaved, totalSaved: netSaved, todayExpenses };
  }, [expenses, settings]);

  const viewTitle = useMemo(() => {
    switch (currentView) {
      case 'BUDGET': return currentSubView === 'DASHBOARD' ? '今日看板' : '收支明细';
      case 'BACKPACK': return currentSubView === 'ITEMS' ? '物品管理' : '收入记录';
      case 'PROFILE': return '个人中心';
      default: return '小票日记';
    }
  }, [currentView, currentSubView]);

  if (loading) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="animate-pulse text-stone-400 font-cartoon text-xl">载入中...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f5f4] text-[#1c1917] font-sans pb-32">
      {/* 顶部导航栏 - 整合二级菜单 */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 px-6 h-16 flex items-center justify-between border-b border-stone-100 pt-safe">
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar flex-1 mr-4">
          {currentView === 'BUDGET' && (
            <div className="flex gap-6">
              <button 
                onClick={() => setCurrentSubView('DASHBOARD')}
                className={`text-sm font-bold pb-1 transition-all whitespace-nowrap ${currentSubView === 'DASHBOARD' ? 'text-stone-900 border-b-2 border-stone-900' : 'text-stone-300'}`}
              >
                今日看板
              </button>
              <button 
                onClick={() => setCurrentSubView('CALENDAR')}
                className={`text-sm font-bold pb-1 transition-all whitespace-nowrap ${currentSubView === 'CALENDAR' ? 'text-stone-900 border-b-2 border-stone-900' : 'text-stone-300'}`}
              >
                收支明细
              </button>
            </div>
          )}
          {currentView === 'BACKPACK' && (
            <span className="text-sm font-bold text-stone-900">行囊物品</span>
          )}
          {currentView === 'PROFILE' && (
            <span className="text-sm font-bold text-stone-900">个人中心</span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsSettlementOpen(true)}
            className="p-2 bg-amber-400 rounded-xl shadow-sm active:scale-95 transition-transform"
          >
            <Receipt size={20} />
          </button>
        </div>
      </header>

      <main className="px-6 pt-20">
        {currentView === 'BUDGET' && currentSubView === 'DASHBOARD' && (
          <div className="space-y-8">
            {/* 核心卡片 */}
            <div className="bg-[#1c1917] text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute -right-8 -top-8 w-48 h-48 bg-amber-400/10 rounded-full blur-3xl group-hover:bg-amber-400/20 transition-all"></div>
              
              <div className="relative z-10">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-2">今日已省</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-6xl font-cartoon">¥{budgetState.todaySaved.toFixed(0)}</span>
                      {budgetState.todaySaved < 0 && <span className="text-red-400 text-sm font-bold">(超支)</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-stone-500 text-[10px] font-bold uppercase mb-1">本月累计节省</p>
                    <p className="text-sm font-cartoon text-stone-300">¥{budgetState.totalSaved.toFixed(0)}</p>
                  </div>
                </div>
                
                <div className="mt-8 pt-6 border-t border-white/10 flex justify-between">
                  <div className="flex-1">
                    <p className="text-[10px] text-stone-500 font-bold uppercase mb-1">实际支出</p>
                    <p className="text-lg font-cartoon">¥{budgetState.todaySpent.toFixed(0)}</p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-[10px] text-stone-500 font-bold uppercase mb-1">今日预算</p>
                    <p className="text-lg font-cartoon">¥{budgetState.dailyBudget.toFixed(0)}</p>
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-[10px] text-stone-500 font-bold uppercase mb-1">明日预算</p>
                    <p className="text-lg font-cartoon">¥{budgetState.tomorrowBudget.toFixed(0)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 今日流水 - 单栏显示 */}
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">今日流水</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => { setEditingRecord(null); setModalInitialType(RecordType.INCOME); setIsRecordModalOpen(true); }}
                    className="bg-emerald-600 text-white p-1.5 rounded-lg shadow-lg active:scale-90 flex items-center gap-1"
                  >
                    <Plus size={12} /> <span className="text-[8px] font-bold">收入</span>
                  </button>
                  <button 
                    onClick={() => { setEditingRecord(null); setModalInitialType(RecordType.EXPENSE); setIsRecordModalOpen(true); }}
                    className="bg-stone-900 text-white p-1.5 rounded-lg shadow-lg active:scale-90 flex items-center gap-1"
                  >
                    <Plus size={12} /> <span className="text-[8px] font-bold">支出</span>
                  </button>
                </div>
              </div>
              
              {budgetState.todayExpenses.length === 0 && incomes.filter(i => i.date === budgetState.todayStr).length === 0 ? (
                <div className="py-12 text-center border-4 border-dashed border-stone-200 rounded-[2.5rem]">
                  <p className="text-stone-300 font-bold text-sm">还没有记账，快去记一笔吧</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    ...incomes.filter(i => i.date === budgetState.todayStr).map(inc => ({ ...inc, isIncome: true })),
                    ...budgetState.todayExpenses.map(exp => ({ ...exp, isIncome: false }))
                  ].sort((a, b) => b.id.localeCompare(a.id)).map(item => (
                    <SwipeableRecordCard 
                      key={item.id} 
                      record={item as any} 
                      isIncome={item.isIncome}
                      onClick={() => { setEditingRecord(item as any); setIsRecordModalOpen(true); }}
                      onUpdate={() => {}} 
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {currentView === 'BUDGET' && currentSubView === 'CALENDAR' && (
          <DetailedRecordsView 
            expenses={expenses}
            incomes={incomes}
            settings={settings}
            onEditExpense={(e) => { setEditingRecord(e); setIsRecordModalOpen(true); }}
            onEditIncome={(i) => { setEditingRecord(i); setIsRecordModalOpen(true); }}
          />
        )}

        {currentView === 'BACKPACK' && (
          <Backpack 
            expenses={expenses} 
            onExpenseClick={(e) => { setEditingRecord(e); setIsRecordModalOpen(true); }}
          />
        )}

        {currentView === 'PROFILE' && (
          <PersonalCenter 
            settings={settings} 
            onSave={async (s) => { setSettings(s); await saveSettings(s); }}
            onOpenBudgetManager={() => setIsManagerOpen(true)}
          />
        )}
      </main>

      {/* 底部导航 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-8 py-4 flex justify-between items-center pb-safe z-40 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <button onClick={() => { setCurrentView('BUDGET'); setCurrentSubView('DASHBOARD'); }} className={`flex flex-col items-center gap-1 ${currentView === 'BUDGET' ? 'text-stone-900' : 'text-stone-300'}`}>
          <Home size={24} />
          <span className="text-[10px] font-bold">首页</span>
        </button>
        <button onClick={() => { setCurrentView('BACKPACK'); setCurrentSubView('ITEMS'); }} className={`flex flex-col items-center gap-1 ${currentView === 'BACKPACK' ? 'text-stone-900' : 'text-stone-300'}`}>
          <Package size={24} />
          <span className="text-[10px] font-bold">行囊</span>
        </button>
        <button onClick={() => setCurrentView('PROFILE')} className={`flex flex-col items-center gap-1 ${currentView === 'PROFILE' ? 'text-stone-900' : 'text-stone-300'}`}>
          <User size={24} />
          <span className="text-[10px] font-bold">我的</span>
        </button>
      </nav>

      {/* 弹窗组件 */}
      <BudgetManager 
        isOpen={isManagerOpen} 
        onClose={() => setIsManagerOpen(false)} 
        currentSettings={settings}
        expenses={expenses}
        onSave={async (s) => { setSettings(s); await saveSettings(s); setIsManagerOpen(false); }}
      />

      <SettlementReceipt 
        date={budgetState.todayStr}
        expenses={budgetState.todayExpenses}
        incomes={incomes.filter(i => i.date === budgetState.todayStr)}
        savings={budgetState.todaySaved}
        monthlySavings={budgetState.totalSaved}
        isOpen={isSettlementOpen}
        onClose={() => setIsSettlementOpen(false)}
        onEditExpense={(e) => { setEditingRecord(e); setIsRecordModalOpen(true); }}
        onEditIncome={(i) => { setEditingRecord(i); setIsRecordModalOpen(true); }}
        onAddExpense={async (e) => {
          const updated = [e, ...expenses];
          setExpenses(updated);
          await saveExpenses(updated);
        }}
        onAddIncome={async (i) => {
          const updated = [i, ...incomes];
          setIncomes(updated);
          await saveIncomes(updated);
        }}
        settings={settings}
      />

      <AddRecordModal 
        isOpen={isRecordModalOpen} 
        onClose={() => setIsRecordModalOpen(false)} 
        settings={settings}
        recordToEdit={editingRecord}
        initialType={modalInitialType}
        onSaveExpense={async (e) => {
          const isExistingExpense = expenses.some(x => x.id === e.id);
          const updatedExpenses = isExistingExpense 
            ? expenses.map(x => x.id === e.id ? e : x)
            : [e, ...expenses];
          
          setExpenses(updatedExpenses);
          await saveExpenses(updatedExpenses);
          
          // 如果之前是收入，现在改成了支出，需要从收入列表中移除
          if (incomes.some(x => x.id === e.id)) {
            const updatedIncomes = incomes.filter(x => x.id !== e.id);
            setIncomes(updatedIncomes);
            await saveIncomes(updatedIncomes);
          }
        }}
        onSaveIncome={async (i) => {
          const isExistingIncome = incomes.some(x => x.id === i.id);
          const updatedIncomes = isExistingIncome 
            ? incomes.map(x => x.id === i.id ? i : x)
            : [i, ...incomes];
          
          setIncomes(updatedIncomes);
          await saveIncomes(updatedIncomes);
          
          // 如果之前是支出，现在改成了收入，需要从支出列表中移除
          if (expenses.some(x => x.id === i.id)) {
            const updatedExpenses = expenses.filter(x => x.id !== i.id);
            setExpenses(updatedExpenses);
            await saveExpenses(updatedExpenses);
          }
        }}
        onDelete={async (id, type) => {
          if (type === RecordType.EXPENSE) {
            const updated = expenses.filter(x => x.id !== id);
            setExpenses(updated);
            await saveExpenses(updated);
          } else {
            const updated = incomes.filter(x => x.id !== id);
            setIncomes(updated);
            await saveIncomes(updated);
          }
        }}
      />
    </div>
  );
};

export default App;
