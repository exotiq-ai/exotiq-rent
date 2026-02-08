'use client';

import {
  Car, DollarSign, TrendingUp, BarChart3, Calendar, Star,
  Check, ArrowRight, Users, Clock, Shield, Plus,
} from 'lucide-react';
import { vehicles, PageType } from './data';

interface OperatorDashboardProps {
  navigate: (page: PageType, vehicleId?: number) => void;
}

export default function OperatorDashboard({ navigate }: OperatorDashboardProps) {
  const fleetVehicles = vehicles.slice(0, 6);
  const monthlyRevenue = [28, 35, 42, 38, 52, 61, 58, 72, 68, 85, 79, 94];
  const maxRev = Math.max(...monthlyRevenue);

  return (
    <div className="animate-page-in" style={{ backgroundColor: '#0B0B0F', minHeight: '100vh', paddingTop: '100px' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] mb-2" style={{ color: '#6EC1E4' }}>OPERATOR DASHBOARD</p>
            <h1 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: '"Dfaalt", sans-serif', color: '#F0F0F5' }}>
              Desert Exotic Rentals
            </h1>
            <p className="text-sm mt-1" style={{ color: '#8888A0' }}>Scottsdale, AZ · Member since Jan 2023</p>
          </div>
          <button
            className="mt-4 sm:mt-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
            style={{ backgroundColor: '#6EC1E4', color: '#0B0B0F' }}
          >
            <Plus size={16} /> Add Vehicle
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { icon: Car, value: '6', label: 'Active Vehicles', change: '+2 this month', positive: true },
            { icon: DollarSign, value: '$94K', label: 'Monthly Revenue', change: '+18% vs last month', positive: true },
            { icon: Calendar, value: '85%', label: 'Utilization Rate', change: '+5% vs last month', positive: true },
            { icon: Star, value: '4.9', label: 'Average Rating', change: '47 reviews', positive: true },
          ].map((kpi, i) => (
            <div key={i} className="rounded-xl p-5" style={{ backgroundColor: '#161622', border: '1px solid rgba(110,193,228,0.08)' }}>
              <div className="flex items-center justify-between mb-3">
                <kpi.icon size={20} color="#6EC1E4" />
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(46,204,113,0.1)', color: '#2ECC71' }}>
                  {kpi.change}
                </span>
              </div>
              <p className="text-2xl font-bold font-mont" style={{ color: '#F0F0F5' }}>{kpi.value}</p>
              <p className="text-xs mt-1" style={{ color: '#555570' }}>{kpi.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Chart */}
          <div className="lg:col-span-2 rounded-xl p-6" style={{ backgroundColor: '#161622', border: '1px solid rgba(110,193,228,0.08)' }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-semibold" style={{ color: '#F0F0F5' }}>Revenue Overview</h3>
                <p className="text-xs" style={{ color: '#555570' }}>Last 12 months</p>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp size={14} color="#2ECC71" />
                <span className="text-xs font-semibold" style={{ color: '#2ECC71' }}>+42% YoY</span>
              </div>
            </div>
            <div className="flex items-end gap-2 h-40">
              {monthlyRevenue.map((rev, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t transition-all duration-300 hover:opacity-80"
                    style={{
                      height: `${(rev / maxRev) * 100}%`,
                      backgroundColor: i === monthlyRevenue.length - 1 ? '#6EC1E4' : 'rgba(110,193,228,0.25)',
                      minHeight: '4px',
                    }}
                  />
                  <span className="text-[9px]" style={{ color: '#555570' }}>
                    {['J','F','M','A','M','J','J','A','S','O','N','D'][i]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Booking Pipeline */}
          <div className="rounded-xl p-6" style={{ backgroundColor: '#161622', border: '1px solid rgba(110,193,228,0.08)' }}>
            <h3 className="text-base font-semibold mb-5" style={{ color: '#F0F0F5' }}>Booking Pipeline</h3>
            <div className="space-y-4">
              {[
                { status: 'Upcoming', count: 8, color: '#6EC1E4' },
                { status: 'Active', count: 3, color: '#2ECC71' },
                { status: 'Completed', count: 142, color: '#8888A0' },
                { status: 'Pending Review', count: 2, color: '#F15A29' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm" style={{ color: '#F0F0F5' }}>{item.status}</span>
                  </div>
                  <span className="text-sm font-semibold font-mont" style={{ color: item.color }}>{item.count}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs mb-2" style={{ color: '#555570' }}>Total Revenue (YTD)</p>
              <p className="text-2xl font-bold font-mont" style={{ color: '#6EC1E4' }}>$847,200</p>
            </div>
          </div>
        </div>

        {/* Fleet Grid */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold" style={{ fontFamily: '"Dfaalt", sans-serif', color: '#F0F0F5' }}>Your Fleet</h3>
            <span className="text-xs" style={{ color: '#8888A0' }}>6 vehicles</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {fleetVehicles.map((v) => (
              <div
                key={v.id}
                onClick={() => navigate('vehicle', v.id)}
                className="rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
                style={{ backgroundColor: '#161622', border: '1px solid rgba(110,193,228,0.06)' }}
              >
                <img src={v.image} alt={v.name} className="w-full h-36 object-cover" />
                <div className="p-4">
                  <p className="font-semibold text-sm mb-1" style={{ color: '#F0F0F5' }}>{v.name}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: '#8888A0' }}>{v.trips} trips · {v.rating}★</span>
                    <span className="text-sm font-bold font-mont" style={{ color: '#6EC1E4' }}>${v.price}/day</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full" style={{ width: `${60 + Math.random() * 35}%`, backgroundColor: '#2ECC71' }} />
                    </div>
                    <span className="text-[10px]" style={{ color: '#2ECC71' }}>Active</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA for new operators */}
        <div className="mt-12 rounded-2xl p-8 text-center" style={{ backgroundColor: 'rgba(110,193,228,0.04)', border: '1px solid rgba(110,193,228,0.1)' }}>
          <h3 className="text-xl font-bold mb-2" style={{ fontFamily: '"Dfaalt", sans-serif', color: '#F0F0F5' }}>
            Ready to List Your Fleet?
          </h3>
          <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: '#8888A0' }}>
            Join 50+ verified operators earning an average of $14K/month per vehicle on Drive Exotiq.
          </p>
          <button className="px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90" style={{ backgroundColor: '#6EC1E4', color: '#0B0B0F' }}>
            Apply to List Your Fleet <ArrowRight size={16} className="inline ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}
