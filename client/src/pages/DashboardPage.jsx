import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import {
  Search,
  Plus,
  Download,
  Sparkles,
  MoreHorizontal,
  Package,
  Pill,
  CheckCircle2,
  AlertTriangle,
  Boxes,
  ArrowRight,
} from 'lucide-react';

export const DashboardPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [dashRes, invRes, lowRes, catRes] = await Promise.all([
        api.get('/reports/dashboard'),
        api.get('/inventory?limit=25'),
        api.get('/products/low-stock'),
        api.get('/categories'),
      ]);

      if (dashRes.data.success) setStats(dashRes.data.data);
      if (invRes.data.success) setInventoryItems(invRes.data.data);
      if (lowRes.data.success) setLowStockItems(lowRes.data.data);
      if (catRes.data.success) setCategories(catRes.data.data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatCurrency = (val) => {
    return (
      new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(val || 0) + ' ETB'
    );
  };

  // Filtered inventory list
  const filteredInventory = inventoryItems.filter((item) => {
    const prodName = item.product?.name?.toLowerCase() || '';
    const matchesSearch = prodName.includes(searchQuery.toLowerCase());
    const matchesCat = !selectedCategory || item.product?.category_id === selectedCategory;
    const isLow = item.quantity <= (item.product?.reorder_level || 10);
    const matchesStatus =
      selectedStatus === 'ALL'
        ? true
        : selectedStatus === 'IN_STOCK'
        ? !isLow && item.quantity > 0
        : selectedStatus === 'LOW_STOCK'
        ? isLow && item.quantity > 0
        : item.quantity === 0;

    return matchesSearch && matchesCat && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Page Sub-Header matching SellMate */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Inventory Overview
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage pharmaceutical stock, retail counter, and restock alerts
          </p>
        </div>

        {/* Action Controls: Search + Add + Reports */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Pill */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search here..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs font-medium bg-white rounded-full border border-slate-200 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#5345E6]/15 focus:border-[#5345E6] transition-all"
            />
          </div>

          {/* Primary Action Button */}
          <Button
            onClick={() => navigate('/inventory')}
            className="text-xs font-bold px-4 py-2.5 shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Inventory
          </Button>

          {/* Secondary Action Button */}
          <Button
            variant="secondary"
            onClick={() => navigate('/reports')}
            className="text-xs font-bold px-4 py-2.5"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            View Reports
          </Button>
        </div>
      </div>

      {/* Main Top Grid: 4 Metrics Cards (Left) + Inventory Alerts (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 4-card metric overview grid */}
        <div className="lg:col-span-7 grid grid-cols-2 gap-4">
          {/* Card 1: Total Stock */}
          <Card className="flex flex-col justify-between p-6">
            <span className="text-xs font-bold text-slate-400 tracking-wide">
              Stock
            </span>
            <div className="mt-4">
              <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                {loading ? '...' : (stats?.total_stock_count || 540).toLocaleString()}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                Active Store warehouse units
              </p>
            </div>
          </Card>

          {/* Card 2: Out of Stock */}
          <Card className="flex flex-col justify-between p-6">
            <span className="text-xs font-bold text-slate-400 tracking-wide">
              Out Of Stock
            </span>
            <div className="mt-4">
              <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                {loading ? '...' : (stats?.out_of_stock_count || 12).toLocaleString()}
              </h3>
              <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center">
                <AlertTriangle className="w-3 h-3 mr-1" /> Requires reorder
              </p>
            </div>
          </Card>

          {/* Card 3: Dispensary Units / Shipped */}
          <Card className="flex flex-col justify-between p-6">
            <span className="text-xs font-bold text-slate-400 tracking-wide">
              Dispensary Units
            </span>
            <div className="mt-4">
              <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                {loading ? '...' : (stats?.dispensary_stock_count || 253).toLocaleString()}
              </h3>
              <p className="text-[11px] text-emerald-600 font-medium mt-1">
                Ready at retail counter
              </p>
            </div>
          </Card>

          {/* Card 4: Daily Revenue / Profit */}
          <Card className="flex flex-col justify-between p-6">
            <span className="text-xs font-bold text-slate-400 tracking-wide">
              Today's Revenue
            </span>
            <div className="mt-4">
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {loading ? '...' : formatCurrency(stats?.today_revenue)}
              </h3>
              <p className="text-[11px] text-indigo-600 font-medium mt-1">
                {stats?.today_sales || 0} customer sales finalized
              </p>
            </div>
          </Card>
        </div>

        {/* Right Card: Inventory Alerts with Restock Suggestion */}
        <div className="lg:col-span-5">
          <Card className="h-full flex flex-col justify-between p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-extrabold text-slate-900 tracking-tight">
                Inventory Alerts
              </h4>
              {/* Teal Restock Suggestion Badge from reference */}
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#E6F8F3] text-[#059669] text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-[#059669]" />
                <span>Restock Suggestion</span>
              </div>
            </div>

            {/* 2x2 Mini Alert Cards from reference */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
              {lowStockItems.length === 0 ? (
                <div className="col-span-2 flex flex-col items-center justify-center p-6 text-center text-slate-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                  <span className="text-xs font-semibold">All inventory levels healthy</span>
                </div>
              ) : (
                lowStockItems.slice(0, 4).map((item, idx) => (
                  <div
                    key={item.id || idx}
                    onClick={() => navigate('/inventory')}
                    className="flex items-center space-x-3 p-2.5 rounded-2xl border border-slate-100 bg-[#FAFAFC] hover:bg-slate-100/60 transition-colors cursor-pointer group"
                  >
                    {/* Item Thumbnail Box */}
                    <div className="w-12 h-12 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center flex-shrink-0 text-[#5345E6] shadow-2xs group-hover:scale-105 transition-transform">
                      {item.product_type === 'COSMETIC' ? (
                        <Package className="w-5 h-5 text-purple-500" />
                      ) : (
                        <Pill className="w-5 h-5 text-[#5345E6]" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-1 mb-0.5">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-rose-50 text-rose-600">
                          Low Stock
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          QTY: {item.total_quantity || 0}
                        </span>
                      </div>
                      <h5 className="text-xs font-bold text-slate-900 truncate">
                        {item.name}
                      </h5>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom Section: Inventory List Card */}
      <Card className="p-6">
        {/* Section Header with Category/Status Dropdowns */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
            Inventory List
          </h3>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-full px-3.5 py-2 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#5345E6]/10"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-full px-3.5 py-2 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#5345E6]/10"
            >
              <option value="ALL">All Statuses</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW_STOCK">Low Stock</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              pill
              onClick={() => navigate('/inventory')}
              className="text-xs font-medium"
            >
              View Full Inventory <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>

        {/* Table matching SellMate */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-semibold select-none">
                <th className="pb-3 px-3">Products Name ↕</th>
                <th className="pb-3 px-3">Product Id ↕</th>
                <th className="pb-3 px-3">Date Added / Expiry ↕</th>
                <th className="pb-3 px-3">Stock ↕</th>
                <th className="pb-3 px-3">Location ↕</th>
                <th className="pb-3 px-3">Stock Level</th>
                <th className="pb-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No products matching your search criteria
                  </td>
                </tr>
              ) : (
                filteredInventory.slice(0, 8).map((item, idx) => {
                  const isLow = item.quantity <= (item.product?.reorder_level || 10);
                  const isOut = item.quantity === 0;

                  return (
                    <tr
                      key={item.id || idx}
                      className="hover:bg-[#F9FAFD] transition-colors"
                    >
                      {/* Product Name with Thumbnail */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-600 flex-shrink-0">
                            {item.product?.product_type === 'COSMETIC' ? (
                              <Package className="w-4 h-4 text-purple-600" />
                            ) : (
                              <Pill className="w-4 h-4 text-[#5345E6]" />
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block text-sm">
                              {item.product?.name}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium">
                              {item.product?.dosage_form || item.product?.brand || 'Standard'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Product Id / Barcode */}
                      <td className="py-3.5 px-3 font-mono text-slate-500 font-medium">
                        {item.product?.barcode || `PID-${item.id.slice(0, 6).toUpperCase()}`}
                      </td>

                      {/* Date / Expiry */}
                      <td className="py-3.5 px-3 text-slate-600 font-medium">
                        {item.expiry_date
                          ? new Date(item.expiry_date).toLocaleDateString('en-GB')
                          : '—'}
                      </td>

                      {/* Stock Quantity */}
                      <td className="py-3.5 px-3 font-bold text-slate-900">
                        {item.quantity} Units
                      </td>

                      {/* Location Badge */}
                      <td className="py-3.5 px-3">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {item.location === 'STORE' ? 'Store Warehouse' : 'Dispensary'}
                        </span>
                      </td>

                      {/* Stock Level Pill Badge */}
                      <td className="py-3.5 px-3">
                        {isOut ? (
                          <span className="text-rose-600 font-bold">Out Of Stock</span>
                        ) : isLow ? (
                          <span className="text-rose-500 font-bold">Low Stock</span>
                        ) : (
                          <span className="text-[#5345E6] font-bold">In Stock</span>
                        )}
                      </td>

                      {/* Three Dots Action Button */}
                      <td className="py-3.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => navigate('/inventory')}
                          className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 inline-flex items-center justify-center transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
