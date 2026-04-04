import React, { useState, useEffect } from 'react';
import { zonesAPI } from '../services/api';
import { Boxes } from 'lucide-react';
import { toast } from 'sonner';

export default function DigitalTwin() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchZones = async () => {
    try {
      const data = await zonesAPI.getAll();
      setZones(data);
    } catch (error) {
      toast.error("Failed to load digital twin data");
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchZones().finally(() => setLoading(false));
    const interval = setInterval(fetchZones, 2000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary"></div>
      </div>
    );
  }

  const getZone = (name) => zones.find(z => z.name === name) || { status: 'active', has_leak: false, is_valve_open: true };

  const getStrokeColor = (zoneObj) => {
    if (!zoneObj.is_valve_open) return '#475569'; // slate-600
    if (zoneObj.status === 'critical' || zoneObj.has_leak) return '#ef4444'; // red-500
    return '#06b6d4'; // cyan-500
  };

  const getGlowFilter = (zoneObj) => {
    if (zoneObj.status === 'critical' || zoneObj.has_leak) return 'url(#glow-leak)';
    return 'url(#glow-normal)';
  };

  // Node placements for exactly 4 zones
  const nodes = [
    { id: 'Zone A - Downtown', title: 'ZONE A', x: 750, y: 100, path: "M 195 300 L 250 300 L 400 100 L 700 100" },
    { id: 'Zone B - Industrial', title: 'ZONE B', x: 750, y: 250, path: "M 195 300 L 250 300 L 400 250 L 700 250" },
    { id: 'Zone C - Residential', title: 'ZONE C', x: 750, y: 400, path: "M 195 300 L 250 300 L 400 400 L 700 400" },
    { id: 'Zone D - Commercial', title: 'ZONE D', x: 750, y: 550, path: "M 195 300 L 250 300 L 400 550 L 700 550" },
  ];

  return (
    <div className="space-y-6 animate-fade-up h-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-outfit font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Boxes className="w-8 h-8 text-cyan-500" /> Digital Twin Simulation
          </h1>
          <p className="text-slate-500 mt-1">Live physical-to-digital mapping of the water network infrastructure.</p>
        </div>
      </div>

      <div className="digital-twin-wrapper glass-card p-6 overflow-hidden relative min-h-[700px] flex items-center justify-center bg-slate-950/50">
        <div className="w-full max-w-5xl">
          <svg viewBox="0 0 1000 650" className="w-full h-auto topology-map" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="glow-normal" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="8" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="glow-leak" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="15" result="blur" />
                    <feComponentTransfer in="blur" result="glow">
                        <feFuncA type="linear" slope="1.5" />
                    </feComponentTransfer>
                    <feMerge>
                        <feMergeNode in="glow"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
                </pattern>
            </defs>
            
            <rect width="1000" height="650" fill="url(#grid)" />

            <g transform="translate(150, 300)">
                <circle cx="0" cy="0" r="45" fill="rgba(6,182,212,0.1)" stroke="#06b6d4" strokeWidth="2" filter="url(#glow-normal)" />
                <circle cx="0" cy="0" r="30" fill="#06b6d4" />
                <text x="0" y="5" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">MAIN</text>
            </g>

            {nodes.map(node => {
              const zoneObj = getZone(node.id);
              const color = getStrokeColor(zoneObj);
              const filter = getGlowFilter(zoneObj);
              const isFlowing = zoneObj.is_valve_open && !zoneObj.has_leak;

              return (
                <React.Fragment key={node.id}>
                  {/* Pipe */}
                  <path 
                    d={node.path} 
                    fill="none" 
                    stroke={color} 
                    strokeWidth="4" 
                    strokeDasharray={zoneObj.is_valve_open ? "10 10" : "none"}
                    className={isFlowing ? "animate-[dash_1s_linear_infinite]" : ""}
                    style={isFlowing ? { strokeDashoffset: 100 } : {}}
                  />
                  {/* Node Terminal */}
                  <g transform={`translate(${node.x}, ${node.y})`}>
                    <rect x="-60" y="-35" width="120" height="70" rx="8" fill="rgba(15,23,42,0.8)" stroke={color} strokeWidth="2" filter={filter}/>
                    <text x="0" y="-10" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="600" className="font-outfit">{node.title}</text>
                    <text x="0" y="10" textAnchor="middle" fill={color} fontSize="10" fontWeight="bold">
                      {zoneObj.is_valve_open ? (zoneObj.has_leak ? 'CRITICAL LEAK' : 'VALVE OPEN') : 'VALVE CLOSED'}
                    </text>
                    <text x="0" y="25" textAnchor="middle" fill="#94a3b8" fontSize="10">
                      {zoneObj.current_consumption} m³/h
                    </text>
                  </g>
                </React.Fragment>
              );
            })}
          </svg>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes dash {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}} />
    </div>
  );
}