export type PageType = 'home' | 'search' | 'vehicle' | 'booking' | 'trips' | 'favorites' | 'messages' | 'operator';

export interface Vehicle {
  id: number;
  name: string;
  price: number;
  city: string;
  rating: number;
  trips: number;
  type: string;
  fleet: string;
  instant: boolean;
  image: string;
  gallery: string[];
  specs: {
    power: string;
    acceleration: string;
    topSpeed: string;
    engine: string;
    transmission: string;
    fuel: string;
    drive: string;
    seats: number;
  };
}

export interface CityData {
  name: string;
  state: string;
  count: number;
  gradient: string;
  image: string;
}

export interface ReviewData {
  name: string;
  rating: number;
  date: string;
  text: string;
  vehicle: string;
}

export const vehicles: Vehicle[] = [
  {
    id: 1, name: "2024 McLaren 750S Spider", price: 1199, city: "Scottsdale, AZ",
    rating: 4.9, trips: 47, type: "Supercar", fleet: "Desert Exotic Rentals", instant: true,
    image: "/images/vehicles/mclaren-750s.png",
    gallery: ["/images/vehicles/mclaren-750s.png", "/images/vehicles/ferrari-296-gtb.png", "/images/vehicles/porsche-911-gt3rs.png", "/images/vehicles/bentley-continental-gt.png", "/images/vehicles/mercedes-amg-gt63.png"],
    specs: { power: "740 bhp", acceleration: "2.8s", topSpeed: "206 mph", engine: "V8 Twin-Turbo", transmission: "Automatic", fuel: "Gasoline", drive: "RWD", seats: 2 }
  },
  {
    id: 2, name: "2024 Lamborghini Huracán EVO", price: 1499, city: "Scottsdale, AZ",
    rating: 4.8, trips: 62, type: "Supercar", fleet: "AZ Luxury Motors", instant: true,
    image: "/images/vehicles/lamborghini-huracan.png",
    gallery: ["/images/vehicles/lamborghini-huracan.png", "/images/vehicles/mclaren-750s.png", "/images/vehicles/lamborghini-urus.png", "/images/vehicles/ferrari-296-gtb.png", "/images/vehicles/porsche-911-gt3rs.png"],
    specs: { power: "630 bhp", acceleration: "2.9s", topSpeed: "202 mph", engine: "V10", transmission: "Automatic", fuel: "Gasoline", drive: "AWD", seats: 2 }
  },
  {
    id: 3, name: "2023 Rolls-Royce Ghost", price: 899, city: "Scottsdale, AZ",
    rating: 5.0, trips: 28, type: "Luxury Sedan", fleet: "Desert Exotic Rentals", instant: false,
    image: "/images/vehicles/rolls-royce-ghost.png",
    gallery: ["/images/vehicles/rolls-royce-ghost.png", "/images/vehicles/mercedes-amg-gt63.png", "/images/vehicles/bentley-continental-gt.png", "/images/vehicles/range-rover-sv.png", "/images/vehicles/aston-martin-db12.png"],
    specs: { power: "563 bhp", acceleration: "4.8s", topSpeed: "155 mph", engine: "V12 Twin-Turbo", transmission: "Automatic", fuel: "Gasoline", drive: "AWD", seats: 5 }
  },
  {
    id: 4, name: "2024 Ferrari 296 GTB", price: 1299, city: "Miami, FL",
    rating: 4.9, trips: 53, type: "Supercar", fleet: "South Beach Exotics", instant: true,
    image: "/images/vehicles/ferrari-296-gtb.png",
    gallery: ["/images/vehicles/ferrari-296-gtb.png", "/images/vehicles/lamborghini-huracan.png", "/images/vehicles/mclaren-750s.png", "/images/vehicles/porsche-911-gt3rs.png", "/images/vehicles/aston-martin-db12.png"],
    specs: { power: "819 bhp", acceleration: "2.9s", topSpeed: "205 mph", engine: "V6 Hybrid", transmission: "Automatic", fuel: "Hybrid", drive: "RWD", seats: 2 }
  },
  {
    id: 5, name: "2024 Porsche 911 GT3 RS", price: 999, city: "Los Angeles, CA",
    rating: 4.7, trips: 41, type: "Sports Car", fleet: "LA Dream Cars", instant: true,
    image: "/images/vehicles/porsche-911-gt3rs.png",
    gallery: ["/images/vehicles/porsche-911-gt3rs.png", "/images/vehicles/bmw-m4-competition.png", "/images/vehicles/mclaren-750s.png", "/images/vehicles/ferrari-296-gtb.png", "/images/vehicles/mercedes-amg-gt63.png"],
    specs: { power: "518 bhp", acceleration: "3.2s", topSpeed: "184 mph", engine: "Flat-6", transmission: "PDK", fuel: "Gasoline", drive: "RWD", seats: 2 }
  },
  {
    id: 6, name: "2023 Bentley Continental GT", price: 799, city: "Las Vegas, NV",
    rating: 4.8, trips: 35, type: "Grand Tourer", fleet: "Vegas Exotic Fleet", instant: true,
    image: "/images/vehicles/bentley-continental-gt.png",
    gallery: ["/images/vehicles/bentley-continental-gt.png", "/images/vehicles/rolls-royce-ghost.png", "/images/vehicles/aston-martin-db12.png", "/images/vehicles/mercedes-amg-gt63.png", "/images/vehicles/range-rover-sv.png"],
    specs: { power: "650 bhp", acceleration: "3.5s", topSpeed: "208 mph", engine: "W12", transmission: "Automatic", fuel: "Gasoline", drive: "AWD", seats: 4 }
  },
  {
    id: 7, name: "2024 Mercedes-AMG GT 63", price: 599, city: "Denver, CO",
    rating: 4.9, trips: 19, type: "Luxury Sedan", fleet: "Denver Exotic Rental Cars", instant: true,
    image: "/images/vehicles/mercedes-amg-gt63.png",
    gallery: ["/images/vehicles/mercedes-amg-gt63.png", "/images/vehicles/bmw-m4-competition.png", "/images/vehicles/rolls-royce-ghost.png", "/images/vehicles/bentley-continental-gt.png", "/images/vehicles/aston-martin-db12.png"],
    specs: { power: "577 bhp", acceleration: "3.2s", topSpeed: "195 mph", engine: "V8 Biturbo", transmission: "Automatic", fuel: "Gasoline", drive: "AWD", seats: 5 }
  },
  {
    id: 8, name: "2023 Aston Martin DB12", price: 899, city: "Scottsdale, AZ",
    rating: 4.8, trips: 22, type: "Grand Tourer", fleet: "Desert Exotic Rentals", instant: false,
    image: "/images/vehicles/aston-martin-db12.png",
    gallery: ["/images/vehicles/aston-martin-db12.png", "/images/vehicles/bentley-continental-gt.png", "/images/vehicles/porsche-911-gt3rs.png", "/images/vehicles/mclaren-750s.png", "/images/vehicles/ferrari-296-gtb.png"],
    specs: { power: "671 bhp", acceleration: "3.5s", topSpeed: "202 mph", engine: "V8 Twin-Turbo", transmission: "Automatic", fuel: "Gasoline", drive: "RWD", seats: 4 }
  },
  {
    id: 9, name: "2024 Lamborghini Urus S", price: 699, city: "Miami, FL",
    rating: 4.7, trips: 71, type: "Luxury SUV", fleet: "South Beach Exotics", instant: true,
    image: "/images/vehicles/lamborghini-urus.png",
    gallery: ["/images/vehicles/lamborghini-urus.png", "/images/vehicles/range-rover-sv.png", "/images/vehicles/lamborghini-huracan.png", "/images/vehicles/mercedes-amg-gt63.png", "/images/vehicles/rolls-royce-ghost.png"],
    specs: { power: "657 bhp", acceleration: "3.5s", topSpeed: "190 mph", engine: "V8 Twin-Turbo", transmission: "Automatic", fuel: "Gasoline", drive: "AWD", seats: 5 }
  },
  {
    id: 10, name: "2025 Range Rover SV", price: 549, city: "Scottsdale, AZ",
    rating: 4.6, trips: 33, type: "Luxury SUV", fleet: "AZ Luxury Motors", instant: true,
    image: "/images/vehicles/range-rover-sv.png",
    gallery: ["/images/vehicles/range-rover-sv.png", "/images/vehicles/lamborghini-urus.png", "/images/vehicles/rolls-royce-ghost.png", "/images/vehicles/bentley-continental-gt.png", "/images/vehicles/rivian-r1s.png"],
    specs: { power: "523 bhp", acceleration: "4.4s", topSpeed: "162 mph", engine: "V8", transmission: "Automatic", fuel: "Gasoline", drive: "AWD", seats: 5 }
  },
  {
    id: 11, name: "2024 BMW M4 Competition", price: 349, city: "Denver, CO",
    rating: 4.8, trips: 26, type: "Sports Car", fleet: "Denver Exotic Rental Cars", instant: true,
    image: "/images/vehicles/bmw-m4-competition.png",
    gallery: ["/images/vehicles/bmw-m4-competition.png", "/images/vehicles/porsche-911-gt3rs.png", "/images/vehicles/mercedes-amg-gt63.png", "/images/vehicles/aston-martin-db12.png", "/images/vehicles/ferrari-296-gtb.png"],
    specs: { power: "503 bhp", acceleration: "3.8s", topSpeed: "180 mph", engine: "I6 Twin-Turbo", transmission: "Automatic", fuel: "Gasoline", drive: "RWD", seats: 4 }
  },
  {
    id: 12, name: "2023 Rivian R1S", price: 289, city: "Scottsdale, AZ",
    rating: 4.5, trips: 15, type: "Electric SUV", fleet: "Desert Exotic Rentals", instant: true,
    image: "/images/vehicles/rivian-r1s.png",
    gallery: ["/images/vehicles/rivian-r1s.png", "/images/vehicles/range-rover-sv.png", "/images/vehicles/lamborghini-urus.png", "/images/vehicles/bmw-m4-competition.png", "/images/vehicles/mercedes-amg-gt63.png"],
    specs: { power: "835 bhp", acceleration: "3.0s", topSpeed: "125 mph", engine: "Quad Motor Electric", transmission: "Single-Speed", fuel: "Electric", drive: "AWD", seats: 7 }
  },
];

export const cities: CityData[] = [
  { name: "Scottsdale", state: "AZ", count: 85, gradient: "linear-gradient(135deg, #E8522A 0%, #7B2D1A 50%, #3A1508 100%)", image: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&auto=format&fit=crop" },
  { name: "Miami", state: "FL", count: 120, gradient: "linear-gradient(135deg, #00C9DB 0%, #0077B6 50%, #023E58 100%)", image: "https://images.unsplash.com/photo-1535498730771-e735b998cd64?w=800&auto=format&fit=crop" },
  { name: "Las Vegas", state: "NV", count: 95, gradient: "linear-gradient(135deg, #C850C0 0%, #8E24AA 50%, #4A148C 100%)", image: "https://images.unsplash.com/photo-1605833556294-ea5c7a74f57d?w=800&auto=format&fit=crop" },
  { name: "Los Angeles", state: "CA", count: 150, gradient: "linear-gradient(135deg, #FF6B35 0%, #F7931E 50%, #B85A0A 100%)", image: "https://images.unsplash.com/photo-1534190760961-74e8c1c5c3da?w=800&auto=format&fit=crop" },
  { name: "Denver", state: "CO", count: 40, gradient: "linear-gradient(135deg, #2E86AB 0%, #1B5E7D 50%, #0D3B50 100%)", image: "https://images.unsplash.com/photo-1546156929-a4c0ac411f47?w=800&auto=format&fit=crop" },
  { name: "New York", state: "NY", count: 75, gradient: "linear-gradient(135deg, #667EEA 0%, #485EC4 50%, #2A3A80 100%)", image: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&auto=format&fit=crop" },
];

export const reviews: ReviewData[] = [
  { name: "Alex S.", rating: 5, date: "October 2025", text: "Incredible experience. The McLaren was in perfect condition and the delivery to my hotel was seamless. Will definitely use Drive Exotiq again.", vehicle: "McLaren 750S" },
  { name: "Sarah M.", rating: 5, date: "September 2025", text: "Best car rental experience I've ever had. The AI pricing saved me $400 compared to what I was quoted elsewhere. The concierge service is next level.", vehicle: "Rolls-Royce Ghost" },
  { name: "James K.", rating: 4, date: "November 2025", text: "Great selection of exotic cars. The booking process was smooth and the host was very responsive. Only wish there were more pickup time options.", vehicle: "Porsche 911 GT3" },
];

export const vehicleTypes = ["Supercar", "Luxury Sedan", "Sports Car", "Grand Tourer", "Luxury SUV", "Electric SUV"];
export const brands = ["Ferrari", "Lamborghini", "McLaren", "Porsche", "Rolls-Royce", "Bentley", "Mercedes", "BMW", "Aston Martin", "Rivian", "Range Rover"];
