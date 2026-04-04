import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Settings as SettingsIcon, User, Shield, Bell, Save } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

export default function Settings() {
  const { user } = useAuth();

  const handleSave = (e) => {
    e.preventDefault();
    toast.success("Settings updated successfully");
  };

  return (
    <div className="space-y-6 animate-fade-up max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-outfit font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-slate-500" /> Account Settings
          </h1>
          <p className="text-slate-500 mt-1">Manage your account preferences and system configuration.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-1 space-y-2">
          <div className="px-4 py-2 bg-cyan-500/10 text-cyan-600 rounded-lg font-medium flex items-center gap-2 cursor-pointer">
            <User className="w-4 h-4" /> Profile
          </div>
          <div className="px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg transition flex items-center gap-2 cursor-pointer">
            <Bell className="w-4 h-4" /> Notifications
          </div>
          <div className="px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg transition flex items-center gap-2 cursor-pointer">
            <Shield className="w-4 h-4" /> Security
          </div>
        </div>

        <div className="md:col-span-3">
          <div className="glass-card p-8">
            <h2 className="text-xl font-outfit font-bold text-slate-900 dark:text-white mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">Personal Information</h2>
            
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Full Name</label>
                  <input 
                    type="text" 
                    defaultValue={user?.name || ''}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Email Address</label>
                  <input 
                    type="email" 
                    defaultValue={user?.email || ''}
                    disabled
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-400 mt-1">Email cannot be changed directly.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Role</label>
                  <input 
                    type="text" 
                    defaultValue={user?.role?.toUpperCase() || ''}
                    disabled
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 cursor-not-allowed font-medium"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                  <Save className="w-4 h-4" /> Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}