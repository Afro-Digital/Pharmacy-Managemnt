const prisma = require('../config/database');
const { PAGINATION } = require('../config/constants');

// GET /api/v1/patients
const getPatients = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(parseInt(req.query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;
    const { search } = req.query;

    const where = {};
    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: 'insensitive' } },
        { full_name_am: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where, skip, take: limit,
        include: {
          _count: { select: { prescriptions: true, sales: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.patient.count({ where }),
    ]);

    res.json({
      success: true,
      data: patients,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/patients/:id
const getPatient = async (req, res, next) => {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: req.params.id },
      include: {
        prescriptions: {
          include: { items: { include: { product: true } } },
          orderBy: { created_at: 'desc' },
          take: 10,
        },
        sales: {
          include: { items: { include: { product: true } }, payments: { include: { payment_method: true } } },
          orderBy: { created_at: 'desc' },
          take: 10,
        },
      },
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Patient not found' },
      });
    }

    res.json({ success: true, data: patient });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/patients
const createPatient = async (req, res, next) => {
  try {
    const { full_name, full_name_am, phone, date_of_birth, gender, address, allergies, notes } = req.body;

    if (!full_name) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION', message: 'Full name is required' },
      });
    }

    const patient = await prisma.patient.create({
      data: {
        full_name, full_name_am, phone,
        date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
        gender, address, allergies, notes,
      },
    });

    res.status(201).json({ success: true, data: patient, message: 'Patient created successfully' });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/patients/:id
const updatePatient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    if (updateData.date_of_birth) {
      updateData.date_of_birth = new Date(updateData.date_of_birth);
    }

    const patient = await prisma.patient.update({
      where: { id },
      data: updateData,
    });

    res.json({ success: true, data: patient, message: 'Patient updated successfully' });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/patients/:id/prescriptions
const getPatientPrescriptions = async (req, res, next) => {
  try {
    const prescriptions = await prisma.prescription.findMany({
      where: { patient_id: req.params.id },
      include: {
        items: { include: { product: true } },
        dispenser: { select: { full_name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json({ success: true, data: prescriptions });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/patients/:id/purchases
const getPatientPurchases = async (req, res, next) => {
  try {
    const sales = await prisma.sale.findMany({
      where: { patient_id: req.params.id },
      include: {
        items: { include: { product: true } },
        payments: { include: { payment_method: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json({ success: true, data: sales });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPatients, getPatient, createPatient, updatePatient,
  getPatientPrescriptions, getPatientPurchases,
};
