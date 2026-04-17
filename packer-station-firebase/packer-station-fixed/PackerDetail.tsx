import React, { useState, useMemo } from 'react';
import { UserPlus, Users, Trash2, Search, X, Power, Shield, User as UserIcon, Key } from 'lucide-react';
import { User, Role } from '../types';
import { getAllUsers, saveAllUsers, toggleUserActive } from '../services/dataService';
import { uid } from '../utils';

interface UserManagementProps {
  t: any;
  currentUser: User;
}

export const UserManagement: React.FC<UserManagementProps> = ({ t, currentUser }) => {
  const [form, setForm] = useState({ name: '', pin: '', confirm: '', role: 'packer' as Role });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [users, setUsers] = useState<User[]>(getAllUsers());
  const [search, setSearch] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editPin, setEditPin] = useState({ pin: '', confirm: '' });
  const [editErr, setEditErr] = useState('');

  const setField = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const isAdmin = currentUser.role === 'admin';
  const isSupervisor = currentUser.role === 'supervisor' || isAdmin;

  const handleAdd = () => {
    setErr('');
    setOk('');
    if (!form.name.trim()) return setErr(t.nameRequired);
    if (!/^\d{4,6}$/.test(form.pin)) return setErr(t.pinFourDigits);
    if (form.pin !== form.confirm) return setErr(t.pinMismatch);
    
    // Permission check
    if (!isSupervisor) return setErr("Unauthorized");
    
    const all = getAllUsers();
    if (all.find((u) => u.pin === form.pin)) return setErr(t.pinExists);
    
    const nu: User = {
      uid: uid(),
      name: form.name.trim(),
      role: form.role,
      pin: form.pin,
      isActive: true
    };
    
    const updated = [...all, nu];
    saveAllUsers(updated);
    setUsers(updated);
    setOk(t.userAdded);
    setForm({ name: '', pin: '', confirm: '', role: 'packer' });
    setTimeout(() => setOk(''), 3000);
  };

  const handleDelete = (userId: string) => {
    if (!isSupervisor) return;
    const target = users.find(u => u.uid === userId);
    if (!isAdmin && target?.role === 'admin') return;
    
    const updated = users.filter((u) => u.uid !== userId);
    saveAllUsers(updated);
    setUsers(updated);
    setDeleteConfirmId(null);
  };

  const handleToggleActive = (id: string) => {
    const updated = toggleUserActive(id);
    setUsers(updated);
  };

  const handleUpdatePin = () => {
    if (!editingUser) return;
    setEditErr('');
    if (!/^\d{4,6}$/.test(editPin.pin)) return setEditErr(t.pinFourDigits);
    if (editPin.pin !== editPin.confirm) return setEditErr(t.pinMismatch);

    const all = getAllUsers();
    if (all.find(u => u.pin === editPin.pin && u.uid !== editingUser.uid)) {
      return setEditErr(t.pinExists);
    }

    const updated = all.map(u => u.uid === editingUser.uid ? { ...u, pin: editPin.pin } : u);
    saveAllUsers(updated);
    setUsers(updated);
    setEditingUser(null);
    setEditPin({ pin: '', confirm: '' });
    setOk(t.successful || 'Successful!');
    setTimeout(() => setOk(''), 3000);
  };

  const filteredUsers = users.filter(u => {
    // Visibility logic: Supervisor can only see Packers and other Supervisors
    if (currentUser.role === 'supervisor' && u.role === 'admin') return false;
    
    return u.name.toLowerCase().includes(search.toLowerCase()) || 
           u.pin.includes(search);
  });

  return (
    <div className="space-y-4">
      {/* Add form */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4 text-sm">
          <UserPlus size={16} className="text-blue-600" />
          {t.addUser}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              {t.fullNameLabel}
            </label>
            <input
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder={t.fullNamePH}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              {t.roleLabel}
            </label>
            <select
              value={form.role}
              onChange={(e) => setField('role', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
            >
              <option value="packer">{t.packerRole}</option>
              {isSupervisor && <option value="supervisor">{t.supervisorRole}</option>}
              {isSupervisor && <option value="admin">Admin</option>}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                {t.pinLabel}
              </label>
              <input
                type="password"
                value={form.pin}
                onChange={(e) => setField('pin', e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                inputMode="numeric"
                placeholder="······"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-center text-lg font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                {t.confirmPinLabel}
              </label>
              <input
                type="password"
                value={form.confirm}
                onChange={(e) => setField('confirm', e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                inputMode="numeric"
                placeholder="······"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-center text-lg font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>
          {err && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-4 py-2.5">{err}</p>}
          {ok && <p className="text-xs text-green-600 bg-green-50 rounded-xl px-4 py-2.5">{ok}</p>}
          <button
            onClick={handleAdd}
            className="w-full py-2.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors text-sm"
          >
            {t.addUser}
          </button>
        </div>
      </div>

      {/* User list */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm shrink-0">
            <Users size={16} className="text-purple-600" />
            {t.existingUsers}
          </h3>
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.searchUserPH}
              className="w-full pl-9 pr-8 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
        {filteredUsers.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">{t.noUsersYet}</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filteredUsers.map((u) => (
              <div key={u.uid} className={`px-5 py-3 flex items-center justify-between group hover:bg-gray-50 transition-colors ${u.isActive === false ? 'opacity-50 grayscale' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${u.role === 'admin' ? 'bg-purple-100 text-purple-600' : u.role === 'supervisor' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                    {u.role === 'admin' ? <Shield size={18} /> : <UserIcon size={18} />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      {u.name}
                      {u.isActive === false && <span className="text-[8px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Inactive</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      <span className="font-semibold uppercase">{u.role}</span>
                      {' · PIN: '}
                      <span className="font-mono">{u.pin}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Edit PIN Button */}
                  {isSupervisor && (
                    (isAdmin) || 
                    (u.uid === currentUser.uid) || 
                    (u.role === 'packer')
                  ) && (
                    <button
                      onClick={() => {
                        setEditingUser(u);
                        setEditPin({ pin: '', confirm: '' });
                        setEditErr('');
                      }}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title={t.changePin || 'Change PIN'}
                    >
                      <Key size={16} />
                    </button>
                  )}

                  {/* Supervisor/Admin can deactivate/activate */}
                  {isSupervisor && u.uid !== currentUser.uid && (isAdmin || u.role === 'packer') && (
                    <button 
                      onClick={() => handleToggleActive(u.uid)}
                      className={`p-2 rounded-lg transition-all ${u.isActive === false ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-orange-100 text-orange-600 hover:bg-orange-200'}`}
                      title={u.isActive === false ? t.activateUser : t.deactivateUser}
                    >
                      <Power size={16} />
                    </button>
                  )}

                  {/* Supervisor/Admin can delete */}
                  {isSupervisor && u.uid !== currentUser.uid && (isAdmin || u.role !== 'admin') && (
                    <div className="relative">
                      {deleteConfirmId === u.uid ? (
                        <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                          <button
                            onClick={() => handleDelete(u.uid)}
                            className="px-2 py-1 bg-red-500 text-white text-[10px] font-bold rounded-lg hover:bg-red-600 transition-colors"
                          >
                            {t.deleteUser || 'Delete'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(u.uid)}
                          title={t.deleteUser}
                          className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit PIN Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in duration-300">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Key size={24} className="text-blue-600" />
              </div>
              <h3 className="text-base font-bold text-gray-900">{t.changePin || 'Change PIN'}</h3>
              <p className="text-xs text-gray-500 mt-1">{editingUser.name}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  {t.pinLabel}
                </label>
                <input
                  type="password"
                  value={editPin.pin}
                  onChange={(e) => setEditPin(p => ({ ...p, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  maxLength={6}
                  inputMode="numeric"
                  placeholder="······"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-center text-lg font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  {t.confirmPinLabel}
                </label>
                <input
                  type="password"
                  value={editPin.confirm}
                  onChange={(e) => setEditPin(p => ({ ...p, confirm: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  maxLength={6}
                  inputMode="numeric"
                  placeholder="······"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-center text-lg font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              {editErr && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-4 py-2.5">{editErr}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2.5 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors text-sm"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={handleUpdatePin}
                  className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors text-sm"
                >
                  {t.savePin || 'Save PIN'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
