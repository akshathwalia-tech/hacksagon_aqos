import React, { useState, useEffect } from 'react';
import { analyticsAPI } from '../services/api';
import { 
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { BarChart3, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function Analytics() {
  const [heatmap, setHeatmap] = useState([]);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const [heatmapData, trendsData] = await Promise.all([
          analyticsAPI.getHeatmap(),
          analyticsAPI.getTrends('week')
        ]);
        setHeatmap(heatmapData);
        setTrends(trendsData);
      } catch (error) {
        console.error("Failed to load analytics:", error);
        toast.error("Failed to load analytics data");
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

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
            <BarChart3 className="w-8 h-8 text-indigo-500" /> Advanced Analytics
          </h1>
          <p className="text-slate-500 mt-1">Deep dive into historical consumption and efficiency metrics.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 lg:col-span-2">
          <h2 className="text-lg font-outfit font-bold text-slate-900 dark:text-white mb-6">7-Day Analysis: Consumption vs Leaks</h2>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trends} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                  itemStyle={{ color: '#0f172a' }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="consumption" fill="#6366f1" radius={[4, 4, 0, 0]} name="Consumption (m³)" opacity={0.8} />
                <Line yAxisId="right" type="monotone" dataKey="leaks_detected" stroke="#ef4444" strokeWidth={3} name="Leaks Detected" dot={{ r: 4 }} activeDot={{ r: 8 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-6 lg:col-span-2">
          <h2 className="text-lg font-outfit font-bold text-slate-900 dark:text-white mb-6">Zone Efficiency Heatmap</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {heatmap.map((zone, index) => (
              <div key={index} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <h3 className="font-outfit font-bold text-slate-900 dark:text-white mb-2 truncate" title={zone.zone}>{zone.zone}</h3>
                
                <div className="space-y-3 mt-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1 text-slate-500">
                      <span>Efficiency</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{zone.efficiency.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full ${zone.efficiency > 85 ? 'bg-emerald-500' : zone.efficiency > 70 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                        style={{ width: `${zone.efficiency}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs mb-1 text-slate-500">
                      <span>Leak Risk</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{zone.leak_risk.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full ${zone.leak_risk > 20 ? 'bg-red-500' : zone.leak_risk > 10 ? 'bg-orange-500' : 'bg-blue-500'}`} 
                        style={{ width: `${zone.leak_risk}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}