'use client';

import { useState, useMemo } from 'react';
import {
  Search, MapPin, Calendar, Filter, X, ChevronDown, ChevronUp, Sliders, SlidersHorizontal,
} from 'lucide-react';
import { vehicles, vehicleTypes, brands, Vehicle, PageType } from './data';
import { VehicleCard } from './shared';

interface SearchPageProps {
  navigate: (page: PageType, vehicleId?: number) => void;
  favorites: number[];
  toggleFavorite: (id: number) => void;
  searchCity: string;
  setSearchCity: (city: string) => void;
}

export default function SearchPage({
  navigate,
  favorites,
  toggleFavorite,
  searchCity,
  setSearchCity,
}: SearchPageProps) {
  // Filter state
  const [sortBy, setSortBy] = useState('featured');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([200, 5000]);
  const [instantOnly, setInstantOnly] = useState(false);
  const [mobileFilters, setMobileFilters] = useState(false);

  // Toggle type filter
  const toggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  // Toggle brand filter
  const toggleBrand = (brand: string) => {
    setSelectedBrands(prev =>
      prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]
    );
  };

  // Reset all filters
  const resetFilters = () => {
    setSelectedTypes([]);
    setSelectedBrands([]);
    setPriceRange([200, 5000]);
    setInstantOnly(false);
    setSortBy('featured');
  };

  // Filter + sort vehicles
  const filteredVehicles = useMemo(() => {
    let result = [...vehicles];

    // City filter
    if (searchCity) {
      const cityLower = searchCity.toLowerCase();
      result = result.filter(v => v.city.toLowerCase().includes(cityLower));
    }

    // Type filter
    if (selectedTypes.length > 0) {
      result = result.filter(v => selectedTypes.includes(v.type));
    }

    // Brand filter
    if (selectedBrands.length > 0) {
      result = result.filter(v =>
        selectedBrands.some(b => v.name.toLowerCase().includes(b.toLowerCase()))
      );
    }

    // Price filter
    result = result.filter(v => v.price >= priceRange[0] && v.price <= priceRange[1]);

    // Instant book
    if (instantOnly) {
      result = result.filter(v => v.instant);
    }

    // Sort
    switch (sortBy) {
      case 'price-low':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      default:
        break; // featured = default order
    }

    return result;
  }, [searchCity, selectedTypes, selectedBrands, priceRange, instantOnly, sortBy]);

  // If no city filter matches, show all vehicles
  const displayVehicles = filteredVehicles.length > 0 ? filteredVehicles : vehicles;

  const activeFilterCount = selectedTypes.length + selectedBrands.length + (instantOnly ? 1 : 0) +
    (priceRange[0] !== 200 || priceRange[1] !== 5000 ? 1 : 0);

  /* ===== FILTER SIDEBAR CONTENT ===== */
  const filterContent = (
    <div className="space-y-8">
      {/* Sort */}
      <div>
        <h4 className="text-xs font-medium uppercase tracking-[0.1em] mb-3" style={{ color: '#8888A0' }}>
          Sort By
        </h4>
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'featured', label: 'Featured' },
            { value: 'price-low', label: 'Lowest Price' },
            { value: 'price-high', label: 'Highest Price' },
            { value: 'rating', label: 'Top Rated' },
          ].map(s => (
            <button
              key={s.value}
              onClick={() => setSortBy(s.value)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
              style={
                sortBy === s.value
                  ? { backgroundColor: 'rgba(110, 193, 228, 0.15)', color: '#6EC1E4', border: '1px solid rgba(110,193,228,0.3)' }
                  : { backgroundColor: 'transparent', color: '#8888A0', border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <h4 className="text-xs font-medium uppercase tracking-[0.1em] mb-3" style={{ color: '#8888A0' }}>
          Daily Price
        </h4>
        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex-1 rounded-lg px-3 py-2 text-sm"
            style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F0F5' }}
          >
            ${priceRange[0]}
          </div>
          <span className="text-xs" style={{ color: '#555570' }}>to</span>
          <div
            className="flex-1 rounded-lg px-3 py-2 text-sm"
            style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F0F5' }}
          >
            ${priceRange[1]}
          </div>
        </div>
        <input
          type="range"
          min={200}
          max={5000}
          step={50}
          value={priceRange[1]}
          onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
          className="w-full accent-[#6EC1E4]"
        />
      </div>

      {/* Categories */}
      <div>
        <h4 className="text-xs font-medium uppercase tracking-[0.1em] mb-3" style={{ color: '#8888A0' }}>
          Category
        </h4>
        <div className="flex flex-wrap gap-2">
          {vehicleTypes.map(type => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
              style={
                selectedTypes.includes(type)
                  ? { backgroundColor: 'rgba(110, 193, 228, 0.15)', color: '#6EC1E4', border: '1px solid rgba(110,193,228,0.3)' }
                  : { backgroundColor: 'transparent', color: '#8888A0', border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Brands */}
      <div>
        <h4 className="text-xs font-medium uppercase tracking-[0.1em] mb-3" style={{ color: '#8888A0' }}>
          Brands
        </h4>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {brands.map(brand => (
            <label key={brand} className="flex items-center gap-3 cursor-pointer group">
              <div
                className="w-4 h-4 rounded flex items-center justify-center transition-all duration-200"
                style={
                  selectedBrands.includes(brand)
                    ? { backgroundColor: '#6EC1E4', border: '1px solid #6EC1E4' }
                    : { backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }
                }
              >
                {selectedBrands.includes(brand) && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="#0B0B0F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span
                className="text-sm transition-colors duration-200 group-hover:text-white"
                style={{ color: selectedBrands.includes(brand) ? '#F0F0F5' : '#8888A0' }}
              >
                {brand}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Instant Book */}
      <div>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm" style={{ color: '#F0F0F5' }}>Instant Book Only</span>
          <button
            onClick={() => setInstantOnly(!instantOnly)}
            className="w-11 h-6 rounded-full transition-all duration-200 relative"
            style={{ backgroundColor: instantOnly ? '#6EC1E4' : 'rgba(255,255,255,0.1)' }}
          >
            <div
              className="w-4 h-4 rounded-full absolute top-1 transition-all duration-200"
              style={{
                backgroundColor: instantOnly ? '#0B0B0F' : '#8888A0',
                left: instantOnly ? '24px' : '4px',
              }}
            />
          </button>
        </label>
      </div>

      {/* Reset */}
      {activeFilterCount > 0 && (
        <button
          onClick={resetFilters}
          className="w-full py-2.5 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-[rgba(110,193,228,0.1)]"
          style={{ color: '#6EC1E4', border: '1px solid rgba(110,193,228,0.2)' }}
        >
          Reset Filters
        </button>
      )}
    </div>
  );

  return (
    <div style={{ backgroundColor: '#0B0B0F', minHeight: '100vh', paddingTop: '80px' }}>
      {/* Compact Search Bar */}
      <div
        className="sticky top-16 lg:top-20 z-40 py-4 px-4"
        style={{
          backgroundColor: 'rgba(11,11,15,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(110,193,228,0.08)',
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <div className="flex-1 flex items-center gap-3">
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl flex-1 max-w-md"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <Search size={16} color="#6EC1E4" />
              <input
                value={searchCity}
                onChange={(e) => setSearchCity(e.target.value)}
                placeholder="Search city..."
                className="bg-transparent text-sm outline-none flex-1"
                style={{ color: '#F0F0F5' }}
              />
              {searchCity && (
                <button onClick={() => setSearchCity('')}>
                  <X size={14} color="#555570" />
                </button>
              )}
            </div>
            <div className="hidden sm:flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Calendar size={14} color="#6EC1E4" />
              <span className="text-xs" style={{ color: '#8888A0' }}>Any dates</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm hidden sm:block" style={{ color: '#8888A0' }}>
              <span style={{ color: '#6EC1E4', fontWeight: 600 }}>{displayVehicles.length}</span> vehicles
            </span>
            {/* Mobile filter toggle */}
            <button
              onClick={() => setMobileFilters(!mobileFilters)}
              className="lg:hidden flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
              style={{ border: '1px solid rgba(110,193,228,0.2)', color: '#6EC1E4' }}
            >
              <Filter size={14} />
              Filters
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: '#6EC1E4', color: '#0B0B0F' }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div
              className="sticky top-40 rounded-xl p-5"
              style={{
                backgroundColor: '#161622',
                border: '1px solid rgba(110, 193, 228, 0.08)',
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-semibold font-mont" style={{ color: '#F0F0F5' }}>
                  <SlidersHorizontal size={14} className="inline mr-2" color="#6EC1E4" />
                  Filters
                </h3>
                {activeFilterCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(110,193,228,0.15)', color: '#6EC1E4' }}>
                    {activeFilterCount}
                  </span>
                )}
              </div>
              {filterContent}
            </div>
          </aside>

          {/* Mobile Filters Panel */}
          {mobileFilters && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/60" onClick={() => setMobileFilters(false)} />
              <div
                className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-2xl p-6"
                style={{ backgroundColor: '#161622' }}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold" style={{ color: '#F0F0F5' }}>Filters</h3>
                  <button onClick={() => setMobileFilters(false)}>
                    <X size={20} color="#8888A0" />
                  </button>
                </div>
                {filterContent}
                <button
                  onClick={() => setMobileFilters(false)}
                  className="w-full mt-6 py-3 rounded-xl font-semibold text-sm"
                  style={{ backgroundColor: '#6EC1E4', color: '#0B0B0F' }}
                >
                  View {displayVehicles.length} Results
                </button>
              </div>
            </div>
          )}

          {/* Vehicle Grid */}
          <div className="flex-1">
            {displayVehicles.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-lg mb-2" style={{ color: '#F0F0F5' }}>No vehicles found</p>
                <p className="text-sm" style={{ color: '#8888A0' }}>Try adjusting your filters</p>
                <button
                  onClick={resetFilters}
                  className="mt-4 px-4 py-2 rounded-lg text-sm"
                  style={{ color: '#6EC1E4', border: '1px solid rgba(110,193,228,0.3)' }}
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {displayVehicles.map(v => (
                  <VehicleCard
                    key={v.id}
                    vehicle={v}
                    navigate={navigate}
                    favorites={favorites}
                    toggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
