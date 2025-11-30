import React from 'react';
import { Palette, FileText, CheckCircle, BarChart2, Download } from 'lucide-react';
import { AppState } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentState: AppState;
}

const steps = [
  { id: AppState.UPLOAD, label: 'Upload', icon: FileText },
  { id: AppState.ANALYZING_DOC, label: 'Analyze', icon: Palette },
  { id: AppState.SEARCHING, label: 'Search', icon: CheckCircle },
  { id: AppState.COMPARING, label: 'Compare', icon: BarChart2 },
  { id: AppState.RESULT, label: 'Result', icon: Download },
];

export const Layout: React.FC<LayoutProps> = ({ children, currentState }) => {
  const getCurrentStepIndex = () => {
    return steps.findIndex(s => s.id === currentState) === -1 
      ? steps.findIndex(s => s.id === AppState.CONFIRM_REQUIREMENTS) // Map sub-states
      : steps.findIndex(s => s.id === currentState);
  };

  const activeIndex = getCurrentStepIndex();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-800 font-sans">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Palette className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">ColorInsight AI</span>
          </div>
          <div className="hidden md:flex items-center space-x-6 text-sm">
            <span className="text-gray-500">v1.0.0</span>
            <a href="#" className="text-blue-600 font-medium hover:underline">Help & Support</a>
          </div>
        </div>
      </header>

      {/* Main Content with Sidebar */}
      <div className="flex flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 gap-8">
        
        {/* Sidebar Navigation */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <nav className="space-y-1">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === activeIndex || (currentState === AppState.CONFIRM_REQUIREMENTS && step.id === AppState.ANALYZING_DOC);
              const isCompleted = index < activeIndex;

              return (
                <div 
                  key={step.id}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                    isActive 
                      ? 'bg-blue-50 text-blue-700' 
                      : isCompleted 
                        ? 'text-green-600'
                        : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`mr-3 h-5 w-5 ${
                    isActive ? 'text-blue-600' : isCompleted ? 'text-green-500' : 'text-gray-400'
                  }`} />
                  {step.label}
                  {isCompleted && <CheckCircle className="ml-auto h-4 w-4 text-green-500" />}
                </div>
              );
            })}
          </nav>

          {/* Customer Info Placeholder */}
          <div className="mt-10 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">System Status</h4>
            <div className="flex items-center gap-2 text-sm text-green-600 mb-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Gemini AI: Online
            </div>
            <div className="flex items-center gap-2 text-sm text-green-600">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Parser: Ready
            </div>
          </div>
        </aside>

        {/* Dynamic Content Area */}
        <main className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[600px] p-6 sm:p-8 relative overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};