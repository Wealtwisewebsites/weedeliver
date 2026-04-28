import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding WeeDeliver database...\n");

  // Clear existing data
  await prisma.orderItem.deleteMany();
  await prisma.deliveryTracking.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.dispensaryBanking.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.order.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.product.deleteMany();
  await prisma.dispensary.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.user.deleteMany();

  const password = await bcrypt.hash("password123", 12);

  // ─── USERS ───
  const customer = await prisma.user.create({
    data: { email: "customer@test.com", phone: "+27821234567", passwordHash: password, role: "CUSTOMER", firstName: "Thabo", lastName: "Mokoena", isVerified: true, isAgeVerified: true, dateOfBirth: new Date("1995-06-15") },
  });

  const dispOwner = await prisma.user.create({
    data: { email: "dispensary@test.com", phone: "+27829876543", passwordHash: password, role: "DISPENSARY", firstName: "Sarah", lastName: "van der Berg", isVerified: true, isAgeVerified: true, dateOfBirth: new Date("1988-03-22") },
  });

  const dispOwner2 = await prisma.user.create({
    data: { email: "dispensary2@test.com", phone: "+27829876544", passwordHash: password, role: "DISPENSARY", firstName: "Thandi", lastName: "Nkosi", isVerified: true, isAgeVerified: true, dateOfBirth: new Date("1990-07-14") },
  });

  const dispOwner3 = await prisma.user.create({
    data: { email: "dispensary3@test.com", phone: "+27829876545", passwordHash: password, role: "DISPENSARY", firstName: "James", lastName: "Pretorius", isVerified: true, isAgeVerified: true, dateOfBirth: new Date("1985-04-20") },
  });

  const driverUser = await prisma.user.create({
    data: { email: "driver@test.com", phone: "+27834567890", passwordHash: password, role: "DRIVER", firstName: "Sipho", lastName: "Ndlovu", isVerified: true, isAgeVerified: true, dateOfBirth: new Date("1992-11-08") },
  });

  const admin = await prisma.user.create({
    data: { email: "admin@weedeliver.co.za", phone: "+27800000001", passwordHash: password, role: "ADMIN", firstName: "Admin", lastName: "User", isVerified: true, isAgeVerified: true, dateOfBirth: new Date("1985-01-01") },
  });

  console.log("✓ Users created");

  // ─── DRIVER PROFILE ───
  await prisma.driver.create({
    data: { userId: driverUser.id, vehicleType: "Scooter", licenseNumber: "GP123456", isOnline: false, rating: 4.8 },
  });
  console.log("✓ Driver profile created");

  const defaultHours = {
    mon: { open: "08:00", close: "22:00", isOpen: true },
    tue: { open: "08:00", close: "22:00", isOpen: true },
    wed: { open: "08:00", close: "22:00", isOpen: true },
    thu: { open: "08:00", close: "22:00", isOpen: true },
    fri: { open: "08:00", close: "23:00", isOpen: true },
    sat: { open: "09:00", close: "23:00", isOpen: true },
    sun: { open: "10:00", close: "20:00", isOpen: true },
  };

  // ─── DISPENSARIES ───
  const d1 = await prisma.dispensary.create({
    data: { userId: dispOwner.id, name: "Green Leaf Co.", slug: "green-leaf-co", bio: "Premium indoor cannabis, hand-trimmed and lab-tested. Cape Town's original craft cannabis collective.", tagline: "Craft Cannabis, Elevated.", address: "42 Long St, Cape Town", city: "Cape Town", province: "Western Cape", lat: -33.9249, lng: 18.4241, deliveryRadius: 15, deliveryFee: 35, minimumOrder: 100, isApproved: true, isActive: true, membershipType: "FREE", rating: 4.8, reviewCount: 234, operatingHours: JSON.stringify(defaultHours) },
  });

  const d2 = await prisma.dispensary.create({
    data: { userId: dispOwner2.id, name: "Durban Poison House", slug: "durban-poison-house", bio: "Authentic Durban strains, locally grown with love.", tagline: "Heritage Strains, Modern Delivery.", address: "88 Florida Rd, Durban", city: "Durban", province: "KwaZulu-Natal", lat: -29.8587, lng: 31.0218, deliveryRadius: 10, deliveryFee: 45, minimumOrder: 150, isApproved: true, isActive: true, membershipType: "PAID", membershipPrice: 50, rating: 4.6, reviewCount: 189 },
  });

  const d3 = await prisma.dispensary.create({
    data: { userId: dispOwner3.id, name: "Highveld Herbals", slug: "highveld-herbals", bio: "Johannesburg's finest selection of concentrates, edibles, and premium flower.", tagline: "JHB's Premium Cannabis Destination.", address: "15 Melle St, Braamfontein, JHB", city: "Johannesburg", province: "Gauteng", lat: -26.1952, lng: 28.0338, deliveryRadius: 20, deliveryFee: 40, minimumOrder: 120, isApproved: true, isActive: true, membershipType: "FREE", rating: 4.9, reviewCount: 312 },
  });

  console.log("✓ Dispensaries created");

  // ─── PRODUCTS ───
  const products = [
    { dispensaryId: d1.id, name: "Purple Haze", slug: "purple-haze", description: "A legendary sativa-dominant strain with a sweet, earthy aroma.", category: "INDOOR_FLOWER" as const, price: 160, unit: "per gram", thcPercent: 28, cbdPercent: 0.5, strainType: "SATIVA" as const, effectSpectrum: 8, stock: 50 },
    { dispensaryId: d1.id, name: "OG Kush", slug: "og-kush", description: "A classic hybrid with piney, woody undertones.", category: "INDOOR_FLOWER" as const, price: 140, unit: "per gram", thcPercent: 24, cbdPercent: 1, strainType: "HYBRID" as const, effectSpectrum: 4, stock: 35 },
    { dispensaryId: d1.id, name: "CBD Calm Drops", slug: "cbd-calm-drops", description: "Full-spectrum CBD oil tincture. 1000mg per 30ml bottle.", category: "CONCENTRATE" as const, price: 450, unit: "per bottle", thcPercent: 0.3, cbdPercent: 33, strainType: "HYBRID" as const, effectSpectrum: 1, stock: 20 },
    { dispensaryId: d1.id, name: "Rasta Roller Grinder", slug: "rasta-roller-grinder", description: "Premium 4-piece aluminium herb grinder with kief catcher.", category: "ACCESSORY" as const, price: 220, unit: "per unit", stock: 15 },
    { dispensaryId: d1.id, name: "Chocolate Space Cake", slug: "chocolate-space-cake", description: "Rich dark chocolate brownie infused with 50mg THC.", category: "EDIBLE" as const, price: 120, unit: "per piece", thcPercent: 50, cbdPercent: 5, strainType: "INDICA" as const, effectSpectrum: 2, stock: 30 },
    { dispensaryId: d2.id, name: "Durban Poison", slug: "durban-poison", description: "The legendary pure sativa landrace from KZN.", category: "GREENHOUSE_FLOWER" as const, price: 120, unit: "per gram", thcPercent: 22, cbdPercent: 0.2, strainType: "SATIVA" as const, effectSpectrum: 9, stock: 80 },
    { dispensaryId: d2.id, name: "Swazi Gold", slug: "swazi-gold", description: "Traditional Swazi strain grown in our Durban greenhouse.", category: "GREENHOUSE_FLOWER" as const, price: 90, unit: "per gram", thcPercent: 18, cbdPercent: 1, strainType: "SATIVA" as const, effectSpectrum: 7, stock: 60 },
    { dispensaryId: d3.id, name: "Gelato #41", slug: "gelato-41", description: "Dense, frosty buds with a sweet dessert flavour.", category: "INDOOR_FLOWER" as const, price: 180, unit: "per gram", thcPercent: 30, cbdPercent: 0.3, strainType: "HYBRID" as const, effectSpectrum: 5, stock: 25 },
    { dispensaryId: d3.id, name: "Live Resin Cartridge", slug: "live-resin-cart", description: "Full-spectrum live resin vape cart. 1g.", category: "CONCENTRATE" as const, price: 550, unit: "per cart", thcPercent: 85, cbdPercent: 2, strainType: "HYBRID" as const, effectSpectrum: 4, stock: 12 },
    { dispensaryId: d3.id, name: "Gummy Bears 10-Pack", slug: "gummy-bears", description: "Assorted fruit flavour gummies, 10mg THC each.", category: "EDIBLE" as const, price: 200, unit: "per pack", thcPercent: 10, cbdPercent: 2, strainType: "INDICA" as const, effectSpectrum: 3, stock: 40 },
  ];

  for (const p of products) {
    await prisma.product.create({ data: p });
  }
  console.log("✓ Products created");

  // ─── MEMBERSHIPS ───
  await prisma.membership.create({ data: { userId: customer.id, dispensaryId: d1.id, status: "ACTIVE" } });
  await prisma.membership.create({ data: { userId: customer.id, dispensaryId: d3.id, status: "ACTIVE" } });
  console.log("✓ Memberships created");

  console.log("\n🌿 Seed complete!");
  console.log("\n  Demo logins (password: password123):");
  console.log("  Customer:    customer@test.com");
  console.log("  Dispensary:  dispensary@test.com");
  console.log("  Driver:      driver@test.com");
  console.log("  Admin:       admin@weedeliver.co.za\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
