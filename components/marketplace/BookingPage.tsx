'use client';

import { useState } from 'react';
import {
  Check, ArrowRight, ArrowLeft, Shield, Calendar, MapPin,
  CreditCard, Clock, Star, Zap, Car, Plus, Minus,
} from 'lucide-react';
import { Vehicle, PageType } from './data';

interface BookingPageProps {
  vehicle: Vehicle;
  navigate: (page: PageType, vehicleId?: number) => void;
}

type BookingStep = 'details' | 'protection' | 'extras' | 'payment' | 'confirmation';

const STEPS: { key: BookingStep; label: string }[] = [
  { key: 'details', label: 'Trip Details' },
  { key: 'protection', label: 'Protection' },
  { key: 'extras', label: 'Extras' },
  { key: 'payment', label: 'Payment' },
  { key: 'confirmation', label: 'Confirmed' },
];

export default function BookingPage({ vehicle, navigate }: BookingPageProps) {
  const [currentStep, setCurrentStep] = useState<BookingStep>('details');
  const [selectedProtection, setSelectedProtection] = useState('standard');
  const [extras, setExtras] = useState<string[]>([]);

  const stepIndex = STEPS.findIndex(s => s.key === currentStep);

  const goNext = () => {
    const next = STEPS[stepIndex + 1];
    if (next) setCurrentStep(next.key);
  };

  const goBack = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) setCurrentStep(prev.key);
  };

  const toggleExtra = (extra: string) => {
    setExtras(prev => prev.includes(extra) ? prev.filter(e => e !== extra) : [...prev, extra]);
  };

  const days = 4;
  const total = vehicle.price * days + 100 + 75 + 220 + Math.round(vehicle.price * days * 0.068);

  return (
    <div style={{ backgroundColor: '#0B0B0F', minHeight: '100vh', paddingTop: '80px' }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Progress Bar */}
        {currentStep !== 'confirmation' && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              {STEPS.slice(0, -1).map((step, i) => (
                <div key={step.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                      style={{
                        backgroundColor: i <= stepIndex ? '#6EC1E4' : 'rgba(255,255,255,0.06)',
                        color: i <= stepIndex ? '#0B0B0F' : '#555570',
                      }}
                    >
                      {i < stepIndex ? <Check size={14} /> : i + 1}
                    </div>
                    <span className="text-[10px] mt-1.5 hidden sm:block" style={{ color: i <= stepIndex ? '#6EC1E4' : '#555570' }}>
                      {step.label}
                    </span>
                  </div>
                  {i < STEPS.length - 2 && (
                    <div className="flex-1 h-px mx-2" style={{ backgroundColor: i < stepIndex ? '#6EC1E4' : 'rgba(255,255,255,0.08)' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vehicle Summary (always visible on non-confirmation) */}
        {currentStep !== 'confirmation' && (
          <div
            className="rounded-xl p-4 mb-8 flex items-center gap-4"
            style={{ backgroundColor: '#161622', border: '1px solid rgba(110,193,228,0.08)' }}
          >
            <img src={vehicle.image} alt={vehicle.name} className="w-20 h-14 rounded-lg object-cover" />
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: '#F0F0F5' }}>{vehicle.name}</p>
              <p className="text-xs" style={{ color: '#8888A0' }}>{vehicle.fleet} · {vehicle.city}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold font-mont" style={{ color: '#6EC1E4' }}>${total.toLocaleString()}</p>
              <p className="text-[10px]" style={{ color: '#555570' }}>{days} days</p>
            </div>
          </div>
        )}

        {/* ===== STEP: TRIP DETAILS ===== */}
        {currentStep === 'details' && (
          <div
            className="rounded-2xl p-6 sm:p-8"
            style={{ backgroundColor: '#161622', border: '1px solid rgba(110,193,228,0.08)' }}
          >
            <h2 className="text-xl font-bold mb-6" style={{ fontFamily: '"Dfaalt", sans-serif', color: '#F0F0F5' }}>
              Trip Details
            </h2>

            <div className="space-y-5">
              {/* Dates */}
              <div className="flex items-start gap-3">
                <Calendar size={18} color="#6EC1E4" className="mt-1" />
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1" style={{ color: '#F0F0F5' }}>Dates & Times</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg p-3" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: '#555570' }}>Pickup</p>
                      <p className="text-sm" style={{ color: '#F0F0F5' }}>Wed, Oct 11</p>
                      <p className="text-xs" style={{ color: '#8888A0' }}>10:00 AM</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: '#555570' }}>Return</p>
                      <p className="text-sm" style={{ color: '#F0F0F5' }}>Sat, Oct 14</p>
                      <p className="text-xs" style={{ color: '#8888A0' }}>10:00 AM</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pickup preference */}
              <div className="flex items-start gap-3">
                <MapPin size={18} color="#6EC1E4" className="mt-1" />
                <div className="flex-1">
                  <p className="text-sm font-medium mb-3" style={{ color: '#F0F0F5' }}>Pickup Preference</p>
                  {['Pickup at Location', 'Deliver to Me'].map((opt, i) => (
                    <label key={opt} className="flex items-center gap-3 mb-2 cursor-pointer">
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ border: `2px solid ${i === 0 ? '#6EC1E4' : 'rgba(255,255,255,0.15)'}` }}
                      >
                        {i === 0 && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#6EC1E4' }} />}
                      </div>
                      <span className="text-sm" style={{ color: '#F0F0F5' }}>{opt}</span>
                      {i === 1 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(46,204,113,0.1)', color: '#2ECC71' }}>Free</span>}
                    </label>
                  ))}
                </div>
              </div>

              {/* Driver Info */}
              <div className="flex items-start gap-3">
                <Car size={18} color="#6EC1E4" className="mt-1" />
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1" style={{ color: '#F0F0F5' }}>Driver Information</p>
                  <p className="text-xs" style={{ color: '#8888A0' }}>Primary driver details will be confirmed at checkout</p>
                </div>
              </div>
            </div>

            <button
              onClick={goNext}
              className="w-full mt-8 py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-300 hover:opacity-90"
              style={{ backgroundColor: '#6EC1E4', color: '#0B0B0F' }}
            >
              Continue to Protection <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ===== STEP: PROTECTION ===== */}
        {currentStep === 'protection' && (
          <div
            className="rounded-2xl p-6 sm:p-8"
            style={{ backgroundColor: '#161622', border: '1px solid rgba(110,193,228,0.08)' }}
          >
            <h2 className="text-xl font-bold mb-6" style={{ fontFamily: '"Dfaalt", sans-serif', color: '#F0F0F5' }}>
              Protection Plan
            </h2>

            <div className="space-y-4">
              {[
                {
                  id: 'premium',
                  name: 'Premium Protection',
                  price: '$380',
                  desc: 'Full coverage with $0 deductible. Includes tire & windshield protection.',
                  badge: 'RECOMMENDED',
                },
                {
                  id: 'standard',
                  name: 'Standard Protection',
                  price: '$220',
                  desc: 'Comprehensive coverage with $500 deductible. Covers collision and theft.',
                  badge: 'INCLUDED',
                },
                {
                  id: 'minimum',
                  name: 'Minimum Protection',
                  price: '$120',
                  desc: 'Basic coverage with $2,500 deductible. State-minimum requirements met.',
                  badge: null,
                },
              ].map(plan => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedProtection(plan.id)}
                  className="w-full text-left rounded-xl p-5 transition-all duration-200"
                  style={{
                    backgroundColor: selectedProtection === plan.id ? 'rgba(110,193,228,0.05)' : 'rgba(255,255,255,0.02)',
                    border: `1.5px solid ${selectedProtection === plan.id ? 'rgba(110,193,228,0.4)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ border: `2px solid ${selectedProtection === plan.id ? '#6EC1E4' : 'rgba(255,255,255,0.2)'}` }}
                      >
                        {selectedProtection === plan.id && (
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#6EC1E4' }} />
                        )}
                      </div>
                      <span className="font-semibold text-sm" style={{ color: '#F0F0F5' }}>{plan.name}</span>
                      {plan.badge && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: plan.badge === 'RECOMMENDED' ? 'rgba(110,193,228,0.15)' : 'rgba(201,168,76,0.15)',
                            color: plan.badge === 'RECOMMENDED' ? '#6EC1E4' : '#C9A84C',
                          }}
                        >
                          {plan.badge}
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-sm font-mont" style={{ color: '#6EC1E4' }}>{plan.price}</span>
                  </div>
                  <p className="text-xs ml-7" style={{ color: '#8888A0' }}>{plan.desc}</p>
                </button>
              ))}
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={goBack}
                className="flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200"
                style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#8888A0' }}
              >
                <ArrowLeft size={14} /> Back
              </button>
              <button
                onClick={goNext}
                className="flex-[2] py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-300 hover:opacity-90"
                style={{ backgroundColor: '#6EC1E4', color: '#0B0B0F' }}
              >
                Continue to Extras <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP: EXTRAS ===== */}
        {currentStep === 'extras' && (
          <div
            className="rounded-2xl p-6 sm:p-8"
            style={{ backgroundColor: '#161622', border: '1px solid rgba(110,193,228,0.08)' }}
          >
            <h2 className="text-xl font-bold mb-6" style={{ fontFamily: '"Dfaalt", sans-serif', color: '#F0F0F5' }}>
              Extras & Add-Ons
            </h2>

            <div className="space-y-3">
              {[
                { id: 'mileage', name: 'Extra 500 Miles', price: '$175', desc: '500 additional miles beyond the included 500' },
                { id: 'child-seat', name: 'Child Seat', price: '$25/day', desc: 'Rear-facing or forward-facing car seat' },
                { id: 'gps', name: 'Portable GPS', price: '$15/day', desc: 'Standalone GPS navigation device' },
                { id: 'wifi', name: 'Mobile WiFi Hotspot', price: '$20/day', desc: 'Stay connected on the road' },
                { id: 'charger', name: 'Phone Charger Kit', price: '$10', desc: 'Multi-device charging cable set' },
              ].map(extra => (
                <button
                  key={extra.id}
                  onClick={() => toggleExtra(extra.id)}
                  className="w-full text-left rounded-xl p-4 flex items-center gap-4 transition-all duration-200"
                  style={{
                    backgroundColor: extras.includes(extra.id) ? 'rgba(110,193,228,0.05)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${extras.includes(extra.id) ? 'rgba(110,193,228,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: extras.includes(extra.id) ? '#6EC1E4' : 'transparent',
                      border: `2px solid ${extras.includes(extra.id) ? '#6EC1E4' : 'rgba(255,255,255,0.15)'}`,
                    }}
                  >
                    {extras.includes(extra.id) && (
                      <Check size={12} color="#0B0B0F" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: '#F0F0F5' }}>{extra.name}</p>
                    <p className="text-xs" style={{ color: '#8888A0' }}>{extra.desc}</p>
                  </div>
                  <span className="text-sm font-semibold font-mont" style={{ color: '#6EC1E4' }}>{extra.price}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={goBack}
                className="flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200"
                style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#8888A0' }}
              >
                <ArrowLeft size={14} /> Back
              </button>
              <button
                onClick={goNext}
                className="flex-[2] py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-300 hover:opacity-90"
                style={{ backgroundColor: '#6EC1E4', color: '#0B0B0F' }}
              >
                Continue to Payment <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP: PAYMENT ===== */}
        {currentStep === 'payment' && (
          <div
            className="rounded-2xl p-6 sm:p-8"
            style={{ backgroundColor: '#161622', border: '1px solid rgba(110,193,228,0.08)' }}
          >
            <h2 className="text-xl font-bold mb-6" style={{ fontFamily: '"Dfaalt", sans-serif', color: '#F0F0F5' }}>
              Payment
            </h2>

            {/* Card form */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: '#8888A0' }}>Card Number</label>
                <input
                  type="text"
                  placeholder="4242 4242 4242 4242"
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all focus:border-[#6EC1E4]"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#F0F0F5',
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#8888A0' }}>Expiry</label>
                  <input
                    type="text"
                    placeholder="MM / YY"
                    className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all focus:border-[#6EC1E4]"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#F0F0F5',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#8888A0' }}>CVV</label>
                  <input
                    type="text"
                    placeholder="123"
                    className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all focus:border-[#6EC1E4]"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#F0F0F5',
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: '#8888A0' }}>Name on Card</label>
                <input
                  type="text"
                  placeholder="John Smith"
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all focus:border-[#6EC1E4]"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#F0F0F5',
                  }}
                />
              </div>
            </div>

            {/* Trip Summary */}
            <div
              className="rounded-xl p-4 mb-6 space-y-2"
              style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: '#555570' }}>Trip Summary</p>
              <div className="flex justify-between text-sm">
                <span style={{ color: '#8888A0' }}>{vehicle.name}</span>
                <span style={{ color: '#F0F0F5' }}>{days} days</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: '#8888A0' }}>Protection</span>
                <span className="capitalize" style={{ color: '#F0F0F5' }}>{selectedProtection}</span>
              </div>
              {extras.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#8888A0' }}>Extras</span>
                  <span style={{ color: '#F0F0F5' }}>{extras.length} add-ons</span>
                </div>
              )}
              <div className="flex justify-between pt-2 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="font-semibold" style={{ color: '#F0F0F5' }}>Total</span>
                <span className="font-bold text-lg font-mont" style={{ color: '#6EC1E4' }}>${total.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={goBack}
                className="flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200"
                style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#8888A0' }}
              >
                <ArrowLeft size={14} /> Back
              </button>
              <button
                onClick={goNext}
                className="flex-[2] py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-300 hover:opacity-90"
                style={{ backgroundColor: '#6EC1E4', color: '#0B0B0F' }}
              >
                <CreditCard size={16} /> Book This Trip
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP: CONFIRMATION ===== */}
        {currentStep === 'confirmation' && (
          <div className="text-center py-12">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: 'rgba(110,193,228,0.15)' }}
            >
              <Check size={36} color="#6EC1E4" />
            </div>
            <h2
              className="text-2xl sm:text-3xl font-bold mb-3"
              style={{ fontFamily: '"Dfaalt", sans-serif', color: '#F0F0F5' }}
            >
              Booking Confirmed!
            </h2>
            <p className="text-sm mb-8 max-w-md mx-auto" style={{ color: '#8888A0' }}>
              Your {vehicle.name} is reserved. Rari will message you with pickup details and final instructions.
            </p>

            <div
              className="rounded-xl p-6 max-w-md mx-auto mb-8 text-left"
              style={{ backgroundColor: '#161622', border: '1px solid rgba(110,193,228,0.08)' }}
            >
              <div className="flex items-center gap-4 mb-4">
                <img src={vehicle.image} alt={vehicle.name} className="w-24 h-16 rounded-lg object-cover" />
                <div>
                  <p className="font-semibold text-sm" style={{ color: '#F0F0F5' }}>{vehicle.name}</p>
                  <p className="text-xs" style={{ color: '#8888A0' }}>{vehicle.fleet}</p>
                </div>
              </div>
              <div className="space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#8888A0' }}>Dates</span>
                  <span style={{ color: '#F0F0F5' }}>Oct 11 – Oct 14</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#8888A0' }}>Location</span>
                  <span style={{ color: '#F0F0F5' }}>{vehicle.city}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#8888A0' }}>Total</span>
                  <span className="font-bold" style={{ color: '#6EC1E4' }}>${total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate('trips')}
                className="px-6 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-300 hover:opacity-90"
                style={{ backgroundColor: '#6EC1E4', color: '#0B0B0F' }}
              >
                View My Trips <ArrowRight size={16} />
              </button>
              <button
                onClick={() => navigate('home')}
                className="px-6 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200"
                style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#8888A0' }}
              >
                Back to Home
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
