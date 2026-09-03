const prisma = require('../config/database');

// GET /api/v1/categories
const getCategories = async (req, res, next) => {
  try {
    const { type } = req.query;
    const where = {};
    if (type) where.type = type;

    const categories = await prisma.category.findMany({
      where,
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/categories
const createCategory = async (req, res, next) => {
  try {
    const { name, name_am, type, description } = req.body;

    if (!name || !type) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION', message: 'Name and type are required' },
      });
    }

    const category = await prisma.category.create({
      data: { name, name_am, type, description },
    });

    res.status(201).json({ success: true, data: category, message: 'Category created successfully' });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/categories/:id
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await prisma.category.update({
      where: { id },
      data: req.body,
    });

    res.json({ success: true, data: category, message: 'Category updated successfully' });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/categories/:id
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const productCount = await prisma.product.count({ where: { category_id: id } });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'HAS_DEPENDENCIES', message: `Cannot delete category with ${productCount} associated products` },
      });
    }

    await prisma.category.delete({ where: { id } });
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
