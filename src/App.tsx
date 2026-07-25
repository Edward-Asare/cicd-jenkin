import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Item = {
  _id: string;
  itemName: string;
  sku: string;
  category: string;
  quantity: number;
  price: number;
  lowStockThreshold: number;
  notes: string;
  lastUpdated: string;
};

type Stats = { totalItems: number; totalUnits: number; totalValue: number; lowStockCount: number; outOfStockCount: number; categoriesCount: number };
type FormData = Omit<Item, '_id' | 'lastUpdated'>;

const blankForm: FormData = { itemName: '', sku: '', category: '', quantity: 0, price: 0, lowStockThreshold: 5, notes: '' };

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('storetrack-token');
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Request failed.');
  return payload;
}

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [authenticated, setAuthenticated] = useState(Boolean(localStorage.getItem('storetrack-token')));
  const [form, setForm] = useState<FormData>(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [inventory, metrics] = await Promise.all([api<Item[]>('/api/inventory'), api<Stats>('/api/inventory/stats')]);
      setItems(inventory);
      setStats(metrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load inventory.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!authenticated) return;
    api('/api/auth/me').catch(() => {
      localStorage.removeItem('storetrack-token');
      setAuthenticated(false);
    });
  }, [authenticated]);

  const visibleItems = useMemo(() => items.filter((item) => {
    const matchesSearch = [item.itemName, item.sku, item.category].some((value) => value.toLowerCase().includes(search.toLowerCase()));
    const matchesFilter = filter === 'all' || (filter === 'out' && item.quantity === 0) || (filter === 'low' && item.quantity > 0 && item.quantity <= item.lowStockThreshold) || (filter === 'healthy' && item.quantity > item.lowStockThreshold);
    return matchesSearch && matchesFilter;
  }), [items, search, filter]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError('');
    try {
      const result = await api<{ token: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: data.get('username'), password: data.get('password') }) });
      localStorage.setItem('storetrack-token', result.token);
      setAuthenticated(true);
      setMessage('Administrator login successful.');
      event.currentTarget.reset();
    } catch (err) { setError(err instanceof Error ? err.message : 'Login failed.'); }
  }

  async function saveItem(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await api(editingId ? `/api/inventory/${editingId}` : '/api/inventory', { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(form) });
      setMessage(editingId ? 'Item updated.' : 'Item added.');
      setForm(blankForm);
      setEditingId(null);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save item.'); }
  }

  async function adjust(item: Item, delta: number) {
    try {
      await api(`/api/inventory/${item._id}/stock`, { method: 'PATCH', body: JSON.stringify({ delta, reason: delta > 0 ? 'Stock received' : 'Stock sold or removed' }) });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to adjust stock.'); }
  }

  async function remove(item: Item) {
    if (!confirm(`Delete ${item.itemName}?`)) return;
    try {
      await api(`/api/inventory/${item._id}`, { method: 'DELETE' });
      setMessage('Item deleted.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to delete item.'); }
  }

  function edit(item: Item) {
    const { _id, lastUpdated, ...data } = item;
    void _id; void lastUpdated;
    setForm(data);
    setEditingId(item._id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return <main className="shell">
    <header className="hero">
      <div><p className="eyebrow">Inventory control</p><h1>StoreTrack</h1><p>Simple, secure stock management for local shops.</p></div>
      {authenticated ? <button className="secondary" onClick={() => { localStorage.removeItem('storetrack-token'); setAuthenticated(false); }}>Log out</button> : null}
    </header>

    {error && <div className="alert error">{error}</div>}
    {message && <div className="alert success" onClick={() => setMessage('')}>{message}</div>}

    {!authenticated ? <section className="panel login-panel">
      <div><h2>Administrator login</h2><p>Log in to add, edit, or remove inventory.</p></div>
      <form onSubmit={login} className="login-form"><input name="username" placeholder="Username" required autoComplete="username"/><input name="password" type="password" placeholder="Password" required autoComplete="current-password"/><button>Log in</button></form>
    </section> : <section className="panel">
      <h2>{editingId ? 'Edit product' : 'Add product'}</h2>
      <form className="item-form" onSubmit={saveItem}>
        <label>Product name<input value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} required maxLength={120}/></label>
        <label>SKU<input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })} required maxLength={64}/></label>
        <label>Category<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required maxLength={80}/></label>
        <label>Quantity<input type="number" min="0" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} required/></label>
        <label>Unit price<input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} required/></label>
        <label>Low-stock level<input type="number" min="0" step="1" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })} required/></label>
        <label className="wide">Notes<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500}/></label>
        <div className="form-actions"><button>{editingId ? 'Save changes' : 'Add product'}</button>{editingId && <button type="button" className="secondary" onClick={() => { setEditingId(null); setForm(blankForm); }}>Cancel</button>}</div>
      </form>
    </section>}

    <section className="stats">
      {[['Products', stats?.totalItems], ['Units', stats?.totalUnits], ['Inventory value', stats ? `$${stats.totalValue.toFixed(2)}` : '—'], ['Low stock', stats?.lowStockCount], ['Out of stock', stats?.outOfStockCount]].map(([label, value]) => <article className="stat" key={label}><span>{label}</span><strong>{value ?? '—'}</strong></article>)}
    </section>

    <section className="panel">
      <div className="toolbar"><div><h2>Current inventory</h2><p>{visibleItems.length} products shown</p></div><div className="filters"><input aria-label="Search inventory" placeholder="Search name, SKU, category" value={search} onChange={(e) => setSearch(e.target.value)}/><select aria-label="Filter by stock level" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All stock</option><option value="healthy">Healthy</option><option value="low">Low</option><option value="out">Out of stock</option></select></div></div>
      {loading ? <p className="empty">Loading inventory…</p> : visibleItems.length === 0 ? <p className="empty">No inventory items found.</p> : <div className="table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Quantity</th><th>Price</th><th>Status</th>{authenticated && <th>Actions</th>}</tr></thead><tbody>{visibleItems.map((item) => {
        const status = item.quantity === 0 ? 'Out' : item.quantity <= item.lowStockThreshold ? 'Low' : 'Healthy';
        return <tr key={item._id}><td><strong>{item.itemName}</strong><small>{item.notes}</small></td><td>{item.sku}</td><td>{item.category}</td><td>{item.quantity}</td><td>${item.price.toFixed(2)}</td><td><span className={`badge ${status.toLowerCase()}`}>{status}</span></td>{authenticated && <td><div className="actions"><button className="tiny" onClick={() => void adjust(item, 1)}>+1</button><button className="tiny" disabled={item.quantity === 0} onClick={() => void adjust(item, -1)}>−1</button><button className="tiny" onClick={() => edit(item)}>Edit</button><button className="tiny danger" onClick={() => void remove(item)}>Delete</button></div></td>}</tr>;
      })}</tbody></table></div>}
    </section>
  </main>;
}
