import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useShift } from '../../context/ShiftContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  Clock,
  Play,
  LogOut,
  AlertCircle,
  Coins,
  CheckCircle2,
  TrendingUp,
  FileCheck,
} from 'lucide-react';

export const ShiftBar = ({ onReconcileClick }) => {
  const { user } = useAuth();
  const { activeShift, shiftMetrics, startShift, endShift, loading } = useShift();
  const navigate = useNavigate();

  const [startModalOpen, setStartModalOpen] = useState(false);
  const [shiftName, setShiftName] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!user || user.role === 'ADMIN') {
    // Admin/owner oversees everything; doesn't need to be locked into an individual cashier shift
    return null;
  }

  const handleStartShift = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await startShift({
        shift_name: shiftName,
        opening_balance: openingBalance || 0,
      });
      setStartModalOpen(false);
      setShiftName('');
      setOpeningBalance('');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to start shift');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseShiftClick = () => {
    if (onReconcileClick) {
      onReconcileClick();
    } else {
      navigate('/reconciliation');
    }
  };

  return (
    <>
      <div className="flex-shrink-0 mb-2">
        {!activeShift ? (
          <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 shadow-2xs">
            <div className="flex items-center space-x-2.5 text-xs text-amber-900 dark:text-amber-200">
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold block">No Active Shift Started</span>
                <span className="text-[11px] text-amber-700 dark:text-amber-300">
                  {user.role === 'CASHIER'
                    ? 'Start a shift with your opening cash drawer float to track your transactions separately.'
                    : 'Start your shift to record approved prescriptions and dispensed medicines.'}
                </span>
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => {
                setShiftName(
                  user.role === 'CASHIER'
                    ? `Morning Shift - ${user.full_name}`
                    : `Clinical Shift - ${user.full_name}`
                );
                setStartModalOpen(true);
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
            >
              <Play className="w-3.5 h-3.5 mr-1" /> Start My Shift
            </Button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 sm:px-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/50 shadow-2xs">
            <div className="flex items-center space-x-2.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {activeShift.shift_name || 'Active Shift'}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-2">
                  Started at {new Date(activeShift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {shiftMetrics && (
                <div className="hidden md:flex items-center space-x-2 ml-4 pl-4 border-l border-emerald-200 dark:border-emerald-800/60 text-[11px] text-slate-600 dark:text-slate-300">
                  {user.role === 'CASHIER' ? (
                    <>
                      <span className="font-medium">
                        Float: <strong>{shiftMetrics.opening_cash || 0} ETB</strong>
                      </span>
                      <span>•</span>
                      <span className="font-medium">
                        Collected: <strong>{shiftMetrics.total_collected || 0} ETB</strong>
                      </span>
                      <span>•</span>
                      <span className="font-medium">
                        Sales: <strong>{shiftMetrics.sales_count || 0}</strong>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium">
                        Approved Orders: <strong>{shiftMetrics.sales_approved_count || 0}</strong>
                      </span>
                      <span>•</span>
                      <span className="font-medium">
                        Volume: <strong>{shiftMetrics.total_approved_value || 0} ETB</strong>
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {user.role === 'CASHIER' ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCloseShiftClick}
                  className="font-bold text-xs bg-white dark:bg-slate-800 shadow-2xs border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/50"
                >
                  <Coins className="w-3.5 h-3.5 mr-1" /> End Shift & Reconcile
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    if (window.confirm('Are you sure you want to end your pharmacist shift?')) {
                      await endShift();
                    }
                  }}
                  className="font-bold text-xs bg-white dark:bg-slate-800 shadow-2xs border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/50"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1" /> End Shift
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Start Shift Modal */}
      <Modal
        isOpen={startModalOpen}
        onClose={() => setStartModalOpen(false)}
        title="Start Your Shift"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleStartShift} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 text-xs space-y-1">
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              Staff: <span className="font-bold">{user.full_name}</span> ({user.role})
            </p>
            <p className="text-slate-400">
              Time: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Date: {new Date().toLocaleDateString()}
            </p>
          </div>

          <Input
            label="Shift Label / Name"
            placeholder="e.g. Morning Shift, Afternoon Register"
            value={shiftName}
            onChange={(e) => setShiftName(e.target.value)}
            required
          />

          {user.role === 'CASHIER' && (
            <Input
              label="Opening Drawer Float Cash (ETB)"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 500.00"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              helperText="The physical cash amount already in the drawer before transactions begin."
            />
          )}

          <Button
            type="submit"
            isLoading={isSubmitting}
            className="w-full py-2.5 font-bold"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" /> Start Shift Now
          </Button>
        </form>
      </Modal>
    </>
  );
};
