import React, { useState, useMemo } from 'react';
import { UserPlus, Trash2, Search, X, Power, Shield, User as UserIcon, Key } from 'lucide-react';
import { User, Role } from '../types';
import { useAppData } from '../context/AppDataContext';
import { uid } from '../utils';

interface UserManagementProps { t: any; currentUser: User; }

export const UserManagement: React.FC<UserManagementProps> = ({ t, currentUser }) => {
  const { users, upsertUser, deleteUser: deleteUserFn, saveAllUsers } = useAppData();
  const [form,            setForm]           = useState({ name: '', pin: '', confirm: '', role: 'packer' as Role });
  const [err,             setErr]            = useState('');
  const [ok,              setOk]             = useState('');
  const [search,          setSearch]         = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingUser,     setEditingUser]    = useState<User | null>(null);
  const [editPin,         setEditPin]        = useState({ pin: '', confirm: '' });
  const [editErr,         setEditErr]        = useState('');

  const isAdmin      = currentUser.role === 'admin';
  const isSupervisor = currentUser.role === 'supervisor' || isAdmin;

  const setField = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const flashOk = (msg: string) => { setOk(msg); setTimeout(() => setOk(''), 3000); };

  const handleAdd = async () => {
    setErr(''); setOk('');
    if (!form.name.trim()) return setErr(t.nameRequired);
    if (!/^\d{4,6}$/.test(form.pin)) return setErr(t.pinFourDigits);
    if (form.pin !== form.confirm) return setErr(t.pinMismatch);
    if (!isSupervisor) return setErr('Unauthorized');
    if (users.find(u => u.pin === form.pin && u.isActive !== false)) return setErr(t.pinExists);
    const nu: User = { uid: uid(), name: form.name.trim(), role: form.role, pin: form.pin, isActive: true };
    await upsertUser(nu);
    flashOk(t.userAdded);
    setForm({ name: '', pin: '', confirm: '', role: 'packer' });
  };

  const handleDelete = async (userId: string) => {
    if (!isSupervisor) return;
    const target = users.find(u => u.uid === userId);
    if (!isAdmin && target?.role === 'admin') return;
    await deleteUserFn(userId);
    setDeleteConfirmId(null);
  };

  const handleToggle = async (userId: string) => {
    const u = users.find(x => x.uid === userId);
    if (!u) return;
    await upsertUser({ ...u, isActive: !u.isActive });
  };

  const handleChangePin = async () => {
    setEditErr('');
    if (!editingUser) return;
    if (!/^\d{4,6}$/.test(editPin.pin)) { setEditErr(t.pinFourDigits); return; }
    if (editPin.pin !== editPin.confirm) { setEditErr(t.pinMismatch); return; }
    if (users.find(u => u.pin === editPin.pin && u.uid !== editingUser.uid)) { setEditErr(t.pinExists); return; }
    await upsertUser({ ...editingUser, pin: editPin.pin });
    setEditingUser(null);
    setEditPin({ pin: '', confirm: '' });
    flashOk('PIN updated!');
  };

  const filtered = useMemo(() =>
    users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.pin.includes(search))
  , [users, search]);

  const roleIcon = (role: Role) =>
    role === 'admin' ? <Shield size={12} className="text-purple-500" />
    : role === 'supervisor' ? <Shield size={12} className="text-blue-400" />
    : <UserIcon size={12} className="text-gray-400" />;

  return (
    <div className="space-y-6">
      {/* Add User */}
      {isSupervisor && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
            <UserPlus size={16} className="text-blue-500" />{t.addUser}
          </h3>
          <div className="space-y-3">
            <input value={form.name} onChange={e => setField('name', e.target.value)}
              placeholder={t.fullNamePH} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            <select value={form.role} onChange={e => setField('role', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white">
              <option value="packer">{t.packerRole}</option>
              <option value="supervisor">{t.supervisorRole}</option>
              {isAdmin && <option value="admin">Admin</option>}
            </select>
            <input value={form.pin} onChange={e => setField('pin', e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={t.pinLabel} type="password" inputMode="numeric"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            <input value={form.confirm} onChange={e => setField('confirm', e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={t.confirmPinLabel} type="password" inputMode="numeric"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            {err && <p className="text-xs text-red-500">{err}</p>}
            {ok  && <p className="text-xs text-green-600 font-semibold">{ok}</p>}
            <button onClick={handleAdd}
              className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 text-sm transition-colors">
              {t.addUser}
            </button>
          </div>
        </div>
      )}

      {/* User list */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-sm mb-3">{t.existingUsers} ({users.length})</h3>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t.searchUserPH}
              className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
        </div>

        <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
          {filtered.map(u => (
            <div key={u.uid} className={`px-5 py-3 flex items-center gap-3 ${!u.isActive ? 'opacity-50' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {roleIcon(u.role)}
                  <span className="text-sm font-semibold text-gray-800 truncate">{u.name}</span>
                  {!u.isActive && <span className="text-[9px] font-bold text-red-400 uppercase">inactive</span>}
                </div>
                <div className="text-xs text-gray-400 capitalize">{u.role} · PIN: {'·'.repeat(u.pin.length)}</div>
              </div>
              {isSupervisor && u.uid !== currentUser.uid && (
                <div className="flex items-center gap-1">
                  <button onClick={() => { setEditingUser(u); setEditPin({ pin: '', confirm: '' }); setEditErr(''); }}
                    className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title={t.changePin}>
                    <Key size={14} />
                  </button>
                  <button onClick={() => handleToggle(u.uid)}
                    className={`p-1.5 rounded-lg transition-colors ${u.isActive ? 'text-gray-400 hover:text-orange-500 hover:bg-orange-50' : 'text-green-500 hover:bg-green-50'}`}>
                    <Power size={14} />
                  </button>
                  {isAdmin && (
                    <button onClick={() => setDeleteConfirmId(u.uid)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Change PIN modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-gray-900 mb-4">{t.changePin}: {editingUser.name}</h3>
            <div className="space-y-3">
              <input value={editPin.pin} onChange={e => setEditPin(p => ({ ...p, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                placeholder={t.pinLabel} type="password" inputMode="numeric"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              <input value={editPin.confirm} onChange={e => setEditPin(p => ({ ...p, confirm: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                placeholder={t.confirmPinLabel} type="password" inputMode="numeric"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              {editErr && <p className="text-xs text-red-500">{editErr}</p>}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setEditingUser(null)} className="flex-1 py-2 text-gray-600 font-medium hover:bg-gray-50 rounded-xl text-sm">{t.cancel}</button>
              <button onClick={handleChangePin} className="flex-1 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 text-sm">{t.savePin}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-gray-900 mb-2">{t.deleteUser}?</h3>
            <p className="text-sm text-gray-500 mb-6">{t.confirmDeleteUser}</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-2 text-gray-600 font-medium hover:bg-gray-50 rounded-xl text-sm">{t.cancel}</button>
              <button onClick={() => handleDelete(deleteConfirmId)} className="flex-1 py-2 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 text-sm">{t.deleteUser}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
