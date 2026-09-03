import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import {
  ShoppingBag,
  Search,
  Eye,
  Printer,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
  User,
  CreditCard,
  FileText,
} from 'lucide-react';

export const OrdersPage = () => {
  const { t } = useTranslation();
  const { pharmacyDisplayName, settings } = useTheme();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = { limit: 100 };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;

      const res = await api.get('/sales', { params });
      if (res.data.success) {
        setOrders(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchOrders();
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success">Completed</Badge>;
      case 'PENDING_PAYMENT':
        return <Badge variant="warning">Awaiting Payment</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">Cancelled</Badge>;
      case 'REFUNDED':
        return <Badge variant="primary">Refunded</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const printReceipt = () => {
    window.print();
  };

  const columns = [
    {
      header: 'Order Number',
      accessor: 'sale_number',
      render: (row) => (
        <div>
          <span className="font-mono font-bold text-xs text-[#5345E6] block">
            {row.sale_number}
          </span>
          <span className="text-[10px] text-slate-400">
            {new Date(row.created_at).toLocaleDateString('en-GB')}{' '}
            {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ),
    },
    {
      header: 'Customer',
      accessor: 'patient',
      render: (row) => (
        <span className="font-bold text-slate-800 text-xs">
          {row.patient?.full_name || 'Walk-In Customer'}
        </span>
      ),
    },
    {
      header: 'Staff Involved',
      accessor: 'staff',
      render: (row) => (
        <div className="text-[11px] text-slate-600">
          <div>
            <span className="text-slate-400">Rx:</span> {row.pharmacist?.full_name || 'Pharmacist'}
          </div>
          {row.cashier && (
            <div>
              <span className="text-slate-400">Cashier:</span> {row.cashier.full_name}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Items',
      accessor: 'items',
      render: (row) => (
        <span className="font-medium text-xs text-slate-700">
          {row.items?.length || 0} Products
        </span>
      ),
    },
    {
      header: 'Payment Method',
      accessor: 'payments',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.payments && row.payments.length > 0 ? (
            row.payments.map((p, i) => (
              <span
                key={i}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700"
              >
                {p.payment_method?.name || 'Cash'}: {parseFloat(p.amount).toFixed(2)}
              </span>
            ))
          ) : (
            <span className="text-slate-400 text-xs">—</span>
          )}
        </div>
      ),
    },
    {
      header: 'Total Amount',
      accessor: 'total_amount',
      render: (row) => (
        <span className="font-black text-slate-900 text-sm">
          {parseFloat(row.total_amount).toFixed(2)} ETB
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => getStatusBadge(row.status),
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (row) => (
        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={() => {
              setSelectedOrder(row);
              setDetailsModalOpen(true);
            }}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-500 hover:text-[#5345E6] flex items-center justify-center transition-colors"
            title="View Details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {row.status === 'COMPLETED' && (
            <button
              type="button"
              onClick={() => {
                setSelectedOrder(row);
                setReceiptModalOpen(true);
              }}
              className="w-8 h-8 rounded-full hover:bg-purple-50 text-slate-500 hover:text-[#5345E6] flex items-center justify-center transition-colors"
              title="Print Receipt"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  // Quick statistics from orders list
  const completedCount = orders.filter((o) => o.status === 'COMPLETED').length;
  const pendingCount = orders.filter((o) => o.status === 'PENDING_PAYMENT').length;
  const cancelledCount = orders.filter((o) => o.status === 'CANCELLED').length;
  const totalRevenue = orders
    .filter((o) => o.status === 'COMPLETED')
    .reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Sub-Header matching SellMate */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Order & Sales History
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Complete transaction record across all store registers, pharmacists, and cashiers
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search order # or patient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 text-xs font-medium bg-white rounded-full border border-slate-200 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#5345E6]/15 focus:border-[#5345E6] transition-all"
          />
        </form>
      </div>

      {/* 4 Overview Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase">Total Orders</span>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900">{orders.length}</h3>
            <span className="text-[11px] text-slate-400 font-medium">Logged in system</span>
          </div>
        </Card>

        <Card className="p-5 flex flex-col justify-between">
          <span className="text-xs font-bold text-emerald-600 uppercase">Completed Paid</span>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900">{completedCount}</h3>
            <span className="text-[11px] text-emerald-600 font-semibold">
              ETB {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </Card>

        <Card className="p-5 flex flex-col justify-between">
          <span className="text-xs font-bold text-amber-600 uppercase">Awaiting Payment</span>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900">{pendingCount}</h3>
            <span className="text-[11px] text-amber-600 font-medium">In cashier queue</span>
          </div>
        </Card>

        <Card className="p-5 flex flex-col justify-between">
          <span className="text-xs font-bold text-rose-500 uppercase">Cancelled</span>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900">{cancelledCount}</h3>
            <span className="text-[11px] text-rose-500 font-medium">Returned to dispensary</span>
          </div>
        </Card>
      </div>

      {/* Segmented Filter Pills & Table */}
      <div className="space-y-4">
        <div className="inline-flex p-1 bg-slate-100 rounded-full border border-slate-200/50">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${
              statusFilter === 'ALL'
                ? 'bg-white text-[#5345E6] shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            All Orders
          </button>
          <button
            onClick={() => setStatusFilter('COMPLETED')}
            className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${
              statusFilter === 'COMPLETED'
                ? 'bg-white text-[#5345E6] shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setStatusFilter('PENDING_PAYMENT')}
            className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${
              statusFilter === 'PENDING_PAYMENT'
                ? 'bg-white text-[#5345E6] shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setStatusFilter('CANCELLED')}
            className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${
              statusFilter === 'CANCELLED'
                ? 'bg-white text-[#5345E6] shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Cancelled
          </button>
        </div>

        <Table
          columns={columns}
          data={orders}
          isLoading={loading}
          emptyMessage="No sales orders found matching criteria"
        />
      </div>

      {/* Order Details Modal */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title={`Order Details: ${selectedOrder?.sale_number}`}
        maxWidth="max-w-2xl"
      >
        {selectedOrder && (
          <div className="space-y-4 text-xs">
            {/* Header info */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-extrabold text-sm text-slate-900 block">
                  {selectedOrder.patient?.full_name || 'Walk-In Customer'}
                </span>
                <span className="text-[11px] text-slate-400">
                  Created: {new Date(selectedOrder.created_at).toLocaleString('en-GB')}
                </span>
                <div className="mt-1 text-slate-600">
                  Pharmacist: <strong>{selectedOrder.pharmacist?.full_name || 'Pharmacist'}</strong> • Cashier: <strong>{selectedOrder.cashier?.full_name || 'Pending'}</strong>
                </div>
              </div>
              <div className="text-right space-y-1">
                {getStatusBadge(selectedOrder.status)}
                <div className="text-base font-black text-slate-900">
                  {parseFloat(selectedOrder.total_amount).toFixed(2)} ETB
                </div>
              </div>
            </div>

            {/* Products List */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Medication</th>
                    <th className="p-2.5">Batch</th>
                    <th className="p-2.5 text-right">Qty</th>
                    <th className="p-2.5 text-right">Unit Price</th>
                    <th className="p-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedOrder.items?.map((item, i) => (
                    <tr key={i}>
                      <td className="p-2.5 font-bold text-slate-800">
                        {item.product?.name}
                      </td>
                      <td className="p-2.5 font-mono text-slate-500">
                        {item.batch_number || 'GEN'}
                      </td>
                      <td className="p-2.5 text-right font-medium">{item.quantity}</td>
                      <td className="p-2.5 text-right font-mono">
                        {parseFloat(item.unit_price).toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right font-bold text-slate-900">
                        {parseFloat(item.total_price).toFixed(2)} ETB
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Split Payment Breakdown */}
            {selectedOrder.payments && selectedOrder.payments.length > 0 && (
              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 space-y-1.5">
                <span className="font-bold text-[#5345E6] block">Payment Allocation:</span>
                <div className="space-y-1">
                  {selectedOrder.payments.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center text-slate-700">
                      <span>{p.payment_method?.name} {p.reference_number ? `(Ref: ${p.reference_number})` : ''}:</span>
                      <span className="font-bold font-mono">{parseFloat(p.amount).toFixed(2)} ETB</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setDetailsModalOpen(false)}>
                Close
              </Button>
              {selectedOrder.status === 'COMPLETED' && (
                <Button
                  size="sm"
                  onClick={() => {
                    setDetailsModalOpen(false);
                    setReceiptModalOpen(true);
                  }}
                  className="bg-[#5345E6] hover:bg-[#4336D6] text-white rounded-xl"
                >
                  <Printer className="w-3.5 h-3.5 mr-1" /> Print Receipt
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Printable Receipt Modal */}
      <Modal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        title="Official Sales Receipt"
        maxWidth="max-w-md"
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div id="printable-receipt" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs space-y-3">
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <h4 className="font-bold text-sm text-slate-900">{pharmacyDisplayName || 'TilexPharmacy'}</h4>
                <p className="text-[11px] text-slate-500">{settings?.address || 'Addis Ababa, Ethiopia'}</p>
                <p className="text-[11px] text-slate-500">{settings?.phone}</p>
                <div className="mt-1 font-bold text-slate-800">
                  Receipt: {selectedOrder.sale_number}
                </div>
                <div className="text-[10px] text-slate-400">
                  {new Date(selectedOrder.created_at).toLocaleString('en-GB')}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Pharmacist: {selectedOrder.pharmacist?.full_name} • Cashier: {selectedOrder.cashier?.full_name || 'Cashier'}
                </div>
              </div>

              {/* Line items */}
              <div className="space-y-1 py-1 border-b border-dashed border-slate-300">
                {selectedOrder.items?.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{item.product?.name || 'Item'} x{item.quantity}</span>
                    <span>{parseFloat(item.total_price).toFixed(2)} ETB</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-1 font-semibold">
                <div className="flex justify-between text-slate-900 font-bold text-sm pt-1">
                  <span>TOTAL:</span>
                  <span>{parseFloat(selectedOrder.total_amount).toFixed(2)} ETB</span>
                </div>
              </div>

              {/* Payment Methods */}
              {selectedOrder.payments && selectedOrder.payments.length > 0 && (
                <div className="pt-2 border-t border-dashed border-slate-300 space-y-0.5 text-[11px]">
                  {selectedOrder.payments.map((p, i) => (
                    <div key={i} className="flex justify-between text-slate-600">
                      <span>{p.payment_method?.name}:</span>
                      <span>{parseFloat(p.amount).toFixed(2)} ETB</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-center text-[10px] text-slate-400 pt-2 border-t border-dashed border-slate-300">
                Thank you for choosing TilexPharmacy!
              </div>
            </div>

            <div className="flex space-x-2">
              <Button onClick={printReceipt} className="flex-1 bg-[#5345E6] hover:bg-[#4336D6] text-white font-bold rounded-xl py-2.5">
                <Printer className="w-4 h-4 mr-2" /> Print Receipt
              </Button>
              <Button variant="outline" onClick={() => setReceiptModalOpen(false)} className="rounded-xl">
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
