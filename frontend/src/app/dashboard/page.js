'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Sparkles, LogOut, Activity, MessageSquare, Plus, Clock, 
  Calendar, Heart, ChevronRight, Gift, Stethoscope, Globe, 
  ArrowRight, User, CheckCircle, MapPin, Users 
} from 'lucide-react';
import { useCompatibility, calculateAge } from '../../contexts/CompatibilityContext';
import styles from '../page.module.css';

export default function DashboardPage() {
  const router = useRouter();
  const { 
    user, 
    runsUsed, 
    chatsUsed, 
    isUpgradingQuota, 
    matchesList, 
    isMatchesLoading, 
    fetchRecentMatches, 
    restoreMatchSession,
    handleResetQuota, 
    handleLogout,
    chronicResult,
    mfrResult,
    setOnboardingStep,
    setOnboardingForm
  } = useCompatibility();

  const cn = (...classes) => classes.filter(Boolean).join(' ');

  // Auth / Onboarding Redirect Guard
  useEffect(() => {
    const savedUser = localStorage.getItem('slayhealth_user');
    if (!savedUser) {
      router.push('/');
    } else {
      const parsed = JSON.parse(savedUser);
      if (!parsed.name || !parsed.gender || !parsed.activity_level) {
        setOnboardingStep(1);
        router.push('/onboarding');
      } else {
        fetchRecentMatches(parsed.id);
      }
    }
  }, [router, setOnboardingStep]);

  if (!user) return null;

  return (
    <main className={styles.container} style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Portal Header */}
      <header className={styles.portalHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={24} style={{ color: '#28c79a' }} />
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#2b2b3f', margin: 0 }}>SlayHealth Premarital Portal</h1>
        </div>
        
        <div className={styles.userInfoBadge}>
          <div className={styles.userAvatar}>
            {user.name ? user.name[0].toUpperCase() : 'U'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#2b2b3f' }}>{user.name || 'User Profile'}</span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>{user.phone_number}</span>
          </div>
          <button className={styles.logoutBtn} onClick={() => { handleLogout(); router.push('/'); }}>
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </header>

      {/* Free Tier Quota Panel */}
      <section className={styles.quotaWidget}>
        <div className={styles.quotaText}>
          <h3 className={styles.quotaTitle}>Free Plan Active</h3>
          <p className={styles.quotaSubtitle}>Enrolled by default. Experience our clinical match matrix and counselor chat.</p>
        </div>

        <div className={styles.quotaBadgesList}>
          <span className={styles.quotaLimitBadge}>
            <Activity size={14} style={{ color: '#28c79a' }} />
            Match scan left: <strong>{Math.max(0, 1 - runsUsed)}/1</strong>
          </span>
          <span className={styles.quotaLimitBadge}>
            <MessageSquare size={14} style={{ color: '#d94386' }} />
            Counselor chat left: <strong>{Math.max(0, 5 - chatsUsed)}/5</strong>
          </span>
          
          {(runsUsed > 0 || chatsUsed > 0) && (
            <button 
              className={styles.upgradeTextBtn} 
              onClick={handleResetQuota}
              disabled={isUpgradingQuota}
            >
              {isUpgradingQuota ? 'Resetting...' : 'Reset Quota / Demo Premium'}
            </button>
          )}
        </div>
      </section>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6 mt-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Free Matches Banner */}
          <div className="bg-gradient-to-br from-[#DE457D] to-teal-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-3 left-3 bg-white/20 text-white text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1">
              <Gift className="w-3 h-3" />
              Free Plan
            </div>
            <div className="pt-6">
              <h2 className="text-4xl font-bold mb-1">
                {Math.max(0, 1 - runsUsed)} Matches
              </h2>
              <p className="text-white/80 mb-6">Available for free analysis</p>
              <button
                onClick={() => router.push('/add-prospect')}
                className="bg-white text-[#DE457D] px-6 py-3 rounded-xl font-semibold hover:bg-white/90 transition-all flex items-center gap-2 shadow-md hover:scale-[1.02]"
              >
                <Plus className="w-5 h-5" />
                New Compatibility Check
              </button>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#DE457D]" />
                Recent Activity
              </h3>
            </div>

            {isMatchesLoading ? (
              <div className="p-8 text-center text-slate-500">
                Loading matches list...
              </div>
            ) : matchesList.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {matchesList.map((match) => (
                  <div
                    key={match.id}
                    className="p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => {
                      restoreMatchSession(match);
                      router.push('/core-engine/chronic');
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                        <span className="text-white font-bold text-sm">{match.score || 85}%</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate">
                          {match.user?.name || user.name} & {match.prospect?.name || 'Prospect'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(match.createdAt).toLocaleDateString()}
                          </span>
                          {match.prospect?.meetingSource && (
                            <span className="flex items-center gap-1 text-xs text-slate-600">
                              <span className="text-slate-300">•</span>
                              <Heart className="w-3 h-3 text-pink-500" />
                              {match.prospect.meetingSource}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-600 mb-4">No compatibility checks yet</p>
                <button
                  onClick={() => router.push('/add-prospect')}
                  className="text-[#DE457D] font-medium hover:underline"
                >
                  Start your first check →
                </button>
              </div>
            )}
          </div>

          {/* Service Banners */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Premium Services</h3>
            <div className="grid sm:grid-cols-2 gap-4 text-left">
              {[
                {
                  id: 'diagnostics',
                  title: 'Controlled Diagnostic Reports',
                  description: "Don't rely on uncertain reports. Get verified results from NABL-certified partner labs.",
                  subtext: 'Accurate, controlled testing that protects your decisions.',
                  price: '₹2,500',
                  icon: <Stethoscope className="w-5 h-5 text-blue-500" />,
                  gradient: 'from-blue-50 to-cyan-50 border-blue-100'
                },
                {
                  id: 'counselling',
                  title: 'Pre-Marital Health Counselling',
                  description: 'Talk to real doctors, not the internet. Get personalised pre-marital guidance from certified specialists.',
                  subtext: 'Expert advice for your journey ahead.',
                  price: 'Free Trial',
                  icon: <MessageSquare className="w-5 h-5 text-purple-500" />,
                  gradient: 'from-purple-50 to-pink-50 border-purple-100'
                },
                {
                  id: 'concierge-domestic',
                  title: 'Concierge (Domestic)',
                  description: "Exclusive concierge care for India's high-intent couples.",
                  subtext: 'At-home testing, curated doctors, and a private health manager for complete clarity.',
                  price: '₹50,000',
                  icon: <Sparkles className="w-5 h-5 text-amber-500" />,
                  gradient: 'from-amber-50 to-orange-50 border-amber-100'
                },
                {
                  id: 'concierge-nri',
                  title: 'Concierge (NRIs)',
                  description: 'Your cross-border pre-marital health concierge anywhere in the world.',
                  subtext: 'International testing, global specialists, and seamless logistics.',
                  price: '₹1,25,000',
                  icon: <Globe className="w-5 h-5 text-emerald-500" />,
                  gradient: 'from-emerald-50 to-teal-50 border-emerald-100'
                }
              ].map((service) => (
                <div
                  key={service.id}
                  className={cn(
                    "bg-white border rounded-2xl p-5 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between",
                    service.gradient
                  )}
                >
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center mb-3 shadow-sm group-hover:scale-105 transition-transform">
                      {service.icon}
                    </div>
                    <h4 className="font-bold text-slate-900 mb-1">{service.title}</h4>
                    <p className="text-xs text-slate-600 mb-2 leading-relaxed">{service.description}</p>
                    <p className="text-[10px] text-slate-500 mb-3">{service.subtext}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100/50">
                    <span className="text-xs font-semibold text-slate-900">
                      {service.price}
                    </span>
                    <button className="text-[#DE457D] text-xs font-medium flex items-center gap-1 hover:underline">
                      Learn more <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Profile Summary & Quick Actions */}
        <div className="space-y-6 text-left">
          {/* User Profile Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-[#DE457D] to-teal-400 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-md">
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">{user.name || 'User'}</h3>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  Profile Verified
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-3 text-xs">
                <User className="w-4 h-4 text-slate-400" />
                <span className="text-slate-500">Age:</span>
                <span className="font-semibold text-slate-900 ml-auto">{calculateAge(user.dob)} years</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <Heart className="w-4 h-4 text-slate-400" />
                <span className="text-slate-500">Gender:</span>
                <span className="font-semibold text-slate-900 ml-auto capitalize">{user.gender || '--'}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="text-slate-500">City:</span>
                <span className="font-semibold text-slate-900 ml-auto capitalize">{user.city || '--'}</span>
              </div>
              {user.userRelation !== 'Self' && (
                <div className="flex items-center gap-3 text-xs pt-2 border-t border-slate-100">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">Filled by:</span>
                  <span className="font-semibold text-slate-900 ml-auto">{user.userName || user.name} ({user.userRelation})</span>
                </div>
              )}
            </div>
            <button 
              onClick={() => {
                setOnboardingStep(1);
                setOnboardingForm({
                  userName: user.userName || user.name || '',
                  userRelation: user.userRelation || 'Self',
                  candidateName: user.candidateName || user.name || '',
                  candidateGender: user.gender || '',
                  candidateDob: user.dob || '',
                  candidateCity: user.city || '',
                  relationshipStatus: user.relationshipStatus || 'Single',
                  marriageTimeline: user.marriageTimeline || 'Not sure yet',
                  activity_level: user.activity_level || '',
                  daily_steps: user.daily_steps || '',
                  occupation_style: user.occupation_style || '',
                  drinking_habits: user.drinking_habits || '',
                  smoking_habits: user.smoking_habits || '',
                  tobacco_habits: user.tobacco_habits || '',
                  sleep_cycle: user.sleep_cycle || '',
                  height: user.height || '',
                  weight: user.weight || '',
                  waist: user.waist || '',
                  menstrualCycle: user.menstrualCycle || ''
                });
                router.push('/onboarding');
              }}
              className="w-full mt-4 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-medium transition-all text-xs"
            >
              Edit Profile
            </button>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-900 mb-4 text-sm">Quick Actions</h3>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/add-prospect')}
                className="w-full bg-[#DE457D] hover:bg-[#c93d6f] text-white py-3 rounded-xl font-semibold transition-all hover:scale-[1.02] flex items-center justify-center gap-2 text-sm shadow-sm"
              >
                <Plus className="w-5 h-5" />
                New Compatibility Check
              </button>
              {chronicResult && mfrResult && (
                <button
                  onClick={() => router.push('/core-engine/chronic')}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-sm"
                >
                  View Active Reports
                </button>
              )}
            </div>
          </div>

          {/* Support Card */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-md">
            <h3 className="font-bold mb-2 text-sm">Need Help?</h3>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Our medical team is here to assist you with any questions about your health compatibility journey.
            </p>
            <button className="bg-white/10 hover:bg-white/20 text-white py-2 px-4 rounded-lg text-xs font-medium transition-all">
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
