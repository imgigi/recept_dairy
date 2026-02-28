
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Expense, Income, RecordType, ExpenseType, BudgetSettings } from '../types';
import { X, Tag, Clock, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface AddRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveExpense: (e: Expense) => void;
  onSaveIncome: (i: Income) => void;
  onDelete?: (id: string, type: RecordType) => void;
  settings: BudgetSettings;
  recordToEdit?: Expense | Income | null;
  initialType?: RecordType;
}

const AddRecordModal: React.FC<AddRecordModalProps> = ({ 
  isOpen, onClose, onSaveExpense, onSaveIncome, onDelete, settings, recordToEdit, initialType = RecordType.EXPENSE 
}) => {
  const [quickInput, setQuickInput] = useState('');
  const [recordType, setRecordType] = useState<RecordType>(initialType);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState<number>(1);
  const [durationUnit, setDurationUnit] = useState<'DAY' | 'MONTH'>('DAY');
  const [description, setDescription] = useState('');
  const [expenseType, setExpenseType] = useState<ExpenseType>(ExpenseType.FLEXIBLE);
  
  const [showDetails, setShowDetails] = useState(false);
  const [showTagBubble, setShowTagBubble] = useState(false);
  const [tagFilter, setTagFilter] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (recordToEdit) {
        setAmount(recordToEdit.amount.toString());
        setDate(recordToEdit.date);
        setCategory(recordToEdit.category);
        setDescription(recordToEdit.description);
        const isExpense = 'type' in recordToEdit;
        setRecordType(isExpense ? RecordType.EXPENSE : RecordType.INCOME);
        if (isExpense) {
            setExpenseType((recordToEdit as Expense).type);
            const d = (recordToEdit as Expense).duration;
            if (d >= 28) { setDurationUnit('MONTH'); setDuration(Math.round(d/30)); } 
            else { setDurationUnit('DAY'); setDuration(d); }
        }
        setShowDetails(true);
      } else {
        setQuickInput('');
        setAmount('');
        setDescription('');
        setDate(new Date().toISOString().split('T')[0]);
        setRecordType(initialType);
        setCategory(initialType === RecordType.EXPENSE ? settings.categories.flexible[0] : settings.categories.income[0]);
        setDuration(1);
        setDurationUnit('DAY');
        setShowDetails(false); // 默认不显示详情
      }
    }
  }, [isOpen, recordToEdit, initialType, settings.categories]);

  // 极速解析逻辑：[金额] [名称] [@标签] [时长(数字)]
  const parseLine = (line: string) => {
    const parts = line.split(/\s+/).filter(p => p.length > 0);
    let pAmount = '';
    let pCategory = '';
    let pDescParts: string[] = [];
    let pDuration = 1;

    parts.forEach(part => {
      if (part.startsWith('@')) {
        pCategory = part.slice(1);
      } else if (/^\d+(\.\d+)?$/.test(part)) {
        if (!pAmount) pAmount = part;
        else pDuration = parseInt(part) || 1;
      } else {
        pDescParts.push(part);
      }
    });

    // 如果描述部分包含数字，且金额还没定，尝试把描述末尾的数字作为金额
    if (!pAmount && pDescParts.length > 1) {
      const lastDescPart = pDescParts[pDescParts.length - 1];
      if (/^\d+(\.\d+)?$/.test(lastDescPart)) {
        pAmount = lastDescPart;
        pDescParts.pop();
      }
    }

    return { amount: pAmount, category: pCategory, description: pDescParts.join(' '), duration: pDuration };
  };

  useEffect(() => {
    if (!quickInput || recordToEdit) return;
    const lines = quickInput.split('\n');
    const lastLine = lines[lines.length - 1];
    
    const parts = lastLine.split(/\s+/);
    const lastPart = parts[parts.length - 1] || '';
    
    if (lastPart.startsWith('@')) {
      setShowTagBubble(true);
      setTagFilter(lastPart.slice(1));
    } else {
      setShowTagBubble(false);
    }

    const { amount: a, category: c, description: d, duration: dur } = parseLine(lastLine);
    if (a) setAmount(a);
    if (c) setCategory(c);
    if (d) setDescription(d);
    if (dur !== 1) setDuration(dur);
  }, [quickInput, recordToEdit]);

  const currentCategories = useMemo(() => {
    if (recordType === RecordType.INCOME) return settings.categories.income;
    return expenseType === ExpenseType.FIXED ? settings.categories.fixed : settings.categories.flexible;
  }, [recordType, expenseType, settings.categories]);

  const selectTag = (tag: string) => {
    if (recordToEdit) { setCategory(tag); setShowTagBubble(false); return; }
    const lines = quickInput.split('\n');
    const lastLine = lines[lines.length - 1];
    const parts = lastLine.split(/\s+/);
    let replaced = false;
    for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i].startsWith('@') || parts[i] === '') { parts[i] = `@${tag}`; replaced = true; break; }
    }
    if (!replaced) parts.push(`@${tag}`);
    lines[lines.length - 1] = parts.join(' ') + ' ';
    setQuickInput(lines.join('\n'));
    setShowTagBubble(false);
    setCategory(tag);
    inputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (recordToEdit) {
      if (!amount) return;
      const finalDuration = durationUnit === 'MONTH' ? duration * 30 : duration;
      if (recordType === RecordType.EXPENSE) {
        onSaveExpense({ ...recordToEdit, amount: parseFloat(amount), description: description || category, date, type: expenseType, category: category || currentCategories[0], duration: finalDuration } as Expense);
      } else {
        onSaveIncome({ ...recordToEdit, amount: parseFloat(amount), description: description || category, date, category: category || currentCategories[0] } as Income);
      }
    } else {
      const lines = quickInput.split('\n').filter(l => l.trim().length > 0);
      lines.forEach(line => {
        const { amount: a, category: c, description: d, duration: dur } = parseLine(line);
        if (!a) return;
        const finalAmount = parseFloat(a);
        const finalCategory = c || currentCategories[0];
        const finalDesc = d || finalCategory;
        if (recordType === RecordType.EXPENSE) {
          onSaveExpense({ id: uuidv4(), amount: finalAmount, description: finalDesc, date, type: settings.categories.fixed.includes(finalCategory) ? ExpenseType.FIXED : ExpenseType.FLEXIBLE, category: finalCategory, duration: dur });
        } else {
          onSaveIncome({ id: uuidv4(), amount: finalAmount, description: finalDesc, date, category: finalCategory });
        }
      });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md sm:rounded-[3rem] rounded-t-[3rem] p-8 shadow-2xl animate-slide-up border-t-4 sm:border-4 border-stone-900 max-h-[95vh] overflow-y-auto no-scrollbar">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-cartoon text-stone-900">{recordToEdit ? '修改记录' : '极速输入'}</h3>
          <button onClick={onClose} className="p-2 text-stone-400 hover:bg-stone-100 rounded-full transition-colors"><X size={28}/></button>
        </div>

        <div className="mb-2 relative">
            {showTagBubble && (
                <div className="absolute bottom-full left-0 mb-2 w-full bg-white border-4 border-stone-900 rounded-2xl shadow-xl p-2 z-[130] flex flex-wrap gap-2 animate-bounce-in max-h-[150px] overflow-y-auto no-scrollbar">
                    {currentCategories.filter(t => t.includes(tagFilter)).map(t => (
                        <button key={t} type="button" onClick={() => selectTag(t)} className="px-3 py-1.5 bg-amber-400 text-stone-900 text-[10px] font-bold rounded-lg border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px]">{t}</button>
                    ))}
                    {tagFilter && !currentCategories.includes(tagFilter) && (
                        <button type="button" onClick={() => selectTag(tagFilter)} className="px-3 py-1.5 bg-stone-900 text-white text-[10px] font-bold rounded-lg border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px]">创建: {tagFilter}</button>
                    )}
                </div>
            )}
            
            {!recordToEdit && (
                <>
                    <div className="relative">
                       <Zap size={16} className="absolute left-4 top-4 text-amber-500" />
                       <textarea 
                         ref={inputRef} value={quickInput} onChange={e => setQuickInput(e.target.value)}
                         placeholder="例如: 咖啡 28 @餐饮 3&#10;支持换行输入多笔"
                         className="w-full bg-stone-100 rounded-2xl p-4 pl-10 text-sm font-bold min-h-[120px] outline-none border-2 border-transparent focus:border-stone-900 transition-all no-scrollbar"
                       />
                    </div>
                    <div className="bg-stone-50 px-3 py-2 rounded-xl border border-stone-200 mt-2">
                       <p className="text-[9px] font-bold text-stone-400 leading-tight">格式: <span className="text-stone-600">名称 金额 [@标签] [天数]</span></p>
                    </div>
                </>
            )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex p-1 bg-stone-100 rounded-2xl">
             <button type="button" onClick={() => setRecordType(RecordType.EXPENSE)} className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${recordType === RecordType.EXPENSE ? 'bg-stone-900 text-white shadow-md' : 'text-stone-400'}`}>支出</button>
             <button type="button" onClick={() => setRecordType(RecordType.INCOME)} className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${recordType === RecordType.INCOME ? 'bg-stone-900 text-white shadow-md' : 'text-stone-400'}`}>收入</button>
          </div>

          {!recordToEdit && (
            <button type="button" onClick={() => setShowDetails(!showDetails)} className="w-full flex items-center justify-between text-[10px] font-bold text-stone-400 uppercase tracking-widest px-1 py-2">
              <span>{showDetails ? '隐藏详细参数' : '修改详细参数'}</span>
              {showDetails ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            </button>
          )}

          {showDetails && (
            <div className="space-y-4 animate-fade-in border-t-2 border-dashed border-stone-100 pt-4">
              <div className="relative border-b-4 border-stone-900 pb-2">
                <span className="absolute left-0 bottom-2 text-4xl font-cartoon text-stone-400">¥</span>
                <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full pl-10 text-5xl font-cartoon text-stone-900 outline-none bg-transparent" placeholder="0.00" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1 relative">
                    <label className="text-[8px] font-bold text-stone-400 uppercase">标签</label>
                    <button type="button" onClick={() => setShowTagBubble(!showTagBubble)} className="w-full bg-amber-400 text-stone-900 px-3 py-1.5 rounded-xl text-[10px] font-bold border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] truncate text-left">
                       {category || "未分类"}
                    </button>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[8px] font-bold text-stone-400 uppercase">日期</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-stone-100 p-1.5 rounded-xl text-[10px] font-bold outline-none" />
                 </div>
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-bold text-stone-400 uppercase">名称</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="名称..." className="w-full bg-stone-100 p-3 rounded-xl text-xs font-bold outline-none" />
              </div>
              {recordType === RecordType.EXPENSE && (
                <div className="space-y-2 bg-stone-50 p-4 rounded-2xl border-2 border-dashed border-stone-200">
                  <div className="flex items-center gap-2 text-stone-400"><Clock size={12}/><span className="text-[10px] font-bold">分摊时长</span></div>
                  <div className="flex gap-2">
                     <input type="number" min="1" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 1)} className="w-20 bg-white border-2 border-stone-200 rounded-xl text-center font-bold text-sm outline-none" />
                     <div className="flex-1 flex bg-stone-200 p-1 rounded-xl">
                        <button type="button" onClick={() => setDurationUnit('DAY')} className={`flex-1 py-1 rounded-lg text-[10px] font-bold ${durationUnit === 'DAY' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400'}`}>天</button>
                        <button type="button" onClick={() => setDurationUnit('MONTH')} className={`flex-1 py-1 rounded-lg text-[10px] font-bold ${durationUnit === 'MONTH' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400'}`}>月</button>
                     </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <button type="submit" className="w-full bg-stone-900 text-white py-5 rounded-2xl font-bold text-xl flex items-center justify-center gap-2 shadow-[0_8px_0_0_#44403c] active:translate-y-[4px] active:shadow-[0_4px_0_0_#44403c] transition-all">
             {recordToEdit ? '确认修改' : '确认记录'}
          </button>
          {recordToEdit && onDelete && (
             <button type="button" onClick={() => onDelete(recordToEdit.id, recordType)} className="w-full text-red-500 font-bold text-xs py-2 hover:underline">删除本条记录</button>
          )}
        </form>
      </div>
    </div>
  );
};

export default AddRecordModal;
