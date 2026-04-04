import React, { useState, useEffect } from 'react';
import { notificationsAPI } from '../services/api';
import { Bell, AlertTriangle, ShieldAlert, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await notificationsAPI.getAll();
      setNotifications(data);
    } catch (error) {
      console.error("Failed to load notifications:", error);
      toast.error("Failed to load notifications data");
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type, severity) => {
    if (type === 'leak_alert') {
      if (severity === 'critical') return <ShieldAlert className="w-5 h-5 text-red-500" />;
      if (severity === 'high') return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
    return <Bell className="w-5 h-5 text-blue-500" />;
  };

  const getBgColor = (type, severity) => {
    if (type === 'leak_alert') {
      if (severity === 'critical') return 'bg-red-500/10 border-red-500/20';
      if (severity === 'high') return 'bg-orange-500/10 border-orange-500/20';
      return 'bg-yellow-500/10 border-yellow-500/20';
    }
    return 'bg-blue-500/10 border-blue-500/20';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-outfit font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Bell className="w-8 h-8 text-secondary" /> System Notifications
          </h1>
          <p className="text-slate-500 mt-1">Recent alerts and system messages.</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4 opacity-50" />
            <h3 className="text-xl font-outfit font-bold text-slate-900 dark:text-white">You're caught up</h3>
            <p className="text-slate-500 mt-2">No new notifications in the system.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {notifications.map((notif) => (
              <div key={notif.id} className="p-6 flex gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                <div className={`p-3 rounded-full border h-fit ${getBgColor(notif.type, notif.severity)}`}>
                  {getIcon(notif.type, notif.severity)}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-outfit font-bold text-slate-900 dark:text-white">{notif.title}</h4>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {new Date(notif.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{notif.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}