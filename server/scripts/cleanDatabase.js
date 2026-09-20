const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDatabase() {
  console.log('🧹 Starting cleanup of all seed, demo, and dummy data...\n');

  try {
    // 1. Delete transactional records in foreign key dependency order
    console.log('Clearing sales, payments, and prescription items...');
    await prisma.payment.deleteMany();
    await prisma.saleItem.deleteMany();
    await prisma.prescriptionItem.deleteMany();
    await prisma.prescription.deleteMany();
    await prisma.sale.deleteMany();

    console.log('Clearing shifts and reconciliations...');
    await prisma.reconciliationEntry.deleteMany();
    await prisma.reconciliation.deleteMany();
    await prisma.workShift.deleteMany();

    console.log('Clearing inventory and transfers...');
    await prisma.inventoryTransfer.deleteMany();
    await prisma.inventory.deleteMany();

    console.log('Clearing all demo & seeded products...');
    const deletedProducts = await prisma.product.deleteMany();
    console.log(`Deleted ${deletedProducts.count} products.`);

    console.log('Clearing demo patients...');
    const deletedPatients = await prisma.patient.deleteMany();
    console.log(`Deleted ${deletedPatients.count} patients.`);

    console.log('Clearing demo staff accounts (preserving ADMIN)...');
    const deletedStaff = await prisma.user.deleteMany({
      where: {
        role: { not: 'ADMIN' },
      },
    });
    console.log(`Deleted ${deletedStaff.count} non-admin demo staff users.`);

    console.log('Clearing audit logs...');
    await prisma.auditLog.deleteMany();

    console.log('\n✅ Successfully removed all seed and demo data!');
    console.log('Preserved essential infrastructure:');
    console.log('- Store Settings');
    console.log('- Payment Methods');
    console.log('- Product Categories');
    console.log('- Admin Account');

    const remainingCounts = {
      products: await prisma.product.count(),
      inventory: await prisma.inventory.count(),
      sales: await prisma.sale.count(),
      prescriptions: await prisma.prescription.count(),
      patients: await prisma.patient.count(),
      users: await prisma.user.count(),
      categories: await prisma.category.count(),
    };
    console.log('\nCurrent Database State:', remainingCounts);
  } catch (err) {
    console.error('❌ Error during cleanup:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDatabase();
