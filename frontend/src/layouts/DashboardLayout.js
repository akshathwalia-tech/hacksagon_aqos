import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { 
  LayoutDashboard, 
  Droplet, 
  TrendingUp, 
  AlertTriangle, 
  BarChart3, 
  Boxes,
  Bell,
  Settings,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { toast } from 'sonner';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/auth');
  };

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Overview', testId: 'nav-dashboard' },
    { path: '/dashboard/leaks', icon: AlertTriangle, label: 'Leak Detection', testId: 'nav-leaks' },
    { path: '/dashboard/forecasting', icon: TrendingUp, label: 'Forecasting', testId: 'nav-forecasting' },
    { path: '/dashboard/analytics', icon: BarChart3, label: 'Analytics', testId: 'nav-analytics' },
    { path: '/dashboard/digital-twin', icon: Boxes, label: 'Digital Twin', testId: 'nav-twin' },
    { path: '/dashboard/notifications', icon: Bell, label: 'Notifications', testId: 'nav-notifications' }
  ];

  return (
    <div className="min-h-screen bg-background-light">
      {/* Top Navigation */}
      <nav className="glass-nav sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-white/20">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              data-testid="mobile-menu-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <div className="flex items-center gap-2">
              <Droplet className="w-8 h-8 text-secondary" />
              <span className="text-2xl font-outfit font-bold text-primary">AQOS</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-900">{user?.name}</p>
              <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
            </div>
            <Button
              data-testid="logout-button"
              onClick={handleLogout}
              variant="ghost"
              className="hover:bg-slate-100 rounded-md px-4 py-2"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar */}
        <aside 
          className={`fixed lg:sticky top-[73px] left-0 h-[calc(100vh-73px)] w-60 bg-white border-r border-slate-200 z-30 transition-transform duration-300 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  data-testid={item.testId}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${
                    isActive 
                      ? 'bg-cyan-500/10 text-cyan-600 font-medium' 
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            
            <div className="pt-4 mt-4 border-t border-slate-200">
              <Link
                to="/dashboard/settings"
                data-testid="nav-settings"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${
                  location.pathname === '/dashboard/settings'
                    ? 'bg-cyan-500/10 text-cyan-600 font-medium'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Settings className="w-5 h-5" />
                <span>Settings</span>
              </Link>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}