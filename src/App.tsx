import React, { useState, useEffect, useRef } from 'react';
import {
  Dumbbell,
  Utensils,
  TrendingUp,
  MessageSquare,
  LogOut,
  QrCode,
  Plus,
  ChevronRight,
  User as UserIcon,
  Flame,
  Droplets,
  Beef,
  Wheat,
  Activity,
  Edit2,
  Check
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { getFitnessAdvice } from './services/geminiService';

interface User {
  id: number;
  name: string;
  email: string;
  avatar: string;
}

interface ProgressData {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  water: number;
  workout_name: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<ProgressData[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: string, content: string }[]>([
    { role: 'model', content: "Welcome to Sweat Fix. How can I assist with your fitness goals or macros today?" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<{
    workout_name: string;
    calories: number | '';
    protein: number | '';
    carbs: number | '';
    fats: number | '';
    water: number | '';
  }>({
    workout_name: '',
    calories: '',
    protein: '',
    carbs: '',
    fats: '',
    water: ''
  });

  useEffect(() => {
    fetchUser();
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        fetchUser();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/me');
      const data = await res.json();
      setUser(data);
      if (data) fetchProgress();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgress = async () => {
    try {
      const res = await fetch('/api/progress');
      const data = await res.json();
      setProgress(data.reverse());
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  const handleLogout = async () => {
    await fetch('/api/logout');
    setUser(null);
  };

  const handleSubmitProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        calories: Number(formData.calories) || 0,
        protein: Number(formData.protein) || 0,
        carbs: Number(formData.carbs) || 0,
        fats: Number(formData.fats) || 0,
        water: Number(formData.water) || 0,
        date: format(new Date(), 'MMM dd')
      })
    });
    setFormData({ workout_name: '', calories: '', protein: '', carbs: '', fats: '', water: '' });
    setShowForm(false);
    fetchProgress();
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) return;
    try {
      const res = await fetch('/api/user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName })
      });
      if (res.ok) {
        const updatedUser = await res.json();
        setUser(updatedUser);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsEditingProfile(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    try {
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));
      const advice = await getFitnessAdvice(input, history);
      setMessages([...newMessages, { role: 'model', content: advice || 'I am here to help!' }]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsTyping(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-zinc-950 text-white">Loading...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <div className="w-20 h-20 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-emerald-500/20">
            <Dumbbell className="text-black w-10 h-10" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">SWEAT FIX GYM</h1>
          <p className="text-zinc-400 mb-12 text-lg">Your premium journey to peak performance starts here.</p>

          <button
            onClick={handleLogin}
            className="w-full bg-white text-black font-semibold py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-zinc-200 transition-all active:scale-95 shadow-xl mb-4"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Continue with Google
          </button>

          <button
            onClick={async () => {
              try {
                const res = await fetch('/api/auth/demo', { method: 'POST' });
                if (res.ok) {
                  await fetchUser();
                } else {
                  const err = await res.json();
                  alert(`Demo login failed: ${err.error || 'Unknown error'}`);
                }
              } catch (e) {
                console.error("Demo login fetch error:", e);
                alert("Network error during demo login");
              }
            }}
            className="w-full bg-zinc-900 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-zinc-800 transition-all active:scale-95 border border-zinc-800 shadow-xl"
          >
            <UserIcon size={20} />
            Try Demo Account
          </button>

          <div className="mt-12 pt-12 border-t border-zinc-800">
            <button
              onClick={() => setShowQR(!showQR)}
              className="text-zinc-500 hover:text-white flex items-center gap-2 mx-auto text-sm uppercase tracking-widest font-bold"
            >
              <QrCode size={16} />
              Scan to Access
            </button>
            {showQR && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-6 p-4 bg-white rounded-2xl inline-block"
              >
                <QRCodeSVG value={window.location.href} size={150} />
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans pb-24">
      {/* Header */}
      <header className="p-6 flex justify-between items-center border-b border-zinc-900 sticky top-0 bg-zinc-950/80 backdrop-blur-md z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
            <Dumbbell size={20} className="text-black" />
          </div>
          <div>
            <h2 className="font-bold text-lg leading-tight uppercase tracking-widest text-emerald-500">SWEAT FIX GYM</h2>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowQR(true)} className="p-2 hover:bg-zinc-900 rounded-full transition-colors">
            <QrCode size={20} />
          </button>
          <div className="flex items-center gap-3 pl-4 border-l border-zinc-800">
            <button onClick={() => setShowProfile(true)} className="hover:scale-105 transition-transform">
              <img src={user.avatar} className="w-8 h-8 rounded-full border border-zinc-700" alt={user.name} />
            </button>
            <button onClick={handleLogout} className="p-2 hover:bg-zinc-900 rounded-full text-zinc-500 hover:text-red-400">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-8">
        {/* Welcome Section */}
        <section>
          <h1 className="text-3xl font-bold mb-2">Hello, {user.name.split(' ')[0]}!</h1>
          <p className="text-zinc-500">Ready to crush your goals today?</p>
        </section>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Flame size={20} className="text-orange-500" />
              </div>
              <span className="text-sm font-medium text-zinc-400">Calories</span>
            </div>
            <div className="text-3xl font-bold">{progress[progress.length - 1]?.calories || 0} <span className="text-sm font-normal text-zinc-500">kcal</span></div>
          </div>
          <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Beef size={20} className="text-purple-500" />
              </div>
              <span className="text-sm font-medium text-zinc-400">Protein</span>
            </div>
            <div className="text-3xl font-bold">{progress[progress.length - 1]?.protein || 0} <span className="text-sm font-normal text-zinc-500">g</span></div>
          </div>
          <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Wheat size={20} className="text-yellow-500" />
              </div>
              <span className="text-sm font-medium text-zinc-400">Carbs</span>
            </div>
            <div className="text-3xl font-bold">{progress[progress.length - 1]?.carbs || 0} <span className="text-sm font-normal text-zinc-500">g</span></div>
          </div>
          <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <Activity size={20} className="text-red-500" />
              </div>
              <span className="text-sm font-medium text-zinc-400">Fats</span>
            </div>
            <div className="text-3xl font-bold">{progress[progress.length - 1]?.fats || 0} <span className="text-sm font-normal text-zinc-500">g</span></div>
          </div>
          <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Droplets size={20} className="text-blue-500" />
              </div>
              <span className="text-sm font-medium text-zinc-400">Water</span>
            </div>
            <div className="text-3xl font-bold">{progress[progress.length - 1]?.water || 0} <span className="text-sm font-normal text-zinc-500">ml</span></div>
          </div>
        </div>

        {/* Progress Chart */}
        <section className="bg-zinc-900/30 p-8 rounded-[40px] border border-zinc-800/50">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h3 className="text-xl font-bold mb-1">Weekly Progress</h3>
              <p className="text-sm text-zinc-500 italic">Calorie intake overview</p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-black p-3 rounded-2xl transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
            >
              <Plus size={24} />
            </button>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={progress}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#71717a', fontSize: 12 }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ stroke: '#27272a', strokeWidth: 2 }}
                  contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                />
                <Line
                  type="monotone"
                  dataKey="calories"
                  stroke="#10b981"
                  strokeWidth={4}
                  dot={{ fill: '#18181b', r: 4, strokeWidth: 2, stroke: '#10b981' }}
                  activeDot={{ r: 8, strokeWidth: 0, fill: '#10b981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Recent Workouts */}
        <section>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold">Recent Activity</h3>
            <button className="text-emerald-500 text-sm font-bold flex items-center gap-1">
              View All <ChevronRight size={16} />
            </button>
          </div>
          <div className="space-y-3">
            {progress.slice().reverse().map((item, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center">
                    <Dumbbell size={20} className="text-zinc-400" />
                  </div>
                  <div>
                    <h4 className="font-bold">{item.workout_name || 'General Training'}</h4>
                    <p className="text-xs text-zinc-500">{item.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-emerald-500">+{item.calories} kcal</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Burned</div>
                </div>
              </div>
            ))}
            {progress.length === 0 && (
              <div className="text-center py-12 text-zinc-600 border-2 border-dashed border-zinc-800 rounded-3xl">
                No activity logged yet. Start your journey today!
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Chat Bot Trigger */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-emerald-500 text-black rounded-full shadow-2xl shadow-emerald-500/40 flex items-center justify-center hover:scale-110 transition-transform active:scale-95 z-50"
      >
        <MessageSquare size={28} />
      </button>

      {/* Chat Window */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className="fixed inset-0 md:inset-auto md:bottom-24 md:right-8 md:w-[400px] md:h-[600px] bg-zinc-900 border border-zinc-800 md:rounded-[32px] shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            <div className="p-6 bg-zinc-800/50 flex justify-between items-center border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                  <TrendingUp size={20} className="text-black" />
                </div>
                <div>
                  <h3 className="font-bold">Sweat Fix Coach</h3>
                  <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Always Online</p>
                </div>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-zinc-500 hover:text-white">
                <Plus className="rotate-45" size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${m.role === 'user' ? 'bg-emerald-500 text-black font-medium' : 'bg-zinc-800 text-zinc-100'}`}>
                    <div className="prose prose-invert max-w-none prose-p:leading-tight prose-ul:ml-4 prose-ul:list-disc prose-ul:my-1 prose-li:my-0 text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-strong:text-emerald-400">
                      <ReactMarkdown>
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-zinc-800 p-4 rounded-2xl flex gap-1">
                    <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-zinc-800/30 border-t border-zinc-800">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <button
                  onClick={handleSendMessage}
                  className="bg-emerald-500 text-black p-3 rounded-xl hover:bg-emerald-400 transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Log Progress Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900 w-full max-w-md rounded-[32px] border border-zinc-800 overflow-hidden shadow-2xl"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-bold">Log Progress</h3>
                  <button onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-white">
                    <Plus className="rotate-45" size={28} />
                  </button>
                </div>

                <form onSubmit={handleSubmitProgress} className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Workout Name</label>
                    <input
                      required
                      value={formData.workout_name}
                      onChange={e => setFormData({ ...formData, workout_name: e.target.value })}
                      placeholder="e.g. Chest Day"
                      className="w-full bg-zinc-800 border-none rounded-xl px-4 py-4 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Calories (kcal)</label>
                      <input
                        type="number"
                        value={formData.calories}
                        onChange={e => setFormData({ ...formData, calories: e.target.value ? parseInt(e.target.value) : '' })}
                        className="w-full bg-zinc-800 border-none rounded-xl px-4 py-4 text-white focus:ring-2 focus:ring-emerald-500 outline-none placeholder-zinc-600"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Protein (g)</label>
                      <input
                        type="number"
                        value={formData.protein}
                        onChange={e => setFormData({ ...formData, protein: e.target.value ? parseInt(e.target.value) : '' })}
                        className="w-full bg-zinc-800 border-none rounded-xl px-4 py-4 text-white focus:ring-2 focus:ring-emerald-500 outline-none placeholder-zinc-600"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Carbs (g)</label>
                      <input
                        type="number"
                        value={formData.carbs}
                        onChange={e => setFormData({ ...formData, carbs: e.target.value ? parseInt(e.target.value) : '' })}
                        className="w-full bg-zinc-800 border-none rounded-xl px-4 py-4 text-white focus:ring-2 focus:ring-emerald-500 outline-none placeholder-zinc-600"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Fats (g)</label>
                      <input
                        type="number"
                        value={formData.fats}
                        onChange={e => setFormData({ ...formData, fats: e.target.value ? parseInt(e.target.value) : '' })}
                        className="w-full bg-zinc-800 border-none rounded-xl px-4 py-4 text-white focus:ring-2 focus:ring-emerald-500 outline-none placeholder-zinc-600"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Water (ml)</label>
                    <input
                      type="number"
                      value={formData.water}
                      onChange={e => setFormData({ ...formData, water: e.target.value ? parseInt(e.target.value) : '' })}
                      className="w-full bg-zinc-800 border-none rounded-xl px-4 py-4 text-white focus:ring-2 focus:ring-emerald-500 outline-none placeholder-zinc-600"
                      placeholder="0"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-5 rounded-2xl transition-all active:scale-95 shadow-xl shadow-emerald-500/20 mt-4"
                  >
                    Save Entry
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QR Modal */}
      <AnimatePresence>
        {showQR && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[70] flex items-center justify-center p-6" onClick={() => setShowQR(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-12 rounded-[40px] text-center"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-black text-2xl font-bold mb-2">Access Sweat Fix</h3>
              <p className="text-zinc-500 mb-8">Scan to open your dashboard</p>
              <div className="p-4 bg-zinc-100 rounded-3xl inline-block">
                <QRCodeSVG value={window.location.href} size={250} />
              </div>
              <button
                onClick={() => setShowQR(false)}
                className="mt-8 text-zinc-400 hover:text-black font-bold uppercase tracking-widest text-xs"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfile && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[70] flex items-center justify-center p-6" onClick={() => setShowProfile(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900 border border-zinc-800 p-8 rounded-[40px] text-center max-w-sm w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-end mb-4">
                <button onClick={() => setShowProfile(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>
              <img src={user.avatar} alt={user.name} className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-zinc-800 shadow-xl" />

              {isEditingProfile ? (
                <div className="flex items-center gap-2 mb-6">
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="flex-1 bg-zinc-800 text-white font-bold text-xl rounded-xl px-4 py-2 border border-emerald-500/50 outline-none focus:border-emerald-500 text-center"
                    autoFocus
                  />
                  <button onClick={handleSaveProfile} className="p-2 bg-emerald-500 text-black rounded-xl hover:bg-emerald-400">
                    <Check size={20} />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center mb-6 relative group">
                  <h3 className="text-white text-2xl font-bold">{user.name}</h3>
                  <button
                    onClick={() => {
                      setEditName(user.name);
                      setIsEditingProfile(true);
                    }}
                    className="absolute -right-2 top-0 p-1.5 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Edit2 size={14} />
                  </button>
                  <p className="text-zinc-500 mt-1">{user.email}</p>
                </div>
              )}

              <div className="bg-zinc-800/50 rounded-2xl p-4 mb-8 text-left">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-zinc-400 text-sm">Member ID</span>
                  <span className="text-white font-mono text-sm">#{user.id.toString().padStart(4, '0')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 text-sm">Status</span>
                  <span className="text-emerald-500 font-bold text-sm tracking-widest uppercase">Active</span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="w-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white font-bold py-4 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <LogOut size={20} />
                Sign Out
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
