import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
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
  Check,
  Bot,
  Mic,
  MicOff
} from 'lucide-react';
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import am5themes_Dark from "@amcharts/amcharts5/themes/Dark";
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { getFitnessAdvice } from './services/chatService';

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

interface DailyPlan {
  id: number;
  date: string;
  workout_plan: string;
  diet_plan: string;
  completed: boolean;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<ProgressData[]>([]);
  const [dailyPlans, setDailyPlans] = useState<DailyPlan[]>([]);
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
  const [isListening, setIsListening] = useState(false);

  // Plan state
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planForm, setPlanForm] = useState({
    workout_plan: '',
    diet_plan: ''
  });

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

  useLayoutEffect(() => {
    if (!progress.length) return;

    let root = am5.Root.new("chartdiv");

    root.setThemes([
      am5themes_Animated.new(root),
      am5themes_Dark.new(root)
    ]);

    let chart = root.container.children.push(am5xy.XYChart.new(root, {
      panX: true,
      panY: true,
      wheelX: "panX",
      wheelY: "zoomX",
      pinchZoomX: true
    }));

    let cursor = chart.set("cursor", am5xy.XYCursor.new(root, {
      behavior: "none"
    }));
    cursor.lineY.set("visible", false);

    let xAxisRenderer = am5xy.AxisRendererX.new(root, {});
    xAxisRenderer.grid.template.set("strokeOpacity", 0);

    let xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, {
      categoryField: "date",
      renderer: xAxisRenderer,
      tooltip: am5.Tooltip.new(root, {})
    }));
    xAxis.data.setAll(progress);

    let yAxisRenderer = am5xy.AxisRendererY.new(root, {});
    yAxisRenderer.grid.template.set("strokeOpacity", 0.1);
    yAxisRenderer.grid.template.set("strokeDasharray", [3, 3]);

    let yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
      renderer: yAxisRenderer
    }));

    let series = chart.series.push(am5xy.LineSeries.new(root, {
      name: "Calories",
      xAxis: xAxis,
      yAxis: yAxis,
      valueYField: "calories",
      categoryXField: "date",
      tooltip: am5.Tooltip.new(root, {
        labelText: "{valueY} kcal"
      })
    }));

    series.strokes.template.setAll({
      strokeWidth: 4,
      stroke: am5.color(0x10b981) // emerald-500
    });

    series.bullets.push(function () {
      return am5.Bullet.new(root, {
        sprite: am5.Circle.new(root, {
          radius: 5,
          fill: am5.color(0x18181b),
          stroke: am5.color(0x10b981),
          strokeWidth: 2
        })
      });
    });

    series.data.setAll(progress);
    series.appear(1000);
    chart.appear(1000, 100);

    return () => {
      root.dispose();
    };
  }, [progress]);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/me');
      const data = await res.json();
      setUser(data);
      if (data) {
        fetchProgress();
        fetchPlans();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/plans');
      const data = await res.json();
      setDailyPlans(data);
    } catch (e) {
      console.error(e);
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

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...planForm,
        date: format(new Date(), 'MMM dd')
      })
    });
    setPlanForm({ workout_plan: '', diet_plan: '' });
    setShowPlanForm(false);
    fetchPlans();
  };

  const handleTogglePlan = async (id: number, currentStatus: boolean) => {
    await fetch(`/api/plans/${id}/complete`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !currentStatus })
    });
    fetchPlans();
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
      let advice = await getFitnessAdvice(input, history);

      // Auto-fill parsing
      const jsonMatch = advice.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        try {
          const planData = JSON.parse(jsonMatch[1]);
          if (planData.workout_plan || planData.diet_plan) {
            advice = advice.replace(/```json\n[\s\S]*?\n```/, '').trim();

            let planMarkdown = `\n\n### 📝 Your Generated Protocol\n\n`;
            if (planData.workout_plan) {
              planMarkdown += `**Workout Plan:**\n${planData.workout_plan}\n\n`;
            }
            if (planData.diet_plan) {
              planMarkdown += `**Diet Plan:**\n${planData.diet_plan}\n\n`;
            }

            advice += planMarkdown + "*(I have automatically attached this plan to your Daily Protocol!)*";

            await fetch('/api/plans', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                workout_plan: planData.workout_plan || '',
                diet_plan: planData.diet_plan || '',
                date: format(new Date(), 'MMM dd')
              })
            });
            fetchPlans();
          }
          if (planData.progress_log) {
            fetchProgress();
            advice = advice.replace(/```json\n[\s\S]*?\n```/, '').trim();
            advice += `\n\n*(I have automatically logged your progress!)*`;
          }
        } catch (err) {
          console.error("Auto-fill parsing failed:", err);
        }
      }

      setMessages([...newMessages, { role: 'model', content: advice || 'I am here to help!' }]);
    } catch (e: any) {
      console.error(e);
      setMessages([...newMessages, { role: 'model', content: `**Error:** ${e.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support Speech Recognition. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map(result => result.transcript)
        .join('');
      setInput(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
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
          <div className="flex items-center gap-3">
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-orange-500/10 rounded-md">
                <Flame size={18} className="text-orange-500" />
              </div>
              <span className="text-sm font-medium text-zinc-400">Calories</span>
            </div>
            <div className="text-2xl font-bold">{progress[progress.length - 1]?.calories || 0} <span className="text-sm font-normal text-zinc-500">kcal</span></div>
          </div>
          <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-purple-500/10 rounded-md">
                <Beef size={18} className="text-purple-500" />
              </div>
              <span className="text-sm font-medium text-zinc-400">Protein</span>
            </div>
            <div className="text-2xl font-bold">{progress[progress.length - 1]?.protein || 0} <span className="text-sm font-normal text-zinc-500">g</span></div>
          </div>
          <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-yellow-500/10 rounded-md">
                <Wheat size={18} className="text-yellow-500" />
              </div>
              <span className="text-sm font-medium text-zinc-400">Carbs</span>
            </div>
            <div className="text-2xl font-bold">{progress[progress.length - 1]?.carbs || 0} <span className="text-sm font-normal text-zinc-500">g</span></div>
          </div>
          <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-red-500/10 rounded-md">
                <Activity size={18} className="text-red-500" />
              </div>
              <span className="text-sm font-medium text-zinc-400">Fats</span>
            </div>
            <div className="text-2xl font-bold">{progress[progress.length - 1]?.fats || 0} <span className="text-sm font-normal text-zinc-500">g</span></div>
          </div>
          <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-blue-500/10 rounded-md">
                <Droplets size={18} className="text-blue-500" />
              </div>
              <span className="text-sm font-medium text-zinc-400">Water</span>
            </div>
            <div className="text-2xl font-bold">{progress[progress.length - 1]?.water || 0} <span className="text-sm font-normal text-zinc-500">ml</span></div>
          </div>
        </div>

        {/* Track Workout Section */}
        <section className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-xl font-bold text-emerald-500 mb-1">Track Workout & Macros</h3>
            <p className="text-sm text-zinc-400">Log your recent activity to update your stats and progress chart.</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-3 rounded-2xl transition-all active:scale-95 font-bold shadow-lg shadow-emerald-500/20 whitespace-nowrap"
          >
            <Plus size={20} /> <span className="md:inline">Log Activity</span>
          </button>
        </section>

        {/* Progress Chart */}
        <section className="bg-zinc-900/30 p-8 rounded-[40px] border border-zinc-800/50">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h3 className="text-xl font-bold mb-1">Weekly Progress</h3>
              <p className="text-sm text-zinc-500 italic">Calorie intake overview</p>
            </div>
          </div>

          <div id="chartdiv" className="h-[300px] w-full" />
        </section>

        {/* Diet & Workout Chart Section */}
        <section>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Bot size={24} className="text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold">Workout & Diet Chart</h3>
              </div>
              <p className="text-sm text-zinc-500 mt-2">Your personalized routines generated by Sweat Fix Coach</p>
            </div>
            <button
              onClick={() => setShowPlanForm(true)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm font-bold rounded-xl transition-colors"
            >
              Update Plan
            </button>
          </div>
          <div className="space-y-4">
            {dailyPlans.length > 0 ? dailyPlans.slice(0, 3).map((plan, i) => (
              <div key={i} className={`p-6 rounded-[24px] border ${plan.completed ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-zinc-900/50 border-zinc-800/50'} transition-colors`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">{plan.date === format(new Date(), 'MMM dd') ? 'Today' : plan.date}</span>
                    <h4 className={`text-lg font-bold mt-1 ${plan.completed ? 'text-emerald-500 line-through opacity-70' : 'text-white'}`}>Daily Routine</h4>
                  </div>
                  <button
                    onClick={() => handleTogglePlan(plan.id, plan.completed)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${plan.completed ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-zinc-700 text-transparent hover:border-emerald-500'}`}
                  >
                    <Check size={16} />
                  </button>
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${plan.completed ? 'opacity-50' : ''}`}>
                  <div className="bg-zinc-950/50 p-4 rounded-2xl">
                    <div className="flex items-center gap-2 mb-2 text-zinc-400">
                      <Dumbbell size={16} />
                      <span className="text-sm font-bold uppercase tracking-widest text-emerald-500">Workout Chart</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{plan.workout_plan || 'No training logged.'}</p>
                  </div>
                  <div className="bg-zinc-950/50 p-4 rounded-2xl">
                    <div className="flex items-center gap-2 mb-2 text-zinc-400">
                      <Utensils size={16} />
                      <span className="text-sm font-bold uppercase tracking-widest text-emerald-500">Diet Plan</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{plan.diet_plan || 'No nutrition logged.'}</p>
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-center py-12 text-zinc-600 border-2 border-dashed border-zinc-800 rounded-3xl">
                No daily plan set. Log your workout and diet protocols for the day.
              </div>
            )}
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
                  onClick={toggleListening}
                  className={`p-3 rounded-xl transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}
                >
                  {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
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

      {/* Daily Plan Modal */}
      <AnimatePresence>
        {showPlanForm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900 w-full max-w-lg rounded-[32px] border border-zinc-800 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-8 flex-shrink-0 flex justify-between items-center border-b border-zinc-800/50">
                <h3 className="text-2xl font-bold">Daily Protocol</h3>
                <button onClick={() => setShowPlanForm(false)} className="text-zinc-500 hover:text-white">
                  <Plus className="rotate-45" size={28} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto">
                <form onSubmit={handleSavePlan} className="space-y-6">
                  <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-emerald-500 uppercase tracking-widest mb-3">
                      <Dumbbell size={16} /> Workout Plan
                    </label>
                    <textarea
                      required
                      value={planForm.workout_plan}
                      onChange={e => setPlanForm({ ...planForm, workout_plan: e.target.value })}
                      placeholder="E.g., 4x10 Pull-ups, 3x15 Push-ups"
                      className="w-full bg-zinc-800 border-none rounded-xl px-4 py-4 text-white focus:ring-2 focus:ring-emerald-500 outline-none min-h-[120px] resize-y"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-emerald-500 uppercase tracking-widest mb-3">
                      <Utensils size={16} /> Nutrition Plan
                    </label>
                    <textarea
                      required
                      value={planForm.diet_plan}
                      onChange={e => setPlanForm({ ...planForm, diet_plan: e.target.value })}
                      placeholder="E.g., Breakfast: Oatmeal & Eggs. Lunch: Chicken & Rice."
                      className="w-full bg-zinc-800 border-none rounded-xl px-4 py-4 text-white focus:ring-2 focus:ring-emerald-500 outline-none min-h-[120px] resize-y"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-5 rounded-2xl transition-all active:scale-95 shadow-xl shadow-emerald-500/20 mt-4"
                  >
                    Lock In Plan
                  </button>
                </form>
              </div>
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
