
import React from 'react';
import { Palette, FileText, CheckCircle, BarChart2, Download, Layers, Search } from 'lucide-react';
import { AppState } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentState: AppState;
}

const steps = [
  { id: AppState.UPLOAD, label: '上传 Upload', icon: FileText },
  { id: AppState.ANALYZING_DOC, label: '解析 Analyze', icon: Layers },
  { id: AppState.SEARCHING, label: '搜索 Search', icon: Search },
  { id: AppState.COMPARING, label: '比对 Compare', icon: BarChart2 },
  { id: AppState.RESULT, label: '结果 Result', icon: Download },
];

export const Layout: React.FC<LayoutProps> = ({ children, currentState }) => {
  if (currentState === AppState.LANDING) {
    return <>{children}</>;
  }

  const getCurrentStepIndex = () => {
    if (currentState === AppState.CONFIRM_REQUIREMENTS) return 1;
    if (currentState === AppState.VIEW_SEARCH_RESULTS) return 2;
    return steps.findIndex(s => s.id === currentState) === -1 ? 0 : steps.findIndex(s => s.id === currentState);
  };

  const activeIndex = getCurrentStepIndex();

  return (
    <div className="min-h-screen flex bg-[#f8f9fa] font-sans text-slate-800">
      {/* Sidebar - Hidden on Print */}
      <aside className="print:hidden hidden lg:flex w-72 flex-col bg-white border-r border-gray-100 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20">
        <div className="p-8 pb-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-black p-2 rounded-lg">
              <Palette className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-serif font-bold tracking-tight text-black">ColorInsight</h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Global Edition</p>
            </div>
          </div>
          <div className="h-px bg-gray-100 my-6"></div>
        </div>

        <nav className="flex-1 px-5 space-y-2">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === activeIndex;
            const isCompleted = index < activeIndex;

            return (
              <div 
                key={step.id}
                className={`relative flex items-center px-4 py-4 text-sm font-medium rounded-lg transition-all duration-300 ${
                  isActive 
                    ? 'bg-black text-white shadow-lg' 
                    : isCompleted 
                      ? 'text-gray-800 bg-gray-50'
                      : 'text-gray-400'
                }`}
              >
                <Icon className={`mr-3 h-4 w-4 ${isActive ? 'text-white' : isCompleted ? 'text-green-600' : 'text-gray-400'}`} />
                <span className="font-medium">{step.label}</span>
                {isCompleted && <CheckCircle className="ml-auto h-4 w-4 text-green-600" />}
              </div>
            );
          })}
        </nav>

        <div className="p-6">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Status / 状态</h4>
            <div className="flex items-center gap-2 text-xs text-gray-600 font-medium mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              Gemini Pro Global
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative w-full">
        {/* Print Header */}
        <div className="hidden print:flex items-center gap-4 p-8 border-b border-gray-200 mb-8">
           <div className="bg-black p-2 rounded-lg">
              <Palette className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-serif font-bold text-black">ColorInsight Analysis Report</h1>
              <p className="text-xs text-gray-500">Professional AI Color Strategy</p>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto print:overflow-visible relative z-10 scroll-smooth">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 lg:py-12 print:px-8 print:py-0">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
