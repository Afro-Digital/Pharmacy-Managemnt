const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Setting up core TilexPharmacy system data...\n');

  // ─── 1. Super Admin Account ──────────────────────────
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      full_name: 'Super Admin',
      username: 'admin',
      email: 'admin@tilexpharmacy.com',
      password_hash: adminPassword,
      role: 'ADMIN',
      phone: '+251911000000',
    },
  });
  console.log('✅ Admin user ready:', admin.username);

  // ─── 2. Store Settings ────────────────────────────────
  const settingsCount = await prisma.storeSettings.count();
  if (settingsCount === 0) {
    await prisma.storeSettings.create({
      data: {
        pharmacy_name: 'TilexPharmacy',
        pharmacy_name_am: 'ቲሌክስ ፋርማሲ',
        address: 'Addis Ababa, Ethiopia',
        phone: '+251911000000',
        email: 'info@tilexpharmacy.com',
        primary_color: '#2563EB',
        secondary_color: '#1E40AF',
        currency: 'ETB',
        default_language: 'en',
        operating_hours: {
          monday: { open: '08:00', close: '20:00' },
          tuesday: { open: '08:00', close: '20:00' },
          wednesday: { open: '08:00', close: '20:00' },
          thursday: { open: '08:00', close: '20:00' },
          friday: { open: '08:00', close: '20:00' },
          saturday: { open: '09:00', close: '18:00' },
          sunday: { open: '10:00', close: '16:00' },
        },
      },
    });
    console.log('✅ Store settings created');
  }

  // ─── 3. Payment Methods ───────────────────────────────
  const paymentMethods = [
    { name: 'Cash', name_am: 'ጥሬ ገንዘብ', code: 'CASH', sort_order: 1 },
    { name: 'Telebirr', name_am: 'ቴሌብር', code: 'TELEBIRR', sort_order: 2 },
    { name: 'CBE', name_am: 'ኢትዮጵያ ንግድ ባንክ', code: 'CBE', sort_order: 3 },
    { name: 'Bank Transfer', name_am: 'የባንክ ዝውውር', code: 'BANK_TRANSFER', sort_order: 4 },
  ];

  for (const pm of paymentMethods) {
    await prisma.paymentMethod.upsert({
      where: { code: pm.code },
      update: {},
      create: pm,
    });
  }
  console.log('✅ Payment methods created');

  // ─── 4. Categories ────────────────────────────────────
  const categories = [
    { name: 'Antibiotics', name_am: 'አንቲባዮቲክስ', type: 'MEDICINE', description: 'Antibacterial medications' },
    { name: 'Pain Relief', name_am: 'ህመም ማስታገሻ', type: 'MEDICINE', description: 'Analgesics and antipyretics' },
    { name: 'Cardiovascular', name_am: 'የልብና የደም ቧንቧ', type: 'MEDICINE', description: 'Heart and blood pressure medications' },
    { name: 'Vitamins & Supplements', name_am: 'ቫይታሚንና ተጨማሪ ምግብ', type: 'MEDICINE', description: 'Dietary supplements and vitamins' },
    { name: 'Respiratory', name_am: 'የመተንፈሻ', type: 'MEDICINE', description: 'Cough, cold, and respiratory medications' },
    { name: 'Gastrointestinal', name_am: 'የጨጓራና ዕቃ ቅንጣት', type: 'MEDICINE', description: 'Digestive system medications' },
    { name: 'Skin Care', name_am: 'የቆዳ እንክብካቤ', type: 'COSMETIC', description: 'Moisturizers, cleansers, and skin treatments' },
    { name: 'Hair Care', name_am: 'የፀጉር እንክብካቤ', type: 'COSMETIC', description: 'Shampoos, conditioners, and hair treatments' },
    { name: 'Personal Hygiene', name_am: 'የግል ንጽህና', type: 'COSMETIC', description: 'Soaps, deodorants, and hygiene products' },
    { name: 'Baby Care', name_am: 'የህፃናት እንክብካቤ', type: 'GENERAL', description: 'Baby products and infant care' },
  ];

  for (const cat of categories) {
    const existing = await prisma.category.findFirst({ where: { name: cat.name } });
    if (!existing) {
      await prisma.category.create({ data: cat });
    }
  }
  console.log('✅ Standard categories initialized');

  console.log('\n🎉 Production core setup completed (No demo/seed products or transactions created).');
}

main()
  .catch((e) => {
    console.error('❌ Setup error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
