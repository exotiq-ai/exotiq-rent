'use client';

import { useState } from 'react';
import {
  Star, MapPin, Heart, Share2, ChevronLeft, ChevronRight,
  Shield, Clock, CreditCard, Info, Zap, Gauge, Fuel,
  Car, Users, Check, ArrowRight, MessageCircle, Calendar,
  Navigation, Wifi, Volume2, Camera,
} from 'lucide-react';
import { Vehicle, reviews, PageType } from './data';

interface VehicleDetailPageProps {
  vehicle: Vehicle;
  navigate: (page: PageType, vehicleId?: number) => void;
  favorites: number[];
  toggleFavorite: (id: number) => void;
}

/* ============================================================
   IMAGE GALLERY
   ============================================================ */
function ImageGallery({ vehicle, isFav, onToggleFav }: { vehicle: Vehicle; isFav: boolean; onToggleFav: () => void }) {
  return (
    <div className="relative">
      {/* Full-width hero image */}
      <div className="relative w-full overflow-hidden" style={{ maxHeight: '60vh' }}>
        <img
          src={vehicle.image}
          alt={vehicle.name}
          className="w-full h-full object-cover"
          style={{ minHeight: '400px' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(11,11,15,0.7) 0%, rgba(11,11,15,0.1) 40%, rgba(11,11,15,0.3) 100%)',
          }}
        />

        {/* Overlay buttons */}
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={onToggleFav}
            className="p-2.5 rounded-full backdrop-blur-md transition-all duration-200 hover:scale-110"
            style={{ backgroundColor: isFav ? 'rgba(110,193,228,0.2)' : 'rgba(0,0,0,0.5)' }}
          >
            <Heart size={18} fill={isFav ? '#6EC1E4' : 'none'} color={isFav ? '#6EC1E4' : '#F0F0F5'} />
          </button>
          <button
            className="p-2.5 rounded-full backdrop-blur-md transition-all duration-200 hover:scale-110"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          >
            <Share2 size={18} color="#F0F0F5" />
          </button>
        </div>

        {/* Vehicle name overlay on image */}
        <div className="absolute bottom-6 left-6">
          <p className="text-xs mb-1" style={{ color: '#6EC1E4' }}>{vehicle.fleet}</p>
          <h1
            className="text-2xl sm:text-3xl lg:text-4xl font-bold"
            style={{ fontFamily: '"Dfaalt", sans-serif', color: '#F0F0F5', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
          >
            {vehicle.name}
          </h1>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   SPECS GRID
   ============================================================ */
function SpecsGrid({ specs }: { specs: Vehicle['specs'] }) {
  const specItems = [
    { icon: Zap, label: 'Power', value: specs.power },
    { icon: Gauge, label: '0-100', value: specs.acceleration },
    { icon: ArrowRight, label: 'Top Speed', value: specs.topSpeed },
    { icon: Car, label: 'Engine', value: specs.engine },
    { icon: Clock, label: 'Transmission', value: specs.transmission },
    { icon: Fuel, label: 'Fuel', value: specs.fuel },
    { icon: Navigation, label: 'Drive', value: specs.drive },
    { icon: Users, label: 'Seats', value: specs.seats.toString() },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {specItems.map((s, i) => (
        <div
          key={i}
          className="rounded-xl p-4 text-center"
          style={{
            backgroundColor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(110,193,228,0.06)',
          }}
        >
          <s.icon size={18} color="#6EC1E4" className="mx-auto mb-2" />
          <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: '#555570' }}>{s.label}</p>
          <p className="text-sm font-semibold font-mont" style={{ color: '#F0F0F5' }}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   BOOKING CARD (sticky sidebar)
   ============================================================ */
function BookingCard({ vehicle, navigate }: { vehicle: Vehicle; navigate: (page: PageType) => void }) {
  const days = 4;
  const subtotal = vehicle.price * days;
  const youngDriverFee = 100;
  const tripFee = 75;
  const protection = 220;
  const salesTax = Math.round(subtotal * 0.068);
  const total = subtotal + youngDriverFee + tripFee + protection + salesTax;

  return (
    <div
      className="sticky top-24 rounded-2xl p-6"
      style={{
        backgroundColor: 'rgba(22, 22, 34, 0.8)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(110, 193, 228, 0.15)',
        boxShadow: '0 4px 32px rgba(0,0,0,0.3)',
      }}
    >
      {/* Price with AI savings */}
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-3xl font-bold font-mont" style={{ color: '#6EC1E4' }}>
          ${vehicle.price.toLocaleString()}
        </span>
        <span className="text-sm line-through" style={{ color: '#555570' }}>
          ${Math.round(vehicle.price * 1.15).toLocaleString()}
        </span>
        <span className="text-xs" style={{ color: '#555570' }}>/day</span>
      </div>
      <div className="flex items-center gap-2 mb-6">
        <p className="flex items-center gap-1 text-xs" style={{ color: '#6EC1E4' }}>
          <Zap size={10} /> AI-optimized price
        </p>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(46,204,113,0.12)', color: '#2ECC71' }}>
          Save {Math.round(vehicle.price * 0.15)}
        </span>
      </div>

      {/* Date Selection */}
      <div
        className="rounded-xl mb-4 overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex">
          <div className="flex-1 p-3" style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#555570' }}>Pickup</p>
            <p className="text-sm font-medium" style={{ color: '#F0F0F5' }}>Oct 11, 10:00 AM</p>
          </div>
          <div className="flex-1 p-3">
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#555570' }}>Return</p>
            <p className="text-sm font-medium" style={{ color: '#F0F0F5' }}>Oct 14, 10:00 AM</p>
          </div>
        </div>
      </div>

      {/* Trip duration */}
      <p className="text-sm text-center mb-5" style={{ color: '#8888A0' }}>
        {days} day trip
      </p>

      {/* Price Breakdown */}
      <div className="space-y-3 mb-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
        <div className="flex justify-between text-sm">
          <span style={{ color: '#8888A0' }}>${vehicle.price.toLocaleString()} x {days} days</span>
          <span style={{ color: '#F0F0F5' }}>${subtotal.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: '#8888A0' }}>Young driver fee</span>
          <span style={{ color: '#F0F0F5' }}>${youngDriverFee}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: '#8888A0' }}>Trip fee</span>
          <span style={{ color: '#F0F0F5' }}>${tripFee}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: '#8888A0' }}>Standard protection</span>
          <span style={{ color: '#F0F0F5' }}>${protection}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: '#8888A0' }}>Sales tax</span>
          <span style={{ color: '#F0F0F5' }}>${salesTax}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: '#8888A0' }}>Free delivery</span>
          <span style={{ color: '#2ECC71' }}>$0</span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: '#8888A0' }}>Mileage (500 included)</span>
          <span style={{ color: '#2ECC71' }}>FREE</span>
        </div>
        <div
          className="flex justify-between pt-3 mt-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span className="font-semibold" style={{ color: '#F0F0F5' }}>Total</span>
          <span className="text-xl font-bold font-mont" style={{ color: '#6EC1E4' }}>
            ${total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Free cancellation */}
      <p className="flex items-center gap-2 text-xs mb-5" style={{ color: '#2ECC71' }}>
        <Check size={14} /> Free cancellation before Oct 9
      </p>

      {/* CTA */}
      <button
        onClick={() => navigate('booking')}
        className="w-full py-3.5 rounded-xl font-semibold text-base transition-all duration-300 hover:opacity-90 flex items-center justify-center gap-2"
        style={{ backgroundColor: '#6EC1E4', color: '#0B0B0F' }}
      >
        Continue <ArrowRight size={18} />
      </button>

      {/* Links */}
      <div className="flex items-center justify-center gap-4 mt-4">
        <button className="text-xs transition-colors hover:text-[#6EC1E4]" style={{ color: '#555570' }}>
          Gift Card
        </button>
        <span style={{ color: '#555570' }}>·</span>
        <button className="text-xs transition-colors hover:text-[#6EC1E4]" style={{ color: '#555570' }}>
          Promo Code
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   VEHICLE DETAIL PAGE
   ============================================================ */
export default function VehicleDetailPage({
  vehicle,
  navigate,
  favorites,
  toggleFavorite,
}: VehicleDetailPageProps) {
  const isFav = favorites.includes(vehicle.id);

  const features = [
    { icon: Navigation, label: 'GPS Navigation' },
    { icon: Volume2, label: '150W Audio' },
    { icon: Wifi, label: 'Apple CarPlay' },
    { icon: Wifi, label: 'Bluetooth' },
    { icon: Camera, label: 'Backup Camera' },
    { icon: Shield, label: 'Lane Assist' },
  ];

  const rules = [
    'No smoking in vehicle',
    'Return clean or pay cleaning fee',
    'Report any damage immediately',
    'Keep within mileage limits',
    'Valid license & insurance required',
  ];

  return (
    <div className="animate-page-in" style={{ backgroundColor: '#0B0B0F', minHeight: '100vh', paddingTop: '64px' }}>
      {/* Back button */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <button
          onClick={() => navigate('search')}
          className="flex items-center gap-2 text-sm transition-colors hover:text-[#6EC1E4]"
          style={{ color: '#8888A0' }}
        >
          <ChevronLeft size={16} /> Back to results
        </button>
      </div>

      {/* Image Gallery */}
      <ImageGallery vehicle={vehicle} isFav={isFav} onToggleFav={() => toggleFavorite(vehicle.id)} />

      {/* Content + Booking Sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Column */}
          <div className="flex-1 lg:w-[65%]">
            {/* Rating + Trips + Badges */}
            <div className="flex items-center gap-3 mb-8 flex-wrap">
              <div className="flex items-center gap-1">
                <Star size={16} fill="#F5C842" color="#F5C842" />
                <span className="font-semibold text-sm" style={{ color: '#F0F0F5' }}>{vehicle.rating}</span>
              </div>
              <span className="text-sm" style={{ color: '#8888A0' }}>· {vehicle.trips} trips</span>
              <span className="text-sm flex items-center gap-1" style={{ color: '#8888A0' }}>
                · <MapPin size={12} /> {vehicle.city}
              </span>
              {vehicle.instant && (
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(110,193,228,0.12)', color: '#6EC1E4' }}>
                  Instant Book
                </span>
              )}
              {vehicle.rating >= 4.9 && (
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(241,90,41,0.12)', color: '#F15A29' }}>
                  Superhost
                </span>
              )}
            </div>

            {/* Your Trip Card */}
            <div
              className="rounded-xl p-5 mb-8"
              style={{ backgroundColor: '#161622', border: '1px solid rgba(110,193,228,0.08)' }}
            >
              <h3 className="text-sm font-semibold mb-4 font-mont" style={{ color: '#F0F0F5' }}>Your Trip</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <Calendar size={16} color="#6EC1E4" className="mt-0.5" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wider" style={{ color: '#555570' }}>Trip Dates</p>
                    <p className="text-sm" style={{ color: '#F0F0F5' }}>Wed, Oct 11 – Sat, Oct 14</p>
                    <p className="text-xs" style={{ color: '#8888A0' }}>10:00 AM – 10:00 AM</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin size={16} color="#6EC1E4" className="mt-0.5" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wider" style={{ color: '#555570' }}>Pickup & Return</p>
                    <p className="text-sm" style={{ color: '#F0F0F5' }}>{vehicle.city}</p>
                    <p className="text-xs" style={{ color: '#8888A0' }}>Doorstep delivery available</p>
                  </div>
                </div>
              </div>
            </div>

            {/* About Booking */}
            <div className="mb-8">
              <h3
                className="text-xl font-bold mb-5"
                style={{ fontFamily: '"Dfaalt", sans-serif', color: '#F0F0F5' }}
              >
                About Booking
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { icon: Shield, title: 'Free Cancellation', desc: 'Cancel before Oct 9 at no charge' },
                  { icon: CreditCard, title: '$50 Deposit', desc: 'Pay just $50 to reserve' },
                  { icon: Gauge, title: '500 mi Included', desc: 'Extra miles at $0.75/mi' },
                  { icon: Shield, title: 'Standard Protection', desc: 'Insurance included in price' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: 'rgba(110,193,228,0.08)' }}>
                      <item.icon size={16} color="#6EC1E4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#F0F0F5' }}>{item.title}</p>
                      <p className="text-xs" style={{ color: '#8888A0' }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Technical Specifications */}
            <div className="mb-8">
              <h3
                className="text-xl font-bold mb-5"
                style={{ fontFamily: '"Dfaalt", sans-serif', color: '#F0F0F5' }}
              >
                Technical Specifications
              </h3>
              <SpecsGrid specs={vehicle.specs} />
            </div>

            {/* Vehicle Description */}
            <div className="mb-8">
              <h3
                className="text-xl font-bold mb-4"
                style={{ fontFamily: '"Dfaalt", sans-serif', color: '#F0F0F5' }}
              >
                About This Vehicle
              </h3>
              <p className="text-sm leading-relaxed mb-3" style={{ color: '#8888A0' }}>
                Experience the extraordinary {vehicle.name}. With {vehicle.specs.power} of raw power
                and a {vehicle.specs.acceleration} sprint to 100, this {vehicle.type.toLowerCase()} delivers
                an unforgettable driving experience. The {vehicle.specs.engine} engine paired with a
                {' '}{vehicle.specs.transmission.toLowerCase()} transmission provides seamless performance
                through every corner.
              </p>
              <p className="text-sm leading-relaxed" style={{ color: '#8888A0' }}>
                Available from {vehicle.fleet} in {vehicle.city}, this vehicle comes with 500 miles
                included, comprehensive insurance, and the option for doorstep delivery.
                {vehicle.instant ? ' Instant booking available — reserve in seconds.' : ''}
              </p>
            </div>

            {/* Features */}
            <div className="mb-8">
              <h3
                className="text-xl font-bold mb-5"
                style={{ fontFamily: '"Dfaalt", sans-serif', color: '#F0F0F5' }}
              >
                Features
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                {features.map((f, i) => (
                  <div key={i} className="text-center">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2"
                      style={{ backgroundColor: 'rgba(110,193,228,0.06)', border: '1px solid rgba(110,193,228,0.08)' }}
                    >
                      <f.icon size={18} color="#6EC1E4" />
                    </div>
                    <p className="text-[11px]" style={{ color: '#8888A0' }}>{f.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Reviews */}
            <div className="mb-8">
              <h3
                className="text-xl font-bold mb-5"
                style={{ fontFamily: '"Dfaalt", sans-serif', color: '#F0F0F5' }}
              >
                Ratings & Reviews
              </h3>

              {/* Overall rating */}
              <div className="flex items-center gap-6 mb-6">
                <div className="text-center">
                  <p className="text-4xl font-bold font-mont" style={{ color: '#F0F0F5' }}>{vehicle.rating}</p>
                  <div className="flex gap-0.5 mt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={14} fill="#F5C842" color="#F5C842" />
                    ))}
                  </div>
                  <p className="text-xs mt-1" style={{ color: '#8888A0' }}>{vehicle.trips} reviews</p>
                </div>
                <div className="flex-1 space-y-1.5">
                  {[5, 4, 3, 2, 1].map(stars => {
                    const pct = stars === 5 ? 78 : stars === 4 ? 18 : stars === 3 ? 4 : 0;
                    return (
                      <div key={stars} className="flex items-center gap-2">
                        <span className="text-xs w-3" style={{ color: '#8888A0' }}>{stars}</span>
                        <Star size={10} color="#F5C842" fill="#F5C842" />
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: '#F5C842' }} />
                        </div>
                        <span className="text-xs w-8 text-right" style={{ color: '#555570' }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Review cards */}
              <div className="space-y-4">
                {reviews.map((review, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-5"
                    style={{ backgroundColor: '#161622', border: '1px solid rgba(110,193,228,0.06)' }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ backgroundColor: 'rgba(110,193,228,0.15)', color: '#6EC1E4' }}
                        >
                          {review.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#F0F0F5' }}>{review.name}</p>
                          <p className="text-xs" style={{ color: '#555570' }}>{review.date}</p>
                        </div>
                      </div>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <Star key={j} size={12} fill={j < review.rating ? '#F5C842' : 'transparent'} color={j < review.rating ? '#F5C842' : '#555570'} />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: '#8888A0' }}>
                      {review.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Hosted By */}
            <div className="mb-8">
              <h3
                className="text-xl font-bold mb-5"
                style={{ fontFamily: '"Dfaalt", sans-serif', color: '#F0F0F5' }}
              >
                Hosted By
              </h3>
              <div
                className="rounded-xl p-5"
                style={{ backgroundColor: '#161622', border: '1px solid rgba(110,193,228,0.08)' }}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold"
                    style={{ backgroundColor: 'rgba(110,193,228,0.12)', color: '#6EC1E4' }}
                  >
                    {vehicle.fleet.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-base" style={{ color: '#F0F0F5' }}>{vehicle.fleet}</p>
                    <p className="text-xs" style={{ color: '#8888A0' }}>Joined January 2023</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-xs" style={{ color: '#555570' }}>Response Rate</p>
                    <p className="text-sm font-semibold" style={{ color: '#F0F0F5' }}>98%</p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: '#555570' }}>Response Time</p>
                    <p className="text-sm font-semibold" style={{ color: '#F0F0F5' }}>&lt;1 hour</p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: '#555570' }}>Fleet Size</p>
                    <p className="text-sm font-semibold" style={{ color: '#F0F0F5' }}>12 vehicles</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('messages')}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-[rgba(110,193,228,0.1)]"
                  style={{ border: '1px solid rgba(110,193,228,0.25)', color: '#6EC1E4' }}
                >
                  <MessageCircle size={16} /> Contact Host
                </button>
              </div>
            </div>

            {/* Rules */}
            <div className="mb-8">
              <h3
                className="text-xl font-bold mb-5"
                style={{ fontFamily: '"Dfaalt", sans-serif', color: '#F0F0F5' }}
              >
                Rules of the Road
              </h3>
              <div className="space-y-3">
                {rules.map((rule, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Info size={14} color="#6EC1E4" />
                    <span className="text-sm" style={{ color: '#8888A0' }}>{rule}</span>
                  </div>
                ))}
              </div>
              <button
                className="mt-5 text-xs transition-colors hover:text-[#6EC1E4]"
                style={{ color: '#555570' }}
              >
                Report Listing
              </button>
            </div>
          </div>

          {/* Right Column - Booking Card (desktop) */}
          <div className="hidden lg:block lg:w-[35%]">
            <BookingCard vehicle={vehicle} navigate={navigate} />
          </div>
        </div>
      </div>

      {/* Mobile Sticky Booking Bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden px-4 py-3 backdrop-blur-xl"
        style={{
          backgroundColor: 'rgba(11,11,15,0.95)',
          borderTop: '1px solid rgba(110,193,228,0.1)',
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold font-mont" style={{ color: '#6EC1E4' }}>
                ${vehicle.price.toLocaleString()}
              </span>
              <span className="text-xs" style={{ color: '#555570' }}>/day</span>
            </div>
            <p className="text-[10px] flex items-center gap-1" style={{ color: '#2ECC71' }}>
              <Check size={10} /> Free cancellation
            </p>
          </div>
          <button
            onClick={() => navigate('booking')}
            className="px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all hover:bg-[#8AD0EA]"
            style={{ backgroundColor: '#6EC1E4', color: '#0B0B0F' }}
          >
            Continue <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
