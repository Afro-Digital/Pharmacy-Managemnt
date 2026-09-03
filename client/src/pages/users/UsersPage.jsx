import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/Alert';
import { ShieldCheck, Plus, UserX, UserCheck } from 'lucide-react';

export const UsersPage = () => {
  const { t } = useTranslation();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    email: '',
    password: '',
    role: 'CASHIER',
    phone: '',
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      if (res.data.success) setUsers(res.data.data);
    } catch (err) {
      console.error('Users load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/users', formData);
      if (res.data.success) {
        setSuccessMessage(`User ${formData.username} created successfully`);
        setUserModalOpen(false);
        setFormData({
          full_name: '',
          username: '',
          email: '',
          password: '',
          role: 'CASHIER',
          phone: '',
        });
        fetchUsers();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Failed to create user');
    }
  };

  const handleToggleActive = async (user) => {
    try {
      await api.put(`/users/${user.id}`, { is_active: !user.is_active });
      setSuccessMessage(`User status updated for ${user.username}`);
      fetchUsers();
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Failed to update user status');
    }
  };

  const columns = [
    {
      header: t('users.name'),
      accessor: 'full_name',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-900">{row.full_name}</span>
          <div className="text-xs text-slate-400">@{row.username}</div>
        </div>
      ),
    },
    {
      header: t('users.email'),
      accessor: 'email',
      render: (row) => row.email || '—',
    },
    {
      header: t('users.role'),
      accessor: 'role',
      render: (row) => {
        const colors = {
          ADMIN: 'danger',
          PHARMACIST: 'info',
          CASHIER: 'success',
        };
        return <Badge variant={colors[row.role] || 'neutral'}>{row.role}</Badge>;
      },
    },
    {
      header: t('users.status'),
      accessor: 'is_active',
      render: (row) => (
        <Badge variant={row.is_active ? 'success' : 'neutral'}>
          {row.is_active ? t('users.active') : t('users.inactive')}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleToggleActive(row)}
        >
          {row.is_active ? (
            <>
              <UserX className="w-3.5 h-3.5 mr-1 text-rose-500" /> Deactivate
            </>
          ) : (
            <>
              <UserCheck className="w-3.5 h-3.5 mr-1 text-emerald-500" /> Activate
            </>
          )}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {t('users.title')}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Administer staff roles, access permissions, and account credentials
          </p>
        </div>
        <Button onClick={() => setUserModalOpen(true)} className="text-sm shadow-sm">
          <Plus className="w-4 h-4 mr-1.5" />
          {t('users.add_user')}
        </Button>
      </div>

      {successMessage && (
        <Alert variant="success" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="error" onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      <Table columns={columns} data={users} isLoading={loading} />

      {/* Add User Modal */}
      <Modal
        isOpen={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        title={t('users.add_user')}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <Input
            label={t('users.name')}
            required
            placeholder="e.g. Almaz Kebede"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
          />
          <Input
            label={t('users.username')}
            required
            placeholder="e.g. almazk"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          />
          <Input
            label={t('users.email')}
            type="email"
            placeholder="almaz@tilexpharmacy.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t('users.role')}
              required
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              options={[
                { value: 'ADMIN', label: 'Admin (Full Access)' },
                { value: 'PHARMACIST', label: 'Pharmacist' },
                { value: 'CASHIER', label: 'Cashier (POS Only)' },
              ]}
            />
            <Input
              label="Phone"
              placeholder="+2519..."
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          <Input
            label={t('users.password')}
            type="password"
            required
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          />
          <Button type="submit" className="w-full py-2.5 font-bold mt-2">
            Create User Account
          </Button>
        </form>
      </Modal>
    </div>
  );
};
