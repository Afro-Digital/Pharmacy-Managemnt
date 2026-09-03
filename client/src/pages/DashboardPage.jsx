import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
  Banknote,
  ShoppingCart,
  Clock,
  AlertTriangle,
  Calendar,
  ArrowRight,
  TrendingUp,
  Boxes,
  PlusCircle,
  FilePlus,
} from 'lucide-react';

export const DashboardPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reports/dashboard');
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val || 0) + ' ETB';
  };

  return (
    <div className="space-y-6">
      {/* Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {t('dashboard.title')}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time overview of inventory, sales, and clinical operations
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => navigate('/pos')}
            className="bg-blue-600 hover:bg-blue-700 shadow-sm text-sm"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {t('dashboard.new_sale')}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/inventory')}
            className="text-sm"
          >
            <Boxes className="w-4 h-4 mr-2 text-slate-500" />
            {t('dashboard.transfer_stock')}
          </Button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Today's Revenue */}
        <Card className="flex items-center space-x-4 border-l-4 border-l-blue-600">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Banknote className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('dashboard.today_revenue')}
            </p>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">
              {loading ? '...' : formatCurrency(stats?.today_revenue)}
            </h3>
            <span className="text-xs text-slate-400">
              {stats?.today_sales || 0} {t('dashboard.today_sales').toLowerCase()}
            </span>
          </div>
        </Card>

        {/* Pending Prescriptions */}
        <Card
          onClick={() => navigate('/prescriptions')}
          hoverable
          className="flex items-center space-x-4 border-l-4 border-l-amber-500"
        >
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('dashboard.pending_rx')}
            </p>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">
              {loading ? '...' : stats?.pending_prescriptions || 0}
            </h3>
            <span className="text-xs text-amber-600 font-medium">Needs fulfillment</span>
          </div>
        </Card>

        {/* Low Stock Alerts */}
        <Card
          onClick={() => navigate('/inventory')}
          hoverable
          className="flex items-center space-x-4 border-l-4 border-l-rose-500"
        >
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('dashboard.low_stock')}
            </p>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">
              {loading ? '...' : stats?.low_stock_count || 0}
            </h3>
            <span className="text-xs text-rose-600 font-medium">Below reorder level</span>
          </div>
        </Card>

        {/* Expiring Soon (30 Days) */}
        <Card
          onClick={() => navigate('/reports')}
          hoverable
          className="flex items-center space-x-4 border-l-4 border-l-purple-500"
        >
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('dashboard.expiring_soon')}
            </p>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">
              {loading ? '...' : stats?.expiring_count || 0}
            </h3>
            <span className="text-xs text-purple-600 font-medium">Within 30 days</span>
          </div>
        </Card>
      </div>

      {/* Two Column Layout: Weekly Trend & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Revenue Chart / Bars */}
        <Card className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h4 className="font-semibold text-slate-900">
                {t('dashboard.weekly_revenue')}
              </h4>
            </div>
          </div>

          {/* Simple Clean Bar Visualizer */}
          <div className="pt-4">
            <div className="flex items-end justify-between h-44 gap-2 pt-6 pb-2 px-2 border-b border-slate-100">
              {(stats?.weekly_chart || []).map((day, idx) => {
                const maxRev = Math.max(...(stats?.weekly_chart || []).map((d) => d.revenue), 100);
                const heightPercent = Math.max(8, Math.round((day.revenue / maxRev) * 100));
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center group relative">
                    {/* Tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded pointer-events-none whitespace-nowrap z-10">
                      {formatCurrency(day.revenue)}
                    </div>
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full max-w-[36px] bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-md hover:from-blue-700 hover:to-blue-500 transition-all cursor-pointer shadow-xs"
                    />
                    <span className="text-[11px] text-slate-500 mt-2 font-medium">
                      {day.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Recent Transactions List */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="font-semibold text-slate-900">
              {t('dashboard.recent_sales')}
            </h4>
            <button
              onClick={() => navigate('/reports')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center"
            >
              View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {(!stats?.recent_sales || stats.recent_sales.length === 0) ? (
              <p className="text-xs text-slate-400 py-6 text-center">No recent sales</p>
            ) : (
              stats.recent_sales.map((sale) => (
                <div key={sale.id} className="py-3 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono font-semibold text-slate-800">
                      {sale.sale_number}
                    </span>
                    <p className="text-[11px] text-slate-400">
                      {sale.cashier?.full_name || 'Cashier'} • {sale._count?.items || 0} items
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-900">
                      {formatCurrency(sale.total_amount)}
                    </span>
                    <div>
                      <Badge variant="success" size="xs">
                        Paid
                      </Badge>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
