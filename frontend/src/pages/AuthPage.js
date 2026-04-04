import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Droplet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'operator'
  });
  
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        toast.success('Login successful!');
      } else {
        await register(formData.email, formData.name, formData.password, formData.role);
        toast.success('Registration successful!');
      }
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 flex items-center justify-center p-6 noise-overlay">
      <Card data-testid="auth-card" className="w-full max-w-md glass-card p-8">
        <div className="flex items-center justify-center mb-6">
          <div className="p-3 bg-secondary/10 rounded-full">
            <Droplet className="w-10 h-10 text-secondary" />
          </div>
        </div>
        
        <h1 className="text-3xl font-outfit font-bold text-center mb-2 text-slate-900">
          {isLogin ? 'Welcome Back' : 'Join AQOS'}
        </h1>
        <p className="text-center text-slate-600 mb-6">
          {isLogin ? 'Sign in to your account' : 'Create your account'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div data-testid="name-field">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                data-testid="name-input"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required={!isLogin}
                className="bg-background/50 border-slate-300 focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>
          )}
          
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              data-testid="email-input"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
              className="bg-background/50 border-slate-300 focus:ring-2 focus:ring-cyan-500/20"
            />
          </div>
          
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              data-testid="password-input"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required
              className="bg-background/50 border-slate-300 focus:ring-2 focus:ring-cyan-500/20"
            />
          </div>
          
          {!isLogin && (
            <div data-testid="role-field">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                data-testid="role-select"
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                className="w-full p-2 bg-background/50 border border-slate-300 rounded-md focus:ring-2 focus:ring-cyan-500/20"
              >
                <option value="operator">Operator</option>
                <option value="analyst">Analyst</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          )}
          
          <Button
            data-testid="auth-submit-button"
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-8 py-3 font-semibold tracking-wide shadow-lg hover:shadow-cyan-500/20 transition-all"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
            ) : (
              isLogin ? 'Sign In' : 'Create Account'
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            data-testid="toggle-auth-mode"
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-slate-600 hover:text-secondary transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </Card>
    </div>
  );
}