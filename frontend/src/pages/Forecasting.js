import React, { useState, useEffect } from 'react';
import { aiAPI } from '../services/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Brain, TrendingUp, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function Forecasting() {
  const [forecasts, setForecasts] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchForecasts();
  }, []);

  const fetchForecasts = async () => {
    try {
      setLoading(true);
      const data = await aiAPI.getForecasts();
      setForecasts(data);
    } catch (error) {
      console.error("Failed to load forecasts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAnalysis = async () => {
    try {
      setAnalyzing(true);
      const result = await aiAPI.analyze({ analysis_type: "forecast", time_range: "7d" });
      setAnalysisResult(result);
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-outfit font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Brain className="w-8 h-8 text-cyan-500" /> AI Forecasting
          </h1>
          <p className="text-slate-500 mt-1">Predictive models for water demand and anomaly detection.</p>
        </div>
        <Button 
          onClick={handleRunAnalysis} 
          disabled={analyzing}
          className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white border-none gap-2"
        >
          {analyzing ? (
            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Analyzing...</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Run AI Analysis</>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-outfit font-bold text-slate-900 dark:text-white">7-Day Demand Prediction</h2>
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-cyan-500"></div> Predicted</span>
              <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-400 opacity-50"></div> Confidence Bounds</span>
            </div>
          </div>
          
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecasts} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                />
                <Area type="monotone" dataKey="upper_bound" stroke="none" fill="#94a3b8" fillOpacity={0.1} />
                <Area type="monotone" dataKey="lower_bound" stroke="none" fill="#94a3b8" fillOpacity={0.1} />
                <Area type="monotone" dataKey="predicted" stroke="#06b6d4" strokeWidth={3} fill="url(#colorPredicted)" fillOpacity={0.3} activeDot={{ r: 8 }} />
                <defs>
                  <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6 border-cyan-500/20">
            <h3 className="font-outfit font-bold flex items-center gap-2 text-cyan-600 dark:text-cyan-400 mb-4">
              <Sparkles className="w-5 h-5" /> AI Insights
            </h3>
            {analysisResult ? (
              <div className="space-y-4">
                <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {analysisResult.result}
                </p>
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                  Confidence Score: <span className="font-medium text-emerald-500">{(analysisResult.confidence * 100).toFixed(1)}%</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 flex flex-col items-center">
                <Brain className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm">Click 'Run AI Analysis' to generate Gemini-powered insights on the forecast data.</p>
              </div>
            )}
          </div>

          <div className="glass-card p-6">
            <h3 className="font-outfit font-bold mb-4">Trend Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <span className="text-sm text-slate-500">Expected Peak</span>
                <span className="font-medium text-orange-500">Thursday, 14:00</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <span className="text-sm text-slate-500">Avg Daily Demand</span>
                <span className="font-medium text-slate-900 dark:text-white">21,450 m³</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <span className="text-sm text-slate-500">Growth vs Last Week</span>
                <span className="font-medium text-emerald-500 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> +2.4%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}