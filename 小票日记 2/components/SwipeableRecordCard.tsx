
import React from 'react';
import { Tag, Clock } from 'lucide-react';
import { Expense, Income } from '../types';

interface SwipeableRecordCardProps {
  record: Expense | Income;
  onClick: (record: any) => void;
  onUpdate: (record: any) => void;
  isIncome?: boolean;
}

const SwipeableRecordCard: React.FC<SwipeableRecordCardProps> = ({ record, onClick, isIncome = false }) => {
  const displayDate = record.date ? record.date.slice(5) : ''; // MM-DD

  return (
    <div 
      onClick={() => onClick(record)}
      className={`bg-white rounded-[2rem] p-6 flex justify-between items-center mb-3 border-4 transition-all active:scale-[0.98] cursor-pointer ${
        isIncome ? 'border-emerald-500 shadow-emerald-50' : 'border-stone-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold text-stone-400">{displayDate}</span>
          <div className={`px-2 py-0.5 rounded-lg border text-[8px] font-bold uppercase tracking-tighter ${
            isIncome ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-stone-50 border-stone-200 text-stone-500'
          }`}>
            {record.category}
          </div>
        </div>
        <h4 className="font-bold text-stone-900 text-lg leading-tight truncate">{record.description}</h4>
        {'duration' in record && record.duration > 1 && (
          <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-blue-500">
            <Clock size={10} /> 剩余时长：{record.duration}天
          </div>
        )}
      </div>
      <div className="text-right ml-4">
        <span className={`text-2xl font-cartoon ${isIncome ? 'text-emerald-500' : 'text-stone-900'}`}>
          {isIncome ? '+' : ''}¥{record.amount.toFixed(0)}
        </span>
      </div>
    </div>
  );
};

export default SwipeableRecordCard;
