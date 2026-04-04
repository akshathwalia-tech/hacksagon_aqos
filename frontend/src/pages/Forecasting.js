import React, { useState, useEffect } from 'react';
import { aiAPI } from '../services/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Brain, TrendingUp, Sparkles, Sliders } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function Forecasting() {
  const [forecasts, setForecasts] = useState([]);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePolicyId, setActivePolicyId] = useState('baseline');

  const POLICIES = [
    { id: 'baseline', name: 'Baseline (No Policy)', description: 'Normal unobstructed network operation.' },
    { id: 'rationing', name: 'Mandatory Rationing', description: 'Restricts daytime usage, reducing peak demand heavily.' },
    { id: 'heatwave', name: 'Summer Heatwave', description: 'Simulates extreme afternoon temperatures driving up demand.' },
    { id: 'pressure_drop', name: 'Night-Time Pressure Drop', description: 'Reduces night-time flow pressure to limit baseline leakage.' }
  ];

  useEffect(() => {
    fetchForecasts();
  }, []);

  const fetchForecasts = async () => {
    try {
      setLoading(true);
      const data = await aiAPI.getForecasts();
      setForecasts(data.forecasts || data);
      if(data.weather) setWeather(data.weather);
    } catch (error) {
      console.error("Failed to load forecasts:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary"></div>
      </div>
    );
  }

  const getSimulatedValue = (base, hourStr, policyId) => {
    if (policyId === 'baseline') return base;
    const hour = parseInt(hourStr.split(':')[0], 10);
    switch (policyId) {
      case 'rationing':
        return (hour >= 8 && hour <= 18) ? base * 0.75 : base * 0.95;
      case 'heatwave':
        return (hour >= 13 && hour <= 20) ? base * 1.35 : base * 1.10;
      case 'pressure_drop':
        return (hour >= 23 || hour <= 5) ? base * 0.85 : base * 0.98;
      default:
        return base;
    }
  };

  const processedForecasts = forecasts.map(f => ({
    ...f,
    simulated: getSimulatedValue(f.predicted, f.date, activePolicyId)
  }));

  const peakDemand = processedForecasts.length > 0 ? processedForecasts.reduce((max, obj) => obj.predicted > max.predicted ? obj : max, processedForecasts[0]).date : "--:--";
  const dailyDemand = processedForecasts.length > 0 ? Math.round(processedForecasts.reduce((sum, obj) => sum + obj.predicted, 0)).toLocaleString() : "...";

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-outfit font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Brain className="w-8 h-8 text-cyan-500" /> AI Forecasting
          </h1>
          <p className="text-slate-500 mt-1">Predictive models for water demand and anomaly detection.</p>
        </div>
        <div className="flex items-center gap-4">
          {weather && (
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/80 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300">
              <div className="flex flex-col">
                <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Temp</span>
                <span className="font-semibold text-orange-500">{weather.temp}°C</span>
              </div>
              <div className="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Humidity</span>
                <span className="font-semibold text-cyan-500">{weather.humidity}%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-outfit font-bold text-slate-900 dark:text-white">24-Hour Demand Prediction</h2>
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-cyan-500"></div> Predicted</span>
              {activePolicyId !== 'baseline' && (
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div> 
                  Simulated ({POLICIES.find(p => p.id === activePolicyId)?.name})
                </span>
              )}
              <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-400 opacity-50"></div> Confidence Bounds</span>
            </div>
          </div>
          
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={processedForecasts} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis 
                  dataKey="date" 
                  stroke="#888888" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  label={{ value: 'Time (Hours)', position: 'insideBottom', offset: -15, fill: '#888888', fontSize: 12 }}
                />
                <YAxis 
                  stroke="#888888" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  label={{ value: 'Demand (m³/h)', angle: -90, position: 'insideLeft', offset: -10, fill: '#888888', fontSize: 12 }}
                />
                <Tooltip 
                  formatter={(value, name) => {
                    const titles = { predicted: "Predicted Base", simulated: "Simulated Policy", upper_bound: "Max Bound", lower_bound: "Min Bound" };
                    return [`${Math.round(value).toLocaleString()} m³/h`, titles[name] || name];
                  }}
                  labelFormatter={(label) => `Hour: ${label}`}
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', color: '#0f172a' }}
                />
                <Area type="monotone" dataKey="upper_bound" stroke="none" fill="#94a3b8" fillOpacity={0.1} />
                <Area type="monotone" dataKey="lower_bound" stroke="none" fill="#94a3b8" fillOpacity={0.1} />
                <Area type="monotone" dataKey="predicted" stroke="#06b6d4" strokeWidth={3} fill="url(#colorPredicted)" fillOpacity={0.3} activeDot={{ r: 8 }} />
                {activePolicyId !== 'baseline' && (
                  <Area type="monotone" dataKey="simulated" stroke="#8b5cf6" strokeWidth={3} strokeDasharray="5 5" fill="none" activeDot={{ r: 6, fill: "#8b5cf6" }} />
                )}
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
          <div className="glass-card p-6">
            <h3 className="font-outfit font-bold mb-4">Trend Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <span className="text-sm text-slate-500">Expected Peak Hour</span>
                <span className="font-medium text-orange-500">Today, {peakDemand}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <span className="text-sm text-slate-500">Forecasted Under-24h Demand</span>
                <span className="font-medium text-slate-900 dark:text-white">{dailyDemand} m³</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <span className="text-sm text-slate-500">Growth vs Last Week</span>
                <span className="font-medium text-emerald-500 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> +2.4%</span>
              </div>
          </div>
          </div>

          <div className="glass-card p-6 border-purple-500/20">
            <h3 className="font-outfit font-bold flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-4">
              <Sliders className="w-5 h-5" /> Policy Simulator
            </h3>
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm text-slate-500 block mb-3">Select Scenario to Model:</label>
                {POLICIES.map((policy) => (
                  <div 
                    key={policy.id}
                    onClick={() => setActivePolicyId(policy.id)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 flex items-start gap-3
                      ${activePolicyId === policy.id 
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                        : 'border-slate-100 dark:border-slate-800 hover:border-purple-200 dark:hover:border-purple-800 bg-white dark:bg-slate-900/50'
                      }`}
                  >
                    <div className="mt-0.5 min-w-[16px]">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center
                        ${activePolicyId === policy.id ? 'border-purple-500' : 'border-slate-300 dark:border-slate-600'}`}>
                        {activePolicyId === policy.id && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                      </div>
                    </div>
                    <div>
                      <div className={`font-semibold text-sm ${activePolicyId === policy.id ? 'text-purple-700 dark:text-purple-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {policy.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{policy.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}