const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding TilexPharmacy database...\n');

  // ─── 1. Create Default Admin ──────────────────────────
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
  console.log('✅ Admin user created:', admin.username);

  // Demo Pharmacist
  const pharmacistPassword = await bcrypt.hash('pharma123', 12);
  const pharmacist = await prisma.user.upsert({
    where: { username: 'pharmacist1' },
    update: {},
    create: {
      full_name: 'Abebe Kebede',
      username: 'pharmacist1',
      email: 'pharmacist@tilexpharmacy.com',
      password_hash: pharmacistPassword,
      role: 'PHARMACIST',
      phone: '+251911111111',
    },
  });
  console.log('✅ Pharmacist user created:', pharmacist.username);

  // Demo Cashier
  const cashierPassword = await bcrypt.hash('cashier123', 12);
  const cashier = await prisma.user.upsert({
    where: { username: 'cashier1' },
    update: {},
    create: {
      full_name: 'Tigist Hailu',
      username: 'cashier1',
      email: 'cashier@tilexpharmacy.com',
      password_hash: cashierPassword,
      role: 'CASHIER',
      phone: '+251922222222',
    },
  });
  console.log('✅ Cashier user created:', cashier.username);

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

  const createdCategories = {};
  for (const cat of categories) {
    const created = await prisma.category.create({ data: cat });
    createdCategories[cat.name] = created.id;
  }
  console.log('✅ Categories created');

  // ─── 5. Sample Products ───────────────────────────────
  const products = [
    {
      name: 'Amoxicillin 500mg',
      name_am: 'አሞክሲሊን 500mg',
      generic_name: 'Amoxicillin',
      category_id: createdCategories['Antibiotics'],
      product_type: 'MEDICINE',
      dosage_form: 'Capsule',
      strength: '500mg',
      brand: 'Epharm',
      manufacturer: 'Ethiopian Pharmaceuticals',
      unit_price: 15.00,
      reorder_level: 50,
      requires_prescription: true,
      barcode: 'MED-AMX-500',
    },
    {
      name: 'Paracetamol 500mg',
      name_am: 'ፓራሲታሞል 500mg',
      generic_name: 'Acetaminophen',
      category_id: createdCategories['Pain Relief'],
      product_type: 'MEDICINE',
      dosage_form: 'Tablet',
      strength: '500mg',
      brand: 'Cadila',
      manufacturer: 'Cadila Healthcare',
      unit_price: 5.00,
      reorder_level: 100,
      requires_prescription: false,
      barcode: 'MED-PCM-500',
    },
    {
      name: 'Ibuprofen 400mg',
      name_am: 'አይቡፕሮፌን 400mg',
      generic_name: 'Ibuprofen',
      category_id: createdCategories['Pain Relief'],
      product_type: 'MEDICINE',
      dosage_form: 'Tablet',
      strength: '400mg',
      brand: 'Addis Pharma',
      manufacturer: 'Addis Pharmaceutical',
      unit_price: 8.00,
      reorder_level: 80,
      requires_prescription: false,
      barcode: 'MED-IBU-400',
    },
    {
      name: 'Metformin 500mg',
      name_am: 'ሜትፎርሚን 500mg',
      generic_name: 'Metformin',
      category_id: createdCategories['Cardiovascular'],
      product_type: 'MEDICINE',
      dosage_form: 'Tablet',
      strength: '500mg',
      brand: 'Cipla',
      manufacturer: 'Cipla Ltd',
      unit_price: 12.00,
      reorder_level: 40,
      requires_prescription: true,
      barcode: 'MED-MET-500',
    },
    {
      name: 'Vitamin C 1000mg',
      name_am: 'ቫይታሚን ሲ 1000mg',
      generic_name: 'Ascorbic Acid',
      category_id: createdCategories['Vitamins & Supplements'],
      product_type: 'MEDICINE',
      dosage_form: 'Tablet',
      strength: '1000mg',
      brand: 'Nature Made',
      manufacturer: 'Pharmavite',
      unit_price: 25.00,
      reorder_level: 30,
      requires_prescription: false,
      barcode: 'MED-VIC-1000',
    },
    {
      name: 'Nivea Body Lotion',
      name_am: 'ኒቬያ የሰውነት ክሬም',
      category_id: createdCategories['Skin Care'],
      product_type: 'COSMETIC',
      brand: 'Nivea',
      manufacturer: 'Beiersdorf',
      unit_price: 350.00,
      reorder_level: 15,
      barcode: 'COS-NIV-BL',
    },
    {
      name: 'Dove Shampoo 400ml',
      name_am: 'ዶቭ ሻምፖ 400ሚሊ',
      category_id: createdCategories['Hair Care'],
      product_type: 'COSMETIC',
      brand: 'Dove',
      manufacturer: 'Unilever',
      unit_price: 280.00,
      reorder_level: 10,
      barcode: 'COS-DOV-SH400',
    },
    {
      name: 'Dettol Hand Sanitizer',
      name_am: 'ዴቶል የእጅ ማጽጃ',
      category_id: createdCategories['Personal Hygiene'],
      product_type: 'COSMETIC',
      brand: 'Dettol',
      manufacturer: 'Reckitt Benckiser',
      unit_price: 120.00,
      reorder_level: 20,
      barcode: 'COS-DET-HS',
    },
  ];

  const createdProducts = [];
  for (const prod of products) {
    const created = await prisma.product.create({ data: prod });
    createdProducts.push(created);
  }
  console.log('✅ Sample products created');

  // ─── 6. Sample Inventory ──────────────────────────────
  const today = new Date();
  const threeMonthsLater = new Date(today);
  threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
  const sixMonthsLater = new Date(today);
  sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
  const oneYearLater = new Date(today);
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
  const twentyDaysLater = new Date(today);
  twentyDaysLater.setDate(twentyDaysLater.getDate() + 20);

  for (const product of createdProducts) {
    // Store inventory
    await prisma.inventory.create({
      data: {
        product_id: product.id,
        location: 'STORE',
        batch_number: `BATCH-${product.barcode || 'GEN'}-001`,
        expiry_date: product.product_type === 'MEDICINE' ? sixMonthsLater : oneYearLater,
        quantity: 200,
        shelf_location: 'A1',
        supplier_name: product.manufacturer,
      },
    });

    // Dispensary inventory
    await prisma.inventory.create({
      data: {
        product_id: product.id,
        location: 'DISPENSARY',
        batch_number: `BATCH-${product.barcode || 'GEN'}-001`,
        expiry_date: product.product_type === 'MEDICINE' ? sixMonthsLater : oneYearLater,
        quantity: 50,
        shelf_location: 'D1',
        supplier_name: product.manufacturer,
      },
    });
  }

  // Add a near-expiry item for testing alerts
  if (createdProducts.length > 0) {
    await prisma.inventory.create({
      data: {
        product_id: createdProducts[0].id,
        location: 'DISPENSARY',
        batch_number: `BATCH-EXPIRING-001`,
        expiry_date: twentyDaysLater,
        quantity: 10,
        shelf_location: 'D2',
        supplier_name: 'Test Supplier',
      },
    });
  }
  console.log('✅ Sample inventory created');

  // ─── 7. Sample Patients ───────────────────────────────
  const patients = [
    {
      full_name: 'Dawit Mekonnen',
      full_name_am: 'ዳዊት መኮንን',
      phone: '+251933333333',
      gender: 'MALE',
      date_of_birth: new Date('1985-03-15'),
      address: 'Bole, Addis Ababa',
      allergies: 'Penicillin',
    },
    {
      full_name: 'Sara Tesfaye',
      full_name_am: 'ሳራ ተስፋዬ',
      phone: '+251944444444',
      gender: 'FEMALE',
      date_of_birth: new Date('1992-07-22'),
      address: 'Kazanchis, Addis Ababa',
    },
  ];

  for (const patient of patients) {
    await prisma.patient.create({ data: patient });
  }
  console.log('✅ Sample patients created');

  console.log('\n🎉 Seed completed successfully!');
  console.log('─────────────────────────────────────');
  console.log('  Admin Login:      admin / admin123');
  console.log('  Pharmacist Login: pharmacist1 / pharma123');
  console.log('  Cashier Login:    cashier1 / cashier123');
  console.log('─────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
