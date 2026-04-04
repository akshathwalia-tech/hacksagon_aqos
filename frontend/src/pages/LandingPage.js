import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Droplet, Zap, Brain, Shield, TrendingUp, Waves } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900">
      {/* Navigation */}
      <nav className="glass-nav fixed top-0 w-full z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplet className="w-8 h-8 text-secondary" />
            <span className="text-2xl font-outfit font-bold text-white">AQOS</span>
          </div>
          <Link to="/auth">
            <Button data-testid="login-button" className="bg-secondary/10 text-secondary hover:bg-secondary/20 rounded-full px-6 py-2 font-medium backdrop-blur-sm">
              Sign In
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-6 noise-overlay">
        <div className="absolute inset-0 overflow-hidden">
          <img 
            src="https://images.pexels.com/photos/5712211/pexels-photo-5712211.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
            alt="Water infrastructure"
            className="w-full h-full object-cover opacity-20"
          />
        </div>
        
        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-outfit font-bold text-white mb-6 animate-fade-up">
            AI-Driven Water
            <br />
            <span className="text-secondary">Sustainability OS</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-300 mb-8 max-w-2xl mx-auto animate-fade-up stagger-1">
            Monitor, analyze, and optimize water usage with intelligent AI-powered insights. 
            Transform your water management from reactive to proactive.
          </p>
          <div className="flex flex-wrap gap-4 justify-center animate-fade-up stagger-2">
            <Link to="/auth">
              <Button data-testid="get-started-button" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-8 py-3 font-semibold tracking-wide shadow-lg hover:shadow-cyan-500/20 transition-all">
                Get Started
              </Button>
            </Link>
            <Button data-testid="learn-more-button" className="bg-secondary/10 text-secondary hover:bg-secondary/20 rounded-full px-8 py-3 font-semibold backdrop-blur-sm">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-outfit font-bold text-white text-center mb-16">
            Intelligent Water Management
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Brain,
                title: 'AI Forecasting',
                description: 'LSTM neural networks predict water demand with >90% accuracy'
              },
              {
                icon: Zap,
                title: 'Real-Time Monitoring',
                description: 'Live dashboard with instant alerts and anomaly detection'
              },
              {
                icon: Waves,
                title: 'Acoustic Leak Detection',
                description: 'FFT analysis identifies silent leaks before they become critical'
              },
              {
                icon: TrendingUp,
                title: 'Predictive Analytics',
                description: 'Data-driven insights for proactive resource optimization'
              },
              {
                icon: Shield,
                title: 'Digital Twin Simulation',
                description: 'Test policies risk-free with real-time infrastructure mirroring'
              },
              {
                icon: Droplet,
                title: 'Water Conservation',
                description: 'AI-powered recommendations reduce waste by up to 30%'
              }
            ].map((feature, idx) => (
              <div key={idx} className="glass-card p-6 md:p-8 animate-fade-up" style={{animationDelay: `${idx * 0.1}s`}}>
                <div className="p-3 bg-secondary/10 rounded-full w-fit mb-4">
                  <feature.icon className="w-6 h-6 text-secondary" />
                </div>
                <h3 className="text-xl font-outfit font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 px-6 bg-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '90%+', label: 'Detection Accuracy' },
              { value: '30%', label: 'Water Savings' },
              { value: '24/7', label: 'Real-Time Monitoring' },
              { value: '500+', label: 'Policy Scenarios' }
            ].map((stat, idx) => (
              <div key={idx}>
                <div className="text-4xl sm:text-5xl font-outfit font-bold text-secondary mb-2">{stat.value}</div>
                <div className="text-slate-300">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-outfit font-bold text-white mb-6">
            Ready to Transform Water Management?
          </h2>
          <p className="text-lg text-slate-300 mb-8">
            Join municipalities and utilities leveraging AI for sustainable water infrastructure.
          </p>
          <Link to="/auth">
            <Button data-testid="cta-get-started" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-8 py-3 font-semibold tracking-wide shadow-lg hover:shadow-cyan-500/20 transition-all">
              Start Free Trial
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6">
        <div className="max-w-7xl mx-auto text-center text-slate-400">
          <p>&copy; 2024 AQOS - AI-Driven Water Sustainability Operating System</p>
        </div>
      </footer>
    </div>
  );
}