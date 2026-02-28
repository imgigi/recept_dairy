
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Expense } from '../types';
import { Tag, Clock } from 'lucide-react';

interface SwipeableExpenseCardProps {
  expense: Expense;
  onClick: (expense: Expense) => void;
  onUpdate: (expense: Expense) => void;
}

const SwipeableExpenseCard: React.FC<SwipeableExpenseCardProps> = ({ expense, onClick, onUpdate }) => {
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editAmountStr, setEditAmountStr] = useState(expense.amount.toString());
  const [editDesc, setEditDesc] = useState(expense.description);
  
  const amountRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingAmount && amountRef.current) amountRef.current.focus();
    if (isEditingDesc && descRef.current) descRef.current.focus();
  }, [isEditingAmount, isEditingDesc]);

  const displayDate = useMemo(() => {
    if (!expense.date) return '';
    const parts = expense.date.split('-');
    if (parts.length < 3) return expense.date;
    return `${parts[1]}-${parts[2]}`;
  }, [expense.date]);

  const handleAmountSave = () => {
    const val = parseFloat(editAmountStr);
    if (!isNaN(val) && val >= 0 && val !== expense.amount) {
      onUpdate({ ...expense, amount: val });
    } else {
      setEditAmountStr(expense.amount.toString());
    }
    setIsEditingAmount(false);
  };

  const handleDescSave = () => {
    if (editDesc.trim() !== expense.description) {
      onUpdate({ ...expense, description: editDesc.trim() || expense.category });
    } else {
      setEditDesc(expense.description);
    }
    setIsEditingDesc(false);
  };

  return (
    <div 
      className="relative overflow-hidden rounded-3xl border-2 border-stone-200 bg-white mb-3 shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
      onClick={() => onClick(expense)}
    >
        <div className="p-5 flex justify-between items-center gap-4">
            <div className="flex-1 min-w-0 flex flex-col gap-1">
                {isEditingDesc ? (
                  <input 
                    ref={descRef}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    onBlur={handleDescSave}
                    onKeyDown={(e) => e.key === 'Enter' && handleDescSave()}
                    className="text-lg font-bold text-stone-900 bg-stone-50 rounded px-1 outline-none ring-2 ring-stone-900 w-full"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <h4 
                    className="text-lg font-bold text-stone-900 truncate"
                    onClick={(e) => { e.stopPropagation(); setIsEditingDesc(true); }}
                  >
                    {expense.description}
                  </h4>
                )}
                
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-[8px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                       <Tag size={8}/> {expense.category}
                    </div>
                    <span className="text-[8px] font-bold text-stone-400 tracking-tighter uppercase">{displayDate}</span>
                    {expense.duration > 1 && (
                      <div className="flex items-center gap-0.5 text-[8px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                        <Clock size={8}/> {expense.duration}d
                      </div>
                    )}
                </div>
            </div>
            
            <div 
              className="text-right shrink-0" 
              onClick={(e) => { e.stopPropagation(); setIsEditingAmount(true); }}
            >
                {isEditingAmount ? (
                    <input 
                      ref={amountRef}
                      type="number"
                      value={editAmountStr}
                      onChange={(e) => setEditAmountStr(e.target.value)}
                      onBlur={handleAmountSave}
                      onKeyDown={(e) => e.key === 'Enter' && handleAmountSave()}
                      className="w-20 text-right font-cartoon text-xl text-stone-900 bg-stone-50 rounded px-1 outline-none ring-2 ring-stone-900"
                      onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span className="font-cartoon text-2xl text-stone-900">¥{expense.amount.toFixed(0)}</span>
                )}
            </div>
        </div>
    </div>
  );
};

export default SwipeableExpenseCard;
