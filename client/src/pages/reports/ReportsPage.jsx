import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import {
  BarChart3,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  Package,
  ArrowRightLeft,
} from 'lucide-react';

export const ReportsPage = () => {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState('SALES'); // 'SALES', 'INVENTORY', 'FINANCIAL', 'EXPIRING'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [salesReport, setSalesReport] = useState(null);
  const [financialReport, setFinancialReport] = useState(null);
  const [expiringReport, setExpiringReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);

      if (activeTab === 'SALES') {
        const res = await api.get(`/reports/sales?${params.toString()}`);
        if (res.data.success) setSalesReport(res.data.data);
      } else if (activeTab === 'FINANCIAL') {
        const res = await api.get(`/reports/financial?${params.toString()}`);
        if (res.data.success) setFinancialReport(res.data.data);
      } else if (activeTab === 'EXPIRING') {
        const res = await api.get('/reports/expiring-products?days=60');
        if (res.data.success) setExpiringReport(res.data.data);
      }
    } catch (err) {
      console.error('Report fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [activeTab, fromDate, toDate]);

  const handleExportCSV = async (reportType) => {
    try {
      const token = localStorage.getItem('tilex_access_token');
      const response = await fetch(`/api/v1/reports/export?type=csv&report=${reportType}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}_report_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val || 0) + ' ETB';
  };

  return (
    <div className="space-y-6">
      {/* Title & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {t('reports.title')}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Audit financial metrics, sales trends, stock movement, and regulatory compliance
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => handleExportCSV(activeTab.toLowerCase() === 'sales' ? 'sales' : 'inventory')}
            className="text-sm"
          >
            <Download className="w-4 h-4 mr-2 text-slate-500" />
            {t('reports.export_csv')}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('SALES')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'SALES' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
          }`}
        >
          {t('reports.sales_tab')}
        </button>
        <button
          onClick={() => setActiveTab('FINANCIAL')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'FINANCIAL' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
          }`}
        >
          {t('reports.financial_tab')}
        </button>
        <button
          onClick={() => setActiveTab('EXPIRING')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'EXPIRING' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
          }`}
        >
          {t('reports.expiring_tab')}
        </button>
      </div>

      {/* Date Filters */}
      {activeTab !== 'EXPIRING' && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-xl border border-slate-200">
          <span className="text-xs font-bold uppercase text-slate-500 flex items-center">
            <Calendar className="w-4 h-4 mr-1.5 text-slate-400" /> Date Filter:
          </span>
          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
          {(fromDate || toDate) && (
            <button
              onClick={() => { setFromDate(''); setToDate(''); }}
              className="text-xs text-blue-600 font-medium hover:underline ml-2"
            >
              Reset
            </button>
          )}
        </div>
      )}

      {/* SALES TAB CONTENT */}
      {activeTab === 'SALES' && salesReport && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4">
              <span className="text-xs font-semibold text-slate-500">{t('reports.total_revenue')}</span>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {formatCurrency(salesReport.total_revenue)}
              </h3>
            </Card>
            <Card className="p-4">
              <span className="text-xs font-semibold text-slate-500">{t('reports.total_sales')}</span>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {salesReport.sales_count}
              </h3>
            </Card>
            <Card className="p-4">
              <span className="text-xs font-semibold text-slate-500">{t('reports.avg_sale')}</span>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {formatCurrency(salesReport.average_sale)}
              </h3>
            </Card>
          </div>

          {/* Top Selling Products Table */}
          <Card className="space-y-3">
            <h4 className="font-bold text-sm text-slate-900">{t('reports.top_selling')}</h4>
            <div className="divide-y divide-slate-100">
              {salesReport.top_products?.map((item, idx) => (
                <div key={idx} className="py-2.5 flex justify-between items-center text-xs">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-slate-400 w-5">#{idx + 1}</span>
                    <span className="font-semibold text-slate-800">{item.name}</span>
                  </div>
                  <div className="flex space-x-6">
                    <span className="text-slate-500">{item.quantity} units</span>
                    <span className="font-bold text-slate-900">{formatCurrency(item.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* FINANCIAL TAB CONTENT */}
      {activeTab === 'FINANCIAL' && financialReport && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4">
              <span className="text-xs font-semibold text-slate-500">Gross Sales</span>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {formatCurrency(financialReport.total_revenue)}
              </h3>
            </Card>
            <Card className="p-4">
              <span className="text-xs font-semibold text-slate-500">Total Discounts</span>
              <h3 className="text-2xl font-bold text-rose-600 mt-1">
                -{formatCurrency(financialReport.total_discount)}
              </h3>
            </Card>
            <Card className="p-4">
              <span className="text-xs font-semibold text-slate-500">Net Revenue</span>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                {formatCurrency(financialReport.net_revenue)}
              </h3>
            </Card>
          </div>

          <Card className="space-y-3">
            <h4 className="font-bold text-sm text-slate-900">Payment Methods Breakdown</h4>
            <div className="divide-y divide-slate-100">
              {financialReport.payment_distribution?.map((dist, idx) => (
                <div key={idx} className="py-3 flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-800">{dist.method}</span>
                  <div className="flex space-x-6">
                    <span className="text-slate-500">{dist.count} transactions</span>
                    <span className="font-bold text-slate-900">{formatCurrency(dist.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* EXPIRING PRODUCTS TAB CONTENT */}
      {activeTab === 'EXPIRING' && expiringReport && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4 border-l-4 border-l-rose-500">
              <span className="text-xs font-semibold text-slate-500">Already Expired</span>
              <h3 className="text-2xl font-bold text-rose-600 mt-1">
                {expiringReport.expired?.count || 0} items
              </h3>
            </Card>
            <Card className="p-4 border-l-4 border-l-purple-500">
              <span className="text-xs font-semibold text-slate-500">Expiring Soon (60 Days)</span>
              <h3 className="text-2xl font-bold text-purple-600 mt-1">
                {expiringReport.expiring_soon?.count || 0} items
              </h3>
            </Card>
          </div>

          <Card className="space-y-3">
            <h4 className="font-bold text-sm text-slate-900">Expiring Inventory Details</h4>
            <div className="divide-y divide-slate-100">
              {expiringReport.expiring_soon?.items?.map((item, idx) => (
                <div key={idx} className="py-2.5 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-semibold text-slate-800">{item.product?.name}</span>
                    <p className="text-slate-400">Batch: {item.batch_number} • Loc: {item.location}</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-slate-700 font-bold">{item.quantity} units</span>
                    <span className="text-purple-600 font-semibold">
                      {new Date(item.expiry_date).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
