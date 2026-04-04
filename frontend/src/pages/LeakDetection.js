import React, { useState, useEffect } from 'react';
import { leaksAPI } from '../services/api';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { AlertCircle, CheckCircle2, Clock, MapPin, Activity, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export default function LeakDetection() {
  const [leaks, setLeaks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaks();
  }, []);

  const fetchLeaks = async () => {
    try {
      setLoading(true);
      const data = await leaksAPI.getAll();
      setLeaks(data);
    } catch (error) {
      console.error("Failed to load leaks:", error);
      toast.error("Failed to load leaks data");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await leaksAPI.updateStatus(id, status);
      toast.success(`Leak marked as ${status}`);
      fetchLeaks();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'critical': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'high': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      default: return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
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
          <h1 className="text-3xl font-outfit font-bold text-slate-900 dark:text-white">Leak Detection & Alerts</h1>
          <p className="text-slate-500 mt-1">Real-time acoustic anomalies and flow deviations.</p>
        </div>
        <Button onClick={fetchLeaks} variant="outline" className="gap-2">
          <Activity className="w-4 h-4" /> Refresh Status
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {leaks.map((leak) => (
          <div key={leak.id} className="glass-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:bg-white/80 dark:hover:bg-slate-800/80">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-full ${getSeverityColor(leak.severity)} bg-opacity-20`}>
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-outfit font-bold text-lg text-slate-900 dark:text-white">{leak.type}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium border ${getSeverityColor(leak.severity)}`}>
                    {leak.severity.toUpperCase()}
                  </span>
                  {leak.status === 'resolved' && (
                    <span className="text-xs px-2 py-1 rounded-full font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Resolved
                    </span>
                  )}
                  {leak.status === 'acknowledged' && (
                    <span className="text-xs px-2 py-1 rounded-full font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Ack
                    </span>
                  )}
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-sm mb-2">{leak.description}</p>
                
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {leak.zone_name}</div>
                  <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(leak.detected_at).toLocaleString()}</div>
                  {leak.acoustic_signature && (
                    <div className="flex items-center gap-1"><Activity className="w-3 h-3" /> Sig: {leak.acoustic_signature}</div>
                  )}
                </div>
              </div>
            </div>

            {leak.status === 'active' && (
              <div className="flex gap-2 isolate pt-4 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800 mt-2 md:mt-0">
                <Button 
                  onClick={() => handleStatusUpdate(leak.id, 'acknowledged')}
                  className="bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 border-none"
                >
                  Acknowledge
                </Button>
                <Button 
                  onClick={() => handleStatusUpdate(leak.id, 'resolved')}
                  className="bg-emerald-500 text-white hover:bg-emerald-600 border-none"
                >
                  Resolve
                </Button>
              </div>
            )}
            
            {leak.status === 'acknowledged' && (
              <div className="flex gap-2 isolate pt-4 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800 mt-2 md:mt-0">
                <Button 
                  onClick={() => handleStatusUpdate(leak.id, 'resolved')}
                  className="bg-emerald-500 text-white hover:bg-emerald-600 border-none"
                >
                  Mark Resolved
                </Button>
              </div>
            )}
          </div>
        ))}

        {leaks.length === 0 && (
          <div className="glass-card p-12 text-center flex flex-col items-center justify-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4 opacity-50" />
            <h3 className="text-xl font-outfit font-bold text-slate-900 dark:text-white">All Clear</h3>
            <p className="text-slate-500 mt-2">No active leaks detected in the network.</p>
          </div>
        )}
      </div>
    </div>
  );
}