
import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { AppState, Requirement, ColorScheme, SearchResult } from './types';
import { Upload, FileText, Check, Loader2, Search, ArrowRight, Download, BarChart2, RefreshCw, Wand2, Image as ImageIcon, Globe, Target, TrendingUp, ChevronRight, Printer, ExternalLink, Leaf, AlertCircle } from 'lucide-react';
import { extractTextFromPDF } from './services/pdfService';
import { extractRequirements, generateAndScoreSchemes, generateVisualizationImage, performMarketSearch } from './services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export default function App() {
  const [state, setState] = useState<AppState>(AppState.LANDING);
  const [customerName, setCustomerName] = useState<string>("");
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [schemes, setSchemes] = useState<ColorScheme[]>([]);
  const [bestScheme, setBestScheme] = useState<ColorScheme | null>(null);
  const [loadingMsg, setLoadingMsg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // --- Handlers ---

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== "application/pdf") {
        setError("Please upload a PDF file. / 请上传 PDF 格式文件。");
        return;
      }
      
      setError(null);
      setState(AppState.ANALYZING_DOC);
      processFile(selectedFile);
    }
  };

  const processFile = async (f: File) => {
    try {
      setLoadingMsg("Parsing PDF Content... / 正在解析文本...");
      const text = await extractTextFromPDF(f);
      
      setLoadingMsg("AI Analyzing Requirements... / AI 正在提取品牌需求...");
      const result = await extractRequirements(text);
      
      setCustomerName(result.customerName || "Client");
      setRequirements(result.requirements);
      setState(AppState.CONFIRM_REQUIREMENTS);
    } catch (err: any) {
      console.error(err);
      setError("Analysis Failed: " + (err.message || "Unknown error"));
      setState(AppState.UPLOAD);
    }
  };

  const handleStartSearch = async () => {
    setError(null);
    setState(AppState.SEARCHING);
    setLoadingMsg("Connecting to Global Knowledge Base (Google Search)... / 正在连接全球知识库（搜索）...");
    
    try {
      const data = await performMarketSearch(requirements);
      setSearchResult(data);
      setState(AppState.VIEW_SEARCH_RESULTS);
    } catch (err: any) {
      console.error("Search Error:", err);
      // Fallback or just show error
      setError("Search Connection Failed: " + (err.message || "Network or API Key issue"));
      // We stay on requirements page so user can retry
      setState(AppState.CONFIRM_REQUIREMENTS);
    }
  };

  const handleGenerateSchemes = async () => {
    if (!searchResult) return;
    setError(null);
    setState(AppState.SEARCHING); 
    setLoadingMsg("Generating Color Strategies... / 正在生成色彩策略...");
    
    try {
      const generatedSchemes = await generateAndScoreSchemes(requirements, searchResult);
      setSchemes(generatedSchemes);
      
      const best = generatedSchemes.reduce((prev, current) => 
        (Number(prev.weightedScore) > Number(current.weightedScore)) ? prev : current
      );
      setBestScheme(best);
      
      setState(AppState.COMPARING);
    } catch (err: any) {
      console.error(err);
      setError("Generation Failed: " + err.message);
      setState(AppState.VIEW_SEARCH_RESULTS);
    }
  };

  const generatePreviewImage = async () => {
    if (!bestScheme) return;
    setIsGeneratingImage(true);
    try {
      const base64Image = await generateVisualizationImage(bestScheme, requirements);
      setGeneratedImage(base64Image);
    } catch (err) {
      console.error("Image generation failed", err);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleDownloadPDF = async () => {
    const input = document.getElementById('report-content');
    if (!input) {
      setError("Could not find report content.");
      return;
    }

    setIsDownloading(true);
    try {
      // Create canvas from the report div
      const canvas = await html2canvas(input, {
        scale: 2, // Improve resolution
        useCORS: true, // Allow loading images from external URLs
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      // First page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Additional pages if content is long
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`ColorInsight_Report_${customerName || 'Client'}.pdf`);
    } catch (error: any) {
      console.error('PDF generation failed:', error);
      setError("PDF generation failed. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  // --- Render Views ---

  const renderLanding = () => (
    <div className="relative h-screen w-full overflow-hidden bg-black text-white">
      {/* Background with multiple high-end images */}
      <div className="absolute inset-0 grid grid-cols-2">
         <div className="relative h-full">
            <img 
              src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=2053&auto=format&fit=crop" 
              className="w-full h-full object-cover opacity-60"
              alt="Architecture"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent"></div>
         </div>
         <div className="relative h-full hidden md:block">
            <img 
              src="https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=2000&auto=format&fit=crop" 
              className="w-full h-full object-cover opacity-60"
              alt="Interior"
            />
             <div className="absolute inset-0 bg-gradient-to-l from-black/40 to-transparent"></div>
         </div>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center z-20 px-6 text-center">
        <div className="mb-6 animate-fade-in-up">
           <span className="px-4 py-1.5 border border-white/30 rounded-full text-xs font-medium tracking-[0.2em] uppercase backdrop-blur-md">
             AI-Powered Design Intelligence
           </span>
        </div>
        
        <h1 className="text-6xl md:text-8xl font-serif font-bold tracking-tight mb-8 animate-fade-in-up delay-100">
          ColorInsight
        </h1>
        
        <p className="max-w-xl text-lg md:text-xl text-gray-300 font-light leading-relaxed mb-12 animate-fade-in-up delay-200">
          Transform your client's vision into data-driven color strategies. 
          Analyze PDF requirements, search global trends, and generate world-class palettes instantly.
          <br/><span className="text-sm opacity-70 mt-4 block">深度解析PDF · 全球趋势搜索 · 智能方案生成</span>
        </p>

        <button 
          onClick={() => setState(AppState.UPLOAD)}
          className="group relative px-8 py-4 bg-white text-black text-sm font-bold uppercase tracking-widest overflow-hidden transition-all hover:scale-105 animate-fade-in-up delay-300"
        >
           <span className="relative z-10 flex items-center gap-2">
             Start Analysis / 开始分析 <ArrowRight className="w-4 h-4" />
           </span>
           <div className="absolute inset-0 bg-blue-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500 ease-out -z-0"></div>
           <div className="absolute inset-0 group-hover:bg-blue-500 -z-0"></div>
           <span className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
             Start Analysis / 开始分析 <ArrowRight className="w-4 h-4" />
           </span>
        </button>
      </div>

      <div className="absolute bottom-8 w-full text-center text-[10px] text-gray-500 uppercase tracking-widest z-20">
        Professional Edition v2.2 • Bilingual Support • Global Search
      </div>
    </div>
  );

  const renderUpload = () => (
    <div className="h-full flex flex-col items-center justify-center animate-fade-in py-12">
      <div className="text-center space-y-4 max-w-2xl mx-auto mb-16">
        <h2 className="text-4xl font-serif font-bold text-slate-900">Upload Report</h2>
        <p className="text-slate-500">
          Upload Client Positioning Report (PDF). <br/>
          <span className="text-sm">上传客户定位报告 PDF</span>
        </p>
      </div>
      
      <div className="w-full max-w-xl">
        <label className="relative flex flex-col items-center justify-center w-full h-80 border border-dashed border-slate-300 bg-white hover:bg-slate-50 hover:border-black transition-all duration-500 cursor-pointer group">
          <div className="absolute inset-0 bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="relative z-10 flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
            <div className="w-20 h-20 border border-slate-200 rounded-full flex items-center justify-center mb-6 bg-white group-hover:scale-110 transition-transform duration-500">
              <Upload className="w-8 h-8 text-slate-900" />
            </div>
            <p className="mb-2 text-lg text-slate-900 font-medium">Drag & Drop or Click to Upload</p>
            <p className="text-sm text-slate-400">PDF, Max 20MB</p>
          </div>
          <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
        </label>
      </div>
      
      {error && (
        <div className="mt-8 p-4 bg-red-50 text-red-600 text-sm font-medium flex items-center gap-3 border border-red-100 animate-fade-in rounded-lg max-w-xl mx-auto">
           <AlertCircle className="w-5 h-5 flex-shrink-0" />
           <span>{error}</span>
        </div>
      )}
    </div>
  );

  const renderLoading = () => (
    <div className="h-full flex flex-col items-center justify-center py-20">
      <div className="relative mb-12">
        <div className="w-24 h-24 border-2 border-slate-100 rounded-full"></div>
        <div className="absolute inset-0 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-slate-900" />
        </div>
      </div>
      <h3 className="text-xl font-serif font-bold text-slate-900 mb-2">{loadingMsg.split('/')[0]}</h3>
      <p className="text-slate-500 text-sm">{loadingMsg.split('/')[1]}</p>
    </div>
  );

  const renderRequirements = () => (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto pb-12">
      <div className="flex justify-between items-end border-b border-gray-200 pb-6">
        <div>
          <h2 className="text-3xl font-serif font-bold text-slate-900">Analysis Results</h2>
          <p className="text-slate-500 mt-1">Requirements Extraction / 需求解析</p>
        </div>
        <div className="text-right">
           <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Client</p>
           <p className="font-bold text-slate-900">{customerName}</p>
        </div>
      </div>

      <div className="grid gap-4">
        {requirements.map((req, idx) => (
          <div key={idx} className="bg-white p-6 border border-gray-100 hover:shadow-lg transition-shadow duration-300">
            <div className="flex items-start gap-4">
              <span className="text-xs font-mono text-slate-300 mt-1">0{idx + 1}</span>
              <div className="space-y-2">
                <p className="text-slate-800 font-medium leading-relaxed">{req.text}</p>
                {req.summaryEn && (
                  <p className="text-slate-500 text-sm font-light italic">{req.summaryEn}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 text-sm font-medium flex items-center gap-3 border border-red-100 animate-fade-in rounded-lg">
           <AlertCircle className="w-5 h-5 flex-shrink-0" />
           <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end pt-8">
        <button 
          onClick={handleStartSearch}
          className="flex items-center gap-3 bg-black text-white px-8 py-4 text-sm font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors"
        >
          Global Search / 全网搜索 <Globe className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const renderSearchResults = () => {
    if (!searchResult) return null;
    return (
      <div className="space-y-12 animate-fade-in max-w-6xl mx-auto pb-12">
        <div className="flex items-center justify-between border-b border-gray-200 pb-6">
           <div>
             <h2 className="text-3xl font-serif font-bold text-slate-900">Market Intelligence</h2>
             <p className="text-slate-500 mt-1">Global Data & Trends / 全球数据与趋势</p>
           </div>
           <button 
            onClick={handleGenerateSchemes}
            className="flex items-center gap-3 bg-black text-white px-6 py-3 text-sm font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors"
           >
             Generate Strategy <ChevronRight className="w-4 h-4" />
           </button>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Trends */}
          <div className="bg-white p-8 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="w-5 h-5 text-slate-400" />
              <h3 className="text-lg font-bold text-slate-900">Global Trends (2024-25)</h3>
            </div>
            <ul className="space-y-6">
              {searchResult.trends.map((t, i) => (
                <li key={i} className="group">
                   <p className="text-slate-800 font-medium mb-1">{t.en}</p>
                   <p className="text-slate-500 text-sm">{t.zh}</p>
                   <div className="h-px bg-gray-50 mt-4 group-last:hidden"></div>
                </li>
              ))}
            </ul>
          </div>

          {/* Competitors */}
          <div className="bg-white p-8 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Target className="w-5 h-5 text-slate-400" />
              <h3 className="text-lg font-bold text-slate-900">Benchmark Projects</h3>
            </div>
            <ul className="space-y-6">
              {searchResult.competitors.map((c, i) => (
                <li key={i} className="group">
                   <p className="text-slate-800 font-medium mb-1">{c.en}</p>
                   <p className="text-slate-500 text-sm">{c.zh}</p>
                   <div className="h-px bg-gray-50 mt-4 group-last:hidden"></div>
                </li>
              ))}
            </ul>
          </div>

          {/* Insight */}
          <div className="md:col-span-2 bg-slate-50 p-8 border border-gray-100">
             <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Market Insight</h3>
             <div className="grid md:grid-cols-2 gap-8">
               <p className="text-slate-800 leading-relaxed font-serif text-lg">{searchResult.marketInsight.en}</p>
               <p className="text-slate-600 leading-relaxed">{searchResult.marketInsight.zh}</p>
             </div>
          </div>
          
          {/* Real Sources */}
          {searchResult.sources && searchResult.sources.length > 0 && (
             <div className="md:col-span-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Data Sources / 数据来源</h3>
                <div className="flex flex-wrap gap-4">
                  {searchResult.sources.map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-xs text-slate-600 hover:border-black hover:text-black transition-colors">
                      <ExternalLink className="w-3 h-3" />
                      {s.title}
                    </a>
                  ))}
                </div>
             </div>
          )}
        </div>
      </div>
    );
  };

  const renderComparison = () => (
    <div className="space-y-12 animate-fade-in pb-12 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-end border-b border-gray-200 pb-6">
        <div>
           <h2 className="text-3xl font-serif font-bold text-slate-900">Scheme Comparison</h2>
           <p className="text-slate-500 mt-1">Multi-dimensional Scoring / 多维度比对</p>
        </div>
        <button 
          onClick={() => { setState(AppState.RESULT); if(!generatedImage) generatePreviewImage(); }}
          className="flex items-center gap-2 bg-black text-white px-6 py-3 text-sm font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors"
        >
          View Best Scheme / 查看最佳 <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-12 h-[500px]">
        <div className="bg-white p-6 border border-gray-100 flex flex-col">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Radar Analysis</h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={[
                { subject: 'Match/匹配', A: schemes[0]?.scores.match, B: schemes[1]?.scores.match, fullMark: 10 },
                { subject: 'Trend/流行', A: schemes[0]?.scores.trend, B: schemes[1]?.scores.trend, fullMark: 10 },
                { subject: 'Market/市场', A: schemes[0]?.scores.market, B: schemes[1]?.scores.market, fullMark: 10 },
                { subject: 'Innovation/创新', A: schemes[0]?.scores.innovation, B: schemes[1]?.scores.innovation, fullMark: 10 },
                { subject: 'Harmony/协调', A: schemes[0]?.scores.harmony, B: schemes[1]?.scores.harmony, fullMark: 10 },
              ]}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                <Radar name={schemes[0]?.name.en} dataKey="A" stroke="#000" fill="#000" fillOpacity={0.1} />
                <Radar name={schemes[1]?.name.en} dataKey="B" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.2} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
         <div className="bg-white p-6 border border-gray-100 flex flex-col">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Weighted Score</h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={schemes} layout="vertical" margin={{ left: 0, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" domain={[0, 10]} hide />
                <YAxis dataKey="name.en" type="category" width={120} tick={{fontSize: 11, fill: '#0f172a'}} tickLine={false} axisLine={false} />
                <Tooltip cursor={{fill: '#f8fafc'}} />
                <Bar dataKey="weightedScore" fill="#0f172a" barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
        {schemes.map((s, i) => (
          <div key={i} className={`relative p-6 transition-all border ${s === bestScheme ? 'border-black bg-slate-50' : 'border-gray-100 bg-white'}`}>
            {s === bestScheme && (
               <div className="absolute top-0 right-0 bg-black text-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
                 Recommended
               </div>
            )}
            
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <div>
                   <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wide">{s.name.en}</h4>
                   <p className="text-xs text-slate-500 mt-1">{s.name.zh}</p>
                </div>
                <span className="text-xl font-serif font-bold text-slate-900">{s.weightedScore}</span>
              </div>
              
              <div className="flex gap-0 mb-6 h-8 w-full border border-gray-100">
                <div className="flex-1" style={{ backgroundColor: s.palette.primary }}></div>
                <div className="flex-1" style={{ backgroundColor: s.palette.secondary }}></div>
                <div className="flex-1" style={{ backgroundColor: s.palette.accent }}></div>
              </div>

              <div className="space-y-3 mb-4 flex-1">
                 <div>
                   <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Strengths / 优势</p>
                   <p className="text-xs text-slate-600 leading-relaxed">{s.swot?.strengths?.[0]?.en}</p>
                 </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderResult = () => {
    if (!bestScheme) return null;
    return (
      <div className="space-y-12 animate-fade-in pb-20 max-w-7xl mx-auto">
        <div className="flex items-center justify-between border-b border-gray-200 pb-6">
          <div>
            <h2 className="text-3xl font-serif font-bold text-slate-900">Final Strategy</h2>
            <p className="text-slate-500 mt-1">Optimal Solution / 最佳方案</p>
          </div>
          <div className="flex gap-3">
             <button 
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="flex items-center gap-2 bg-slate-900 text-white px-5 py-3 text-sm font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" /> Download Report / 下载报告
                  </>
                )}
              </button>
             <button 
                onClick={() => { setState(AppState.UPLOAD); setSchemes([]); setRequirements([]); setBestScheme(null); setGeneratedImage(null); }}
                className="flex items-center gap-2 bg-white text-slate-600 border border-slate-200 px-5 py-3 text-sm font-bold uppercase tracking-widest hover:bg-slate-50"
              >
                <RefreshCw className="w-4 h-4" /> New / 新建
              </button>
          </div>
        </div>

        {/* Report Content - Wrapped in ID for html2canvas */}
        <div id="report-content" className="bg-white p-8 md:p-12 shadow-sm border border-gray-100 space-y-10">
           {/* Report Header (Visible in PDF) */}
           <div className="flex justify-between items-center border-b border-gray-200 pb-8 mb-8">
              <div>
                <h1 className="text-2xl font-serif font-bold text-black">ColorInsight Report</h1>
                <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Strategy Analysis for {customerName || 'Client'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{new Date().toLocaleDateString()}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">Confidential</p>
              </div>
           </div>

           {/* Section 1: Overview */}
           <div className="grid lg:grid-cols-2 gap-12 items-start">
              <div>
                 <h3 className="text-5xl font-serif font-bold text-slate-900 mb-2">{bestScheme.name.en}</h3>
                 <h4 className="text-2xl font-light text-slate-600 mb-8">{bestScheme.name.zh}</h4>
                 <p className="text-lg text-slate-800 leading-relaxed font-serif mb-4">{bestScheme.description.en}</p>
                 <p className="text-base text-slate-600 leading-relaxed">{bestScheme.description.zh}</p>
              </div>
              <div className="bg-slate-50 p-8 rounded-lg">
                 <div className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-2">Overall Score</div>
                 <div className="text-6xl font-serif font-bold text-slate-900 mb-8">{bestScheme.weightedScore}</div>
                 
                 <div className="space-y-4">
                    {[
                      { l: 'Match / 匹配', v: bestScheme.scores.match },
                      { l: 'Trend / 流行', v: bestScheme.scores.trend },
                      { l: 'Market / 市场', v: bestScheme.scores.market },
                    ].map((s,i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="w-24 text-xs font-bold text-slate-500 uppercase">{s.l}</span>
                        <div className="flex-1 h-1 bg-gray-200">
                          <div className="h-full bg-black" style={{width: `${s.v * 10}%`}}></div>
                        </div>
                        <span className="text-sm font-mono text-slate-900">{s.v}</span>
                      </div>
                    ))}
                 </div>
              </div>
           </div>

           {/* Section 2: Colors */}
           <div>
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-gray-100 pb-2">Color Palette / 调色板</h4>
              <div className="grid grid-cols-3 h-48">
                 {[
                   {c: bestScheme.palette.primary, l: 'Primary / 主色'},
                   {c: bestScheme.palette.secondary, l: 'Secondary / 辅色'},
                   {c: bestScheme.palette.accent, l: 'Accent / 点缀'}
                 ].map((item, i) => (
                   <div key={i} className="relative flex flex-col justify-end p-6 text-white" style={{backgroundColor: item.c}}>
                      <span className="font-mono text-lg opacity-80 mb-1">{item.c}</span>
                      <span className="text-xs font-bold uppercase tracking-widest opacity-60">{item.l}</span>
                   </div>
                 ))}
              </div>
           </div>

           {/* Section 3: Visualization */}
           <div>
              <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-2">
                 <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">AI Visualization / 效果模拟</h4>
                 {!generatedImage && !isGeneratingImage && !isDownloading && (
                    <button onClick={generatePreviewImage} className="text-xs text-blue-600 font-bold uppercase tracking-widest">
                      Generate Render / 生成
                    </button>
                 )}
              </div>
              
              <div className="w-full aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
                {isGeneratingImage ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                    <span className="text-xs text-slate-400 uppercase tracking-widest">Rendering...</span>
                  </div>
                ) : generatedImage ? (
                  <img src={generatedImage} alt="Visualization" className="w-full h-full object-cover" />
                ) : (
                   <div className="text-slate-300 flex flex-col items-center">
                     <ImageIcon className="w-12 h-12 mb-2" />
                     <span className="text-xs uppercase tracking-widest">No Preview</span>
                   </div>
                )}
              </div>
           </div>

           {/* Section 4: Strategy Detail */}
           <div className="grid md:grid-cols-2 gap-12">
              <div>
                 <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">Usage Strategy / 应用策略</h4>
                 <p className="text-slate-800 leading-relaxed mb-4">{bestScheme.usageAdvice.en}</p>
                 <p className="text-slate-600 leading-relaxed text-sm">{bestScheme.usageAdvice.zh}</p>
              </div>
              <div>
                 <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">SWOT Analysis / 优劣势</h4>
                 <div className="space-y-4">
                    <div>
                      <span className="text-xs font-bold text-green-600 uppercase tracking-widest block mb-1">Strengths</span>
                      <p className="text-sm text-slate-700">{bestScheme.swot.strengths[0]?.en}</p>
                      <p className="text-xs text-slate-500 mt-1">{bestScheme.swot.strengths[0]?.zh}</p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-orange-600 uppercase tracking-widest block mb-1">Weaknesses</span>
                      <p className="text-sm text-slate-700">{bestScheme.swot.weaknesses[0]?.en}</p>
                      <p className="text-xs text-slate-500 mt-1">{bestScheme.swot.weaknesses[0]?.zh}</p>
                    </div>
                 </div>
              </div>
           </div>
           
           {/* Section 5: Sources */}
            <div className="pt-8 border-t border-gray-200">
               <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">References / 参考来源</h4>
               <div className="flex flex-wrap gap-x-6 gap-y-2">
                 {searchResult?.sources?.map((s, i) => (
                    <div key={i} className="text-xs text-slate-500 truncate max-w-xs">
                       • {s.title}
                    </div>
                 ))}
               </div>
               <div className="mt-8 text-[10px] text-slate-300 uppercase tracking-widest">
                  Generated by ColorInsight AI • {new Date().toLocaleDateString()}
               </div>
            </div>
        </div>
      </div>
    );
  };

  return (
    <Layout currentState={state}>
      {state === AppState.LANDING && renderLanding()}
      {state === AppState.UPLOAD && renderUpload()}
      {(state === AppState.ANALYZING_DOC || state === AppState.SEARCHING) && renderLoading()}
      {state === AppState.CONFIRM_REQUIREMENTS && renderRequirements()}
      {state === AppState.VIEW_SEARCH_RESULTS && renderSearchResults()}
      {state === AppState.COMPARING && renderComparison()}
      {state === AppState.RESULT && renderResult()}
    </Layout>
  );
}
