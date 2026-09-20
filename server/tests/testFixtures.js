const bcrypt = require('bcryptjs');
const prisma = require('../src/config/database');

async function ensureTestFixtures() {
  const pharmaPass = await bcrypt.hash('pharma123', 10);
  await prisma.user.upsert({
    where: { username: 'pharmacist1' },
    update: {},
    create: {
      username: 'pharmacist1',
      full_name: 'Test Pharmacist',
      email: 'pharmacist1@test.com',
      password_hash: pharmaPass,
      role: 'PHARMACIST',
    },
  });

  const cashierPass = await bcrypt.hash('cashier123', 10);
  await prisma.user.upsert({
    where: { username: 'cashier1' },
    update: {},
    create: {
      username: 'cashier1',
      full_name: 'Test Cashier',
      email: 'cashier1@test.com',
      password_hash: cashierPass,
      role: 'CASHIER',
    },
  });

  // Ensure a category exists
  let cat = await prisma.category.findFirst();
  if (!cat) {
    cat = await prisma.category.create({
      data: { name: 'Antibiotics', type: 'MEDICINE' },
    });
  }

  // Ensure a test product exists for workflow tests
  let prod = await prisma.product.findFirst({ where: { is_active: true } });
  if (!prod) {
    prod = await prisma.product.create({
      data: {
        name: 'Test Fixture Amoxicillin',
        product_type: 'MEDICINE',
        category_id: cat.id,
        unit_price: 25.0,
        requires_prescription: true,
        dosage_form: 'Capsule',
        strength: '500mg',
        unit: 'Strip',
        barcode: '890111222333',
        sku: 'MED-TST-001',
      },
    });
  }

  // Ensure dispensary inventory exists
  const existingInv = await prisma.inventory.findFirst({
    where: { product_id: prod.id, location: 'DISPENSARY' },
  });
  if (!existingInv) {
    await prisma.inventory.create({
      data: {
        product_id: prod.id,
        location: 'DISPENSARY',
        batch_number: 'TEST-BATCH-001',
        quantity: 100,
        expiry_date: new Date('2028-12-31'),
      },
    });
  }

  return { testProductId: prod.id };
}

module.exports = { ensureTestFixtures };
