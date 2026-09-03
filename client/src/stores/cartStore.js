import { create } from 'zustand';

export const useCartStore = create((set, get) => ({
  items: [],
  discountAmount: 0,
  selectedPatient: null,
  selectedPrescription: null,
  payments: [],

  addItem: (product, batch) => {
    const { items } = get();
    const existingIndex = items.findIndex(
      (item) => item.product.id === product.id && item.batch?.batch_number === batch?.batch_number
    );

    if (existingIndex > -1) {
      const updated = [...items];
      const current = updated[existingIndex];
      const newQty = current.quantity + 1;
      const maxQty = batch ? batch.quantity : 999;
      if (newQty > maxQty) return false; // Stock limit reached

      updated[existingIndex] = {
        ...current,
        quantity: newQty,
        total_price: newQty * current.unit_price - current.discount,
      };
      set({ items: updated });
      return true;
    } else {
      const unit_price = parseFloat(product.unit_price);
      set({
        items: [
          ...items,
          {
            product,
            batch,
            quantity: 1,
            unit_price,
            discount: 0,
            total_price: unit_price,
          },
        ],
      });
      return true;
    }
  },

  updateQuantity: (index, newQty) => {
    const { items } = get();
    if (newQty <= 0) {
      get().removeItem(index);
      return;
    }
    const updated = [...items];
    const item = updated[index];
    const maxQty = item.batch ? item.batch.quantity : 999;
    const finalQty = Math.min(newQty, maxQty);

    updated[index] = {
      ...item,
      quantity: finalQty,
      total_price: finalQty * item.unit_price - item.discount,
    };
    set({ items: updated });
  },

  updateItemDiscount: (index, discount) => {
    const { items } = get();
    const updated = [...items];
    const item = updated[index];
    const disc = parseFloat(discount) || 0;
    updated[index] = {
      ...item,
      discount: disc,
      total_price: item.quantity * item.unit_price - disc,
    };
    set({ items: updated });
  },

  removeItem: (index) => {
    const { items } = get();
    set({ items: items.filter((_, i) => i !== index) });
  },

  setDiscountAmount: (amount) => {
    set({ discountAmount: parseFloat(amount) || 0 });
  },

  setSelectedPatient: (patient) => {
    set({ selectedPatient: patient });
  },

  setSelectedPrescription: (prescription) => {
    set({ selectedPrescription: prescription });
  },

  loadPrescription: (prescription, availableInventory) => {
    const newItems = [];
    for (const pItem of prescription.items) {
      const inv = availableInventory.find((i) => i.product_id === pItem.product_id && i.quantity > 0);
      const unit_price = parseFloat(pItem.product.unit_price);
      const qty = pItem.quantity;
      newItems.push({
        product: pItem.product,
        batch: inv || null,
        quantity: qty,
        unit_price,
        discount: 0,
        total_price: qty * unit_price,
      });
    }
    set({
      items: newItems,
      selectedPrescription: prescription,
      selectedPatient: prescription.patient || null,
    });
  },

  setPayments: (payments) => {
    set({ payments });
  },

  clearCart: () => {
    set({
      items: [],
      discountAmount: 0,
      selectedPatient: null,
      selectedPrescription: null,
      payments: [],
    });
  },

  getSubtotal: () => {
    const { items } = get();
    return items.reduce((sum, item) => sum + item.total_price, 0);
  },

  getTotalAmount: () => {
    const subtotal = get().getSubtotal();
    const { discountAmount } = get();
    return Math.max(0, subtotal - discountAmount);
  },

  getPaymentTotal: () => {
    const { payments } = get();
    return payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  },
}));
