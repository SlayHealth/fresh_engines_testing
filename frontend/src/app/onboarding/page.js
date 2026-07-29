'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCompatibility } from '../../contexts/CompatibilityContext';
import { API_URL } from '../../config/api';
import { apiFetch } from '../../utils/api';
import { toast } from '../../components/Toast';
import QuestionScreen from '../../components/wizard/QuestionScreen';
// Onboarding now collects only the account holder's name. Relation to the person
// getting married, the marriage timeline, and relationship status moved into the
// "New Compatibility Check" flow (add-prospect), where they have an actual
// referent — a specific candidate/couple — rather than being asked up front.

const fieldInputClass = 'w-full p-4 border rounded-xl text-base';
const fieldInputStyle = { borderColor: 'var(--line)', color: 'var(--ink)', background: 'var(--surface)' };

export default function OnboardingPage() {
  const router = useRouter();
  const {
    user, setUser,
    onboardingStep, setOnboardingStep,
    onboardingForm, setOnboardingForm,
    fetchRecentMatches
  } = useCompatibility();

  const [isOnboardingSaving, setIsOnboardingSaving] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Redirect if user is not authenticated, or already has a name
  useEffect(() => {
    const savedUser = localStorage.getItem('slayhealth_user');
    if (!savedUser) {
      router.push('/');
    } else if (onboardingStep === 0) {
      const parsed = JSON.parse(savedUser);
      if (parsed.name) {
        router.push('/dashboard');
      } else {
        setOnboardingStep(1);
      }
    }
  }, [onboardingStep, router, setOnboardingStep]);

  const goNext = () => setStepIndex((i) => i + 1);
  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));

  const finishOnboarding = async () => {
    if (!onboardingForm.userName || !onboardingForm.userName.trim()) return;

    setIsOnboardingSaving(true);
    try {
      const res = await apiFetch(`${API_URL}/api/auth/profile`, {
        method: 'POST',
        body: JSON.stringify({ id: user.id, name: onboardingForm.userName.trim() })
      });
      const data = await res.json();
      if (data.success) {
        const extendedUser = {
          ...user,
          ...data.user,
          userRelation: onboardingForm.userRelation,
          marriageTimeline: onboardingForm.marriageTimeline
        };
        localStorage.setItem('slayhealth_user', JSON.stringify(extendedUser));
        setUser(extendedUser);
        setOnboardingStep(0);
        fetchRecentMatches(extendedUser.id);
        router.push('/dashboard');
      } else {
        throw new Error(data.error || 'Failed to save your details');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsOnboardingSaving(false);
    }
  };

  if (onboardingStep === 0 || !user) return null;

  const steps = [
    {
      title: "What's your name?",
      canAdvance: !!(onboardingForm.userName && onboardingForm.userName.trim()),
      content: (
        <input
          type="text"
          value={onboardingForm.userName || ''}
          onChange={(e) => setOnboardingForm({ ...onboardingForm, userName: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
          placeholder="Enter your name"
          autoFocus
          className={fieldInputClass}
          style={fieldInputStyle}
        />
      )
    }
  ];

  const clampedIndex = Math.max(0, Math.min(stepIndex, steps.length - 1));
  const currentStep = steps[clampedIndex];
  const isLast = clampedIndex === steps.length - 1;

  return (
    <main className="h-dvh overflow-hidden flex flex-col wizard-bg">
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 py-5 overflow-hidden">
        <QuestionScreen
          key={clampedIndex}
          stepIndex={clampedIndex}
          totalSteps={steps.length}
          title={currentStep.title}
          onBack={clampedIndex > 0 ? goBack : undefined}
          onNext={isLast ? finishOnboarding : goNext}
          nextLabel={isLast ? (isOnboardingSaving ? 'Saving…' : "Let's go") : 'Next'}
          nextDisabled={currentStep.canAdvance === false || (isLast && isOnboardingSaving)}
        >
          {currentStep.content}
        </QuestionScreen>
      </div>
    </main>
  );
}
