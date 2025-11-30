import React, { useState, useCallback } from 'react';
import { Layout } from './components/Layout';
import { AppState, Requirement, ColorScheme } from './types';
import { Upload, FileText, Check, Loader2, Search, ArrowRight, Download, BarChart2, RefreshCw } from 'lucide-react';
import { extractTextFromPDF } from './services/pdfService';
import { extractRequirements, generateAndScoreSchemes } from './services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function App() {
  const [state, setState] = useState<AppState>(AppState.UPLOAD);
  const [file, setFile] = useState<File | null>(null);
  const [customerName, setCustomerName] = useState<string>("");
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [schemes, setSchemes] = useState<ColorScheme[]>([]);
  const [bestScheme, setBestScheme] = useState<ColorScheme | null>(null);
  const [loadingMsg, setLoadingMsg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // --- Handlers ---

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== "application/pdf") {
        setError("Please upload a PDF file.");
        return;
      }
      if (selectedFile.size > 20 * 1024 * 1024) {
        setError("File size exceeds 20MB.");
        return;
      }
      
      setFile(selectedFile);
      setError(null);
      setState(AppState.ANALYZING_DOC);
      processFile(selectedFile);
    }
  };

  const processFile = async (f: File) => {
    try {
      setLoadingMsg("Extracting text from PDF...");
      const text = await extractTextFromPDF(f);
      
      setLoadingMsg("Identifying color requirements with Gemini AI...");
      const result = await extractRequirements(text);
      
      setCustomerName(result.customerName || "Unknown Client");
      setRequirements(result.requirements);
      setState(AppState.CONFIRM_REQUIREMENTS);
    } catch (err: any) {
      setError(err.message || "Failed to process file");
      setState(AppState.UPLOAD);
    }
  };

  const handleStartSearch = async () => {
    setState(AppState.SEARCHING);
    setLoadingMsg("AI Agent searching global design trends...");
    
    try {
      // Simulate multiple steps of search for UX effect
      await new Promise(r => setTimeout(r, 1500));
      setLoadingMsg("Analyzing Pantone 2024/2025 reports...");
      await new Promise(r => setTimeout(r, 1500));
      setLoadingMsg("Cross-referencing market data on Behance/Pinterest...");
      
      const generatedSchemes = await generateAndScoreSchemes(requirements);
      setSchemes(generatedSchemes);
      
      // Find best scheme
      const best = generatedSchemes.reduce((prev, current) => 
        (prev.weightedScore > current.weightedScore) ? prev : current
      );
      setBestScheme(best);
      
      setState(AppState.COMPARING);
    } catch (err: any) {
      setError(err.message || "Search failed");
      setState(AppState.CONFIRM_REQUIREMENTS);
    }
  };

  const handleDownloadPDF = () => {
    if (!bestScheme) return;

    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(74, 144, 226); // Blue
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text("Color Strategy Report", 20, 25);
    doc.setFontSize(12);
    doc.text(`Generated for: ${customerName}`, 20, 35);
    
    let y = 50;

    // Requirements Section
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text("1. Analysis of Requirements", 20, y);
    y += 10;
    doc.setFontSize(10);
    requirements.forEach((req) => {
      doc.text(`• ${req.text}`, 25, y);
      y += 7;
    });

    y += 10;

    // Best Scheme Section
    doc.setFontSize(16);
    doc.text("2. Recommended Color Scheme", 20, y);
    y += 15;
    
    doc.setFontSize(14);
    doc.text(bestScheme.name, 20, y);
    y += 10;
    
    // Draw Color Boxes
    const colors = [bestScheme.palette.primary, bestScheme.palette.secondary, bestScheme.palette.accent];
    const labels = ["Primary", "Secondary", "Accent"];
    
    colors.forEach((color, i) => {
      doc.setFillColor(color);
      doc.rect(20 + (i * 60), y, 50, 30, 'F');
      doc.setTextColor(50, 50, 50);
      doc.text(labels[i], 20 + (i * 60), y + 35);
      doc.text(color, 20 + (i * 60), y + 40);
    });
    
    y += 50;
    
    doc.setFontSize(12);
    doc.text("Strategic Rationale:", 20, y);
    y += 7;
    doc.setFontSize(10);
    const splitText = doc.splitTextToSize(bestScheme.description, 170);
    doc.text(splitText, 20, y);
    y += (splitText.length * 5) + 10;
    
    doc.setFontSize(12);
    doc.text("Usage Advice:", 20, y);
    y += 7;
    doc.setFontSize(10);
    const adviceText = doc.splitTextToSize(bestScheme.usageAdvice, 170);
    doc.text(adviceText, 20, y);

    y += 20;

    // Scoring Table
    doc.setFontSize(16);
    doc.text("3. Comparative Analysis Score", 20, y);
    y += 10;
    
    autoTable(doc, {
      startY: y,
      head: [['Metric', 'Score (0-10)', 'Weight', 'Contribution']],
      body: [
        ['Match', bestScheme.scores.match, '30%', (bestScheme.scores.match * 0.3).toFixed(2)],
        ['Trend', bestScheme.scores.trend, '25%', (bestScheme.scores.trend * 0.25).toFixed(2)],
        ['Market', bestScheme.scores.market, '20%', (bestScheme.scores.market * 0.2).toFixed(2)],
        ['Innovation', bestScheme.scores.innovation, '15%', (bestScheme.scores.innovation * 0.15).toFixed(2)],
        ['Harmony', bestScheme.scores.harmony, '10%', (bestScheme.scores.harmony * 0.1).toFixed(2)],
        ['Total Weighted Score', '', '', bestScheme.weightedScore]
      ],
      theme: 'grid',
      headStyles: { fillColor: [74, 144, 226] }
    });

    doc.save(`${customerName.replace(/\s+/g, '_')}_Color_Strategy.pdf`);
  };

  // --- Render Views ---

  const renderUpload = () => (
    <div className="h-full flex flex-col items-center justify-center space-y-8 animate-fade-in">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">Upload Client Positioning Report</h2>
        <p className="text-gray-500">Supported format: PDF (Max 20MB)</p>
      </div>
      
      <div className="w-full max-w-lg">
        <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-blue-300 border-dashed rounded-xl cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors group">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <div className="p-4 bg-white rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform">
              <Upload className="w-8 h-8 text-blue-500" />
            </div>
            <p className="mb-2 text-sm text-gray-700 font-medium">Click to upload or drag and drop</p>
            <p className="text-xs text-gray-400">PDF Documents only</p>
          </div>
          <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
        </label>
      </div>
      
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
          {error}
        </div>
      )}
    </div>
  );

  const renderLoading = () => (
    <div className="h-full flex flex-col items-center justify-center space-y-6">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
        </div>
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900">{loadingMsg}</h3>
        <p className="text-sm text-gray-500 mt-2">This usually takes 10-20 seconds.</p>
      </div>
      {/* Progress visual */}
      <div className="w-64 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 animate-progress"></div>
      </div>
    </div>
  );

  const renderRequirements = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Extracted Requirements</h2>
          <p className="text-sm text-gray-500">Client: {customerName}</p>
        </div>
        <button 
          onClick={() => setState(AppState.UPLOAD)}
          className="text-sm text-gray-400 hover:text-gray-600 underline"
        >
          Re-upload
        </button>
      </div>

      <div className="grid gap-4">
        {requirements.map((req, idx) => (
          <div key={idx} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
            <div className="mt-1">
              <Check className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-gray-800 font-medium">{req.text}</p>
              <p className="text-xs text-gray-400 mt-1">Source: Page {req.sourcePage || 1}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-4 flex justify-end">
        <button 
          onClick={handleStartSearch}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg shadow-blue-200 transition-all hover:translate-y-[-2px]"
        >
          <Search className="w-5 h-5" />
          Start AI Search & Analysis
        </button>
      </div>
    </div>
  );

  const renderComparison = () => (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">Multi-Dimensional Analysis</h2>
        <button 
          onClick={() => setState(AppState.RESULT)}
          className="flex items-center gap-2 text-blue-600 font-medium hover:bg-blue-50 px-4 py-2 rounded-lg"
        >
          View Best Scheme <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Weighted Scores Chart */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm h-[300px]">
          <h3 className="text-sm font-semibold text-gray-500 mb-4">Total Weighted Scores</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={schemes} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 10]} hide />
              <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
              <Tooltip cursor={{fill: '#f0f9ff'}} />
              <Bar dataKey="weightedScore" fill="#4A90E2" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed Radar Chart for Best Scheme vs Others */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm h-[300px]">
          <h3 className="text-sm font-semibold text-gray-500 mb-4">Attribute Comparison</h3>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
               { subject: 'Match', A: schemes[0]?.scores.match, B: schemes[1]?.scores.match, fullMark: 10 },
               { subject: 'Trend', A: schemes[0]?.scores.trend, B: schemes[1]?.scores.trend, fullMark: 10 },
               { subject: 'Market', A: schemes[0]?.scores.market, B: schemes[1]?.scores.market, fullMark: 10 },
               { subject: 'Innovation', A: schemes[0]?.scores.innovation, B: schemes[1]?.scores.innovation, fullMark: 10 },
               { subject: 'Harmony', A: schemes[0]?.scores.harmony, B: schemes[1]?.scores.harmony, fullMark: 10 },
            ]}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" />
              <PolarRadiusAxis angle={30} domain={[0, 10]} />
              <Radar name={schemes[0]?.name} dataKey="A" stroke="#4A90E2" fill="#4A90E2" fillOpacity={0.4} />
              <Radar name={schemes[1]?.name} dataKey="B" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.4} />
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scheme Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {schemes.map((s, i) => (
          <div key={i} className={`p-4 rounded-xl border ${s === bestScheme ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-100' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-bold text-gray-900">{s.name}</h4>
                <p className="text-xs text-gray-500">{s.description.substring(0, 60)}...</p>
              </div>
              <span className={`text-lg font-bold ${s === bestScheme ? 'text-orange-600' : 'text-gray-600'}`}>
                {s.weightedScore}
              </span>
            </div>
            
            <div className="flex gap-2 mb-3">
              <div className="h-8 flex-1 rounded-md" style={{ backgroundColor: s.palette.primary }} title="Primary"></div>
              <div className="h-8 flex-1 rounded-md" style={{ backgroundColor: s.palette.secondary }} title="Secondary"></div>
              <div className="h-8 flex-1 rounded-md" style={{ backgroundColor: s.palette.accent }} title="Accent"></div>
            </div>

            {s === bestScheme && (
               <div className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                 <Check className="w-3 h-3" /> Recommended
               </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderResult = () => {
    if (!bestScheme) return null;
    return (
      <div className="space-y-8 animate-fade-in pb-10">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-green-100 rounded-full mb-2">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Optimal Color Strategy Found</h2>
          <p className="text-gray-500">Based on multi-dimensional analysis of client requirements</p>
        </div>

        {/* Hero Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="p-8 border-b border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-3xl font-bold text-gray-900 mb-2">{bestScheme.name}</h3>
                <p className="text-gray-600 max-w-2xl leading-relaxed">{bestScheme.description}</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400 uppercase tracking-wider font-semibold">Score</div>
                <div className="text-4xl font-bold text-blue-600">{bestScheme.weightedScore}</div>
                <div className="text-xs text-green-500 font-medium">Top Ranked</div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 h-48">
             <div className="relative flex items-center justify-center text-white font-mono text-lg font-bold group" style={{backgroundColor: bestScheme.palette.primary}}>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md">{bestScheme.palette.primary}</span>
                <span className="absolute bottom-4 left-4 text-xs opacity-70">Primary</span>
             </div>
             <div className="relative flex items-center justify-center text-white font-mono text-lg font-bold group" style={{backgroundColor: bestScheme.palette.secondary}}>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md">{bestScheme.palette.secondary}</span>
                <span className="absolute bottom-4 left-4 text-xs opacity-70">Secondary</span>
             </div>
             <div className="relative flex items-center justify-center text-white font-mono text-lg font-bold group" style={{backgroundColor: bestScheme.palette.accent}}>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md">{bestScheme.palette.accent}</span>
                <span className="absolute bottom-4 left-4 text-xs opacity-70">Accent</span>
             </div>
          </div>

          <div className="p-8 bg-gray-50 grid md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-blue-500" /> Performance Analysis
              </h4>
              <ul className="space-y-3">
                <li className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Requirement Match (30%)</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{width: `${bestScheme.scores.match * 10}%`}}></div>
                    </div>
                    <span className="font-bold">{bestScheme.scores.match}</span>
                  </div>
                </li>
                <li className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Trend Alignment (25%)</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500" style={{width: `${bestScheme.scores.trend * 10}%`}}></div>
                    </div>
                    <span className="font-bold">{bestScheme.scores.trend}</span>
                  </div>
                </li>
                <li className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Market Viability (20%)</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{width: `${bestScheme.scores.market * 10}%`}}></div>
                    </div>
                    <span className="font-bold">{bestScheme.scores.market}</span>
                  </div>
                </li>
              </ul>
            </div>
            <div>
               <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-500" /> Usage Strategy
              </h4>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                {bestScheme.usageAdvice}
              </p>
              <div className="flex flex-wrap gap-2">
                {bestScheme.sources.map((source, i) => (
                  <span key={i} className="px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-500">
                    {source}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <button 
            onClick={() => { setState(AppState.UPLOAD); setSchemes([]); setRequirements([]); }}
            className="flex items-center gap-2 bg-white text-gray-700 border border-gray-300 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50"
          >
            <RefreshCw className="w-5 h-5" /> Start New
          </button>
          <button 
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold shadow-lg shadow-blue-200 transition-transform hover:-translate-y-1"
          >
            <Download className="w-5 h-5" /> Download Full Report (PDF)
          </button>
        </div>
      </div>
    );
  };

  return (
    <Layout currentState={state}>
      {state === AppState.UPLOAD && renderUpload()}
      {(state === AppState.ANALYZING_DOC || state === AppState.SEARCHING) && renderLoading()}
      {state === AppState.CONFIRM_REQUIREMENTS && renderRequirements()}
      {state === AppState.COMPARING && renderComparison()}
      {state === AppState.RESULT && renderResult()}
    </Layout>
  );
}