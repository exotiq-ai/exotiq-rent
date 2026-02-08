'use client';

import { useState } from 'react';
import { Heart, Star, MapPin, Zap } from 'lucide-react';
import { Vehicle, PageType } from './data';

/* ============================================================
   LOGO - Stylized "D" shield with wordmark
   ============================================================ */
export function Logo({ size = 32 }: { size?: number; showText?: boolean }) {
  return (
    <img
      src="/images/logos/drive-exotiq-lockup-transparent.png"
      alt="Drive Exotiq"
      style={{ height: `${size}px`, width: 'auto' }}
      className="object-contain"
    />
  );
}

/* ============================================================
   SECTION EYEBROW - Small teal uppercase label
   ============================================================ */
export function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs font-medium uppercase mb-3"
      style={{ color: '#6EC1E4', letterSpacing: '0.15em' }}
    >
      {children}
    </p>
  );
}

/* ============================================================
   SECTION HEADING - Large Playfair Display heading
   ============================================================ */
export function SectionHeading({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h2
      className={`text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 ${className}`}
      style={{ fontFamily: '"Dfaalt", sans-serif', color: '#F0F0F5' }}
    >
      {children}
    </h2>
  );
}

/* ============================================================
   VEHICLE CARD - Premium vehicle card used across pages
   Pure CSS hover states for smooth performance
   ============================================================ */
export function VehicleCard({
  vehicle,
  navigate,
  favorites,
  toggleFavorite,
}: {
  vehicle: Vehicle;
  navigate: (page: PageType, vehicleId?: number) => void;
  favorites: number[];
  toggleFavorite: (id: number) => void;
}) {
  const isFav = favorites.includes(vehicle.id);
  const [justFaved, setJustFaved] = useState(false);

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(vehicle.id);
    if (!isFav) {
      setJustFaved(true);
      setTimeout(() => setJustFaved(false), 500);
    }
  };

  return (
    <div
      onClick={() => navigate('vehicle', vehicle.id)}
      className="group cursor-pointer rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_8px_32px_rgba(78,205,196,0.12)]"
      style={{
        backgroundColor: '#161622',
        border: '1px solid rgba(110, 193, 228, 0.1)',
      }}
    >
      <style>{`
        .vehicle-card-border:hover { border-color: rgba(110, 193, 228, 0.35) !important; }
      `}</style>
      {/* Image */}
      <div className="relative overflow-hidden" style={{ aspectRatio: '16/10' }}>
        <img
          src={vehicle.image}
          alt={vehicle.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {/* Gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(22,22,34,0.8) 0%, transparent 50%)',
          }}
        />
        {/* Favorite button */}
        <button
          onClick={handleFavorite}
          className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-all duration-200 hover:scale-110 ${
            justFaved ? 'animate-heart-bounce' : ''
          }`}
          style={{
            backgroundColor: isFav ? 'rgba(110, 193, 228, 0.2)' : 'rgba(0,0,0,0.4)',
          }}
        >
          <Heart
            size={18}
            fill={isFav ? '#6EC1E4' : 'none'}
            color={isFav ? '#6EC1E4' : '#F0F0F5'}
            className="transition-colors duration-200"
          />
        </button>
        {/* Badges */}
        <div className="absolute bottom-3 left-3 flex gap-2">
          {vehicle.instant && (
            <span
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-md"
              style={{ backgroundColor: 'rgba(110, 193, 228, 0.2)', color: '#6EC1E4' }}
            >
              <Zap size={10} /> Instant Book
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Fleet name */}
        <p className="text-xs mb-1 truncate" style={{ color: '#555570' }}>
          {vehicle.fleet}
        </p>
        {/* Vehicle name */}
        <h3 className="font-semibold text-base mb-2 font-mont truncate" style={{ color: '#F0F0F5' }}>
          {vehicle.name}
        </h3>
        {/* Rating + trips + city */}
        <div className="flex items-center gap-2 text-xs mb-3" style={{ color: '#8888A0' }}>
          <div className="flex items-center gap-1">
            <Star size={12} fill="#F5C842" color="#F5C842" />
            <span className="font-medium" style={{ color: '#F0F0F5' }}>{vehicle.rating}</span>
          </div>
          <span>·</span>
          <span>{vehicle.trips} trips</span>
          <span>·</span>
          <div className="flex items-center gap-1">
            <MapPin size={10} />
            <span className="truncate">{vehicle.city}</span>
          </div>
        </div>
        {/* Price */}
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold" style={{ color: '#6EC1E4' }}>
            ${vehicle.price.toLocaleString()}
          </span>
          <span className="text-xs" style={{ color: '#555570' }}>/day</span>
        </div>
      </div>
    </div>
  );
}
