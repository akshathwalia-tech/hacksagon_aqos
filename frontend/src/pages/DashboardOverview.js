import React, { useState, useEffect } from 'react';
import { dashboardAPI, controlAPI } from '../services/api';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { Droplet, Activity, AlertTriangle, Zap, Settings2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

export default function DashboardOverview() {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [zoneConsumption, setZoneConsumption] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeZone, setActiveZone] = useState("Zone A - Downtown");

  const fetchDashboardData = async () => {
    try {
      const [statsData, historyData, zoneData] = await Promise.all([
        dashboardAPI.getStats(),
        dashboardAPI.getConsumptionHistory(),
        dashboardAPI.getZoneConsumption()
      ]);
      setStats(statsData);
      setHistory(historyData);
      setZoneConsumption(zoneData);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchDashboardData().finally(() => setLoading(false));
    const interval = setInterval(fetchDashboardData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleControl = async (action, value) => {
    try {
      if (action === 'leak') {
        await controlAPI.triggerLeak(activeZone, value);
        toast.success(value ? `Leak Triggered in ${activeZone}` : `Leak Sealed in ${activeZone}`);
      } else {
        await controlAPI.updateValve(activeZone, value);
        toast.success(value ? `Valve Opened in ${activeZone}` : `Valve Closed in ${activeZone}`);
      }
      fetchDashboardData();
    } catch (e) {
      toast.error('Control action failed.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary"></div>
      </div>
    );
  }

  const currentZoneState = stats?.system_state ? stats.system_state[activeZone] : null;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-outfit font-bold text-slate-900 dark:text-white">Dashboard Overview</h1>
          <p className="text-slate-500 mt-1">Real-time water network metrics and system status.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Droplet className="w-16 h-16" /></div>
          <p className="text-sm font-medium text-slate-500">Total Consumption</p>
          <div className="flex items-center mt-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">{stats?.total_consumption}</span>
            <span className="ml-2 text-sm text-slate-400">m³/h</span>
          </div>
        </div>

        <div className="glass-card p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Activity className="w-16 h-16" /></div>
          <p className="text-sm font-medium text-slate-500">Active Zones</p>
          <div className="flex items-center mt-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">{stats?.active_zones}</span>
            <span className="ml-2 text-sm text-slate-400">/ {stats?.total_zones}</span>
          </div>
        </div>

        <div className="glass-card p-6 flex flex-col justify-between relative overflow-hidden border-orange-500/20">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-orange-500"><AlertTriangle className="w-16 h-16" /></div>
          <p className="text-sm font-medium text-orange-500">Critical Alerts</p>
          <div className="flex items-center mt-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">{stats?.critical_alerts}</span>
            <span className="ml-2 text-sm text-slate-400">Total: {stats?.active_alerts}</span>
          </div>
        </div>

        <div className="glass-card p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-500"><Zap className="w-16 h-16" /></div>
          <p className="text-sm font-medium text-slate-500">Efficiency Score</p>
          <div className="flex items-center mt-2">
            <span className="text-3xl font-bold text-emerald-500">{stats?.efficiency_score}%</span>
          </div>
        </div>
      </div>

      {/* Manual Override Settings */}
      <div className="glass-card p-6 border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.05)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-outfit font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-cyan-500" /> Manual Override
          </h2>
          <select 
            value={activeZone}
            onChange={(e) => setActiveZone(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm rounded-lg px-3 py-1 outline-none"
          >
            {zoneConsumption.map(z => (
              <option key={z.name} value={z.id || z.name}>{z.name}</option>
            ))}
            {!zoneConsumption.length && (
              <>
                <option value="Zone A - Downtown">Zone A - Downtown</option>
                <option value="Zone B - Industrial">Zone B - Industrial</option>
                <option value="Zone C - Residential">Zone C - Residential</option>
                <option value="Zone D - Commercial">Zone D - Commercial</option>
              </>
            )}
          </select>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 grid grid-cols-2 gap-4">
            <Button onClick={() => handleControl('leak', true)} className="bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 border border-orange-500/30">
              ⚡ Trigger Burst
            </Button>
            <Button onClick={() => handleControl('leak', false)} className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border border-blue-500/30">
              ✓ Seal Pipe
            </Button>
            <Button onClick={() => handleControl('valve', false)} className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30">
              ⏏ Force Close Valve
            </Button>
            <Button onClick={() => handleControl('valve', true)} className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/30">
              ↻ Open Valve
            </Button>
          </div>
          <div className="md:w-64 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
             <div className="text-xs text-slate-500 mb-2">Live Node Status</div>
             <div className="flex justify-between items-center mb-1">
                <span className="text-sm">Valve</span>
                <span className={`text-sm font-bold ${currentZoneState?.valve_open ? 'text-emerald-500' : 'text-red-500'}`}>
                  {currentZoneState?.valve_open ? 'OPEN' : 'CLOSED'}
                </span>
             </div>
             <div className="flex justify-between items-center mb-1">
                <span className="text-sm">Integrity</span>
                <span className={`text-sm font-bold ${currentZoneState?.manual_leak ? 'text-orange-500' : 'text-emerald-500'}`}>
                  {currentZoneState?.manual_leak ? 'BREACHED' : 'INTACT'}
                </span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-sm">AI State</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${currentZoneState?.alert_status === 'CRITICAL_LEAK' ? 'bg-red-500/20 text-red-500' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                  {currentZoneState?.alert_status || 'NORMAL'}
                </span>
             </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="glass-card p-6 lg:col-span-2">
          <h2 className="text-lg font-outfit font-bold text-slate-900 dark:text-white mb-6">Live Telemetry Feed: {activeZone}</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history.filter(h => h.zone === activeZone.split(" - ")[0])} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                <XAxis dataKey="timestamp" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="#06b6d4" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => value} />
                <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                  itemStyle={{ color: '#0f172a' }}
                />
                <Line yAxisId="left" type="monotone" dataKey="consumption" stroke="#06b6d4" strokeWidth={3} dot={false} activeDot={{ r: 8 }} name="Flow (L/min)" />
                <Line yAxisId="right" type="monotone" dataKey="pressure" stroke="#64748b" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Pressure (psi)" opacity={0.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="text-lg font-outfit font-bold text-slate-900 dark:text-white mb-6">Zone Comparison</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneConsumption} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} horizontal={false} />
                <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} width={100} />
                <Tooltip 
                  cursor={{fill: 'rgba(0,0,0,0.05)'}}
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="value" fill="#0ea5e9" radius={[0, 4, 4, 0]} name="Consumption" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}